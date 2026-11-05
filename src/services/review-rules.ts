import { taskDate } from "./task-rules";
import { addDays, weekday } from "./planner-rules";
import type { ReviewMode } from "../types/review";
import type { User } from "../types/user";
const days = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
export function reviewPeriod(
  mode: ReviewMode,
  day: string,
  weekStart: User["week_start"],
) {
  if (!taskDate(day) || !["week", "month"].includes(mode))
    throw new Error("Période invalide.");
  if (mode === "week") {
    const from = addDays(
      day,
      -((weekday(day) - days.indexOf(weekStart) + 7) % 7),
    );
    return {
      from,
      to: addDays(from, 6),
      previous: addDays(from, -7),
      next: addDays(from, 7),
    };
  }
  const from = day.slice(0, 7) + "-01",
    date = new Date(from + "T12:00Z");
  date.setUTCMonth(date.getUTCMonth() + 1);
  const next = date.toISOString().slice(0, 10);
  date.setUTCMonth(date.getUTCMonth() - 2);
  return {
    from,
    to: addDays(next, -1),
    previous: date.toISOString().slice(0, 10),
    next,
  };
}
