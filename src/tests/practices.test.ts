import { beforeEach, afterEach, test, expect } from "bun:test";
import type { Database } from "bun:sqlite";
import { createTestDatabase, connectDatabase } from "../db/connection";
import { migrate, migrations } from "../db/migrate";
import { seedJade } from "../db/seed";
import { SqliteUserRepository } from "../db/repositories/sqlite-user-repository";
import { SqlitePracticeRepository } from "../db/repositories/sqlite-practice-repository";
import { SqliteTaskRepository } from "../db/repositories/sqlite-task-repository";
import { SqliteProjectRepository } from "../db/repositories/sqlite-project-repository";
import { SqliteLifeAreaRepository } from "../db/repositories/sqlite-life-area-repository";
import { SqliteMilestoneRepository } from "../db/repositories/sqlite-milestone-repository";
import { SqliteTimeRepository } from "../db/repositories/sqlite-time-repository";
import { TaskService } from "../services/task-service";
import { TimeService } from "../services/time-service";
import { PracticeService } from "../services/practice-service";
import { habitPeriod } from "../services/habit-rules";
import type { User } from "../types/user";
import type {
  HabitInput,
  TrackerInput,
  StepInput,
  PracticeCommand,
} from "../types/practices";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
let db: Database,
  r: SqlitePracticeRepository,
  s: PracticeService,
  u: User,
  tasks: TaskService,
  ts: TimeService,
  now: string;
function setup(database: Database) {
  r = new SqlitePracticeRepository(database);
  u = new SqliteUserRepository(database).getCurrent()!;
  tasks = new TaskService(
    new SqliteTaskRepository(database),
    new SqliteProjectRepository(database),
    new SqliteLifeAreaRepository(database),
    new SqliteMilestoneRepository(database),
    u.timezone,
  );
  s = new PracticeService(r, tasks, () => new Date(now));
  ts = new TimeService(new SqliteTimeRepository(database), () => new Date(now));
}
beforeEach(() => {
  db = createTestDatabase();
  migrate(db);
  seedJade(db);
  now = "2026-11-05T12:00:00.000Z";
  setup(db);
});
afterEach(() => db.close());
const exec = (c: PracticeCommand) => s.execute(u, c);
const hv: HabitInput = {
  title: "Lecture",
  life_area_id: null,
  start_day: "2026-10-01",
  frequency: "days",
  weekdays: [0, 1, 2, 3, 4, 5, 6],
  every_days: 2,
  quota: 3,
  target_kind: "count",
  target: 1,
  unit: "",
};
const tv: TrackerInput = {
  title: "Pages",
  kind: "number",
  unit: "pages",
  target: 20,
  frequency: "daily",
  scale_min: 0,
  scale_max: 10,
};
const habit = (v: Partial<HabitInput> = {}) =>
  exec({ kind: "habit-save", values: { ...hv, ...v } });
const summary = (id: string, day?: string) =>
  s.habits(u, day).find((h) => h.habit.id === id)!;
const log = (
  id: string,
  day: string,
  status: "done" | "skip" | "missed" | "progress" = "done",
  value = 1,
) => exec({ kind: "habit-log", id, day, status, value });
const advance = (minutes: number) => {
  now = new Date(Date.parse(now) + minutes * 60000).toISOString();
};
const routine = () => exec({ kind: "routine-save", title: "Morning" });
const step = (routineId: string, v: Partial<StepInput> = {}) =>
  exec({
    kind: "step-save",
    routineId,
    values: {
      title: "Étape",
      kind: "simple",
      checklist: [],
      task_id: null,
      habit_id: null,
      target_minutes: null,
      ...v,
    },
  });
