export const taskStatuses = [
  "inbox",
  "todo",
  "doing",
  "waiting",
  "done",
  "someday",
] as const;
export const taskPriorities = ["must", "should", "could", "none"] as const;
export const taskEfforts = ["low", "medium", "deep", "none"] as const;
export const taskContexts = [
  "Computer",
  "Phone",
  "Home",
  "Outside",
  "Shopping",
  "Admin",
] as const;
export const taskViews = [
  "inbox",
  "today",
  "upcoming",
  "waiting",
  "follow-ups",
  "overdue",
  "someday",
  "completed",
  "unscheduled",
  "all",
  "archived",
] as const;
export type TaskStatus = (typeof taskStatuses)[number];
export type TaskPriority = (typeof taskPriorities)[number];
export type TaskEffort = (typeof taskEfforts)[number];
export type TaskView = (typeof taskViews)[number];
export interface Task {
  id: string;
  user_id: string;
  project_id: string | null;
  milestone_id: string | null;
  life_area_id: string | null;
  parent_task_id: string | null;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  effort: TaskEffort;
  do_date: string | null;
  deadline: string | null;
  estimated_minutes: number | null;
  context: string | null;
  position: number;
  waiting_for: string | null;
  waiting_since: string | null;
  follow_up_date: string | null;
  completed_at: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}
export interface TaskSummary extends Task {
  effective_life_area_id: string | null;
  project_title: string | null;
  life_area_name: string | null;
}
export type TaskInput = Pick<Task, "title"> &
  Partial<
    Omit<
      Task,
      | "id"
      | "user_id"
      | "title"
      | "completed_at"
      | "archived_at"
      | "created_at"
      | "updated_at"
    >
  >;
export type TaskPatch = Partial<TaskInput>;
export interface TaskFilter {
  view?: TaskView;
  today: string;
  projectId?: string;
  areaId?: string;
  context?: string;
  search?: string;
  parentId?: string;
}
export interface ChecklistItem {
  id: string;
  task_id: string;
  label: string;
  is_completed: boolean;
  position: number;
  created_at: string;
  updated_at: string;
}
export interface Reminder {
  id: string;
  user_id: string;
  task_id: string;
  remind_at: string;
  created_at: string;
  updated_at: string;
}
export interface TaskRepository {
  get(userId: string, id: string): TaskSummary | null;
  list(userId: string, filter: TaskFilter): TaskSummary[];
  insert(task: Task): TaskSummary;
  replace(task: Task): TaskSummary;
  checklist(userId: string, taskId: string): ChecklistItem[];
  addChecklist(userId: string, taskId: string, label: string): ChecklistItem;
  updateChecklist(
    userId: string,
    taskId: string,
    id: string,
    label: string,
    complete: boolean,
  ): void;
  reorderChecklist(userId: string, taskId: string, ids: string[]): void;
  removeChecklist(userId: string, taskId: string, id: string): void;
  reminder(userId: string, taskId: string): Reminder | null;
  setReminder(userId: string, taskId: string, at: string | null): void;
  transaction<T>(action: () => T): T;
}

// Lightweight choices loaded only when a Today task's quick actions are opened.
export interface TaskReferences {
  projects: { id: string; title: string }[];
  areas: { id: string; name: string }[];
}
