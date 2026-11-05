import type { Database } from "bun:sqlite";
import type {
  Habit,
  HabitRule,
  HabitInput,
  HabitEntry,
  HabitPause,
  Routine,
  RoutineStep,
  StepInput,
  RoutineRun,
  RunStep,
  Tracker,
  TrackerInput,
  TrackerEntry,
} from "../../types/practices";
const rule = (
  r: Omit<HabitRule, "weekdays"> & { weekdays: string },
): HabitRule => ({ ...r, weekdays: JSON.parse(r.weekdays) });
const step = (
  r: Omit<RoutineStep, "checklist"> & { checklist: string },
): RoutineStep => ({ ...r, checklist: JSON.parse(r.checklist) });
const runStep = (
  r: Omit<RunStep, "checklist" | "checks"> & {
    checklist: string;
    checks: string;
  },
): RunStep => ({
  ...r,
  checklist: JSON.parse(r.checklist),
  checks: JSON.parse(r.checks),
});
export class SqlitePracticeRepository {
  constructor(readonly db: Database) {}
  transaction<T>(f: () => T) {
    return this.db.transaction(f).immediate();
  }
  habit(user: string, id: string) {
    const h = this.db
      .query<
        Habit,
        [string, string]
      >("SELECT * FROM habits WHERE user_id=? AND id=?")
      .get(user, id);
    if (!h) throw new Error("Habit introuvable.");
    return h;
  }
  habits(user: string, archived = false) {
    return this.db
      .query<
        Habit,
        [string, number]
      >("SELECT * FROM habits WHERE user_id=? AND archived=? ORDER BY created_at,id")
      .all(user, +archived);
  }
  rules(ids: string[]) {
    return ids.length
      ? this.db
          .query<Omit<HabitRule, "weekdays"> & { weekdays: string }, string[]>(
            `SELECT * FROM habit_rules WHERE habit_id IN (${ids.map(() => "?").join(",")}) ORDER BY effective_from`,
          )
          .all(...ids)
          .map(rule)
      : [];
  }
  entries(ids: string[], from: string, to: string) {
    return ids.length
      ? this.db
          .query<
            HabitEntry,
            string[]
          >(`SELECT * FROM habit_entries WHERE habit_id IN (${ids.map(() => "?").join(",")}) AND day BETWEEN ? AND ?`)
          .all(...ids, from, to)
      : [];
  }
  pauses(ids: string[]) {
    return ids.length
      ? this.db
          .query<
            HabitPause,
            string[]
          >(`SELECT * FROM habit_pauses WHERE habit_id IN (${ids.map(() => "?").join(",")}) ORDER BY from_day`)
          .all(...ids)
      : [];
  }
  saveHabit(
    user: string,
    id: string | undefined,
    v: HabitInput,
    effective: string,
    now: string,
  ) {
    if (id)
      this.db
        .query(
          "UPDATE habits SET title=?,updated_at=? WHERE user_id=? AND id=?",
        )
        .run(v.title, now, user, id);
    else {
      id = crypto.randomUUID();
      this.db
        .query(
          "INSERT INTO habits(id,user_id,title,life_area_id,created_at,updated_at) VALUES(?,?,?,?,?,?)",
        )
        .run(id, user, v.title, v.life_area_id, now, now);
    }
    this.db
      .query(
        "INSERT INTO habit_rules(habit_id,effective_from,frequency,weekdays,every_days,quota,target_kind,target,unit) VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(habit_id,effective_from) DO UPDATE SET frequency=excluded.frequency,weekdays=excluded.weekdays,every_days=excluded.every_days,quota=excluded.quota,target_kind=excluded.target_kind,target=excluded.target,unit=excluded.unit",
      )
      .run(
        id,
        effective,
        v.frequency,
        JSON.stringify(v.weekdays),
        v.every_days,
        v.quota,
        v.target_kind,
        v.target,
        v.unit,
      );
    return id;
  }
  log(
    id: string,
    day: string,
    status: HabitEntry["status"],
    value: number,
    note: string,
    now: string,
  ) {
    this.db
      .query(
        "INSERT INTO habit_entries(habit_id,day,status,value,note,updated_at) VALUES(?,?,?,?,?,?) ON CONFLICT(habit_id,day) DO UPDATE SET status=excluded.status,value=excluded.value,note=excluded.note,updated_at=excluded.updated_at",
      )
      .run(id, day, status, value, note, now);
  }
  pause(id: string, day: string, paused: boolean) {
    const open = this.db
      .query<
        HabitPause,
        [string]
      >("SELECT * FROM habit_pauses WHERE habit_id=? AND to_day IS NULL")
      .get(id);
    if (paused && !open)
      this.db
        .query("INSERT INTO habit_pauses(id,habit_id,from_day) VALUES(?,?,?)")
        .run(crypto.randomUUID(), id, day);
    if (!paused && open) {
      if (open.from_day === day)
        this.db.query("DELETE FROM habit_pauses WHERE id=?").run(open.id);
      else
        this.db
          .query("UPDATE habit_pauses SET to_day=? WHERE id=?")
          .run(
            new Date(Date.parse(day + "T12:00Z") - 86400000)
              .toISOString()
              .slice(0, 10),
            open.id,
          );
    }
  }
  archive(
    user: string,
    type: "habit" | "routine" | "tracker",
    id: string,
    archived: boolean,
  ) {
    const table = { habit: "habits", routine: "routines", tracker: "trackers" }[
      type
    ];
    if (!table) throw new Error("Type invalide.");
    this.db
      .query(
        `UPDATE ${table} SET archived=?,updated_at=? WHERE user_id=? AND id=?`,
      )
      .run(+archived, new Date().toISOString(), user, id);
  }
  routine(user: string, id: string) {
    const r = this.db
      .query<
        Routine,
        [string, string]
      >("SELECT * FROM routines WHERE user_id=? AND id=?")
      .get(user, id);
    if (!r) throw new Error("Routine introuvable.");
    return r;
  }
  routines(user: string, archived = false) {
    return this.db
      .query<
        Routine,
        [string, number]
      >("SELECT * FROM routines WHERE user_id=? AND archived=? ORDER BY created_at,id")
      .all(user, +archived);
  }
  saveRoutine(
    user: string,
    id: string | undefined,
    title: string,
    now: string,
  ) {
    if (id)
      this.db
        .query(
          "UPDATE routines SET title=?,updated_at=? WHERE user_id=? AND id=?",
        )
        .run(title, now, user, id);
    else {
      id = crypto.randomUUID();
      this.db
        .query(
          "INSERT INTO routines(id,user_id,title,created_at,updated_at) VALUES(?,?,?,?,?)",
        )
        .run(id, user, title, now, now);
    }
    return id;
  }
  steps(id: string) {
    return this.db
      .query<
        Omit<RoutineStep, "checklist"> & { checklist: string },
        [string]
      >("SELECT * FROM routine_steps WHERE routine_id=? AND archived=0 ORDER BY position,id")
      .all(id)
      .map(step);
  }
  saveStep(routine: string, id: string | undefined, v: StepInput) {
    if (id)
      this.db
        .query(
          "UPDATE routine_steps SET title=?,kind=?,checklist=?,task_id=?,habit_id=?,target_minutes=? WHERE id=? AND routine_id=?",
        )
        .run(
          v.title,
          v.kind,
          JSON.stringify(v.checklist),
          v.task_id,
          v.habit_id,
          v.target_minutes,
          id,
          routine,
        );
    else {
      id = crypto.randomUUID();
      this.db
        .query(
          "INSERT INTO routine_steps(id,routine_id,title,kind,checklist,task_id,habit_id,target_minutes,position) SELECT ?,?,?,?,?,?,?,?,COALESCE(MAX(position),-1)+1 FROM routine_steps WHERE routine_id=?",
        )
        .run(
          id,
          routine,
          v.title,
          v.kind,
          JSON.stringify(v.checklist),
          v.task_id,
          v.habit_id,
          v.target_minutes,
          routine,
        );
    }
    return id;
  }
  removeStep(id: string) {
    this.db.query("UPDATE routine_steps SET archived=1 WHERE id=?").run(id);
  }
  reorderSteps(ids: string[]) {
    ids.forEach((id, i) =>
      this.db
        .query("UPDATE routine_steps SET position=? WHERE id=?")
        .run(i, id),
    );
  }
  run(user: string, id: string) {
    const r = this.db
      .query<
        RoutineRun,
        [string, string]
      >("SELECT * FROM routine_runs WHERE user_id=? AND id=?")
      .get(user, id);
    if (!r) throw new Error("Routine Run introuvouvable.");
    return r;
  }
  runs(user: string) {
    return this.db
      .query<
        RoutineRun,
        [string]
      >("SELECT * FROM routine_runs WHERE user_id=? ORDER BY status DESC,started_at DESC LIMIT 100")
      .all(user);
  }
  runSteps(id: string) {
    return this.db
      .query<
        Omit<RunStep, "checklist" | "checks"> & {
          checklist: string;
          checks: string;
        },
        [string]
      >("SELECT * FROM routine_run_steps WHERE run_id=? ORDER BY position,id")
      .all(id)
      .map(runStep);
  }
  startRun(user: string, r: Routine, steps: RoutineStep[], now: string) {
    const id = crypto.randomUUID();
    this.db
      .query(
        "INSERT INTO routine_runs(id,routine_id,user_id,title,status,started_at) VALUES(?,?,?,?,'running',?)",
      )
      .run(id, r.id, user, r.title, now);
    steps.forEach((s, i) =>
      this.db
        .query(
          "INSERT INTO routine_run_steps(id,run_id,source_step_id,title,kind,checklist,checks,task_id,habit_id,target_minutes,position) VALUES(?,?,?,?,?,?,?,?,?,?,?)",
        )
        .run(
          crypto.randomUUID(),
          id,
          s.id,
          s.title,
          s.kind,
          JSON.stringify(s.checklist),
          JSON.stringify(s.checklist.map(() => false)),
          s.task_id,
          s.habit_id,
          s.target_minutes,
          i,
        ),
    );
    return id;
  }
  moveRun(id: string, index: number) {
    this.db
      .query("UPDATE routine_runs SET current_step=? WHERE id=?")
      .run(index, id);
  }
  checkRun(stepId: string, checks: boolean[]) {
    this.db
      .query("UPDATE routine_run_steps SET checks=? WHERE id=?")
      .run(JSON.stringify(checks), stepId);
  }
  finishStep(id: string, status: "done" | "skip", now: string) {
    this.db
      .query("UPDATE routine_run_steps SET status=?,completed_at=? WHERE id=?")
      .run(status, now, id);
  }
  finishRun(id: string, now: string) {
    this.db
      .query("UPDATE routine_runs SET status='completed',ended_at=? WHERE id=?")
      .run(now, id);
  }
  tracker(user: string, id: string) {
    const t = this.db
      .query<
        Tracker,
        [string, string]
      >("SELECT * FROM trackers WHERE user_id=? AND id=?")
      .get(user, id);
    if (!t) throw new Error("Tracker introuvable.");
    return t;
  }
  trackers(user: string, archived = false) {
    return this.db
      .query<
        Tracker,
        [string, number]
      >("SELECT * FROM trackers WHERE user_id=? AND archived=? ORDER BY created_at,id")
      .all(user, +archived);
  }
  trackerEntries(ids: string[], from: string, to: string) {
    return ids.length
      ? this.db
          .query<
            TrackerEntry,
            string[]
          >(`SELECT * FROM tracker_entries WHERE tracker_id IN (${ids.map(() => "?").join(",")}) AND day BETWEEN ? AND ? ORDER BY day DESC`)
          .all(...ids, from, to)
      : [];
  }
  saveTracker(
    user: string,
    id: string | undefined,
    v: TrackerInput,
    now: string,
  ) {
    if (id)
      this.db
        .query(
          "UPDATE trackers SET title=?,target=?,frequency=?,updated_at=? WHERE user_id=? AND id=?",
        )
        .run(v.title, v.target, v.frequency, now, user, id);
    else {
      id = crypto.randomUUID();
      this.db
        .query(
          "INSERT INTO trackers(id,user_id,title,kind,unit,target,frequency,scale_min,scale_max,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)",
        )
        .run(
          id,
          user,
          v.title,
          v.kind,
          v.unit,
          v.target,
          v.frequency,
          v.scale_min,
          v.scale_max,
          now,
          now,
        );
    }
    return id;
  }
  trackerEntry(
    id: string,
    day: string,
    value: number,
    note: string,
    now: string,
    increment: boolean,
  ) {
    this.db
      .query(
        `INSERT INTO tracker_entries(tracker_id,day,value,note,updated_at) VALUES(?,?,?,?,?) ON CONFLICT(tracker_id,day) DO UPDATE SET value=${increment ? "tracker_entries.value+excluded.value" : "excluded.value"},note=excluded.note,updated_at=excluded.updated_at`,
      )
      .run(id, day, value, note, now);
  }
}
