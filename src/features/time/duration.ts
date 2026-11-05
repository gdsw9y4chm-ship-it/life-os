import type { TimeSession, TimePause } from "../../types/time";
// A display tick never changes stored data. Actual duration is the intersection of persisted active intervals.
export function actualSeconds(
  s: Pick<TimeSession, "started_at" | "ended_at">,
  pauses: Pick<TimePause, "started_at" | "ended_at">[],
  now: string,
  from?: string,
  to?: string,
) {
  const start = Math.max(
    Date.parse(s.started_at),
    from ? Date.parse(from) : -Infinity,
  );
  const end = Math.min(
    Date.parse(s.ended_at ?? now),
    to ? Date.parse(to) : Infinity,
  );
  if (end <= start) return 0;
  const paused = pauses.reduce(
    (n, p) =>
      n +
      Math.max(
        0,
        Math.min(end, Date.parse(p.ended_at ?? now)) -
          Math.max(start, Date.parse(p.started_at)),
      ),
    0,
  );
  return Math.max(0, (end - start - paused) / 1000);
}
export function durationLabel(seconds: number) {
  const n = Math.max(0, Math.floor(seconds));
  return `${Math.floor(n / 3600)
    .toString()
    .padStart(
      2,
      "0",
    )}:${Math.floor(n / 60) % 60 < 10 ? "0" : ""}${Math.floor(n / 60) % 60}:${(n % 60).toString().padStart(2, "0")}`;
}
