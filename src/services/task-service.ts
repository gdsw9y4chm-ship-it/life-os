import type {
  TaskRepository,
  TaskInput,
  TaskPatch,
  TaskFilter,
  Task,
  TaskStatus,
} from "../types/task";
import type {
  ProjectRepository,
  LifeAreaRepository,
  MilestoneRepository,
} from "../types/organization";
import { requireRecord } from "./organization-rules";
import {
  calendarDay,
  taskValues,
  reminderInstant,
  taskBasedProgress,
} from "./task-rules";
export class TaskService {
  constructor(
    private readonly tasks: TaskRepository,
    private readonly projects: ProjectRepository,
    private readonly areas: LifeAreaRepository,
    private readonly milestones: MilestoneRepository,
    private readonly timezone = "Europe/Paris",
    private readonly now = () => new Date(),
  ) {}
  today() {
    return calendarDay(this.now(), this.timezone);
  }
  get(userId: string, id: string) {
    return requireRecord(this.tasks.get(userId, id));
  }
  list(userId: string, filter: Omit<TaskFilter, "today"> = {}) {
    return this.tasks.list(userId, { ...filter, today: this.today() });
  }
  detail(userId: string, id: string) {
    return {
      task: this.get(userId, id),
      checklist: this.tasks.checklist(userId, id),
      reminder: this.tasks.reminder(userId, id),
      subtasks: this.list(userId, { parentId: id }),
    };
  }
  private relations(
    userId: string,
    values: ReturnType<typeof taskValues>,
    id: string,
  ) {
    if (values.milestone_id) {
      const milestone = requireRecord(
        this.milestones.get(userId, values.milestone_id),
      );
      if (values.project_id && values.project_id !== milestone.project_id)
        throw new Error("Le Milestone doit appartenir au Project choisi.");
      values.project_id = milestone.project_id;
    }
    if (values.life_area_id)
      requireRecord(this.areas.get(userId, values.life_area_id));
    if (values.project_id) {
      const project = requireRecord(
        this.projects.get(userId, values.project_id),
      );
      if (values.life_area_id && values.life_area_id !== project.life_area_id)
        throw new Error(
          "La Life Area est héritée du Project. Retirez le Project pour choisir un autre domaine.",
        );
      values.life_area_id = null;
    }
    if (values.parent_task_id) {
      const parent = this.get(userId, values.parent_task_id);
      if (parent.id === id || parent.parent_task_id)
        throw new Error("Un seul niveau de sous-tâches est autorisé.");
      const children = [
        ...this.list(userId, { parentId: id }),
        ...this.list(userId, { parentId: id, view: "archived" }),
      ];
      if (children.length)
        throw new Error(
          "Une tâche avec des enfants ne peut pas devenir une sous-tâche.",
        );
    }
  }
  create(userId: string, input: TaskInput) {
    return this.tasks.transaction(() => {
      const values = taskValues(input),
        id = crypto.randomUUID(),
        now = this.now().toISOString();
      this.relations(userId, values, id);
      if (values.status === "waiting" && !values.waiting_since)
        values.waiting_since = this.today();
      return this.tasks.insert({
        ...values,
        id,
        user_id: userId,
        completed_at: values.status === "done" ? now : null,
        archived_at: null,
        created_at: now,
        updated_at: now,
      });
    });
  }
  update(userId: string, id: string, patch: TaskPatch) {
    return this.tasks.transaction(() => {
      const previous = this.get(userId, id),
        values = taskValues({ ...previous, ...patch });
      this.relations(userId, values, id);
      const now = this.now().toISOString();
      if (values.status === "waiting" && !values.waiting_since)
        values.waiting_since = this.today();
      return this.tasks.replace({
        ...previous,
        ...values,
        completed_at:
          values.status === "done" ? (previous.completed_at ?? now) : null,
        updated_at: now,
      });
    });
  }
  changeStatus(userId: string, id: string, status: TaskStatus) {
    return this.update(userId, id, { status });
  }
  complete(userId: string, id: string) {
    return this.changeStatus(userId, id, "done");
  }
  reopen(userId: string, id: string) {
    return this.changeStatus(userId, id, "todo");
  }
  archive(userId: string, id: string, archived = true) {
    const task = this.get(userId, id),
      now = this.now().toISOString();
    return this.tasks.replace({
      ...task,
      archived_at: archived ? (task.archived_at ?? now) : null,
      updated_at: now,
    });
  }
  save(userId: string, id: string, patch: TaskPatch, remindAt?: string | null) {
    return this.tasks.transaction(() => {
      const at = remindAt === undefined ? undefined : reminderInstant(remindAt);
      const task = this.update(userId, id, patch);
      if (at !== undefined) this.tasks.setReminder(userId, id, at);
      return task;
    });
  }
  checklist(userId: string, taskId: string) {
    return this.tasks.checklist(userId, taskId);
  }
  addChecklist(userId: string, taskId: string, label: string) {
    return this.tasks.addChecklist(userId, taskId, label);
  }
  updateChecklist(
    userId: string,
    taskId: string,
    id: string,
    label: string,
    completed: boolean,
  ) {
    this.tasks.updateChecklist(userId, taskId, id, label, completed);
  }
  reorderChecklist(userId: string, taskId: string, ids: string[]) {
    this.tasks.reorderChecklist(userId, taskId, ids);
  }
  removeChecklist(userId: string, taskId: string, id: string) {
    this.tasks.removeChecklist(userId, taskId, id);
  }
  progress(userId: string, projectId: string) {
    requireRecord(this.projects.get(userId, projectId));
    return taskBasedProgress(this.list(userId, { projectId }));
  }
  listInbox(userId: string) {
    return this.list(userId, { view: "inbox" });
  }
  listToday(userId: string) {
    return this.list(userId, { view: "today" });
  }
  listUpcoming(userId: string) {
    return this.list(userId, { view: "upcoming" });
  }
  listWaiting(userId: string) {
    return this.list(userId, { view: "waiting" });
  }
  listFollowUps(userId: string) {
    return this.list(userId, { view: "follow-ups" });
  }
  listOverdue(userId: string) {
    return this.list(userId, { view: "overdue" });
  }
  listSomeday(userId: string) {
    return this.list(userId, { view: "someday" });
  }
  listCompleted(userId: string) {
    return this.list(userId, { view: "completed" });
  }
}
export type TaskCommand =
  | { kind: "create"; values: TaskInput }
  | { kind: "update"; id: string; values: TaskPatch; remindAt?: string | null }
  | { kind: "status"; id: string; status: TaskStatus }
  | { kind: "archive"; id: string; archived: boolean }
  | { kind: "checklist-add"; taskId: string; label: string }
  | {
      kind: "checklist-update";
      taskId: string;
      id: string;
      label: string;
      completed: boolean;
    }
  | { kind: "checklist-reorder"; taskId: string; ids: string[] }
  | { kind: "checklist-remove"; taskId: string; id: string };
export function executeTask(
  service: TaskService,
  userId: string,
  command: TaskCommand,
): string | null {
  switch (command.kind) {
    case "create":
      return service.create(userId, command.values).id;
    case "update":
      return service.save(userId, command.id, command.values, command.remindAt)
        .id;
    case "status":
      return service.changeStatus(userId, command.id, command.status).id;
    case "archive":
      if (typeof command.archived !== "boolean")
        throw new Error("Archivage invalide.");
      return service.archive(userId, command.id, command.archived).id;
    case "checklist-add":
      service.addChecklist(userId, command.taskId, command.label);
      return null;
    case "checklist-update":
      service.updateChecklist(
        userId,
        command.taskId,
        command.id,
        command.label,
        command.completed,
      );
      return null;
    case "checklist-reorder":
      service.reorderChecklist(userId, command.taskId, command.ids);
      return null;
    case "checklist-remove":
      service.removeChecklist(userId, command.taskId, command.id);
      return null;
    default:
      throw new Error("Opération inconnue.");
  }
}
export type TaskDetail = ReturnType<TaskService["detail"]>;
export type TaskEntity = Task;