const run = (routineId: string) => exec({ kind: "run-start", routineId });
test("migration 007 preserves existing notes, tasks, profile and SQLite integrity", () => {
  const old = createTestDatabase();
  migrate(old, migrations.slice(0, 6));
  seedJade(old);
  old
    .query(
      "INSERT INTO notes(id,user_id,title,body,kind,created_at,updated_at) VALUES('n',?,'Note','Texte','full',?,?)",
    )
    .run(u.id, now, now);
  const rows = old.query("SELECT * FROM notes").all();
  migrate(old);
  seedJade(old);
  expect(old.query("SELECT * FROM notes").all()).toEqual(rows);
  expect(old.query("PRAGMA foreign_key_check").all()).toEqual([]);
  expect(old.query("PRAGMA integrity_check").get()).toEqual({
    integrity_check: "ok",
  });
  old.close();
});
test("specific days distinguish off, pending and missed", () => {
  const id = habit({ weekdays: [1, 4] });
  expect(summary(id).day.state).toBe("pending");
  expect(summary(id, "2026-11-04").day.state).toBe("off");
  expect(summary(id, "2026-11-02").day.state).toBe("missed");
});
test("weekly quota shows 2/3 without false daily failures", () => {
  const id = habit({ frequency: "weekly" });
  log(id, "2026-11-02");
  log(id, "2026-11-04");
  const h = summary(id);
  expect(h.period).toMatchObject({
    from: "2026-11-02",
    to: "2026-11-08",
    completed: 2,
    target: 3,
    state: "progress",
  });
  expect(h.history.find((d) => d.day === "2026-11-03")!.state).toBe("pending");
  log(id, "2026-11-05");
  expect(summary(id).period.state).toBe("done");
});
test("closed weekly quota may be missed, Skip is neutral and not a completion", () => {
  const id = habit({ frequency: "weekly" });
  log(id, "2026-10-28", "skip", 0);
  expect(summary(id, "2026-11-01").period.state).toBe("missed");
  expect(summary(id, "2026-10-28").day.state).toBe("skip");
  expect(summary(id, "2026-11-01").period.completed).toBe(0);
});
test("monthly quota counts unique completed days and uses calendar boundaries", () => {
  const id = habit({ frequency: "monthly", quota: 4 });
  log(id, "2026-11-01");
  log(id, "2026-11-01");
  log(id, "2026-11-04");
  expect(summary(id).period).toMatchObject({
    from: "2026-11-01",
    to: "2026-11-30",
    completed: 2,
    target: 4,
  });
});
test("week start follows profile and leap February is bounded", () => {
  const id = habit({ frequency: "weekly" });
  u = { ...u, week_start: "Sunday" };
  expect(summary(id).period.from).toBe("2026-11-01");
  expect(
    habitPeriod({ ...summary(id).rule, frequency: "monthly" }, "2028-02-14", 1)
      .to,
  ).toBe("2028-02-29");
});
test("every X days stays anchored across DST", () => {
  const id = habit({
    frequency: "interval",
    start_day: "2026-10-24",
    every_days: 2,
  });
  expect(summary(id, "2026-10-25").day.state).toBe("off");
  expect(summary(id, "2026-10-26").day.state).toBe("missed");
});
test("quantity target is partial until met and explicit Missed/Skip override progress", () => {
  const id = habit({ target_kind: "quantity", target: 8, unit: "verres" });
  log(id, "2026-11-05", "done", 3);
  expect(summary(id).day.state).toBe("progress");
  log(id, "2026-11-05", "done", 8);
  expect(summary(id).day.state).toBe("done");
  log(id, "2026-11-05", "missed", 8);
  expect(summary(id).day.state).toBe("missed");
  expect(summary(id).day.value).toBe(0);
});
test("temporary pause preserves neutral history and resume activates today", () => {
  const id = habit();
  exec({ kind: "habit-pause", id, paused: true });
  expect(summary(id).day.state).toBe("paused");
  advance(2880);
  exec({ kind: "habit-pause", id, paused: false });
  const h = summary(id);
  expect(h.day.state).toBe("pending");
  expect(h.history.find((d) => d.day === "2026-11-06")!.state).toBe("paused");
  expect(r.pauses([id])[0].to_day).toBe("2026-11-06");
});
test("same day pause/resume is neutral and a fully paused week has no failure", () => {
  const id = habit({ frequency: "weekly" });
  exec({ kind: "habit-pause", id, paused: true });
  exec({ kind: "habit-pause", id, paused: false });
  expect(r.pauses([id])).toEqual([]);
  exec({ kind: "habit-pause", id, paused: true });
  advance(1440 * 10);
  expect(summary(id).period).toMatchObject({ target: 0, state: "paused" });
});
test("rule edits preserve old targets and history, archive restores without deleting", () => {
  const id = habit();
  log(id, "2026-11-04");
  exec({
    kind: "habit-save",
    id,
    values: { ...hv, target_kind: "quantity", target: 5 },
  });
  expect(summary(id, "2026-11-04").rule.target).toBe(1);
  expect(summary(id).rule.target).toBe(5);
  exec({ kind: "archive", type: "habit", id, archived: true });
  expect(s.habits(u)).toEqual([]);
  expect(
    s.habits(u, undefined, true)[0].history.find((d) => d.day === "2026-11-04")!
      .state,
  ).toBe("done");
  exec({ kind: "archive", type: "habit", id, archived: false });
  expect(summary(id)).toBeDefined();
});
test("completed Timer contributes duration once, excluding all pauses", () => {
  const id = habit({ target_kind: "duration", target: 15 });
  const session = ts.start(u.id, { source: { kind: "habit", id } });
  advance(10);
  ts.pause(u.id, session);
  advance(50);
  expect(summary(id).day.timer_minutes).toBe(0);
  ts.resume(u.id, session);
  advance(5);
  ts.stop(u.id, session);
  expect(summary(id).day).toMatchObject({
    value: 15,
    timer_minutes: 15,
    state: "done",
  });
  expect(summary(id).day.value).toBe(15);
});
test("duration Timer splits at profile midnight and survives DST fold", () => {
  const id = habit({ target_kind: "duration", target: 60 });
  now = "2026-10-24T21:30:00.000Z";
  const session = ts.start(u.id, { source: { kind: "habit", id } });
  now = "2026-10-25T02:30:00.000Z";
  ts.stop(u.id, session);
  expect(summary(id, "2026-10-24").day.timer_minutes).toBe(30);
  expect(summary(id, "2026-10-25").day.timer_minutes).toBe(270);
});
test("timer correction is reflected without duplicating a Habit entry", () => {
  const id = habit({ target_kind: "duration", target: 20 });
  const session = ts.start(u.id, { source: { kind: "habit", id } });
  advance(30);
  ts.stop(u.id, session);
  expect(summary(id).day.timer_minutes).toBe(30);
  ts.manual(u.id, {
    id: session,
    title: "Lecture corrigée",
    started_at: "2026-11-05T12:00:00.000Z",
    ended_at: "2026-11-05T12:10:00.000Z",
    pauses: [],
  });
  expect(summary(id).day.timer_minutes).toBe(10);
  expect(r.entries([id], "2026-11-01", "2026-11-30")).toEqual([]);
});
test("paused habits allow historical logs without rewriting pause intervals", () => {
  const id = habit();
  exec({ kind: "habit-pause", id, paused: true });
  log(id, "2026-11-04");
  expect(summary(id, "2026-11-04").day.state).toBe("done");
  expect(r.pauses([id])).toHaveLength(1);
});
test("routine run snapshots steps and checklist across template edits", () => {
  const id = routine(),
    st = step(id, { kind: "checklist", checklist: ["Eau", "Lumière"] });
  const rid = run(id),
    rs = r.runSteps(rid)[0];
  exec({
    kind: "step-save",
    routineId: id,
    id: st,
    values: {
      title: "Modifiée",
      kind: "simple",
      checklist: [],
      task_id: null,
      habit_id: null,
      target_minutes: null,
    },
  });
  expect(r.runSteps(rid)[0].title).toBe("Étape");
  expect(() =>
    exec({ kind: "run-step", id: rid, stepId: rs.id, status: "done" }),
  ).toThrow("checklist");
  exec({ kind: "run-check", id: rid, stepId: rs.id, index: 0, checked: true });
  exec({ kind: "run-check", id: rid, stepId: rs.id, index: 1, checked: true });
  exec({ kind: "run-step", id: rid, stepId: rs.id, status: "done" });
  expect(r.run(u.id, rid).status).toBe("completed");
});
test("Previous/Next do not complete or skip pending steps", () => {
  const id = routine();
  step(id);
  step(id, { title: "Deuxième" });
  const rid = run(id),
    steps = r.runSteps(rid);
  exec({ kind: "run-move", id: rid, direction: 1 });
  exec({ kind: "run-step", id: rid, stepId: steps[1].id, status: "skip" });
  expect(r.run(u.id, rid).status).toBe("running");
  exec({ kind: "run-move", id: rid, direction: -1 });
  expect(r.run(u.id, rid).current_step).toBe(0);
  exec({ kind: "run-step", id: rid, stepId: steps[0].id, status: "done" });
  expect(r.run(u.id, rid).status).toBe("completed");
});
test("linked Task completes only on Done and run rollback preserves consistency", () => {
  const task = tasks.create(u.id, { title: "Task réelle" }),
    id = routine();
  step(id, { kind: "task", task_id: task.id });
  let rid = run(id);
  exec({
    kind: "run-step",
    id: rid,
    stepId: r.runSteps(rid)[0].id,
    status: "skip",
  });
  expect(tasks.get(u.id, task.id).status).toBe("inbox");
  rid = run(id);
  exec({
    kind: "run-step",
    id: rid,
    stepId: r.runSteps(rid)[0].id,
    status: "done",
  });
  expect(tasks.get(u.id, task.id).status).toBe("done");
});
test("Habit routine step fills missing manual duration without duplicating Timer minutes", () => {
  const h = habit({ target_kind: "duration", target: 20 }),
    session = ts.start(u.id, { source: { kind: "habit", id: h } });
  advance(5);
  ts.stop(u.id, session);
  const id = routine();
  step(id, { kind: "habit", habit_id: h });
  const rid = run(id);
  exec({
    kind: "run-step",
    id: rid,
    stepId: r.runSteps(rid)[0].id,
    status: "done",
  });
  expect(summary(h).day.value).toBe(20);
  expect(summary(h).day.state).toBe("done");
});
test("explicit Finish of Timer step closes its paused session, not global timer", () => {
  const id = routine();
  step(id, { kind: "timer", target_minutes: 25 });
  const rid = run(id),
    st = r.runSteps(rid)[0],
    session = ts.start(u.id, {
      source: { kind: "routine", id: rid, key: st.id },
    });
  advance(5);
  const global = ts.start(u.id, {
    source: { kind: "routine", id: rid },
    conflict: "pause",
  });
  exec({ kind: "run-step", id: rid, stepId: st.id, status: "done" });
  const tr = new SqliteTimeRepository(db);
  expect(tr.get(u.id, session).status).toBe("completed");
  expect(tr.get(u.id, global).status).toBe("running");
});
test("Skip never implicitly finishes an attached Timer", () => {
  const id = routine();
  step(id, { kind: "timer" });
  const rid = run(id),
    st = r.runSteps(rid)[0],
    session = ts.start(u.id, {
      source: { kind: "routine", id: rid, key: st.id },
    });
  ts.pause(u.id, session);
  exec({ kind: "run-step", id: rid, stepId: st.id, status: "skip" });
  expect(new SqliteTimeRepository(db).get(u.id, session).status).toBe("paused");
});
test("counter increments atomically, daily entries replace and history persists", () => {
  const id = exec({ kind: "tracker-save", values: { ...tv, kind: "counter" } });
  exec({
    kind: "tracker-entry",
    id,
    day: "2026-11-05",
    value: 1,
    increment: true,
  });
  exec({
    kind: "tracker-entry",
    id,
    day: "2026-11-05",
    value: 2,
    increment: true,
  });
  expect(r.trackerEntries([id], "2026-11-01", "2026-11-05")[0].value).toBe(3);
  exec({ kind: "tracker-entry", id, day: "2026-11-05", value: 4 });
  expect(r.trackerEntries([id], "2026-11-01", "2026-11-05")[0].value).toBe(4);
});
test("all Tracker types enforce boundaries and no mood is seeded", () => {
  expect(r.trackers(u.id)).toEqual([]);
  for (const kind of [
    "number",
    "duration",
    "counter",
    "boolean",
    "scale",
  ] as const) {
    const id = exec({ kind: "tracker-save", values: { ...tv, kind } });
    exec({ kind: "tracker-entry", id, day: "2026-11-05", value: 1 });
    expect(() =>
      exec({ kind: "tracker-entry", id, day: "2026-11-06", value: 1 }),
    ).toThrow("futur");
    if (kind !== "number")
      expect(() =>
        exec({ kind: "tracker-entry", id, day: "2026-11-05", value: -1 }),
      ).toThrow();
    if (kind === "boolean")
      expect(() =>
        exec({ kind: "tracker-entry", id, day: "2026-11-05", value: 2 }),
      ).toThrow();
    if (kind === "scale")
      expect(() =>
        exec({ kind: "tracker-entry", id, day: "2026-11-05", value: 11 }),
      ).toThrow();
  }
});
test("counter overflow is rejected transactionally and type remains immutable", () => {
  const id = exec({ kind: "tracker-save", values: { ...tv, kind: "counter" } });
  exec({ kind: "tracker-entry", id, day: "2026-11-05", value: 1e9 });
  expect(() =>
    exec({
      kind: "tracker-entry",
      id,
      day: "2026-11-05",
      value: 1,
      increment: true,
    }),
  ).toThrow();
  expect(r.trackerEntries([id], "2026-11-05", "2026-11-05")[0].value).toBe(1e9);
  expect(() => exec({ kind: "tracker-save", id, values: tv })).toThrow(
    "historiques",
  );
});
test("cross-user reads and writes cannot access practices or Timer sources", () => {
  const id = habit();
  const foreign = { ...u, id: "foreign" };
  expect(() =>
    s.execute(foreign, {
      kind: "habit-log",
      id,
      day: "2026-11-05",
      status: "done",
      value: 1,
    }),
  ).toThrow();
  expect(() =>
    ts.start("foreign", { source: { kind: "habit", id } }),
  ).toThrow();
  const rid = routine();
  step(rid);
  expect(() => s.read(foreign, undefined, false, rid)).toThrow();
  expect(() =>
    s.read(foreign, undefined, false, undefined, run(rid)),
  ).toThrow();
});
test("invalid dates, titles, frequencies and quantities cannot partially write", () => {
  expect(() => habit({ title: " " })).toThrow();
  expect(() => habit({ start_day: "" })).toThrow();
  expect(() => habit({ start_day: "2026-11-06" })).toThrow();
  expect(() => habit({ frequency: "weekly", quota: 8 })).toThrow();
  expect(() => habit({ weekdays: [] })).toThrow();
  expect(() => habit({ target: NaN })).toThrow();
  expect(r.habits(u.id)).toEqual([]);
});
test("Today contains only actual due habits and routines, capped compactly", () => {
  expect(s.todaySummary(u)).toEqual({ habits: [], routines: [] });
  for (let i = 0; i < 7; i++) habit({ title: "Habit " + i });
  for (let i = 0; i < 4; i++) routine();
  const paused = habit({ title: "Paused" });
  exec({ kind: "habit-pause", id: paused, paused: true });
  expect(s.todaySummary(u).habits).toHaveLength(5);
  expect(s.todaySummary(u).routines).toHaveLength(3);
});
test("practice data survives full database close and reopen", () => {
  const dir = mkdtempSync(tmpdir() + "/life-os-practice-"),
    path = dir + "/test.sqlite";
  db.close();
  db = connectDatabase(path);
  migrate(db);
  seedJade(db);
  setup(db);
  const id = habit();
  log(id, "2026-11-05");
  const rt = routine();
  step(rt);
  const rid = run(rt);
  db.close();
  db = connectDatabase(path);
  setup(db);
  expect(summary(id).day.state).toBe("done");
  expect(r.runSteps(rid)).toHaveLength(1);
  db.close();
  db = createTestDatabase();
  rmSync(dir, { recursive: true, force: true });
});

