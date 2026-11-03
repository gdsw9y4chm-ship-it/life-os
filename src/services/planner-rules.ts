import {
  reminderFromLocal,
  localReminder,
} from "../features/tasks/reminder-time";
import { taskDate } from "./task-rules";
import type {
  PlannerSeries,
  PlannerException,
  Occurrence,
  PlannerInput,
} from "../types/planner";
export const addDays = (day: string, amount: number) =>
  new Date(Date.parse(day + "T12:00:00Z") + amount * 86400000)
    .toISOString()
    .slice(0, 10);
export const weekday = (day: string) =>
  new Date(day + "T12:00:00Z").getUTCDay();
const dayDiff = (a: string, b: string) =>
  Math.round(
    (Date.parse(a + "T12:00Z") - Date.parse(b + "T12:00Z")) / 86400000,
  );
export function plannerValues(input: PlannerInput): PlannerInput {
  if (
    !["event", "time_block", "scheduled_task"].includes(input.kind) ||
    !["once", "daily", "weekly", "monthly"].includes(input.frequency)
  )
    throw new Error("Type de planning invalide.");
  if (!input.title?.trim() || input.title.length > 300)
    throw new Error("Un titre de 300 caractères maximum est requis.");
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(input.start_local))
    throw new Error("Date et heure requises.");
  taskDate(input.start_local.slice(0, 10));
  reminderFromLocal(input.start_local, input.timezone);
  if (
    !Number.isInteger(input.duration_minutes) ||
    input.duration_minutes < 1 ||
    input.duration_minutes > 10080
  )
    throw new Error("Durée comprise entre 1 minute et 7 jours.");
  if (
    !Number.isInteger(input.interval_count) ||
    input.interval_count < 1 ||
    input.interval_count > 365
  )
    throw new Error("Intervalle invalide.");
  if (
    !Array.isArray(input.weekdays) ||
    input.weekdays.some((d) => !Number.isInteger(d) || d < 0 || d > 6)
  )
    throw new Error("Jours invalides.");
  const until = taskDate(input.until_day);
  if (until && until < input.start_local.slice(0, 10))
    throw new Error("Fin de série antérieure au début.");
  if (input.kind === "scheduled_task" && !input.task_id)
    throw new Error("Choisissez une Task existante.");
  return {
    ...input,
    title: input.title.trim(),
    until_day: until,
    weekdays: [...new Set(input.weekdays)].sort(),
  };
}
export function occursOn(series: PlannerSeries, day: string) {
  const anchor = series.start_local.slice(0, 10);
  if (day < anchor || (series.until_day && day > series.until_day))
    return false;
  const diff = dayDiff(day, anchor);
  if (series.frequency === "once") return diff === 0;
  if (series.frequency === "daily") return diff % series.interval_count === 0;
  if (series.frequency === "monthly") {
    const months =
      (Number(day.slice(0, 4)) - Number(anchor.slice(0, 4))) * 12 +
      Number(day.slice(5, 7)) -
      Number(anchor.slice(5, 7));
    return (
      months % series.interval_count === 0 && day.slice(8) === anchor.slice(8)
    );
  }
  const weekAnchor = addDays(anchor, -((weekday(anchor) + 6) % 7));
  const weeks = Math.floor(dayDiff(day, weekAnchor) / 7);
  return (
    weeks % series.interval_count === 0 &&
    (series.weekdays.length ? series.weekdays : [weekday(anchor)]).includes(
      weekday(day),
    )
  );
}
export function expandSeries(
  series: PlannerSeries,
  exceptions: PlannerException[],
  from: string,
  to: string,
): Occurrence[] {
  taskDate(from);
  taskDate(to);
  if (to < from || dayDiff(to, from) > 62)
    throw new Error("Chargez au maximum 63 jours.");
  if (series.archived) return [];
  const overrides = new Map(exceptions.map((e) => [e.occurrence_day, e]));
  const keys = new Set<string>();
  // Multi-day occurrences can begin before the displayed window.
  for (let day = addDays(from, -8); day <= to; day = addDays(day, 1))
    if (occursOn(series, day)) keys.add(day);
  // A moved occurrence may originate outside this window.
  for (const e of exceptions)
    if (
      e.start_local &&
      e.start_local.slice(0, 10) >= addDays(from, -8) &&
      e.start_local.slice(0, 10) <= to &&
      occursOn(series, e.occurrence_day)
    )
      keys.add(e.occurrence_day);
  const result: Occurrence[] = [];
  const rangeStart = reminderFromLocal(from + "T00:00", series.timezone)!;
  const rangeEnd = reminderFromLocal(
    addDays(to, 1) + "T00:00",
    series.timezone,
  )!;
  for (const key of keys) {
    const override = overrides.get(key);
    if (override?.cancelled) continue;
    const wall = override?.start_local ?? key + series.start_local.slice(10);
    let start: string;
    try {
      start = reminderFromLocal(wall, series.timezone)!;
    } catch {
      continue;
    }
    const end = new Date(
      Date.parse(start) +
        (override?.duration_minutes ?? series.duration_minutes) * 60000,
    ).toISOString();
    if (start < rangeEnd && end > rangeStart)
      result.push({
        series,
        key,
        day: wall.slice(0, 10),
        start,
        end,
        title: override?.title ?? series.title,
      });
  }
  return result.sort(
    (a, b) =>
      a.start.localeCompare(b.start) || a.series.id.localeCompare(b.series.id),
  );
}
export { localReminder, reminderFromLocal };
