import type { SqlitePracticeRepository } from "../db/repositories/sqlite-practice-repository";
import { SqliteTimeRepository } from "../db/repositories/sqlite-time-repository";
import { TimeService } from "./time-service";
import type { TaskService } from "./task-service";
import { taskDate, calendarDay } from "./task-rules";
import { addDays, reminderFromLocal } from "./planner-rules";
import {
  ruleFor,
  isHabitPaused,
  habitDay,
  habitPeriod,
  habitDue,
} from "./habit-rules";
import { actualSeconds } from "../features/time/duration";
import type { User } from "../types/user";
import type {
  PracticeCommand,
  HabitSummary,
  HabitInput,
  StepInput,
  TrackerInput,
} from "../types/practices";
const weekDays = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
const name = (v: string) => {
  if (typeof v !== "string" || !v.trim() || v.length > 300)
    throw new Error("Titre requis (300 caractères maximum).");
  return v.trim();
};
const noteText = (v: string | undefined) => {
  if (v !== undefined && (typeof v !== "string" || v.length > 10000))
    throw new Error("Note trop longue.");
  return v ?? "";
};
export class PracticeService {
  constructor(
    private repo: SqlitePracticeRepository,
    private tasks: TaskService,
    private clock: () => Date = () => new Date(),
  ) {}
  today(user: User) {
    return calendarDay(this.clock(), user.timezone);
  }
  habits(user: User, day = this.today(user), archived = false): HabitSummary[] {
    if (!taskDate(day)) throw new Error("Date requise.");
    const habits = this.repo.habits(user.id, archived);
    if (!habits.length) return [];
    const ids = habits.map((h) => h.id),
      rules = this.repo.rules(ids),
      from = addDays(day, -34),
      to = addDays(day, 31),
      entries = this.repo.entries(
        ids,
        from,
        to < this.today(user) ? to : this.today(user),
      ),
      pauses = this.repo.pauses(ids),
      time = new SqliteTimeRepository(this.repo.db),
      sessions = time
        .habitRange(
          user.id,
          reminderFromLocal(from + "T00:00", user.timezone)!,
          reminderFromLocal(
            addDays(to < this.today(user) ? to : this.today(user), 1) +
              "T00:00",
            user.timezone,
          )!,
        )
        .filter(
          (s) =>
            s.status === "completed" && s.habit_id && ids.includes(s.habit_id),
        ),
      timePauses = time.pauses(sessions.map((s) => s.id)),
      today = this.today(user),
      now = this.clock().toISOString();
    const bounds = new Map<string, { start: string; end: string }>();
    for (let d = from; d <= to; d = addDays(d, 1))
      bounds.set(d, {
        start: reminderFromLocal(d + "T00:00", user.timezone)!,
        end: reminderFromLocal(addDays(d, 1) + "T00:00", user.timezone)!,
      });
    return habits.flatMap((h) => {
      const hr = rules.filter((r) => r.habit_id === h.id),
        r = ruleFor(hr, day);
      if (!r) return [];
      const hp = pauses.filter((p) => p.habit_id === h.id),
        he = entries.filter((e) => e.habit_id === h.id),
        hs = sessions.filter((s) => s.habit_id === h.id),
        days = new Map<string, ReturnType<typeof habitDay>>();
      for (let d = from; d <= to; d = addDays(d, 1)) {
        const { start, end } = bounds.get(d)!;
        const timer = hs.reduce(
          (n, s) =>
            n +
            actualSeconds(
              s,
              timePauses.filter((p) => p.session_id === s.id),
              now,
              start,
              end,
            ) /
              60,
          0,
        );
        days.set(
          d,
          habitDay(
            d,
            today,
            ruleFor(hr, d),
            he.find((e) => e.day === d),
            isHabitPaused(hp, d),
            timer,
          ),
        );
      }
      const period = habitPeriod(r, day, weekDays.indexOf(user.week_start)),
        pd = [...days.values()].filter(
          (d) => d.day >= period.from && d.day <= period.to,
        ),
        eligible = pd.filter((d) => {
          const rule = ruleFor(hr, d.day);
          return rule && !isHabitPaused(hp, d.day) && habitDue(rule, d.day);
        }).length,
        completed = pd.filter((d) => d.state === "done").length,
        target = ["weekly", "monthly"].includes(r.frequency)
          ? Math.min(r.quota, eligible)
          : 1;
      return [
        {
          habit: h,
          rule: r,
          day: days.get(day)!,
          period: {
            ...period,
            completed,
            target,
            state:
              eligible === 0
                ? "paused"
                : completed >= target
                  ? "done"
                  : period.to < today
                    ? "missed"
                    : "progress",
          },
          history: [...days.values()].filter(
            (d) => d.day <= day && d.day >= addDays(day, -13),
          ),
          paused: isHabitPaused(hp, today),
        },
      ];
    });
  }
  todaySummary(user: User) {
    return {
      habits: this.habits(user)
        .filter(
          (h) => !h.paused && h.day.state !== "off" && h.day.state !== "paused",
        )
        .slice(0, 5),
      routines: this.repo.routines(user.id).slice(0, 3),
    };
  }
  read(
    user: User,
    day = this.today(user),
    archived = false,
    routineId?: string,
    runId?: string,
  ) {
    taskDate(day);
    const trackers = this.repo.trackers(user.id, archived);
    return {
      day,
      today: this.today(user),
      habits: this.habits(user, day, archived),
      trackers,
      entries: this.repo.trackerEntries(
        trackers.map((t) => t.id),
        addDays(day, -89),
        day,
      ),
      routines: this.repo.routines(user.id, archived),
      runs: this.repo.runs(user.id),
      routine: routineId ? this.repo.routine(user.id, routineId) : null,
      steps: routineId ? this.repo.steps(routineId) : [],
      run: runId ? this.repo.run(user.id, runId) : null,
      runSteps: runId ? this.repo.runSteps(runId) : [],
      areas: this.repo.db
        .query<
          { id: string; name: string },
          [string]
        >("SELECT id,name FROM life_areas WHERE user_id=? AND is_archived=0 ORDER BY position")
        .all(user.id),
      tasks: this.repo.db
        .query<
          { id: string; title: string },
          [string]
        >("SELECT id,title FROM tasks WHERE user_id=? AND archived_at IS NULL ORDER BY created_at DESC LIMIT 200")
        .all(user.id),
    };
  }
  execute(user: User, c: PracticeCommand): string {
    return this.repo.transaction(() => {
      const today = this.today(user),
        now = this.clock().toISOString();
      switch (c.kind) {
        case "habit-save": {
          const v = this.habitValues(c.values);
          if (c.id) {
            const old = this.repo.habit(user.id, c.id);
            if (old.life_area_id !== v.life_area_id)
              throw new Error(
                "Le domaine historique de cette Habit est conservé.",
              );
          }
          if (v.start_day > today)
            throw new Error("La date de début ne peut pas être future.");
          return this.repo.saveHabit(
            user.id,
            c.id,
            v,
            c.id ? today : v.start_day,
            now,
          );
        }
        case "habit-log": {
          this.repo.habit(user.id, c.id);
          const day = taskDate(c.day);
          if (!day) throw new Error("Date requise.");
          if (day > today)
            throw new Error("Impossible de renseigner le futur.");
          const r = ruleFor(this.repo.rules([c.id]), day);
          if (!r) throw new Error("La Habit n’existait pas à cette date.");
          if (
            !["done", "skip", "missed", "progress"].includes(c.status) ||
            !Number.isFinite(c.value) ||
            c.value < 0 ||
            c.value > 1000000000
          )
            throw new Error("Entrée invalide.");
          const status =
            c.status === "done" && c.value < r.target ? "progress" : c.status;
          this.repo.log(
            c.id,
            day,
            status,
            ["skip", "missed"].includes(status) ? 0 : c.value,
            c.note === undefined
              ? (this.repo.entries([c.id], day, day)[0]?.note ?? "")
              : noteText(c.note),
            now,
          );
          return c.id;
        }
        case "habit-pause":
          this.repo.habit(user.id, c.id);
          this.repo.pause(c.id, today, c.paused);
          return c.id;
        case "archive": {
          if (c.type === "habit") this.repo.habit(user.id, c.id);
          else if (c.type === "routine") this.repo.routine(user.id, c.id);
          else if (c.type === "tracker") this.repo.tracker(user.id, c.id);
          else throw new Error("Type invalide.");
          this.repo.archive(user.id, c.type, c.id, c.archived);
          return c.id;
        }
        case "routine-save":
          if (c.id) this.repo.routine(user.id, c.id);
          return this.repo.saveRoutine(user.id, c.id, name(c.title), now);
        case "step-save": {
          this.repo.routine(user.id, c.routineId);
          if (c.id && !this.repo.steps(c.routineId).some((s) => s.id === c.id))
            throw new Error("Étape introuvable.");
          return this.repo.saveStep(
            c.routineId,
            c.id,
            this.stepValues(user, c.values),
          );
        }
        case "step-remove":
        case "step-move": {
          this.repo.routine(user.id, c.routineId);
          const steps = this.repo.steps(c.routineId),
            at = steps.findIndex((s) => s.id === c.id);
          if (at < 0) throw new Error("Étape introuvable.");
          if (c.kind === "step-remove") this.repo.removeStep(c.id);
          else {
            if (![-1, 1].includes(c.direction))
              throw new Error("Direction invalide.");
            const to = at + c.direction;
            if (to >= 0 && to < steps.length) {
              [steps[at], steps[to]] = [steps[to], steps[at]];
              this.repo.reorderSteps(steps.map((s) => s.id));
            }
          }
          return c.routineId;
        }
        case "run-start": {
          const r = this.repo.routine(user.id, c.routineId),
            steps = this.repo.steps(r.id);
          if (r.archived || !steps.length)
            throw new Error("Ajoutez une étape à une routine active.");
          return this.repo.startRun(user.id, r, steps, now);
        }
        case "run-move": {
          const run = this.repo.run(user.id, c.id);
          if (![-1, 1].includes(c.direction))
            throw new Error("Direction invalide.");
          const steps = this.repo.runSteps(run.id);
          this.repo.moveRun(
            run.id,
            Math.max(
              0,
              Math.min(steps.length - 1, run.current_step + c.direction),
            ),
          );
          return run.id;
        }
        case "run-check":
        case "run-step": {
          const run = this.repo.run(user.id, c.id),
            steps = this.repo.runSteps(run.id),
            step = steps.find((s) => s.id === c.stepId);
          if (!step || run.status !== "running")
            throw new Error("Étape active introuvable.");
          if (c.kind === "run-check") {
            if (
              step.kind !== "checklist" ||
              !Number.isInteger(c.index) ||
              c.index < 0 ||
              c.index >= step.checks.length
            )
              throw new Error("Checklist invalide.");
            step.checks[c.index] = c.checked;
            this.repo.checkRun(step.id, step.checks);
            return run.id;
          }
          if (!["done", "skip"].includes(c.status))
            throw new Error("État invalide.");
          if (step.status !== "pending") return run.id;
          if (c.status === "done") {
            if (step.kind === "checklist" && !step.checks.every(Boolean))
              throw new Error("Complétez la checklist ou choisissez Skip.");
            if (step.task_id)
              this.tasks.changeStatus(user.id, step.task_id, "done");
            if (step.habit_id) {
              const r = ruleFor(this.repo.rules([step.habit_id]), today);
              if (!r) throw new Error("Habit indisponible.");
              const current = this.habits(user).find(
                (h) => h.habit.id === step.habit_id,
              );
              this.execute(user, {
                kind: "habit-log",
                id: step.habit_id,
                day: today,
                status: "done",
                value: Math.max(
                  (current?.day.value ?? 0) - (current?.day.timer_minutes ?? 0),
                  r.target -
                    (r.target_kind === "duration"
                      ? (current?.day.timer_minutes ?? 0)
                      : 0),
                ),
              });
            }
            if (step.kind === "timer") {
              const tr = new SqliteTimeRepository(this.repo.db),
                ts = new TimeService(tr, this.clock);
              for (const session of tr
                .unfinished(user.id)
                .filter((s) => s.routine_run_step_id === step.id))
                ts.stop(user.id, session.id);
            }
          }
          this.repo.finishStep(step.id, c.status, now);
          if (steps.every((s) => s.id === step.id || s.status !== "pending"))
            this.repo.finishRun(run.id, now);
          else
            this.repo.moveRun(
              run.id,
              Math.min(steps.length - 1, step.position + 1),
            );
          return run.id;
        }
        case "tracker-save": {
          const v = this.trackerValues(c.values);
          if (c.id) {
            const old = this.repo.tracker(user.id, c.id);
            if (
              old.kind !== v.kind ||
              old.unit !== v.unit ||
              old.scale_min !== v.scale_min ||
              old.scale_max !== v.scale_max
            )
              throw new Error(
                "Type, unité et échelle historiques sont conservés.",
              );
          }
          return this.repo.saveTracker(user.id, c.id, v, now);
        }
        case "tracker-entry": {
          const t = this.repo.tracker(user.id, c.id),
            day = taskDate(c.day);
          if (!day) throw new Error("Date requise.");
          if (day > today)
            throw new Error("Impossible de renseigner le futur.");
          if (!Number.isFinite(c.value) || Math.abs(c.value) > 1000000000)
            throw new Error("Valeur invalide.");
          if (c.increment && t.kind !== "counter")
            throw new Error("Incrément réservé aux compteurs.");
          if (
            (t.kind === "boolean" && ![0, 1].includes(c.value)) ||
            (t.kind === "scale" &&
              (c.value < t.scale_min || c.value > t.scale_max)) ||
            (["duration", "counter"].includes(t.kind) && c.value < 0)
          )
            throw new Error("Valeur hors limites.");
          this.repo.trackerEntry(
            t.id,
            day,
            c.value,
            noteText(c.note),
            now,
            !!c.increment,
          );
          return t.id;
        }
        default:
          throw new Error("Commande invalide.");
      }
    });
  }
  private habitValues(v: HabitInput): HabitInput {
    if (!taskDate(v.start_day)) throw new Error("Date requise.");
    if (
      !["days", "weekly", "monthly", "interval"].includes(v.frequency) ||
      !["count", "quantity", "duration"].includes(v.target_kind)
    )
      throw new Error("Fréquence ou cible invalide.");
    if (
      !Array.isArray(v.weekdays) ||
      v.weekdays.some((d) => !Number.isInteger(d) || d < 0 || d > 6) ||
      (v.frequency === "days" && !v.weekdays.length)
    )
      throw new Error("Choisissez des jours.");
    if (
      !Number.isInteger(v.every_days) ||
      v.every_days < 1 ||
      v.every_days > 365 ||
      !Number.isInteger(v.quota) ||
      v.quota < 1 ||
      v.quota > (v.frequency === "weekly" ? 7 : 31) ||
      !Number.isFinite(v.target) ||
      v.target <= 0 ||
      v.target > 1000000
    )
      throw new Error("Objectif invalide.");
    return {
      ...v,
      title: name(v.title),
      weekdays: [...new Set(v.weekdays)].sort(),
      target: v.target_kind === "count" ? 1 : v.target,
      unit:
        v.target_kind === "duration" ? "min" : noteText(v.unit).slice(0, 40),
    };
  }
  private stepValues(user: User, v: StepInput): StepInput {
    if (!["simple", "checklist", "task", "habit", "timer"].includes(v.kind))
      throw new Error("Type d’étape invalide.");
    if (!Array.isArray(v.checklist) || v.checklist.length > 100)
      throw new Error("Checklist invalide.");
    if (v.kind === "checklist" && !v.checklist.length)
      throw new Error("Ajoutez une ligne de checklist.");
    if (v.kind === "task") {
      if (!v.task_id) throw new Error("Task requise.");
      this.tasks.get(user.id, v.task_id);
    }
    if (v.kind === "habit") {
      if (!v.habit_id) throw new Error("Habit requise.");
      this.repo.habit(user.id, v.habit_id);
    }
    if (
      v.target_minutes != null &&
      (!Number.isInteger(v.target_minutes) ||
        v.target_minutes < 1 ||
        v.target_minutes > 10080)
    )
      throw new Error("Durée invalide.");
    return {
      ...v,
      title: name(v.title),
      checklist: v.kind === "checklist" ? v.checklist.map(name) : [],
      task_id: v.kind === "task" ? v.task_id : null,
      habit_id: v.kind === "habit" ? v.habit_id : null,
      target_minutes: v.kind === "timer" ? v.target_minutes : null,
    };
  }
  private trackerValues(v: TrackerInput): TrackerInput {
    if (
      !["number", "duration", "counter", "boolean", "scale"].includes(v.kind) ||
      !["daily", "weekly", "monthly"].includes(v.frequency) ||
      !Number.isFinite(v.scale_min) ||
      !Number.isFinite(v.scale_max) ||
      v.scale_max <= v.scale_min ||
      (v.target !== null && !Number.isFinite(v.target))
    )
      throw new Error("Tracker invalide.");
    return {
      ...v,
      title: name(v.title),
      unit: v.kind === "duration" ? "min" : noteText(v.unit).slice(0, 40),
    };
  }
}
