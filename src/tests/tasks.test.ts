import { afterEach, beforeEach, expect, test, describe } from "bun:test";
import type { Database } from "bun:sqlite";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createTestDatabase, connectDatabase } from "../db/connection";
import { migrate, migrations } from "../db/migrate";
import { seedJade } from "../db/seed";
import { INITIAL_USER_ID as jade } from "../db/repositories/sqlite-user-repository";
import { SqliteTaskRepository } from "../db/repositories/sqlite-task-repository";
import { SqliteProjectRepository } from "../db/repositories/sqlite-project-repository";
import { SqliteLifeAreaRepository } from "../db/repositories/sqlite-life-area-repository";
import { SqliteMilestoneRepository } from "../db/repositories/sqlite-milestone-repository";
import { TaskService } from "../services/task-service";
import { calendarDay } from "../services/task-rules";
import {
  reminderFromLocal,
  localReminder,
} from "../features/tasks/reminder-time";
import { taskStatuses, taskPriorities, taskEfforts } from "../types/task";
import type { TaskInput, TaskPatch } from "../types/task";
let db: Database,
  repository: SqliteTaskRepository,
  projects: SqliteProjectRepository,
  areas: SqliteLifeAreaRepository,
  milestones: SqliteMilestoneRepository,
  service: TaskService;
const other = "task-other-test-user";
let instant: string;
beforeEach(() => {
  db = createTestDatabase();
  migrate(db);
  seedJade(db);
  db.query(
    "INSERT INTO users SELECT ?, ?, avatar, theme, timezone, week_start, locale, created_at, updated_at FROM users WHERE id = ?",
  ).run(other, "Test only", jade);
  repository = new SqliteTaskRepository(db);
  projects = new SqliteProjectRepository(db);
  areas = new SqliteLifeAreaRepository(db);
  milestones = new SqliteMilestoneRepository(db);
  instant = "2026-11-03T12:00:00.000Z";
  service = new TaskService(
    repository,
    projects,
    areas,
    milestones,
    "Europe/Paris",
    () => new Date(instant),
  );
});
afterEach(() => db.close());
const create = (input: Partial<TaskInput> = {}) =>
  service.create(jade, { title: "Action", ...input });
const project = () =>
  projects.create(jade, { title: "Project", progress_mode: "task_based" });

