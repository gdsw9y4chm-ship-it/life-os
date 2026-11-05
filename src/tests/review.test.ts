import { beforeEach, afterEach, test, expect } from "bun:test";
import type { Database } from "bun:sqlite";
import { createTestDatabase, connectDatabase } from "../db/connection";
import { migrate, migrations } from "../db/migrate";
import { seedJade } from "../db/seed";
import { SqliteReviewRepository } from "../db/repositories/sqlite-review-repository";
import { SqliteUserRepository } from "../db/repositories/sqlite-user-repository";
import { SqliteTimeRepository } from "../db/repositories/sqlite-time-repository";
import { SqliteProjectRepository } from "../db/repositories/sqlite-project-repository";
import { SqliteTaskRepository } from "../db/repositories/sqlite-task-repository";
import { SqliteLifeAreaRepository } from "../db/repositories/sqlite-life-area-repository";
import { SqliteMilestoneRepository } from "../db/repositories/sqlite-milestone-repository";
import { SqlitePracticeRepository } from "../db/repositories/sqlite-practice-repository";
import { SqlitePlannerRepository } from "../db/repositories/sqlite-planner-repository";
import { TaskService } from "../services/task-service";
import { PracticeService } from "../services/practice-service";
import { PlannerService } from "../services/planner-service";
import { TimeService } from "../services/time-service";
import { ReviewService } from "../services/review-service";
import { reviewPeriod } from "../services/review-rules";
import type { User } from "../types/user";
import type { ResetCommand } from "../types/review";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
let db: Database,
  r: SqliteReviewRepository,
  s: ReviewService,
  u: User,
  ts: TimeService,
  tasks: TaskService,
  pr: SqlitePracticeRepository,
  ps: PracticeService,
  now: string;
function setup() {
  r = new SqliteReviewRepository(db);
  s = new ReviewService(r, () => new Date(now));
  u = new SqliteUserRepository(db).getCurrent()!;
  ts = new TimeService(new SqliteTimeRepository(db), () => new Date(now));
  tasks = new TaskService(
    new SqliteTaskRepository(db),
    new SqliteProjectRepository(db),
    new SqliteLifeAreaRepository(db),
    new SqliteMilestoneRepository(db),
    u.timezone,
  );
  pr = new SqlitePracticeRepository(db);
  ps = new PracticeService(pr, tasks, () => new Date(now));
}
beforeEach(() => {
  db = createTestDatabase();
  migrate(db);
  seedJade(db);
  now = "2026-11-05T12:00:00.000Z";
  setup();
});
afterEach(() => db.close());
const read = () => s.read(u, "week", "2026-11-05");
const advance = (m: number) => {
  now = new Date(Date.parse(now) + m * 60000).toISOString();
};
const reset = (mode: "week" | "month" = "week") =>
  s.execute(u, { kind: "start", mode, day: "2026-11-05" });
