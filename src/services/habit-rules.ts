import { addDays, weekday } from "./planner-rules";
import type {
  HabitRule,
  HabitEntry,
  HabitPause,
  HabitDay,
} from "../types/practices";
export const ruleFor = (rules: HabitRule[], day: string) =>
  rules
    .filter((r) => r.effective_from <= day)
    .sort((a, b) => b.effective_from.localeCompare(a.effective_from))[0];
export const isHabitPaused = (pauses: HabitPause[], day: string) =>
  pauses.some((p) => p.from_day <= day && (!p.to_day || p.to_day >= day));
export function habitDue(r: HabitRule, day: string) {
  if (day < r.effective_from) return false;
  if (r.frequency === "days") return r.weekdays.includes(weekday(day));
  if (r.frequency === "interval")
    return (
      Math.round(
        (Date.parse(day + "T12:00Z") -
          Date.parse(r.effective_from + "T12:00Z")) /
          86400000,
      ) %
        r.every_days ===
      0
    );
  return true;
}
export function habitDay(
  day: string,
  today: string,
  r: HabitRule | undefined,
  entry: HabitEntry | undefined,
  paused: boolean,
  timer: number,
): HabitDay {
  const target = r?.target ?? 1,
    value = (entry?.value ?? 0) + (r?.target_kind === "duration" ? timer : 0),
    base = {
      day,
      value,
      target,
      timer_minutes: r?.target_kind === "duration" ? timer : 0,
      note: entry?.note ?? "",
    };
  if (entry?.status === "skip" || entry?.status === "missed")
    return { ...base, state: entry.status };
  if (r && value >= target) return { ...base, state: "done" };
  if (value > 0) return { ...base, state: "progress" };
  if (!r) return { ...base, state: "off" };
  if (paused) return { ...base, state: "paused" };
  if (!habitDue(r, day)) return { ...base, state: "off" };
  return {
    ...base,
    state:
      day < today && ["days", "interval"].includes(r.frequency)
        ? "missed"
        : "pending",
  };
}
export function habitPeriod(r: HabitRule, day: string, weekStart: number) {
  if (r.frequency === "weekly") {
    const from = addDays(day, -((weekday(day) - weekStart + 7) % 7));
    return { from, to: addDays(from, 6) };
  }
  if (r.frequency === "monthly") {
    const from = day.slice(0, 7) + "-01",
      d = new Date(from + "T12:00Z");
    d.setUTCMonth(d.getUTCMonth() + 1);
    return { from, to: addDays(d.toISOString().slice(0, 10), -1) };
  }
  return { from: day, to: day };
}