describe("Tasks lifecycle", () => {
  test("title-only capture creates an Inbox task with no forced metadata", () => {
    const task = create({ title: "  Appeler le vétérinaire  " });
    expect(task).toMatchObject({
      title: "Appeler le vétérinaire",
      status: "inbox",
      priority: "none",
      effort: "none",
      project_id: null,
      do_date: null,
      deadline: null,
      completed_at: null,
      archived_at: null,
    });
    expect(service.listInbox(jade).map((t) => t.id)).toEqual([task.id]);
  });
  test("edit all task fields, independent dates and custom contexts", () => {
    const task = create();
    expect(
      service.update(jade, task.id, {
        title: "Edited",
        description: "Details",
        priority: "must",
        effort: "deep",
        do_date: "2026-11-10",
        deadline: "2026-11-05",
        estimated_minutes: 42,
        context: "Studio",
        position: 5,
      }),
    ).toMatchObject({
      title: "Edited",
      do_date: "2026-11-10",
      deadline: "2026-11-05",
      context: "Studio",
      estimated_minutes: 42,
    });
  });
  test("all statuses, priorities and efforts are supported", () => {
    const task = create();
    for (const status of taskStatuses)
      expect(service.changeStatus(jade, task.id, status).status).toBe(status);
    for (const priority of taskPriorities)
      expect(service.update(jade, task.id, { priority }).priority).toBe(
        priority,
      );
    for (const effort of taskEfforts)
      expect(service.update(jade, task.id, { effort }).effort).toBe(effort);
  });
  test("completion is timestamped, idempotent and reopen clears it", () => {
    const task = create();
    service.complete(jade, task.id);
    instant = "2026-11-04T12:00:00.000Z";
    expect(service.complete(jade, task.id).completed_at).toBe(
      "2026-11-03T12:00:00.000Z",
    );
    expect(
      service.update(jade, task.id, { title: "Still done" }).completed_at,
    ).toBe("2026-11-03T12:00:00.000Z");
    expect(service.reopen(jade, task.id)).toMatchObject({
      status: "todo",
      completed_at: null,
    });
    expect(service.complete(jade, task.id).completed_at).toBe(instant);
  });
  test("archive is independent, reversible and preserves reminder/checklist", () => {
    const task = create();
    service.addChecklist(jade, task.id, "Passport");
    service.save(jade, task.id, {}, "2026-11-05T14:00:00Z");
    service.archive(jade, task.id);
    expect(service.listInbox(jade)).toEqual([]);
    expect(service.list(jade, { view: "archived" })).toHaveLength(1);
    expect(service.get(jade, task.id).status).toBe("inbox");
    expect(service.detail(jade, task.id).checklist).toHaveLength(1);
    expect(service.detail(jade, task.id).reminder).not.toBeNull();
    service.archive(jade, task.id, false);
    expect(service.listInbox(jade)).toHaveLength(1);
  });
  test("invalid input is rejected before persistence", () => {
    for (const values of [
      { title: " " },
      { status: "invalid" },
      { priority: "high" },
      { effort: "happy" },
      { do_date: "2026-02-30" },
      { deadline: "tomorrow" },
      { estimated_minutes: -1 },
      { estimated_minutes: 1.5 },
      { position: NaN },
    ])
      expect(() => create(values as Partial<TaskInput>)).toThrow();
    expect(service.list(jade)).toEqual([]);
  });
  test("forged ownership, archive and completion fields cannot be changed through a patch", () => {
    const task = create();
    const patched = service.update(jade, task.id, {
      user_id: other,
      archived_at: instant,
      completed_at: instant,
    } as TaskPatch);
    expect(patched).toMatchObject({
      user_id: jade,
      archived_at: null,
      completed_at: null,
    });
  });
});
describe("Relations and isolation", () => {
  test("project area is inherited dynamically and contradictory areas are rejected", () => {
    const [a, b] = areas.list(jade),
      p = projects.create(jade, { title: "Home", life_area_id: a.id });
    const task = create({ project_id: p.id, life_area_id: a.id });
    expect(task.life_area_id).toBeNull();
    expect(task.effective_life_area_id).toBe(a.id);
    expect(() => service.update(jade, task.id, { life_area_id: b.id })).toThrow(
      "héritée",
    );
    projects.update(jade, p.id, { life_area_id: b.id });
    expect(service.get(jade, task.id).effective_life_area_id).toBe(b.id);
    expect(service.list(jade, { areaId: b.id })).toHaveLength(1);
    expect(service.list(jade, { areaId: a.id })).toHaveLength(0);
  });
  test("milestone infers its project and incompatible project is rejected", () => {
    const p = project(),
      m = milestones.create(jade, p.id, { title: "Stage" });
    expect(create({ milestone_id: m.id }).project_id).toBe(p.id);
    expect(() =>
      create({ milestone_id: m.id, project_id: project().id }),
    ).toThrow();
  });
  test("cross-user Life Area, Project, Milestone and Parent are rejected", () => {
    const a = areas.create(other, { name: "Private" }),
      p = projects.create(other, { title: "Private" }),
      m = milestones.create(other, p.id, { title: "Private" }),
      parent = service.create(other, { title: "Private" });
    for (const values of [
      { life_area_id: a.id },
      { project_id: p.id },
      { milestone_id: m.id },
      { parent_task_id: parent.id },
    ]) {
      expect(() => create(values)).toThrow();
      const own = create();
      expect(() => service.update(jade, own.id, values)).toThrow();
    }
    expect(() => service.get(jade, parent.id)).toThrow();
    expect(() => service.update(jade, parent.id, { title: "Wrong" })).toThrow();
    expect(() => service.archive(jade, parent.id)).toThrow();
    expect(service.list(jade, { search: "Private" })).toEqual([]);
  });
  test("foreign keys and triggers enforce isolation for direct SQL", () => {
    const own = create(),
      p = projects.create(other, { title: "Private" }),
      a = areas.create(other, { name: "Private" });
    expect(() =>
      db
        .query("UPDATE tasks SET project_id = ? WHERE id = ?")
        .run(p.id, own.id),
    ).toThrow();
    expect(() =>
      db
        .query("UPDATE tasks SET life_area_id = ? WHERE id = ?")
        .run(a.id, own.id),
    ).toThrow();
    expect(() =>
      db.query("UPDATE tasks SET user_id = ? WHERE id = ?").run(other, own.id),
    ).toThrow();
    expect(() =>
      db.query("UPDATE tasks SET status = 'done' WHERE id = ?").run(own.id),
    ).toThrow();
    expect(() => service.create("missing", { title: "Orphan" })).toThrow();
  });
  test("archive project preserves tasks; optional physical links detach", () => {
    const p = project(),
      task = create({ project_id: p.id });
    projects.archive(jade, p.id);
    expect(service.get(jade, task.id).project_id).toBe(p.id);
    db.query("DELETE FROM projects WHERE id = ?").run(p.id);
    expect(service.get(jade, task.id).project_id).toBeNull();
    const area = areas.list(jade)[0],
      standalone = create({ life_area_id: area.id });
    db.query("DELETE FROM life_areas WHERE id = ?").run(area.id);
    expect(service.get(jade, standalone.id).life_area_id).toBeNull();
  });
  test("milestone cannot move away from linked tasks and deletion detaches safely", () => {
    const p = project(),
      m = milestones.create(jade, p.id, { title: "M" }),
      task = create({ milestone_id: m.id });
    expect(() =>
      db
        .query("UPDATE milestones SET project_id = ? WHERE id = ?")
        .run(project().id, m.id),
    ).toThrow();
    db.query("DELETE FROM milestones WHERE id = ?").run(m.id);
    expect(service.get(jade, task.id).milestone_id).toBeNull();
  });
});
describe("Smart Lists and Waiting", () => {
  test("Today includes only actionable tasks and excludes archives, Inbox, Waiting and Someday", () => {
    for (const status of taskStatuses)
      create({ title: status, status, do_date: "2026-11-03" });
    const archived = create({ status: "todo", do_date: "2026-11-03" });
    service.archive(jade, archived.id);
    expect(
      service
        .listToday(jade)
        .map((t) => t.status)
        .sort(),
    ).toEqual(["doing", "todo"]);
  });
  test("Upcoming uses Do Date only; Overdue uses Deadline only", () => {
    const future = create({
      status: "todo",
      do_date: "2026-11-10",
      deadline: "2026-11-02",
    });
    create({ status: "todo", do_date: "2026-11-01", deadline: "2026-11-10" });
    create({ status: "done", deadline: "2026-11-01" });
    create({ status: "someday", deadline: "2026-11-01" });
    expect(service.listUpcoming(jade).map((t) => t.id)).toEqual([future.id]);
    expect(service.listOverdue(jade).map((t) => t.id)).toEqual([future.id]);
  });
  test("Waiting sets since date and due follow-ups keep Waiting status", () => {
    const due = create({
      status: "waiting",
      waiting_for: "Réponse",
      follow_up_date: "2026-11-03",
    });
    create({ status: "waiting", follow_up_date: "2026-11-04" });
    create({ status: "waiting" });
    create({ status: "todo", follow_up_date: "2026-11-02" });
    expect(due.waiting_since).toBe("2026-11-03");
    expect(service.listWaiting(jade)).toHaveLength(3);
    expect(service.listFollowUps(jade).map((t) => t.id)).toEqual([due.id]);
    expect(service.get(jade, due.id).status).toBe("waiting");
    expect(service.changeStatus(jade, due.id, "todo").waiting_for).toBe(
      "Réponse",
    );
  });
  test("Someday, Completed and Unscheduled distinguish actionable state", () => {
    for (const status of taskStatuses) create({ title: status, status });
    expect(service.listSomeday(jade).map((t) => t.status)).toEqual(["someday"]);
    expect(service.listCompleted(jade).map((t) => t.status)).toEqual(["done"]);
    expect(
      service
        .list(jade, { view: "unscheduled" })
        .map((t) => t.status)
        .sort(),
    ).toEqual(["doing", "todo"]);
  });
  test("profile timezone controls calendar dates, including UTC midnight boundary", () => {
    instant = "2026-11-03T23:30:00.000Z";
    expect(service.today()).toBe("2026-11-04");
    create({ status: "todo", do_date: "2026-11-04" });
    expect(service.listToday(jade)).toHaveLength(1);
    expect(calendarDay(new Date(instant), "America/New_York")).toBe(
      "2026-11-03",
    );
  });
  test("search title and description, contexts and project filters are scoped", () => {
    const p = project(),
      a = create({
        title: "Phone plumber",
        context: "Phone",
        project_id: p.id,
        estimated_minutes: 12,
      }),
      b = create({
        description: "Plumber contact",
        context: "Phone",
        project_id: p.id,
        estimated_minutes: 30,
      });
    create({ title: "Unrelated", context: "Computer" });
    expect(
      service
        .list(jade, { search: "plumber", context: "Phone", projectId: p.id })
        .map((t) => t.id)
        .sort(),
    ).toEqual([a.id, b.id].sort());
    expect(service.list(jade, { search: "%' OR 1=1 --" })).toEqual([]);
    const accented = create({ title: "ÉTÉ vétérinaire" });
    expect(
      service.list(jade, { search: "ete VETERINAIRE" }).map((task) => task.id),
    ).toEqual([accented.id]);
  });
});
describe("Subtasks, checklist and reminders", () => {
  test("subtask is independent and completion does not auto-complete the parent", () => {
    const parent = create(),
      child = create({
        parent_task_id: parent.id,
        status: "todo",
        do_date: "2026-11-03",
      });
    service.complete(jade, child.id);
    expect(service.get(jade, parent.id).status).toBe("inbox");
    expect(service.detail(jade, parent.id).subtasks[0].status).toBe("done");
    expect(() =>
      db.query("DELETE FROM tasks WHERE id = ?").run(parent.id),
    ).toThrow();
  });
  test("one-level rule rejects grandchildren, self links, cycles and reparenting a parent", () => {
    const parent = create(),
      child = create({ parent_task_id: parent.id }),
      otherParent = create();
    expect(() => create({ parent_task_id: child.id })).toThrow();
    expect(() =>
      service.update(jade, parent.id, { parent_task_id: parent.id }),
    ).toThrow();
    expect(() =>
      service.update(jade, parent.id, { parent_task_id: child.id }),
    ).toThrow();
    expect(() =>
      service.update(jade, parent.id, { parent_task_id: otherParent.id }),
    ).toThrow();
    service.archive(jade, child.id);
    expect(() =>
      service.update(jade, parent.id, { parent_task_id: otherParent.id }),
    ).toThrow();
  });
  test("checklist create, edit, complete, reorder and removal are independent of Tasks", () => {
    const task = create(),
      a = service.addChecklist(jade, task.id, "Passport"),
      b = service.addChecklist(jade, task.id, "Charger");
    service.updateChecklist(jade, task.id, a.id, "Passeport", true);
    service.reorderChecklist(jade, task.id, [b.id, a.id]);
    expect(service.checklist(jade, task.id).map((item) => item.label)).toEqual([
      "Charger",
      "Passeport",
    ]);
    expect(service.checklist(jade, task.id)[1].is_completed).toBe(true);
    expect(service.list(jade)).toHaveLength(1);
    service.removeChecklist(jade, task.id, b.id);
    expect(service.checklist(jade, task.id)).toHaveLength(1);
  });
  test("checklist rejects duplicate, missing and foreign IDs atomically", () => {
    const task = create(),
      a = service.addChecklist(jade, task.id, "A"),
      b = service.addChecklist(jade, task.id, "B");
    for (const ids of [[a.id, a.id], [a.id], [b.id, "missing"]])
      expect(() => service.reorderChecklist(jade, task.id, ids)).toThrow();
    expect(service.checklist(jade, task.id).map((item) => item.id)).toEqual([
      a.id,
      b.id,
    ]);
    expect(() =>
      service.updateChecklist(other, task.id, a.id, "Wrong", true),
    ).toThrow();
    expect(() => service.addChecklist(other, task.id, "Wrong")).toThrow();
    expect(() => service.addChecklist(jade, task.id, " ")).toThrow();
  });
  test("reminder persists, updates in place, clears and rejects cross-user access", () => {
    const task = create();
    service.save(jade, task.id, {}, "2026-11-05T15:00:00+01:00");
    const first = service.detail(jade, task.id).reminder!;
    expect(first.remind_at).toBe("2026-11-05T14:00:00.000Z");
    service.save(jade, task.id, {}, "2026-11-06T15:00:00Z");
    expect(service.detail(jade, task.id).reminder!.id).toBe(first.id);
    expect(() => service.save(other, task.id, {}, null)).toThrow();
    expect(() =>
      db
        .query("UPDATE task_reminders SET user_id = ? WHERE task_id = ?")
        .run(other, task.id),
    ).toThrow();
    service.save(jade, task.id, {}, null);
    expect(service.detail(jade, task.id).reminder).toBeNull();
  });
  test("invalid reminder rolls back task edit and requires an explicit timezone", () => {
    const task = create();
    for (const at of ["tomorrow", "2026-11-05T12:00", "2026-02-30T12:00:00Z"])
      expect(() =>
        service.save(jade, task.id, { title: "Must not persist" }, at),
      ).toThrow();
    expect(service.get(jade, task.id).title).toBe("Action");
  });
  test("reminder editor converts profile timezone and rejects nonexistent DST times", () => {
    expect(reminderFromLocal("2026-11-05T15:00", "Europe/Paris")).toBe(
      "2026-11-05T14:00:00.000Z",
    );
    expect(localReminder("2026-07-01T14:00:00.000Z", "Europe/Paris")).toBe(
      "2026-07-01T16:00",
    );
    expect(() =>
      reminderFromLocal("2026-03-29T02:30", "Europe/Paris"),
    ).toThrow();
  });
});
describe("Real project progress", () => {
  test("no eligible tasks means no percentage; completed count determines progress", () => {
    const p = project();
    expect(service.progress(jade, p.id)).toBeNull();
    const a = create({ project_id: p.id }),
      b = create({ project_id: p.id });
    service.complete(jade, a.id);
    expect(service.progress(jade, p.id)).toBe(50);
    service.complete(jade, b.id);
    expect(service.progress(jade, p.id)).toBe(100);
    service.reopen(jade, a.id);
    expect(service.progress(jade, p.id)).toBe(50);
  });
  test("excludes archives and Someday and does not double-count parent and child", () => {
    const p = project(),
      parent = create({ project_id: p.id, status: "done" });
    create({ project_id: p.id, parent_task_id: parent.id });
    create({ project_id: p.id, status: "someday" });
    const archived = create({ project_id: p.id });
    service.archive(jade, archived.id);
    expect(service.progress(jade, p.id)).toBe(100);
    service.archive(jade, parent.id);
    expect(service.progress(jade, p.id)).toBe(0);
  });
  test("a child in another project contributes only to that project", () => {
    const p = project(),
      q = project(),
      parent = create({ project_id: p.id, status: "done" });
    create({ project_id: q.id, parent_task_id: parent.id, status: "todo" });
    expect(service.progress(jade, p.id)).toBe(100);
    expect(service.progress(jade, q.id)).toBe(0);
    expect(() => service.progress(other, p.id)).toThrow();
  });
});
test("migration upgrades Phase 3 without changing existing core data or seeding Tasks", () => {
  const old = createTestDatabase();
  try {
    migrate(old, migrations.slice(0, 2));
    seedJade(old);
    const p = new SqliteProjectRepository(old).create(jade, {
      title: "Existing",
    });
    migrate(old);
    seedJade(old);
    migrate(old);
    expect(new SqliteProjectRepository(old).get(jade, p.id)).toEqual(p);
    expect(old.query("SELECT count(*) AS n FROM tasks").get()).toEqual({
      n: 0,
    });
    expect(old.query("PRAGMA foreign_key_check").all()).toEqual([]);
  } finally {
    old.close();
  }
});
test("Tasks, checklist and reminders survive database close and reopen", () => {
  const dir = mkdtempSync(join(tmpdir(), "life-os-tasks-")),
    path = join(dir, "test.sqlite");
  const disk = connectDatabase(path);
  migrate(disk);
  seedJade(disk);
  const repo = new SqliteTaskRepository(disk),
    s = new TaskService(
      repo,
      new SqliteProjectRepository(disk),
      new SqliteLifeAreaRepository(disk),
      new SqliteMilestoneRepository(disk),
    );
  const task = s.create(jade, { title: "Persist" });
  s.addChecklist(jade, task.id, "Keep");
  s.save(jade, task.id, {}, "2027-01-01T12:00:00Z");
  disk.close();
  const reopened = connectDatabase(path);
  try {
    const r = new SqliteTaskRepository(reopened);
    expect(r.get(jade, task.id)!.title).toBe("Persist");
    expect(r.checklist(jade, task.id)).toHaveLength(1);
    expect(r.reminder(jade, task.id)).not.toBeNull();
  } finally {
    reopened.close();
    rmSync(dir, { recursive: true });
  }
});
