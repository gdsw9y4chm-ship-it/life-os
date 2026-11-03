import {
  goalTypes,
  goalStatuses,
  projectStatuses,
  progressModes,
  milestoneStatuses,
} from "../types/organization";
import type {
  LifeAreaInput,
  GoalInput,
  ProjectInput,
  MilestoneInput,
  Project,
  Milestone,
} from "../types/organization";
export function requiredText(value: unknown): string {
  if (typeof value !== "string" || !value.trim() || value.length > 300)
    throw new Error("Le nom ou titre est requis (300 caractères maximum).");
  return value.trim();
}
function optionalText(value: unknown): string | null {
  if (value == null || value === "") return null;
  if (typeof value !== "string" || value.length > 10000)
    throw new Error("Texte invalide (10 000 caractères maximum).");
  return value.trim() || null;
}
function choice<T extends string>(value: unknown, choices: readonly T[]): T {
  if (typeof value !== "string" || !choices.includes(value as T))
    throw new Error("Type ou statut invalide.");
  return value as T;
}
function number(value: unknown, max = Number.MAX_SAFE_INTEGER): number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < 0 ||
    value > max
  )
    throw new Error(`La valeur doit être comprise entre 0 et ${max}.`);
  return value;
}
function position(value: unknown): number {
  const result = number(value ?? 0);
  if (!Number.isSafeInteger(result))
    throw new Error("Position entière requise.");
  return result;
}
function date(value: unknown): string | null {
  if (value == null || value === "") return null;
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    !Number.isFinite(Date.parse(value)) ||
    new Date(value).toISOString().slice(0, 10) !== value
  )
    throw new Error("Date invalide.");
  return value;
}
export function lifeAreaValues(input: LifeAreaInput) {
  if (input.is_archived !== undefined && typeof input.is_archived !== "boolean")
    throw new Error("Archivage invalide.");
  return {
    name: requiredText(input.name),
    description: optionalText(input.description),
    icon: optionalText(input.icon),
    position: position(input.position),
    is_archived: input.is_archived ?? false,
  };
}
export function goalValues(input: GoalInput) {
  return {
    title: requiredText(input.title),
    description: optionalText(input.description),
    type: choice(input.type, goalTypes),
    status: choice(input.status ?? "active", goalStatuses),
    target_value:
      input.target_value == null ? null : number(input.target_value),
    target_unit: optionalText(input.target_unit),
    target_date: date(input.target_date),
  };
}
export function projectValues(input: ProjectInput) {
  const progress_mode = choice(input.progress_mode ?? "none", progressModes);
  const start_date = date(input.start_date),
    deadline = date(input.deadline);
  if (start_date && deadline && start_date > deadline)
    throw new Error("La deadline doit suivre la date de début.");
  // Changing mode clears an obsolete manual value; manual always requires an explicit valid value.
  const manual_progress =
    progress_mode === "manual" ? number(input.manual_progress, 100) : null;
  return {
    title: requiredText(input.title),
    description: optionalText(input.description),
    status: choice(input.status ?? "active", projectStatuses),
    life_area_id: optionalText(input.life_area_id),
    goal_id: optionalText(input.goal_id),
    start_date,
    deadline,
    progress_mode,
    manual_progress,
    position: position(input.position),
  };
}
export function milestoneValues(input: MilestoneInput) {
  return {
    title: requiredText(input.title),
    description: optionalText(input.description),
    status: choice(input.status ?? "pending", milestoneStatuses),
    position: position(input.position),
    target_date: date(input.target_date),
  };
}
export function requireRecord<T>(record: T | null): T {
  if (!record) throw new Error("Élément introuvable pour cet utilisateur.");
  return record;
}
export function validateOrder(existing: { id: string }[], ids: string[]): void {
  if (
    !Array.isArray(ids) ||
    ids.length !== existing.length ||
    new Set(ids).size !== ids.length ||
    ids.some((id) => !existing.some((item) => item.id === id))
  )
    throw new Error(
      "L’ordre doit contenir chaque élément exactement une fois.",
    );
}
export function projectProgress(
  project: Project,
  milestones: Milestone[],
): number | null {
  if (project.progress_mode === "manual") return project.manual_progress;
  if (project.progress_mode !== "milestones") return null;
  const own = milestones.filter((item) => item.project_id === project.id);
  return own.length
    ? Math.round(
        (100 * own.filter((item) => item.status === "completed").length) /
          own.length,
      )
    : null;
}
