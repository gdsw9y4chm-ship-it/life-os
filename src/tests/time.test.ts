import { correctedInstant } from "../features/time/local-time";
import { TaskService } from "../services/task-service";
import { SqliteMilestoneRepository } from "../db/repositories/sqlite-milestone-repository";
import { beforeEach, afterEach, test, expect } from "bun:test";
import type { Database } from "bun:sqlite";
import { createTestDatabase, connectDatabase } from "../db/connection";
import { migrate, migrations } from "../db/migrate";
import { seedJade } from "../db/seed";
import { INITIAL_USER_ID as user } from "../db/repositories/sqlite-user-repository";
import { SqliteTimeRepository } from "../db/repositories/sqlite-time-repository";
import { SqliteTaskRepository } from "../db/repositories/sqlite-task-repository";
import { SqliteProjectRepository } from "../db/repositories/sqlite-project-repository";
import { SqliteGoalRepository } from "../db/repositories/sqlite-goal-repository";
import { SqliteLifeAreaRepository } from "../db/repositories/sqlite-life-area-repository";
import { SqlitePlannerRepository } from "../db/repositories/sqlite-planner-repository";
import { PlannerService } from "../services/planner-service";
import { TimeService } from "../services/time-service";
import { actualSeconds } from "../features/time/duration";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
let db: Database, repo: SqliteTimeRepository, s: TimeService, now: string;
beforeEach(() => {
  db = createTestDatabase();
  migrate(db);
  seedJade(db);
  repo = new SqliteTimeRepository(db);
  now = "2026-11-03T12:00:00.000Z";
  s = new TimeService(repo, () => new Date(now));
});
afterEach(() => db.close());
const start = (title = "A") =>
  s.start(user, { source: { kind: "quick" }, title });
