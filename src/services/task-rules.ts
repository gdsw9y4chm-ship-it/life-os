import { taskStatuses, taskPriorities, taskEfforts } from "../types/task";
import type { Task, TaskInput } from "../types/task";
import { requiredText } from "./organization-rules";
export function calendarDay(now: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  return ["year", "month", "day"]
    .map((key) => parts.find((p) => p.type === key)!.value)
    .join("-");
}
export function taskDate(value: unknown): string | null {
  if (value === undefined || value === null || value === "") return null;
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    !Number.isFinite(Date.parse(value)) ||
    new Date(value).toISOString().slice(0, 10) !== value
  )
    throw new Error("Date invalide.");
  return value;
}
function text(value: unknown): string | null {
  if (value == null || value === "") return null;
  if (typeof value !== "string" || value.length > 10000)
    throw new Error("Texte invalide.");
  return value.trim() || null;
}
function choice<T extends string>(value: unknown, options: readonly T[]): T {
  if (typeof value !== "string" || !options.includes(value as T))
    throw new Error("Statut, priorité ou effort invalide.");
  return value as T;
}
function integer(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0)
    throw new Error("Nombre entier positif ou nul requis.");
  return value;
}
export function taskValues(input: TaskInput) {
  return {
    title: requiredText(input.title),
    description: text(input.description),
    status: choice(
      input.status === undefined ? "inbox" : input.status,
      taskStatuses,
    ),
    priority: choice(
      input.priority === undefined ? "none" : input.priority,
      taskPriorities,
    ),
    effort: choice(
      input.effort === undefined ? "none" : input.effort,
      taskEfforts,
    ),
    project_id: text(input.project_id),
    milestone_id: text(input.milestone_id),
    life_area_id: text(input.life_area_id),
    parent_task_id: text(input.parent_task_id),
    do_date: taskDate(input.do_date),
    deadline: taskDate(input.deadline),
    estimated_minutes:
      input.estimated_minutes == null ? null : integer(input.estimated_minutes),
    context: text(input.context),
    position: integer(input.position ?? 0),
    waiting_for: text(input.waiting_for),
    waiting_since: taskDate(input.waiting_since),
    follow_up_date: taskDate(input.follow_up_date),
  };
}
export function taskBasedProgress(tasks: Task[]): number | null {
  const eligible = tasks.filter(
    (task) => !task.archived_at && task.status !== "someday",
  );
  const ids = new Set(eligible.map((task) => task.id));
  const counted = eligible.filter(
    (task) => !task.parent_task_id || !ids.has(task.parent_task_id),
  );
  return counted.length
    ? Math.round(
        (100 * counted.filter((task) => task.status === "done").length) /
          counted.length,
      )
    : null;
}
export function reminderInstant(value: unknown): string | null {
  if (value == null || value === "") return null;
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/.test(
      value,
    ) ||
    !Number.isFinite(Date.parse(value))
  )
    throw new Error("Le rappel doit être un instant avec fuseau horaire.");
  taskDate(value.slice(0, 10));
  return new Date(value).toISOString();
}
