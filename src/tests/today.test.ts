import { afterEach, beforeEach, expect, test, spyOn } from "bun:test";
import type { Database } from "bun:sqlite";
import { createTestDatabase } from "../db/connection";
import { migrate } from "../db/migrate";
import { seedJade } from "../db/seed";
import {
  SqliteUserRepository,
  INITIAL_USER_ID as jade,
} from "../db/repositories/sqlite-user-repository";
import { SqliteTaskRepository } from "../db/repositories/sqlite-task-repository";
import { SqliteProjectRepository } from "../db/repositories/sqlite-project-repository";
import { SqliteLifeAreaRepository } from "../db/repositories/sqlite-life-area-repository";
import { SqliteMilestoneRepository } from "../db/repositories/sqlite-milestone-repository";
import { SqliteTodayRepository } from "../db/repositories/sqlite-today-repository";
import { TaskService } from "../services/task-service";
import { TodayService } from "../services/today-service";
import { taskBasedProgress } from "../services/task-rules";
import { projectProgress } from "../services/organization-rules";
import type { TaskInput } from "../types/task";
let db: Database,
  projects: SqliteProjectRepository,
  milestones: SqliteMilestoneRepository,
  tasks: SqliteTaskRepository,
  service: TaskService,
  today: TodayService;
let instant: string;
const day = "2026-11-03";
beforeEach(() => {
  db = createTestDatabase();
  migrate(db);
  seedJade(db);
  projects = new SqliteProjectRepository(db);
  milestones = new SqliteMilestoneRepository(db);
  tasks = new SqliteTaskRepository(db);
  instant = "2026-11-03T12:00:00Z";
  service = new TaskService(
    tasks,
    projects,
    new SqliteLifeAreaRepository(db),
    milestones,
    "Europe/Paris",
    () => new Date(instant),
  );
  today = new TodayService(
    new SqliteTodayRepository(db),
    () => new Date(instant),
  );
});
afterEach(() => db.close());
const read = () => today.read(new SqliteUserRepository(db).getCurrent()!);
const create = (values: Partial<TaskInput> = {}) =>
  service.create(jade, { title: "Test Today", ...values });