test("historical weekly summary includes later entries within the same period", () => {
  const id = habit({ frequency: "weekly" });
  log(id, "2026-10-27");
  log(id, "2026-10-29");
  log(id, "2026-10-30");
  expect(summary(id, "2026-10-26").period).toMatchObject({
    completed: 3,
    target: 3,
    state: "done",
  });
  expect(summary(id, "2026-10-26").day.state).toBe("pending");
});
test("quick Done and routine completion preserve notes and already exceeded targets", () => {
  const id = habit({ target_kind: "quantity", target: 8 });
  exec({
    kind: "habit-log",
    id,
    day: "2026-11-05",
    status: "done",
    value: 10,
    note: "Conservée",
  });
  const rt = routine();
  step(rt, { kind: "habit", habit_id: id });
  const rid = run(rt);
  exec({
    kind: "run-step",
    id: rid,
    stepId: r.runSteps(rid)[0].id,
    status: "done",
  });
  expect(summary(id).day).toMatchObject({
    value: 10,
    note: "Conservée",
    state: "done",
  });
});
test("SQL prevents rewriting routine run snapshots", () => {
  const id = routine();
  step(id);
  const rid = run(id),
    st = r.runSteps(rid)[0];
  expect(() =>
    db
      .query("UPDATE routine_run_steps SET title=? WHERE id=?")
      .run("Rewritten", st.id),
  ).toThrow("immutable");
  expect(() =>
    db
      .query("UPDATE routine_runs SET title=? WHERE id=?")
      .run("Rewritten", rid),
  ).toThrow("immutable");
  expect(r.runSteps(rid)[0].title).toBe("Étape");
});

test("changing from duration to quantity does not subtract old Timer minutes from manual value", () => {
  const id = habit({ target_kind: "duration", target: 20 }),
    sid = ts.start(u.id, { source: { kind: "habit", id } });
  advance(5);
  ts.stop(u.id, sid);
  exec({
    kind: "habit-save",
    id,
    values: { ...hv, target_kind: "quantity", target: 8, unit: "pages" },
  });
  log(id, "2026-11-05", "progress", 3);
  expect(summary(id).day).toMatchObject({
    value: 3,
    timer_minutes: 0,
    state: "progress",
  });
});
