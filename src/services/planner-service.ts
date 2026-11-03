import type { SqlitePlannerRepository } from "../db/repositories/sqlite-planner-repository";
import type { EditScope, PlannerInput } from "../types/planner";
import {
  addDays,
  expandSeries,
  occursOn,
  plannerValues,
  reminderFromLocal,
} from "./planner-rules";
export class PlannerService {
  constructor(private readonly repo: SqlitePlannerRepository) {}
  list(user: string, from: string, to: string, timezone?: string) {
    const displayFrom = from,
      displayTo = to;
    if (timezone) {
      from = addDays(from, -1);
      to = addDays(to, 1);
    }
    const series = this.repo.list(user, addDays(from, -8), to),
      exceptions = this.repo.exceptions(series.map((s) => s.id));
    return series
      .flatMap((s) =>
        expandSeries(
          s,
          exceptions.filter((e) => e.series_id === s.id),
          from,
          to,
        ),
      )
      .filter(
        (item) =>
          !timezone ||
          (item.start <
            reminderFromLocal(addDays(displayTo, 1) + "T00:00", timezone)! &&
            item.end > reminderFromLocal(displayFrom + "T00:00", timezone)!),
      )
      .sort((a, b) => a.start.localeCompare(b.start));
  }
  create(user: string, input: PlannerInput) {
    return this.repo.transaction(() =>
      this.repo.create(user, plannerValues(input)),
    );
  }
  edit(
    user: string,
    id: string,
    key: string,
    scope: EditScope,
    input: PlannerInput,
  ) {
    return this.repo.transaction(() => {
      if (!["occurrence", "future", "series"].includes(scope))
        throw new Error("Portée invalide.");
      const current = this.repo.get(user, id),
        v = plannerValues(input);
      if (current.archived || !occursOn(current, key))
        throw new Error("Occurrence introuvable.");
      if (
        v.kind !== current.kind ||
        (v.task_id ?? null) !== (current.task_id ?? null)
      )
        throw new Error("Le type et la Task liée sont immuables.");
      if (current.frequency === "once" || scope === "series") {
        this.repo.update(user, id, v);
        return id;
      }
      if (scope === "occurrence") {
        this.repo.exception(id, key, v);
        return id;
      }
      if (scope !== "future") throw new Error("Portée invalide.");
      // Split, retaining old rows and exceptions for the past; new segment gets its own stable anchor.
      if (key === current.start_local.slice(0, 10))
        return this.repo.update(user, id, v).id;
      this.repo.update(user, id, { ...current, until_day: addDays(key, -1) });
      const next = this.repo.create(user, v);
      // Future exceptions are retained for dates that still belong to the new pattern.
      for (const e of this.repo
        .exceptions([id])
        .filter((e) => e.occurrence_day >= key)) {
        this.repo.exception(
          next.id,
          e.occurrence_day,
          e.cancelled
            ? null
            : {
                title: e.title ?? v.title,
                start_local:
                  e.start_local ?? e.occurrence_day + v.start_local.slice(10),
                duration_minutes: e.duration_minutes ?? v.duration_minutes,
              },
        );
      }
      return next.id;
    });
  }
  remove(user: string, id: string, key: string, scope: EditScope) {
    this.repo.transaction(() => {
      const s = this.repo.get(user, id);
      if (!occursOn(s, key)) throw new Error("Occurrence introuvable.");
      if (scope === "occurrence") this.repo.exception(id, key, null);
      else if (
        scope === "series" ||
        (scope === "future" && key === s.start_local.slice(0, 10))
      )
        this.repo.archive(user, id);
      else if (scope === "future")
        this.repo.update(user, id, { ...s, until_day: addDays(key, -1) });
      else throw new Error("Portée invalide.");
    });
  }
}
