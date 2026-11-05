import { SqliteReviewRepository } from "../db/repositories/sqlite-review-repository";
import { SqliteTimeRepository } from "../db/repositories/sqlite-time-repository";
import { SqliteProjectRepository } from "../db/repositories/sqlite-project-repository";
import { SqliteTodayRepository } from "../db/repositories/sqlite-today-repository";
import { SqlitePracticeRepository } from "../db/repositories/sqlite-practice-repository";
import { calendarDay } from "./task-rules";
import { addDays, reminderFromLocal } from "./planner-rules";
import { ruleFor, isHabitPaused, habitDay } from "./habit-rules";
import { actualSeconds } from "../features/time/duration";
import { reviewPeriod } from "./review-rules";
import {
  resetSteps,
  type ReviewMode,
  type ResetCommand,
} from "../types/review";
import type { User } from "../types/user";
export class ReviewService {
  constructor(
    private repo: SqliteReviewRepository,
    private clock: () => Date = () => new Date(),
  ) {}
  read(
    user: User,
    mode: ReviewMode = "week",
    day = calendarDay(this.clock(), user.timezone),
    runId?: string,
  ) {
    const saved = runId ? this.repo.run(user.id, runId) : null;
    if (saved) {
      mode = saved.kind === "weekly" ? "week" : "month";
      day = saved.period_start;
    }
    const now = this.clock().toISOString(),
      today = calendarDay(this.clock(), user.timezone),
      calculated = reviewPeriod(mode, day, user.week_start),
      period = saved
        ? {
            ...calculated,
            from: saved.period_start,
            to: saved.period_end,
            next: addDays(saved.period_end, 1),
            previous:
              mode === "week"
                ? addDays(saved.period_start, -7)
                : calculated.previous,
          }
        : calculated,
      from = reminderFromLocal(period.from + "T00:00", user.timezone)!,
      to = reminderFromLocal(addDays(period.to, 1) + "T00:00", user.timezone)!,
      comparisonFrom = reminderFromLocal(
        addDays(period.from, -28) + "T00:00",
        user.timezone,
      )!,
      tr = new SqliteTimeRepository(this.repo.db),
      sessions = tr.range(user.id, comparisonFrom, to),
      pauses = tr.pauses(sessions.map((s) => s.id)),
      areas = this.repo.areas(user.id),
      projects = new SqliteProjectRepository(this.repo.db).list(user.id),
      tasks = this.repo.tasks(user.id),
      agg = new SqliteTodayRepository(this.repo.db),
      lastTimes = this.repo.lastTimes(user.id, now),
      taskAgg = agg.taskAggregates(
        user.id,
        projects.map((p) => p.id),
      ),
      milestones = agg.milestoneAggregates(
        user.id,
        projects
          .filter((p) => p.progress_mode === "milestones")
          .map((p) => p.id),
      );
    const measured = sessions.map((s) => ({
        ...s,
        seconds: actualSeconds(
          s,
          pauses.filter((p) => p.session_id === s.id),
          now,
          from,
          to,
        ),
        previous: actualSeconds(
          s,
          pauses.filter((p) => p.session_id === s.id),
          now,
          comparisonFrom,
          from,
        ),
      })),
      total = measured.reduce((n, s) => n + s.seconds, 0),
      byArea = [
        ...areas.map((a) => ({ id: a.id, title: a.name })),
        { id: null, title: "Non affecté" },
      ]
        .map((a) => ({
          ...a,
          seconds: measured
            .filter((s) => s.life_area_id === a.id)
            .reduce((n, s) => n + s.seconds, 0),
          previousWeekly:
            measured
              .filter((s) => s.life_area_id === a.id)
              .reduce((n, s) => n + s.previous, 0) / 4,
        }))
        .filter((a) => a.seconds > 0 || a.previousWeekly > 0);
    const comparisons = new Map<
      string,
      { title: string; planned: number; actual: number }
    >();
    for (const s of measured) {
      if (
        s.seconds <= 0 ||
        !s.planner_id ||
        !s.occurrence_key ||
        s.planned_minutes == null
      )
        continue;
      const key = s.planner_id + ":" + s.occurrence_key;
      const old = comparisons.get(key);
      comparisons.set(key, {
        title: s.title,
        planned: old?.planned ?? s.planned_minutes * 60,
        actual: (old?.actual ?? 0) + s.seconds,
      });
    }
    const open = tasks.filter((t) => !t.archived_at && t.status !== "done"),
      counts = {
        created: tasks.filter((t) => t.created_at >= from && t.created_at < to)
          .length,
        completed: tasks.filter(
          (t) =>
            t.completed_at && t.completed_at >= from && t.completed_at < to,
        ).length,
        waiting: open.filter((t) => t.status === "waiting").length,
        inbox: open.filter((t) => t.status === "inbox").length,
        overdue: open.filter(
          (t) => t.status !== "someday" && t.deadline && t.deadline < today,
        ).length,
      };
    const projectStats = projects.map((p) => {
      const a =
          p.progress_mode === "milestones"
            ? milestones.find((a) => a.project_id === p.id)
            : taskAgg.find((a) => a.project_id === p.id),
        linked = tasks.filter((t) => t.project_id === p.id),
        times = measured.filter((s) => s.project_id === p.id),
        last = [
          p.created_at,
          p.updated_at,
          ...linked.map((t) => t.updated_at),
          lastTimes.find((t) => t.project_id === p.id)?.last ?? p.created_at,
        ]
          .sort()
          .at(-1)!;
      return {
        ...p,
        seconds: times.reduce((n, s) => n + s.seconds, 0),
        taskCount: taskAgg.find((a) => a.project_id === p.id)?.total ?? 0,
        doneCount: taskAgg.find((a) => a.project_id === p.id)?.done ?? 0,
        progress:
          p.progress_mode === "none"
            ? null
            : p.progress_mode === "manual"
              ? p.manual_progress
              : a?.total
                ? Math.round((a.done / a.total) * 100)
                : null,
        lastActivity: last,
        inactive:
          p.status === "active" &&
          last <
            reminderFromLocal(addDays(today, -28) + "T00:00", user.timezone)!,
      };
    });
    const pr = new SqlitePracticeRepository(this.repo.db),
      habits = [...pr.habits(user.id), ...pr.habits(user.id, true)],
      ids = habits.map((h) => h.id),
      rules = pr.rules(ids),
      entries = pr.entries(ids, period.from, period.to),
      hp = pr.pauses(ids),
      bounds = new Map<string, { start: string; end: string }>();
    for (let d = period.from; d <= period.to && d <= today; d = addDays(d, 1))
      bounds.set(d, {
        start: reminderFromLocal(d + "T00:00", user.timezone)!,
        end: reminderFromLocal(addDays(d, 1) + "T00:00", user.timezone)!,
      });
    const habitStats = habits
      .map((h) => {
        const hr = rules.filter((r) => r.habit_id === h.id),
          history = [...bounds].map(([d, b]) =>
            habitDay(
              d,
              today,
              ruleFor(hr, d),
              entries.find((e) => e.habit_id === h.id && e.day === d),
              isHabitPaused(
                hp.filter((p) => p.habit_id === h.id),
                d,
              ),
              sessions
                .filter((s) => s.habit_id === h.id && s.status === "completed")
                .reduce(
                  (n, s) =>
                    n +
                    actualSeconds(
                      s,
                      pauses.filter((p) => p.session_id === s.id),
                      now,
                      b.start,
                      b.end,
                    ) /
                      60,
                  0,
                ),
            ),
          );
        return {
          id: h.id,
          title: h.title,
          archived: !!h.archived,
          done: history.filter((d) => d.state === "done").length,
          skip: history.filter((d) => d.state === "skip").length,
          missed: history.filter((d) => d.state === "missed").length,
          paused: history.filter((d) => d.state === "paused").length,
          frequency: ruleFor(hr, period.to)?.frequency ?? null,
          quota: ruleFor(hr, period.to)?.quota ?? null,
        };
      })
      .filter((h) => h.frequency !== null);
    return {
      mode,
      period,
      today,
      timezone: user.timezone,
      total,
      byArea,
      projects: projectStats,
      comparisons: [...comparisons.values()],
      counts,
      habits: habitStats,
      timeTargets: measured
        .filter((s) => s.seconds > 0 && s.target_minutes != null)
        .map((s) => ({
          id: s.id,
          title: s.title,
          target: s.target_minutes!,
          seconds: s.seconds,
        })),
      inbox: open.filter((t) => t.status === "inbox").slice(0, 30),
      overdue: open
        .filter(
          (t) => t.status !== "someday" && t.deadline && t.deadline < today,
        )
        .slice(0, 30),
      waiting: open.filter((t) => t.status === "waiting").slice(0, 30),
      goals: this.repo.goals(user.id),
      areas,
      runs: this.repo.runs(user.id),
      run: runId ? this.repo.run(user.id, runId) : null,
    };
  }
  execute(user: User, c: ResetCommand) {
    return this.repo.transaction(() => {
      const now = this.clock().toISOString();
      if (c.kind === "start") {
        const p = reviewPeriod(c.mode, c.day, user.week_start);
        if (p.from > calendarDay(this.clock(), user.timezone))
          throw new Error(
            "Le bilan d’une période future n’est pas encore disponible.",
          );
        const kind = c.mode === "week" ? "weekly" : "monthly";
        return this.repo.start(
          user.id,
          kind,
          p.from,
          p.to,
          resetSteps[kind].length,
          now,
        );
      }
      const r = this.repo.run(user.id, c.id);
      if (r.revision !== c.revision)
        throw new Error(
          "Ce Reset a changé dans un autre onglet. Actualisez avant de réessayer.",
        );
      switch (c.kind) {
        case "move":
          if (![-1, 1].includes(c.direction))
            throw new Error("Direction invalide.");
          r.cursor = Math.max(
            0,
            Math.min(r.steps.length - 1, r.cursor + c.direction),
          );
          break;
        case "step":
          if (!["done", "skip"].includes(c.status))
            throw new Error("État invalide.");
          r.steps[r.cursor] = c.status;
          if (r.steps.every(Boolean)) r.completed_at ??= now;
          else r.cursor = Math.min(r.steps.length - 1, r.cursor + 1);
          break;
        case "priorities":
          if (
            !Array.isArray(c.values) ||
            c.values.length > 3 ||
            c.values.some(
              (v) => typeof v !== "string" || !v.trim() || v.length > 300,
            )
          )
            throw new Error(
              "Choisissez au maximum 3 priorités, de 300 caractères chacune.",
            );
          r.priorities = c.values.map((v) => v.trim());
          break;
        case "note":
          if (typeof c.text !== "string" || c.text.length > 10000)
            throw new Error("Note trop longue.");
          r.notes[String(r.cursor)] = c.text;
          break;
        default:
          throw new Error("Commande invalide.");
      }
      this.repo.save(r, now);
      return r.id;
    });
  }
}
