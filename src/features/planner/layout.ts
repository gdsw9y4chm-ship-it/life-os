import type { Occurrence } from "../../types/planner";
// Assign stable lanes to each connected overlap group; chained overlaps must not share a lane.
export function occurrenceLanes(items: Occurrence[]) {
  const result = new Map<string, { lane: number; columns: number }>();
  const sorted = [...items].sort(
    (a, b) => a.start.localeCompare(b.start) || b.end.localeCompare(a.end),
  );
  let group: Occurrence[] = [],
    end = "";
  function flush() {
    const ends: string[] = [];
    for (const item of group) {
      let lane = ends.findIndex((value) => value <= item.start);
      if (lane < 0) lane = ends.length;
      ends[lane] = item.end;
      result.set(item.series.id + item.key, { lane, columns: 0 });
    }
    for (const item of group)
      result.get(item.series.id + item.key)!.columns = ends.length;
  }
  for (const item of sorted) {
    if (group.length && item.start >= end) {
      flush();
      group = [];
      end = "";
    }
    group.push(item);
    if (item.end > end) end = item.end;
  }
  flush();
  return result;
}
