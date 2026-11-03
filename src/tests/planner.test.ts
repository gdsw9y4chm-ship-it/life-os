import { occurrenceLanes } from "../features/planner/layout";
import { beforeEach, afterEach, test, expect } from "bun:test";
import type { Database } from "bun:sqlite";
import { createTestDatabase } from "../db/connection";
import { migrate, migrations } from "../db/migrate";
import { seedJade } from "../db/seed";
import { INITIAL_USER_ID as user } from "../db/repositories/sqlite-user-repository";
import { SqlitePlannerRepository } from "../db/repositories/sqlite-planner-repository";
import { PlannerService } from "../services/planner-service";
import { plannerValues, localReminder } from "../services/planner-rules";
import { SqliteTaskRepository } from "../db/repositories/sqlite-task-repository";
import { SqliteProjectRepository } from "../db/repositories/sqlite-project-repository";
import { SqliteLifeAreaRepository } from "../db/repositories/sqlite-life-area-repository";
import { SqliteMilestoneRepository } from "../db/repositories/sqlite-milestone-repository";
import { TaskService } from "../services/task-service";
import type { PlannerInput } from "../types/planner";
let db: Database,
  repo: SqlitePlannerRepository,
  service: PlannerService,
  tasks: TaskService;
const input = (values: Partial<PlannerInput> = {}): PlannerInput => ({
  kind: "event",
  title: "Rendez-vous",
  start_local: "2026-11-03T09:00",
  duration_minutes: 60,
  timezone: "Europe/Paris",
  frequency: "once",
  interval_count: 1,
  weekdays: [],
  until_day: null,
  ...values,
});
beforeEach(() => {
  db = createTestDatabase();
  migrate(db);
  seedJade(db);
  repo = new SqlitePlannerRepository(db);
  service = new PlannerService(repo);
  tasks = new TaskService(
    new SqliteTaskRepository(db),
    new SqliteProjectRepository(db),
    new SqliteLifeAreaRepository(db),
    new SqliteMilestoneRepository(db),
    "Europe/Paris",
  );
});
afterEach(() => db.close());
test("Planner migration is additive and repeatable with SQLite integrity", () => {
  expect(db.query("PRAGMA integrity_check").get()).toEqual({
    integrity_check: "ok",
  });
  expect(db.query("PRAGMA foreign_key_check").all()).toEqual([]);
  const legacy = createTestDatabase();
  try {
    migrate(legacy, migrations.slice(0, 3));
    seedJade(legacy);
    const before = legacy.query("SELECT * FROM users").all();
    migrate(legacy);
    migrate(legacy);
    seedJade(legacy);
    expect(legacy.query("SELECT * FROM users").all()).toEqual(before);
    expect(legacy.query("PRAGMA foreign_key_check").all()).toEqual([]);
  } finally {
    legacy.close();
  }
});
test("Event, Time Block and Scheduled Task remain distinct", () => {
  const task = tasks.create(user, {
    title: "Task",
    do_date: "2026-11-05",
    deadline: "2026-11-07",
  });
  new SqliteTaskRepository(db).setReminder(
    user,
    task.id,
    "2026-11-04T12:00:00Z",
  );
  service.create(user, input());
  service.create(user, input({ kind: "time_block" }));
  const placement = service.create(
    user,
    input({ kind: "scheduled_task", task_id: task.id }),
  );
  expect(service.list(user, "2026-11-03", "2026-11-03")).toHaveLength(3);
  service.remove(user, placement.id, "2026-11-03", "occurrence");
  expect(tasks.get(user, task.id)).toEqual(task);
  expect(tasks.list(user, {})).toHaveLength(1);
  expect(new SqliteTaskRepository(db).reminder(user, task.id)?.remind_at).toBe(
    "2026-11-04T12:00:00Z",
  );
});
test("Move and resize persist without changing Task dates", () => {
  const task = tasks.create(user, { title: "T", do_date: "2026-11-05" });
  const s = service.create(
    user,
    input({ kind: "scheduled_task", task_id: task.id }),
  );
  service.edit(user, s.id, "2026-11-03", "occurrence", {
    ...s,
    start_local: "2026-11-04T14:00",
    duration_minutes: 90,
  });
  expect(service.list(user, "2026-11-03", "2026-11-03")).toEqual([]);
  const [item] = service.list(user, "2026-11-04", "2026-11-04");
  expect(localReminder(item.start, s.timezone)).toBe("2026-11-04T14:00");
  expect(Date.parse(item.end) - Date.parse(item.start)).toBe(90 * 60000);
  expect(tasks.get(user, task.id).do_date).toBe("2026-11-05");
});
test("Daily intervals use the original local anchor", () => {
  service.create(
    user,
    input({ frequency: "daily", interval_count: 3, until_day: "2026-11-12" }),
  );
  expect(
    service.list(user, "2026-11-01", "2026-11-15").map((o) => o.key),
  ).toEqual(["2026-11-03", "2026-11-06", "2026-11-09", "2026-11-12"]);
});
test("Weekly selected days and interval are anchored to the same week", () => {
  service.create(
    user,
    input({ frequency: "weekly", interval_count: 2, weekdays: [2, 4] }),
  );
  expect(
    service.list(user, "2026-11-01", "2026-11-21").map((o) => o.key),
  ).toEqual(["2026-11-03", "2026-11-05", "2026-11-17", "2026-11-19"]);
});
test("Monthly 31st skips short months without drift", () => {
  service.create(
    user,
    input({ start_local: "2026-01-31T09:00", frequency: "monthly" }),
  );
  expect(
    service.list(user, "2026-02-01", "2026-03-31").map((o) => o.key),
  ).toEqual(["2026-03-31"]);
});
test("Leap day recurrence remains stable", () => {
  service.create(
    user,
    input({
      start_local: "2024-02-29T09:00",
      frequency: "monthly",
      interval_count: 12,
    }),
  );
  expect(service.list(user, "2025-02-01", "2025-03-01")).toEqual([]);
  expect(
    service.list(user, "2028-02-01", "2028-03-01").map((i) => i.key),
  ).toEqual(["2028-02-29"]);
});
test("Occurrence-only edit and removal never shift siblings", () => {
  const s = service.create(user, input({ frequency: "daily" }));
  service.edit(user, s.id, "2026-11-04", "occurrence", {
    ...s,
    start_local: "2026-11-10T14:00",
    title: "Déplacé",
  });
  service.remove(user, s.id, "2026-11-05", "occurrence");
  expect(
    service.list(user, "2026-11-03", "2026-11-06").map((i) => i.key),
  ).toEqual(["2026-11-03", "2026-11-06"]);
  expect(
    service.list(user, "2026-11-10", "2026-11-10").map((i) => i.title),
  ).toContain("Déplacé");
  expect(repo.get(user, s.id).start_local).toBe("2026-11-03T09:00");
});
test("This and future splits the series and preserves past occurrences", () => {
  const s = service.create(
    user,
    input({ frequency: "daily", interval_count: 2 }),
  );
  const id = service.edit(user, s.id, "2026-11-07", "future", {
    ...s,
    start_local: "2026-11-07T11:00",
  });
  expect(id).not.toBe(s.id);
  const items = service.list(user, "2026-11-03", "2026-11-11");
  expect(items.map((i) => localReminder(i.start, s.timezone))).toEqual([
    "2026-11-03T09:00",
    "2026-11-05T09:00",
    "2026-11-07T11:00",
    "2026-11-09T11:00",
    "2026-11-11T11:00",
  ]);
});
test("Future split retains cancelled exceptions", () => {
  const s = service.create(user, input({ frequency: "daily" }));
  service.remove(user, s.id, "2026-11-08", "occurrence");
  service.edit(user, s.id, "2026-11-06", "future", {
    ...s,
    start_local: "2026-11-06T11:00",
  });
  expect(service.list(user, "2026-11-08", "2026-11-08")).toEqual([]);
});
test("Entire-series edit preserves explicit occurrence overrides", () => {
  const s = service.create(user, input({ frequency: "daily" }));
  service.edit(user, s.id, "2026-11-04", "occurrence", {
    ...s,
    start_local: "2026-11-04T15:00",
  });
  service.edit(user, s.id, "2026-11-03", "series", {
    ...s,
    start_local: "2026-11-03T10:00",
  });
  expect(
    service
      .list(user, "2026-11-03", "2026-11-05")
      .map((i) => localReminder(i.start, s.timezone).slice(11)),
  ).toEqual(["10:00", "15:00", "10:00"]);
});
test("Removing future vs all preserves historical records", () => {
  const s = service.create(user, input({ frequency: "daily" }));
  service.remove(user, s.id, "2026-11-05", "future");
  expect(service.list(user, "2026-11-03", "2026-11-07")).toHaveLength(2);
  service.remove(user, s.id, "2026-11-03", "series");
  expect(service.list(user, "2026-11-03", "2026-11-07")).toEqual([]);
  expect(repo.get(user, s.id).archived).toBe(1);
});
test("Local wall time is maintained across DST", () => {
  service.create(
    user,
    input({ start_local: "2026-03-28T09:00", frequency: "daily" }),
  );
  const items = service.list(user, "2026-03-28", "2026-03-30");
  expect(items.map((i) => i.start.slice(11, 16))).toEqual([
    "08:00",
    "07:00",
    "07:00",
  ]);
  expect(
    items.every(
      (i) => localReminder(i.start, "Europe/Paris").slice(11) === "09:00",
    ),
  ).toBe(true);
});
test("Nonexistent local time is rejected explicitly and skipped in a series", () => {
  expect(() =>
    service.create(user, input({ start_local: "2026-03-29T02:30" })),
  ).toThrow();
  service.create(
    user,
    input({ start_local: "2026-03-28T02:30", frequency: "daily" }),
  );
  expect(
    service.list(user, "2026-03-28", "2026-03-30").map((i) => i.key),
  ).toEqual(["2026-03-28", "2026-03-30"]);
});
test("Multi-day blocks intersect adjacent days", () => {
  service.create(
    user,
    input({ start_local: "2026-11-03T23:30", duration_minutes: 120 }),
  );
  expect(service.list(user, "2026-11-04", "2026-11-04")).toHaveLength(1);
});
test("Profile isolation and FK block cross-user placements", () => {
  db.query(
    "INSERT INTO users SELECT 'other','Other',avatar,theme,timezone,week_start,locale,created_at,updated_at FROM users WHERE id=?",
  ).run(user);
  const otherTask = tasks.create("other", { title: "Privé" });
  const s = service.create(user, input());
  expect(service.list("other", "2026-11-03", "2026-11-03")).toEqual([]);
  expect(() =>
    service.edit("other", s.id, "2026-11-03", "series", input()),
  ).toThrow();
  expect(() =>
    service.create(
      user,
      input({ kind: "scheduled_task", task_id: otherTask.id }),
    ),
  ).toThrow();
  expect(db.query("SELECT count(*) AS n FROM planner_series").get()).toEqual({
    n: 1,
  });
});
test("Validation rejects invalid ranges, durations and rules", () => {
  for (const patch of [
    { duration_minutes: 0 },
    { duration_minutes: 1.5 },
    { interval_count: 0 },
    { weekdays: [9] },
    { until_day: "2026-11-01" },
    { start_local: "2026-02-30T09:00" },
  ])
    expect(() => plannerValues(input(patch))).toThrow();
  service.create(user, input());
  expect(() => service.list(user, "2026-01-01", "2026-12-31")).toThrow();
});
test("One-off old history is not loaded as candidate rows", () => {
  service.create(user, input({ start_local: "2020-01-01T09:00" }));
  expect(repo.list(user, "2026-11-01", "2026-11-07")).toEqual([]);
});

test("Chained overlapping placements keep separate lanes", () => {
  const a = service.create(user, input());
  const b = service.create(user, input({ start_local: "2026-11-03T09:30" }));
  const c = service.create(user, input({ start_local: "2026-11-03T10:00" }));
  const lanes = occurrenceLanes(service.list(user, "2026-11-03", "2026-11-03"));
  expect(lanes.get(a.id + "2026-11-03")).toEqual({ lane: 0, columns: 2 });
  expect(lanes.get(b.id + "2026-11-03")).toEqual({ lane: 1, columns: 2 });
  expect(lanes.get(c.id + "2026-11-03")).toEqual({ lane: 0, columns: 2 });
});
