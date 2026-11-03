import type { Database, SQLQueryBindings } from "bun:sqlite";
import type {
  Task,
  TaskSummary,
  TaskFilter,
  TaskRepository,
  ChecklistItem,
  Reminder,
} from "../../types/task";
import {
  requireRecord,
  requiredText,
  validateOrder,
} from "../../services/organization-rules";
export const taskSelection = `SELECT t.*, CASE WHEN t.project_id IS NOT NULL THEN p.life_area_id ELSE t.life_area_id END AS effective_life_area_id, p.title AS project_title, a.name AS life_area_name FROM tasks t LEFT JOIN projects p ON p.id = t.project_id LEFT JOIN life_areas a ON a.id = CASE WHEN t.project_id IS NOT NULL THEN p.life_area_id ELSE t.life_area_id END`;
const columns = [
  "id",
  "user_id",
  "project_id",
  "milestone_id",
  "life_area_id",
  "parent_task_id",
  "title",
  "description",
  "status",
  "priority",
  "effort",
  "do_date",
  "deadline",
  "estimated_minutes",
  "context",
  "position",
  "waiting_for",
  "waiting_since",
  "follow_up_date",
  "completed_at",
  "archived_at",
  "created_at",
  "updated_at",
] as const;
type ChecklistRow = Omit<ChecklistItem, "is_completed"> & {
  is_completed: number;
};
export class SqliteTaskRepository implements TaskRepository {
  constructor(private readonly db: Database) {}
  transaction<T>(action: () => T): T {
    return this.db.transaction(action).immediate();
  }
  get(userId: string, id: string): TaskSummary | null {
    return this.db
      .query<
        TaskSummary,
        [string, string]
      >(`${taskSelection} WHERE t.user_id = ? AND t.id = ?`)
      .get(userId, id);
  }
  list(userId: string, filter: TaskFilter): TaskSummary[] {
    const where = ["t.user_id = ?"],
      args: SQLQueryBindings[] = [userId];
    const view = filter.view ?? "all";
    where.push(
      view === "archived"
        ? "t.archived_at IS NOT NULL"
        : "t.archived_at IS NULL",
    );
    switch (view) {
      case "inbox":
        where.push("t.status = 'inbox'");
        break;
      case "today":
        where.push("t.status IN ('todo','doing') AND t.do_date = ?");
        args.push(filter.today);
        break;
      case "upcoming":
        where.push("t.status IN ('todo','doing') AND t.do_date > ?");
        args.push(filter.today);
        break;
      case "waiting":
        where.push("t.status = 'waiting'");
        break;
      case "follow-ups":
        where.push("t.status = 'waiting' AND t.follow_up_date <= ?");
        args.push(filter.today);
        break;
      case "overdue":
        where.push("t.status NOT IN ('done','someday') AND t.deadline < ?");
        args.push(filter.today);
        break;
      case "someday":
        where.push("t.status = 'someday'");
        break;
      case "completed":
        where.push("t.status = 'done'");
        break;
      case "unscheduled":
        where.push("t.status IN ('todo','doing') AND t.do_date IS NULL");
        break;
      case "all":
      case "archived":
        break;
      default:
        throw new Error("Vue inconnue.");
    }
    if (filter.projectId) {
      where.push("t.project_id = ?");
      args.push(filter.projectId);
    }
    if (filter.areaId) {
      where.push("a.id = ?");
      args.push(filter.areaId);
    }
    if (filter.parentId) {
      where.push("t.parent_task_id = ?");
      args.push(filter.parentId);
    }
    if (filter.context) {
      where.push("t.context = ?");
      args.push(filter.context);
    }
    const fold = (value: string) =>
      value
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "")
        .toLocaleLowerCase("fr-FR");
    const query = fold(filter.search?.trim() ?? "");
    return this.db
      .query<TaskSummary, SQLQueryBindings[]>(
        `${taskSelection} WHERE ${where.join(" AND ")} ORDER BY CASE t.priority WHEN 'must' THEN 0 WHEN 'should' THEN 1 WHEN 'could' THEN 2 ELSE 3 END, t.do_date IS NULL, t.do_date, t.position, t.created_at, t.id`,
      )
      .all(...args)
      .filter(
        (task) =>
          !query ||
          fold(`${task.title} ${task.description ?? ""}`).includes(query),
      );
  }
  insert(task: Task): TaskSummary {
    this.db
      .query(
        `INSERT INTO tasks (${columns.join(",")}) VALUES (${columns.map(() => "?").join(",")})`,
      )
      .run(...columns.map((key) => task[key]));
    return requireRecord(this.get(task.user_id, task.id));
  }
  replace(task: Task): TaskSummary {
    const editable = columns.filter(
      (key) => key !== "id" && key !== "user_id" && key !== "created_at",
    );
    this.db
      .query(
        `UPDATE tasks SET ${editable.map((key) => `${key} = ?`).join(",")} WHERE id = ? AND user_id = ?`,
      )
      .run(...editable.map((key) => task[key]), task.id, task.user_id);
    return requireRecord(this.get(task.user_id, task.id));
  }
  checklist(userId: string, taskId: string): ChecklistItem[] {
    requireRecord(this.get(userId, taskId));
    return this.db
      .query<ChecklistRow, [string]>(
        "SELECT * FROM task_checklist_items WHERE task_id = ? ORDER BY position, id",
      )
      .all(taskId)
      .map((row) => ({ ...row, is_completed: !!row.is_completed }));
  }
  addChecklist(userId: string, taskId: string, label: string): ChecklistItem {
    return this.transaction(() => {
      const items = this.checklist(userId, taskId),
        id = crypto.randomUUID(),
        now = new Date().toISOString();
      const position = Math.max(-1, ...items.map((item) => item.position)) + 1;
      this.db
        .query(
          "INSERT INTO task_checklist_items (id,task_id,label,position,created_at,updated_at) VALUES (?,?,?,?,?,?)",
        )
        .run(id, taskId, requiredText(label), position, now, now);
      return this.checklist(userId, taskId).find((item) => item.id === id)!;
    });
  }
  updateChecklist(
    userId: string,
    taskId: string,
    id: string,
    label: string,
    complete: boolean,
  ) {
    requireRecord(
      this.checklist(userId, taskId).find((item) => item.id === id) ?? null,
    );
    if (typeof complete !== "boolean") throw new Error("Complétion invalide.");
    this.db
      .query(
        "UPDATE task_checklist_items SET label = ?, is_completed = ?, updated_at = ? WHERE id = ? AND task_id = ?",
      )
      .run(
        requiredText(label),
        Number(complete),
        new Date().toISOString(),
        id,
        taskId,
      );
  }
  reorderChecklist(userId: string, taskId: string, ids: string[]) {
    this.transaction(() => {
      validateOrder(this.checklist(userId, taskId), ids);
      ids.forEach((id, position) =>
        this.db
          .query(
            "UPDATE task_checklist_items SET position = ?, updated_at = ? WHERE id = ? AND task_id = ?",
          )
          .run(position, new Date().toISOString(), id, taskId),
      );
    });
  }
  removeChecklist(userId: string, taskId: string, id: string) {
    requireRecord(this.get(userId, taskId));
    this.db
      .query("DELETE FROM task_checklist_items WHERE id = ? AND task_id = ?")
      .run(id, taskId);
  }
  reminder(userId: string, taskId: string): Reminder | null {
    requireRecord(this.get(userId, taskId));
    return this.db
      .query<
        Reminder,
        [string, string]
      >("SELECT * FROM task_reminders WHERE user_id = ? AND task_id = ?")
      .get(userId, taskId);
  }
  setReminder(userId: string, taskId: string, at: string | null) {
    requireRecord(this.get(userId, taskId));
    if (at === null) {
      this.db
        .query("DELETE FROM task_reminders WHERE user_id = ? AND task_id = ?")
        .run(userId, taskId);
      return;
    }
    const now = new Date().toISOString();
    this.db
      .query(
        "INSERT INTO task_reminders (id,user_id,task_id,remind_at,created_at,updated_at) VALUES (?,?,?,?,?,?) ON CONFLICT(task_id) DO UPDATE SET remind_at = excluded.remind_at, updated_at = excluded.updated_at",
      )
      .run(crypto.randomUUID(), userId, taskId, at, now, now);
  }
}
