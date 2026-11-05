// Playwright-only: browserDatabasePath refuses the personal database.
import { browserDatabasePath } from "./browser-database";
import { connectDatabase } from "../src/db/connection";
import { SqliteUserRepository } from "../src/db/repositories/sqlite-user-repository";
import { SqliteTaskRepository } from "../src/db/repositories/sqlite-task-repository";
import { SqliteProjectRepository } from "../src/db/repositories/sqlite-project-repository";
import { SqliteLifeAreaRepository } from "../src/db/repositories/sqlite-life-area-repository";
import { SqliteMilestoneRepository } from "../src/db/repositories/sqlite-milestone-repository";
import { SqliteTimeRepository } from "../src/db/repositories/sqlite-time-repository";
import { SqlitePracticeRepository } from "../src/db/repositories/sqlite-practice-repository";
import { TaskService } from "../src/services/task-service";
import { TimeService } from "../src/services/time-service";
import { PracticeService } from "../src/services/practice-service";
import { calendarDay } from "../src/services/task-rules";
const db = connectDatabase(browserDatabasePath());
try {
  const u = new SqliteUserRepository(db).getCurrent()!,
    areas = new SqliteLifeAreaRepository(db),
    projects = new SqliteProjectRepository(db),
    tasks = new TaskService(
      new SqliteTaskRepository(db),
      projects,
      areas,
      new SqliteMilestoneRepository(db),
      u.timezone,
    );
  const p = projects.create(u.id, {
    title: "Un projet créatif",
    life_area_id: areas.list(u.id)[0].id,
    progress_mode: "task_based",
  });
  tasks.create(u.id, {
    title: "Clarifier mon idée",
    status: "inbox",
    project_id: p.id,
  });
  tasks.create(u.id, { title: "Retour du dossier", status: "waiting" });
  let clock = new Date(Date.now() - 30 * 60000);
  const timer = new TimeService(new SqliteTimeRepository(db), () => clock);
  const id = timer.start(u.id, {
    source: { kind: "project", id: p.id },
    title: "Travail créatif",
    target_minutes: 45,
  });
  clock = new Date(clock.getTime() + 25 * 60000);
  timer.stop(u.id, id);
  const practice = new PracticeService(new SqlitePracticeRepository(db), tasks);
  const day = calendarDay(new Date(), u.timezone),
    habit = practice.execute(u, {
      kind: "habit-save",
      values: {
        title: "Lire au calme",
        life_area_id: null,
        start_day: day,
        frequency: "weekly",
        weekdays: [],
        every_days: 1,
        quota: 3,
        target_kind: "count",
        target: 1,
        unit: "",
      },
    });
  practice.execute(u, {
    kind: "habit-log",
    id: habit,
    day,
    status: "done",
    value: 1,
  });
} finally {
  db.close();
}