const advance = (minutes: number) => {
  now = new Date(Date.parse(now) + minutes * 60000).toISOString();
};
const snap = () => s.snapshot(user, "Europe/Paris");
test("upgrade from Planner preserves data and seed, integrity remains valid", () => {
  const old = createTestDatabase();
  migrate(old, migrations.slice(0, 4));
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
test("running time is derived from persisted timestamps", () => {
  start();
  advance(10);
  expect(snap().unfinished[0].actual_duration).toBe(600);
  expect(snap().today_seconds).toBe(600);
});
test("pause excludes idle time and never completes a session", () => {
  const id = start();
  advance(10);
  s.pause(user, id);
  advance(90);
  expect(snap().unfinished[0].actual_duration).toBe(600);
  expect(repo.get(user, id).status).toBe("paused");
  expect(repo.get(user, id).ended_at).toBeNull();
});
test("resume accounts only active intervals and finish is explicit", () => {
  const id = start();
  advance(10);
  s.pause(user, id);
  advance(20);
  s.resume(user, id);
  advance(5);
  s.stop(user, id);
  advance(60);
  expect(snap().history[0].actual_duration).toBe(900);
  expect(snap().unfinished).toEqual([]);
});
test("many paused sessions coexist, one running", () => {
  const a = start();
  advance(1);
  const b = s.start(user, { source: { kind: "quick" }, conflict: "pause" });
  advance(1);
  const c = s.start(user, { source: { kind: "quick" }, conflict: "pause" });
  expect(repo.get(user, a).status).toBe("paused");
  expect(repo.get(user, b).status).toBe("paused");
  expect(repo.get(user, c).status).toBe("running");
  expect(snap().unfinished).toHaveLength(3);
});
test("resume pauses the other running session atomically", () => {
  const a = start();
  advance(2);
  const b = s.start(user, { source: { kind: "quick" }, conflict: "pause" });
  advance(3);
  s.resume(user, a);
  expect(repo.get(user, b).status).toBe("paused");
  expect(repo.get(user, a).status).toBe("running");
  expect(repo.pauses([a, b]).filter((p) => !p.ended_at)).toHaveLength(1);
});
test("conflict cancel preserves current running and stop/start completes explicitly", () => {
  const a = start();
  expect(() => start()).toThrow();
  expect(repo.running(user)?.id).toBe(a);
  advance(5);
  const b = s.start(user, { source: { kind: "quick" }, conflict: "stop" });
  expect(repo.get(user, a).status).toBe("completed");
  expect(repo.running(user)?.id).toBe(b);
});
test("invalid start does not pause current session", () => {
  const a = start();
  expect(() =>
    s.start(user, {
      source: { kind: "task", id: "missing" },
      conflict: "pause",
    }),
  ).toThrow();
  expect(repo.running(user)?.id).toBe(a);
  expect(repo.pauses([a])).toEqual([]);
});
test("SQLite unique constraint blocks concurrent running inserts, not paused", () => {
  const a = start(),
    copy = repo.get(user, a);
  expect(() => repo.insert({ ...copy, id: "race" })).toThrow();
  s.pause(user, a);
  repo.insert({ ...copy, id: "second" });
  expect(repo.running(user)?.id).toBe("second");
});
test("stop paused excludes open pause and idempotent stop does not extend history", () => {
  const a = start();
  advance(3);
  s.pause(user, a);
  advance(100);
  s.stop(user, a);
  const end = repo.get(user, a).ended_at;
  advance(5);
  s.stop(user, a);
  expect(snap().history[0].actual_duration).toBe(180);
  expect(repo.get(user, a).ended_at).toBe(end);
  expect(() => s.resume(user, a)).toThrow();
});
test("manual entry and pause correction calculate actual duration", () => {
  const id = s.manual(user, {
    title: "Manuel",
    started_at: "2026-11-03T09:00Z",
    ended_at: "2026-11-03T11:00Z",
    pauses: [
      { started_at: "2026-11-03T09:30Z", ended_at: "2026-11-03T10:00Z" },
    ],
  });
  expect(snap().history[0].actual_duration).toBe(5400);
  s.manual(user, {
    id,
    title: "Corrigé",
    started_at: "2026-11-03T09:00Z",
    ended_at: "2026-11-03T10:00Z",
    pauses: [],
  });
  expect(snap().history[0].actual_duration).toBe(3600);
});
test("invalid manual overlap, outside pause, future and reversed dates roll back", () => {
  const v = {
    title: "Bad",
    started_at: "2026-11-03T09:00Z",
    ended_at: "2026-11-03T11:00Z",
    pauses: [],
  };
  for (const values of [
    { ...v, ended_at: v.started_at },
    { ...v, ended_at: "2027-01-01T00:00Z" },
    {
      ...v,
      pauses: [
        { started_at: "2026-11-03T08:00Z", ended_at: "2026-11-03T10:00Z" },
      ],
    },
    {
      ...v,
      pauses: [
        { started_at: "2026-11-03T09:00Z", ended_at: "2026-11-03T10:00Z" },
        { started_at: "2026-11-03T09:30Z", ended_at: "2026-11-03T10:30Z" },
      ],
    },
  ])
    expect(() => s.manual(user, values)).toThrow();
  expect(repo.history(user)).toEqual([]);
});
test("unfinished sessions cannot be corrected as completed", () => {
  const id = start();
  expect(() =>
    s.manual(user, {
      id,
      title: "No",
      started_at: "2026-11-03T09:00Z",
      ended_at: "2026-11-03T11:00Z",
      pauses: [],
    }),
  ).toThrow();
  expect(repo.running(user)?.id).toBe(id);
});
test("daily totals clip sessions and pauses at local midnight", () => {
  now = "2026-11-02T22:30:00Z";
  const a = start();
  advance(45);
  s.pause(user, a);
  advance(30);
  s.resume(user, a);
  advance(45);
  expect(snap().day).toBe("2026-11-03");
  expect(snap().today_seconds).toBe(3600);
});
test("DST elapsed time uses actual instants, not wall-clock subtraction", () => {
  now = "2026-10-25T04:00:00Z";
  s.manual(user, {
    title: "DST",
    started_at: "2026-10-25T00:30:00Z",
    ended_at: "2026-10-25T02:30:00Z",
    pauses: [],
  });
  expect(snap().today_seconds).toBe(7200);
});
test("context inherits Task -> Project -> Goal / Life Area and remains a snapshot", () => {
  const area = new SqliteLifeAreaRepository(db).list(user)[0];
  const goal = new SqliteGoalRepository(db).create(user, {
    title: "Objectif",
    type: "duration",
  });
  const project = new SqliteProjectRepository(db).create(user, {
    title: "Projet",
    life_area_id: area.id,
    goal_id: goal.id,
  });
  const task = new TaskService(
    new SqliteTaskRepository(db),
    new SqliteProjectRepository(db),
    new SqliteLifeAreaRepository(db),
    new SqliteMilestoneRepository(db),
  ).create(user, { title: "Action", project_id: project.id });
  const id = s.start(user, { source: { kind: "task", id: task.id } });
  const session = repo.get(user, id);
  expect([
    session.task_id,
    session.project_id,
    session.goal_id,
    session.life_area_id,
  ]).toEqual([task.id, project.id, goal.id, area.id]);
  db.query("UPDATE tasks SET project_id=NULL WHERE id=?").run(task.id);
  expect(repo.get(user, id).project_id).toBe(project.id);
});
test("planned duration snapshot never rewrites Planner after manual correction", () => {
  const planner = new PlannerService(new SqlitePlannerRepository(db));
  const block = planner.create(user, {
    kind: "time_block",
    title: "Travail",
    start_local: "2026-11-03T09:00",
    timezone: "Europe/Paris",
    duration_minutes: 45,
    frequency: "once",
    interval_count: 1,
    weekdays: [],
    until_day: null,
  });
  const id = s.start(user, {
    source: { kind: "planner", id: block.id, key: "2026-11-03" },
  });
  advance(20);
  s.stop(user, id);
  expect(repo.get(user, id).planned_minutes).toBe(45);
  s.manual(user, {
    id,
    title: "Travail",
    started_at: "2026-11-03T09:00Z",
    ended_at: "2026-11-03T10:00Z",
    pauses: [],
  });
  expect(repo.get(user, id).planned_minutes).toBe(45);
  expect(
    planner.list(user, "2026-11-03", "2026-11-03")[0].series.duration_minutes,
  ).toBe(45);
});
test("ownership protects reads and transitions", () => {
  const a = start();
  for (const fn of [
    () => s.pause("other", a),
    () => s.resume("other", a),
    () => s.stop("other", a),
  ])
    expect(fn).toThrow();
  expect(repo.running(user)?.id).toBe(a);
});
test("completed and paused sessions persist across connection reopen", () => {
  const dir = mkdtempSync(tmpdir() + "/life-os-time-");
  try {
    let disk = connectDatabase(dir + "/test.sqlite");
    migrate(disk);
    seedJade(disk);
    let service = new TimeService(
      new SqliteTimeRepository(disk),
      () => new Date(now),
    );
    const a = service.start(user, { source: { kind: "quick" } });
    advance(5);
    service.pause(user, a);
    disk.close();
    disk = connectDatabase(dir + "/test.sqlite");
    service = new TimeService(
      new SqliteTimeRepository(disk),
      () => new Date(now),
    );
    advance(10);
    expect(
      service.snapshot(user, "Europe/Paris").unfinished[0].actual_duration,
    ).toBe(300);
    service.resume(user, a);
    advance(2);
    service.stop(user, a);
    expect(
      service.snapshot(user, "Europe/Paris").history[0].actual_duration,
    ).toBe(420);
    disk.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
test("duration clamps an interval outside requested range", () => {
  expect(
    actualSeconds(
      { started_at: "2026-11-03T10:00Z", ended_at: "2026-11-03T11:00Z" },
      [],
      now,
      "2026-11-04T00:00Z",
    ),
  ).toBe(0);
});
test('switch uses the same instant for pause and new start',()=>{let tick=Date.parse(now);const timed=new TimeService(repo,()=>new Date(tick++));const a=timed.start(user,{source:{kind:'quick'}});const b=timed.start(user,{source:{kind:'quick'},conflict:'pause'});expect(repo.pauses([a])[0].started_at).toBe(repo.get(user,b).started_at);timed.resume(user,a);expect(repo.pauses([b])[0].started_at).toBe(repo.pauses([a])[0].ended_at!);});
test('backward clock cannot corrupt the current interval',()=>{const id=start();advance(5);s.pause(user,id);advance(5);s.resume(user,id);advance(-2);expect(()=>s.pause(user,id)).toThrow();expect(repo.get(user,id).status).toBe('running');});

test('unchanged manual fields preserve seconds and ambiguous DST occurrence',()=>{expect(correctedInstant('2026-10-25T02:30','Europe/Paris','2026-10-25T00:30:21.123Z')).toBe('2026-10-25T00:30:21.123Z');expect(correctedInstant('2026-11-03T10:15','Europe/Paris','2026-11-03T09:00:21.123Z')).toBe('2026-11-03T09:15:00.000Z');});