test("Today is empty without fabricated data and uses the real profile", () => {
  db.query("UPDATE users SET name = 'Camille' WHERE id = ?").run(jade);
  expect(read()).toMatchObject({
    user: {
      name: "Camille",
      locale: "fr-FR",
      timezone: "Europe/Paris",
      week_start: "Monday",
    },
    day,
    dateLabel: "mardi 3 novembre",
    todayTasks: [],
    groups: [],
    mustCount: 0,
    followUps: [],
    overdueCount: 0,
    inboxCount: 0,
    activeProjects: [],
    todayProjectCount: 0,
  });
});
test("Today groups actionable tasks by priority; excludes other statuses, dates and archives", () => {
  for (const priority of ["none", "could", "should", "must"] as const)
    create({
      status: priority === "must" ? "doing" : "todo",
      priority,
      do_date: day,
    });
  for (const status of ["inbox", "waiting", "done", "someday"] as const)
    create({ status, priority: "must", do_date: day });
  create({ status: "todo", do_date: "2026-11-04" });
  create({ status: "todo" });
  const archived = create({ status: "todo", do_date: day });
  service.archive(jade, archived.id, true);
  const result = read();
  expect(result.todayTasks).toHaveLength(4);
  expect(result.groups.map((g) => g.priority)).toEqual([
    "must",
    "should",
    "could",
    "none",
  ]);
  expect(result.mustCount).toBe(1);
  expect(result.todayTasks.map((t) => t.id)).toEqual(
    service.list(jade, { view: "today" }).map((t) => t.id),
  );
});
test("Follow-ups include only due Waiting, are oldest first and bounded with exact total", () => {
  for (let i = 0; i < 7; i++)
    create({ status: "waiting", follow_up_date: i === 0 ? "2026-11-01" : day });
  create({ status: "waiting", follow_up_date: "2026-11-04" });
  create({ status: "waiting" });
  create({ status: "todo", follow_up_date: day });
  const archived = create({ status: "waiting", follow_up_date: day });
  service.archive(jade, archived.id, true);
  expect(read().followUpCount).toBe(7);
  expect(read().followUps).toHaveLength(5);
  expect(read().followUps[0].follow_up_date).toBe("2026-11-01");
  expect(read().followUpCount).toBe(
    service.list(jade, { view: "follow-ups" }).length,
  );
});
test("Overdue respects Deadline, not Do Date, and Inbox counts exclude archives", () => {
  create({ status: "todo", do_date: "2026-11-01" });
  create({ status: "todo", deadline: "2026-11-02" });
  create({ status: "waiting", deadline: "2026-11-02" });
  create({ status: "todo", deadline: day });
  create({ status: "done", deadline: "2026-11-02" });
  create({ status: "someday", deadline: "2026-11-02" });
  create();
  create();
  const archived = create({ deadline: "2026-11-02" });
  service.archive(jade, archived.id, true);
  expect(read()).toMatchObject({ overdueCount: 2, inboxCount: 2 });
  expect(read().overdueCount).toBe(
    service.list(jade, { view: "overdue" }).length,
  );
});
test("Project selection is active only, limited to four, Today first then recently modified", () => {
  const related = projects.create(jade, { title: "Older but relevant" });
  db.query("UPDATE projects SET updated_at = '2020-01-01' WHERE id = ?").run(
    related.id,
  );
  create({ status: "todo", do_date: day, project_id: related.id });
  const recent = projects.create(jade, { title: "Recent" });
  db.query("UPDATE projects SET updated_at = '2099-01-01' WHERE id = ?").run(
    recent.id,
  );
  for (let i = 0; i < 8; i++) projects.create(jade, { title: "Other" });
  for (const status of [
    "paused",
    "waiting",
    "someday",
    "completed",
    "archived",
  ] as const) {
    const project = projects.create(jade, { title: status, status });
    create({ status: "todo", do_date: day, project_id: project.id });
  }
  expect(read().activeProjects).toHaveLength(4);
  expect(
    read()
      .activeProjects.slice(0, 2)
      .map((p) => p.id),
  ).toEqual([related.id, recent.id]);
  expect(read().activeProjects.every((p) => p.status === "active")).toBe(true);
  expect(read().todayProjectCount).toBe(1);
});
test("All project modes match existing progress, and none/empty never invent a percentage", () => {
  for (const mode of ["none", "manual", "milestones", "task_based"] as const) {
    const project = projects.create(jade, {
      title: mode,
      progress_mode: mode,
      manual_progress: mode === "manual" ? 37 : null,
    });
    create({ project_id: project.id, status: "done" });
    create({ project_id: project.id, status: "todo" });
    milestones.create(jade, project.id, { title: "Step", status: "completed" });
    milestones.create(jade, project.id, { title: "Step 2" });
  }
  expect(
    Object.fromEntries(read().activeProjects.map((p) => [p.title, p.progress])),
  ).toEqual({ none: null, manual: 37, milestones: 50, task_based: 50 });
  for (const p of read().activeProjects) {
    expect(p.progress).toBe(
      p.progress_mode === "task_based"
        ? taskBasedProgress(tasks.list(jade, { today: day, projectId: p.id }))
        : projectProgress(p, milestones.list(jade, p.id)),
    );
  }
});
test("Task progress excludes Someday and archived, counts children only without an eligible same-project parent", () => {
  const project = projects.create(jade, {
    title: "Parent",
    progress_mode: "task_based",
  });
  const parent = create({ project_id: project.id, status: "todo" });
  create({ project_id: project.id, status: "done", parent_task_id: parent.id });
  create({ project_id: project.id, status: "done" });
  create({ project_id: project.id, status: "someday" });
  const archived = create({ project_id: project.id, status: "todo" });
  service.archive(jade, archived.id, true);
  expect(read().activeProjects[0]).toMatchObject({
    progress: 50,
    openTaskCount: 1,
  });
  service.archive(jade, parent.id, true);
  expect(read().activeProjects[0].progress).toBe(100);
  const otherProject = projects.create(jade, { title: "Other" });
  const externalParent = create({
    project_id: otherProject.id,
    status: "todo",
  });
  create({
    project_id: project.id,
    status: "todo",
    parent_task_id: externalParent.id,
  });
  expect(read().activeProjects.find((p) => p.id === project.id)?.progress).toBe(
    67,
  );
});
test("Completion and Undo update Focus, counters, overdue and Project progress", () => {
  const project = projects.create(jade, {
    title: "Live",
    progress_mode: "task_based",
  });
  const task = create({
    project_id: project.id,
    status: "doing",
    priority: "must",
    do_date: day,
    deadline: "2026-11-02",
  });
  service.changeStatus(jade, task.id, "done");
  expect(read()).toMatchObject({
    todayTasks: [],
    mustCount: 0,
    overdueCount: 0,
    todayProjectCount: 0,
  });
  expect(read().activeProjects[0].progress).toBe(100);
  service.changeStatus(jade, task.id, "doing");
  expect(read()).toMatchObject({
    mustCount: 1,
    overdueCount: 1,
    todayProjectCount: 1,
  });
  expect(read().activeProjects[0].progress).toBe(0);
});
test("Profile timezone determines Today around midnight and locale determines the label", () => {
  create({ status: "todo", do_date: "2026-11-04" });
  instant = "2026-11-03T23:30:00Z";
  expect(read().day).toBe("2026-11-04");
  expect(read().todayTasks).toHaveLength(1);
  db.query(
    "UPDATE users SET timezone = 'America/New_York', locale = 'en-US' WHERE id = ?",
  ).run(jade);
  expect(read().day).toBe(day);
  expect(read().dateLabel).toBe("Tuesday, November 3");
  expect(read().todayTasks).toHaveLength(0);
});
test("DST transition uses a calendar day without adding fixed 24-hour offsets", () => {
  instant = "2026-03-29T22:30:00Z";
  expect(read().day).toBe("2026-03-30");
  instant = "2026-10-25T22:30:00Z";
  expect(read().day).toBe("2026-10-25");
});
test("Read queries isolate profiles, projects and task aggregates", () => {
  db.query(
    "INSERT INTO users SELECT 'other', 'Other', avatar, theme, timezone, week_start, locale, created_at, updated_at FROM users WHERE id = ?",
  ).run(jade);
  const project = projects.create("other", { title: "Private" });
  service.create("other", {
    title: "Private",
    status: "todo",
    do_date: day,
    project_id: project.id,
    deadline: "2020-01-01",
  });
  service.create("other", { title: "Private Inbox" });
  service.create("other", {
    title: "Private waiting",
    status: "waiting",
    follow_up_date: day,
  });
  expect(read()).toMatchObject({
    todayTasks: [],
    activeProjects: [],
    followUps: [],
    inboxCount: 0,
    overdueCount: 0,
    todayProjectCount: 0,
  });
  expect(
    new SqliteTodayRepository(db).taskAggregates(jade, [project.id]),
  ).toEqual([]);
  expect(
    new SqliteTodayRepository(db).milestoneAggregates(jade, [project.id]),
  ).toEqual([]);
});
test("Empty task/milestone based projects retain null progress", () => {
  projects.create(jade, { title: "Tasks", progress_mode: "task_based" });
  projects.create(jade, { title: "Steps", progress_mode: "milestones" });
  expect(
    read().activeProjects.every(
      (p) => p.progress === null && p.openTaskCount === 0,
    ),
  ).toBe(true);
});

test("Today keeps a fixed query budget as the project history grows", () => {
  for (let index = 0; index < 40; index++) {
    const project = projects.create(jade, {
      title: `History ${index}`,
      progress_mode: "milestones",
    });
    milestones.create(jade, project.id, { title: "Step" });
    create({ project_id: project.id, status: "done" });
  }
  const query = spyOn(db, "query");
  try {
    const result = read();
    expect(result.activeProjects).toHaveLength(4);
    expect(query).toHaveBeenCalledTimes(7); // User + six batched/scoped reads, no per-project calls.
    expect(result.todayTasks).toHaveLength(0);
  } finally {
    query.mockRestore();
  }
});