const command = (
  id: string,
  c:
    | Omit<Extract<ResetCommand, { kind: "step" }>, "id" | "revision">
    | Omit<Extract<ResetCommand, { kind: "move" }>, "id" | "revision">,
) => s.execute(u, { ...c, id, revision: r.run(u.id, id).revision });
test("Week follows profile start across year boundary", () => {
  expect(reviewPeriod("week", "2027-01-01", "Monday")).toMatchObject({
    from: "2026-12-28",
    to: "2027-01-03",
  });
  expect(reviewPeriod("week", "2027-01-01", "Sunday").from).toBe("2026-12-27");
});
test("Month supports leap February and year navigation", () => {
  expect(reviewPeriod("month", "2028-02-21", "Monday").to).toBe("2028-02-29");
  expect(reviewPeriod("month", "2026-01-30", "Monday").previous).toBe(
    "2025-12-01",
  );
  expect(() => reviewPeriod("week", "2026-02-30", "Monday")).toThrow();
});
test("empty Insights invent no values or targets and reads do not create Resets", () => {
  const d = read();
  expect(d.total).toBe(0);
  expect(d.byArea).toEqual([]);
  expect(d.timeTargets).toEqual([]);
  expect(d.comparisons).toEqual([]);
  expect(d.habits).toEqual([]);
  expect(r.runs(u.id)).toEqual([]);
});
test("tracked time includes running time but excludes every paused interval", () => {
  const id = ts.start(u.id, { source: { kind: "quick" }, title: "Focus" });
  advance(10);
  ts.pause(u.id, id);
  advance(20);
  expect(read().total).toBe(600);
  ts.resume(u.id, id);
  advance(5);
  expect(read().total).toBe(900);
  ts.stop(u.id, id);
  advance(60);
  expect(read().total).toBe(900);
});
test("local Week boundary clips a cross-midnight session", () => {
  now = "2026-11-01T22:30:00.000Z";
  const id = ts.start(u.id, { source: { kind: "quick" }, title: "Nuit" });
  advance(60);
  ts.stop(u.id, id);
  expect(read().total).toBe(1800);
  expect(s.read(u, "week", "2026-11-01").total).toBe(1800);
});
test("DST month uses elapsed instants rather than naive local hours", () => {
  now = "2026-10-25T00:30:00.000Z";
  const id = ts.start(u.id, { source: { kind: "quick" }, title: "Fold" });
  advance(120);
  ts.stop(u.id, id);
  expect(s.read(u, "month", "2026-10-25").total).toBe(7200);
});
test("non-European timezone selects the actual local period", () => {
  u = { ...u, timezone: "America/New_York" };
  now = "2026-11-02T04:30:00.000Z";
  const id = ts.start(u.id, { source: { kind: "quick" }, title: "Minuit" });
  advance(60);
  ts.stop(u.id, id);
  expect(read().total).toBe(1800);
});
test("Life Balance preserves source snapshot and prior four-week average", () => {
  const area = new SqliteLifeAreaRepository(db).list(u.id)[0],
    p = new SqliteProjectRepository(db).create(u.id, {
      title: "Projet",
      life_area_id: area.id,
    });
  now = "2026-10-20T12:00:00.000Z";
  let id = ts.start(u.id, { source: { kind: "project", id: p.id } });
  advance(80);
  ts.stop(u.id, id);
  now = "2026-11-05T12:00:00.000Z";
  id = ts.start(u.id, { source: { kind: "project", id: p.id } });
  advance(30);
  ts.stop(u.id, id);
  db.query("UPDATE projects SET life_area_id=NULL WHERE id=?").run(p.id);
  expect(read().byArea[0]).toMatchObject({
    id: area.id,
    seconds: 1800,
    previousWeekly: 1200,
  });
  expect(read().projects[0].seconds).toBe(1800);
});
test("Planned vs Actual counts one planned occurrence across multiple sessions", () => {
  const p = new PlannerService(new SqlitePlannerRepository(db)).create(u.id, {
    kind: "time_block",
    title: "Bloc",
    start_local: "2026-11-05T13:00",
    timezone: u.timezone,
    duration_minutes: 45,
    frequency: "once",
    interval_count: 1,
    weekdays: [],
    until_day: null,
  });
  for (let i = 0; i < 2; i++) {
    const id = ts.start(u.id, {
      source: { kind: "planner", id: p.id, key: "2026-11-05" },
    });
    advance(10);
    ts.stop(u.id, id);
  }
  expect(read().comparisons).toEqual([
    { title: "Bloc", planned: 2700, actual: 1200 },
  ]);
});
test("session targets are reported only when present", () => {
  const id = ts.start(u.id, {
    source: { kind: "quick" },
    title: "Cible",
    target_minutes: 25,
  });
  advance(10);
  ts.stop(u.id, id);
  expect(read().timeTargets[0]).toMatchObject({ target: 25, seconds: 600 });
});
test("project progress follows real task-based aggregates without subtask double counting", () => {
  const p = new SqliteProjectRepository(db).create(u.id, {
    title: "P",
    progress_mode: "task_based",
  });
  const parent = tasks.create(u.id, { title: "Parent", project_id: p.id });
  tasks.create(u.id, {
    title: "Sous-tâche",
    project_id: p.id,
    parent_task_id: parent.id,
  });
  const other = tasks.create(u.id, { title: "Autre", project_id: p.id });
  tasks.changeStatus(u.id, other.id, "done");
  expect(read().projects[0]).toMatchObject({
    taskCount: 2,
    doneCount: 1,
    progress: 50,
  });
});
test("recent Timer prevents false inactivity even when viewing an older period", () => {
  const p = new SqliteProjectRepository(db).create(u.id, { title: "Actif" });
  db.query(
    "UPDATE projects SET created_at='2026-01-01T00:00:00.000Z',updated_at='2026-01-01T00:00:00.000Z' WHERE id=?",
  ).run(p.id);
  expect(read().projects[0].inactive).toBe(true);
  const id = ts.start(u.id, { source: { kind: "project", id: p.id } });
  advance(5);
  ts.stop(u.id, id);
  expect(s.read(u, "month", "2026-08-01").projects[0].inactive).toBe(false);
});
test("Tasks counts use retained completion timestamps, Waiting is current", () => {
  const id = tasks.create(u.id, { title: "Done" }).id;
  tasks.changeStatus(u.id, id, "done");
  db.query(
    "UPDATE tasks SET completed_at='2026-11-04T12:00:00.000Z' WHERE id=?",
  ).run(id);
  tasks.create(u.id, { title: "Waiting", status: "waiting" });
  expect(read().counts).toMatchObject({ completed: 1, waiting: 1 });
  tasks.changeStatus(u.id, id, "todo");
  expect(read().counts.completed).toBe(0);
});
test("Habits weekly quota creates no fake daily Missed, pauses stay neutral", () => {
  const id = ps.execute(u, {
    kind: "habit-save",
    values: {
      title: "Sport",
      life_area_id: null,
      start_day: "2026-11-01",
      frequency: "weekly",
      weekdays: [],
      every_days: 1,
      quota: 3,
      target_kind: "count",
      target: 1,
      unit: "",
    },
  });
  ps.execute(u, {
    kind: "habit-log",
    id,
    day: "2026-11-02",
    status: "done",
    value: 1,
  });
  ps.execute(u, {
    kind: "habit-log",
    id,
    day: "2026-11-04",
    status: "skip",
    value: 0,
  });
  ps.execute(u, { kind: "habit-pause", id, paused: true });
  expect(read().habits[0]).toMatchObject({
    done: 1,
    skip: 1,
    missed: 0,
    paused: 1,
    quota: 3,
  });
});
test("duration Habit counts completed Timer only, excluding pauses", () => {
  const id = ps.execute(u, {
    kind: "habit-save",
    values: {
      title: "Lire",
      life_area_id: null,
      start_day: "2026-11-01",
      frequency: "days",
      weekdays: [0, 1, 2, 3, 4, 5, 6],
      every_days: 1,
      quota: 1,
      target_kind: "duration",
      target: 10,
      unit: "min",
    },
  });
  const sid = ts.start(u.id, { source: { kind: "habit", id } });
  advance(10);
  expect(read().habits[0].done).toBe(0);
  ts.pause(u.id, sid);
  advance(40);
  ts.stop(u.id, sid);
  expect(read().habits[0].done).toBe(1);
});
test("Reset start is idempotent per user, kind and period", () => {
  const id = reset();
  expect(reset()).toBe(id);
  expect(reset("month")).not.toBe(id);
  expect(r.runs(u.id)).toHaveLength(2);
});
test("Weekly Reset preserves cursor, Done and Skip; Next alone never completes", () => {
  const id = reset();
  command(id, { kind: "move", direction: 1 });
  expect(r.run(u.id, id).steps.every((v) => v === null)).toBe(true);
  command(id, { kind: "move", direction: -1 });
  for (let i = 0; i < 8; i++)
    command(id, { kind: "step", status: i === 2 ? "skip" : "done" });
  expect(r.run(u.id, id).completed_at).toBe(now);
  expect(r.run(u.id, id).steps[2]).toBe("skip");
});
test("Monthly Reset has seven persisted steps and locks its report period", () => {
  const id = reset("month");
  expect(r.run(u.id, id).steps).toHaveLength(7);
  command(id, { kind: "step", status: "done" });
  const d = s.read(u, "week", "2026-01-01", id);
  expect(d.mode).toBe("month");
  expect(d.period.from).toBe("2026-11-01");
  expect(d.run!.cursor).toBe(1);
});
test("priorities max three, notes bounded, stale writes cannot overwrite", () => {
  const id = reset();
  s.execute(u, {
    kind: "priorities",
    id,
    revision: 1,
    values: ["Une", "Deux", "Trois"],
  });
  expect(() =>
    s.execute(u, { kind: "note", id, revision: 1, text: "stale" }),
  ).toThrow("onglet");
  expect(() =>
    s.execute(u, {
      kind: "priorities",
      id,
      revision: 2,
      values: ["1", "2", "3", "4"],
    }),
  ).toThrow("maximum");
  s.execute(u, { kind: "note", id, revision: 2, text: "Conserver" });
  expect(r.run(u.id, id).notes["0"]).toBe("Conserver");
  expect(r.run(u.id, id).priorities).toEqual(["Une", "Deux", "Trois"]);
});
test("cross-user Reset and Insight access is scoped", () => {
  const id = reset(),
    other = { ...u, id: "other" };
  expect(() => s.read(other, "week", undefined, id)).toThrow();
  expect(() =>
    s.execute(other, { kind: "move", id, revision: 1, direction: 1 }),
  ).toThrow();
  expect(s.read(other).total).toBe(0);
  expect(s.read(other).runs).toEqual([]);
});
test("future and invalid Resets are rejected without writes", () => {
  expect(() =>
    s.execute(u, { kind: "start", mode: "week", day: "2027-01-01" }),
  ).toThrow("future");
  expect(() =>
    s.execute(u, { kind: "start", mode: "month", day: "" }),
  ).toThrow();
  expect(r.runs(u.id)).toEqual([]);
});
test("upgrade preserves all existing data and SQLite integrity", () => {
  const old = createTestDatabase();
  migrate(old, migrations.slice(0, 7));
  seedJade(old);
  const before = old.query("SELECT * FROM users").all();
  migrate(old);
  seedJade(old);
  expect(old.query("SELECT * FROM users").all()).toEqual(before);
  expect(old.query("PRAGMA integrity_check").get()).toEqual({
    integrity_check: "ok",
  });
  expect(old.query("PRAGMA foreign_key_check").all()).toEqual([]);
  old.close();
});
test("Reset persists through complete database close/reopen", () => {
  const dir = mkdtempSync(tmpdir() + "/review-"),
    path = dir + "/db.sqlite";
  db.close();
  db = connectDatabase(path);
  migrate(db);
  seedJade(db);
  setup();
  const id = reset();
  s.execute(u, {
    kind: "priorities",
    id,
    revision: 1,
    values: ["Priorité conservée"],
  });
  command(id, { kind: "step", status: "done" });
  db.close();
  db = connectDatabase(path);
  setup();
  expect(r.run(u.id, id).priorities).toEqual(["Priorité conservée"]);
  expect(r.run(u.id, id).cursor).toBe(1);
  db.close();
  db = createTestDatabase();
  rmSync(dir, { recursive: true, force: true });
});

test("saved Reset dates remain fixed after a profile week-start change", () => {
  const id = reset();
  const d = s.read({ ...u, week_start: "Sunday" }, "week", undefined, id);
  expect(d.period).toMatchObject({
    from: "2026-11-02",
    to: "2026-11-08",
    next: "2026-11-09",
  });
});
