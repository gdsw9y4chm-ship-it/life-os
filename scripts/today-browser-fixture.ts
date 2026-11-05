// Executed only by Playwright; never reads LIFE_OS_DB_PATH.
import { browserDatabasePath } from "./browser-database";
import { connectDatabase } from "../src/db/connection";
import { SqliteUserRepository } from "../src/db/repositories/sqlite-user-repository";
import { SqliteTaskRepository } from "../src/db/repositories/sqlite-task-repository";
import { SqliteProjectRepository } from "../src/db/repositories/sqlite-project-repository";
import { SqliteLifeAreaRepository } from "../src/db/repositories/sqlite-life-area-repository";
import { SqliteMilestoneRepository } from "../src/db/repositories/sqlite-milestone-repository";
import { TaskService } from "../src/services/task-service";
import { calendarDay } from "../src/services/task-rules";
import type { TaskInput } from "../src/types/task";
const db = connectDatabase(browserDatabasePath());
try {
  db.transaction(() => {
    db.exec(
      "DELETE FROM note_links; DELETE FROM list_items; DELETE FROM personal_lists; DELETE FROM notes; DELETE FROM time_pauses; DELETE FROM time_sessions; DELETE FROM routine_run_steps; DELETE FROM routine_runs; DELETE FROM routine_steps; DELETE FROM routines; DELETE FROM habit_entries; DELETE FROM habit_rules; DELETE FROM habit_pauses; DELETE FROM habits; DELETE FROM tracker_entries; DELETE FROM trackers; DELETE FROM planner_exceptions; DELETE FROM events; DELETE FROM time_blocks; DELETE FROM scheduled_tasks; DELETE FROM planner_series; DELETE FROM task_reminders; DELETE FROM task_checklist_items; DELETE FROM tasks WHERE parent_task_id IS NOT NULL; DELETE FROM tasks; DELETE FROM milestones; DELETE FROM projects; DELETE FROM goals;",
    );
    if (!["populated", "sparse"].includes(process.argv[2])) return;
    const user = new SqliteUserRepository(db).getCurrent()!;
    const projects = new SqliteProjectRepository(db),
      areas = new SqliteLifeAreaRepository(db),
      milestones = new SqliteMilestoneRepository(db);
    const service = new TaskService(
      new SqliteTaskRepository(db),
      projects,
      areas,
      milestones,
      user.timezone,
    );
    const day = calendarDay(new Date(), user.timezone);
    if (process.argv[2] === "sparse") {
      service.create(user.id, {
        title: "Une seule chose à faire",
        status: "todo",
        priority: "must",
        do_date: day,
      });
      return;
    }
    const area = areas.list(user.id).find((a) => a.name === "Travail & IA")!;
    const project = projects.create(user.id, {
      title: "Life OS · Today",
      life_area_id: area.id,
      progress_mode: "task_based",
    });
    projects.create(user.id, {
      title: "Maison · les essentiels",
      life_area_id: areas.list(user.id).find((a) => a.name === "Maison")!.id,
      progress_mode: "manual",
      manual_progress: 35,
    });
    const steps = projects.create(user.id, {
      title: "Portfolio créatif",
      progress_mode: "milestones",
    });
    milestones.create(user.id, steps.id, {
      title: "Sélection",
      status: "completed",
    });
    milestones.create(user.id, steps.id, { title: "Mise en page" });
    projects.create(user.id, {
      title: "Une nouvelle idée",
      progress_mode: "none",
    });
    const add = (title: string, values: Partial<TaskInput> = {}) =>
      service.create(user.id, { title, ...values });
    add("Finaliser Today", {
      status: "doing",
      priority: "must",
      do_date: day,
      project_id: project.id,
      estimated_minutes: 45,
      effort: "deep",
      context: "Computer",
    });
    add("Fondation validée", { status: "done", project_id: project.id });
    add("Préparer le dossier", {
      status: "todo",
      priority: "should",
      do_date: day,
      estimated_minutes: 20,
      context: "Admin",
    });
    add("Choisir les photos", {
      status: "todo",
      priority: "could",
      do_date: day,
      estimated_minutes: 15,
    });
    add("Appeler le vétérinaire", {
      status: "todo",
      do_date: day,
      context: "Phone",
    });
    add("Dossier location", {
      status: "waiting",
      follow_up_date: day,
      waiting_for: "réponse propriétaire",
      do_date: day,
    });
    add("Attente future", { status: "waiting", follow_up_date: "2099-12-01" });
    add("Facture à vérifier", { status: "todo", deadline: "2020-01-01" });
    add("Idée à classer");
    add("Penser au rendez-vous");
  })();
} finally {
  db.close();
}
