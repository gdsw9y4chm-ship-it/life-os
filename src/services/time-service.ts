import type { SqliteTimeRepository } from "../db/repositories/sqlite-time-repository";
import { SqlitePlannerRepository } from "../db/repositories/sqlite-planner-repository";
import { expandSeries, addDays, reminderFromLocal } from "./planner-rules";
import { calendarDay } from "./task-rules";
import { actualSeconds } from "../features/time/duration";
import type { TimeSession, StartTime, ManualTime } from "../types/time";
function instant(value: string) {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value)))
    throw new Error("Date invalide.");
  return new Date(value).toISOString();
}
function title(value: string) {
  if (typeof value !== "string" || !value.trim() || value.length > 300)
    throw new Error("Titre requis (300 caractères maximum).");
  return value.trim();
}
export class TimeService {
  constructor(
    private repo: SqliteTimeRepository,
    private clock: () => Date = () => new Date(),
  ) {}
  now() {
    return this.clock().toISOString();
  }
  start(user: string, v: StartTime) {
    return this.repo.transaction(() => {
      if (
        !["quick", "task", "project", "life_area", "planner", "habit", "routine"].includes(
          v.source.kind,
        )
      )
        throw new Error("Source invalide.");
      if (v.source.kind !== "quick" && !v.source.id)
        throw new Error("Source requise.");
      if (
        v.target_minutes != null &&
        (!Number.isInteger(v.target_minutes) ||
          v.target_minutes < 1 ||
          v.target_minutes > 10080)
      )
        throw new Error("Objectif invalide.");
      let context = this.repo.context(user, v.source),
        planner_id: string | null = null,
        occurrence_key: string | null = null,
        planned_minutes: number | null = null;
      if (v.source.kind === "planner") {
        const pr = new SqlitePlannerRepository(this.repo.db),
          s = pr.get(user, v.source.id!);
        if (!v.source.key) throw new Error("Occurrence requise.");
        const exceptions = pr.exceptions([s.id]),
          e = exceptions.find((e) => e.occurrence_day === v.source.key),
          day = e?.start_local?.slice(0, 10) ?? v.source.key;
        const occurrence = expandSeries(s, exceptions, day, day).find(
          (o) => o.key === v.source.key,
        );
        if (!occurrence || s.kind === "event")
          throw new Error("Créneau de travail introuvable.");
        context = s.task_id
          ? this.repo.context(user, { kind: "task", id: s.task_id })
          : s.project_id
            ? this.repo.context(user, { kind: "project", id: s.project_id })
            : s.life_area_id
              ? this.repo.context(user, {
                  kind: "life_area",
                  id: s.life_area_id,
                })
              : context;
        context.title = occurrence.title;
        planner_id = s.id;
        occurrence_key = occurrence.key;
        planned_minutes =
          (Date.parse(occurrence.end) - Date.parse(occurrence.start)) / 60000;
      }
      const sessionTitle = title(v.title?.trim() || context.title),
        current = this.repo.running(user),
        now = this.now();
      if (current) {
        if (now < current.updated_at) throw new Error("Horloge antérieure à la dernière transition.");
        if (v.conflict === "pause") this.repo.pause(current.id, now);
        else if (v.conflict === "stop") {this.repo.closePause(current.id, now);this.repo.state(current.id,"completed",now);}
        else
          throw new Error(
            "Une session est en cours : choisissez Pause & Start ou Stop & Start.",
          );
      }
      const session: TimeSession = {
        id: crypto.randomUUID(),
        user_id: user,
        ...context,
        title: sessionTitle,
        planner_id,
        occurrence_key,
        planned_minutes,
        target_minutes: v.target_minutes ?? null,
        status: "running",
        source_kind: v.source.kind,
        started_at: now,
        ended_at: null,
        created_at: now,
        updated_at: now,
      };
      this.repo.insert(session);
      return session.id;
    });
  }
  pause(user: string, id: string) {
    return this.repo.transaction(() => {
      const s = this.repo.get(user, id);
      if (s.status === "paused") return id;
      if (s.status !== "running") throw new Error("Session déjà terminée.");
      const now = this.now();
      if (now < s.updated_at) throw new Error("Horloge antérieure à la dernière transition.");
      this.repo.pause(id, now);
      return id;
    });
  }
  resume(user: string, id: string) {
    return this.repo.transaction(() => {
      const s = this.repo.get(user, id);
      if (s.status === "running") return id;
      if (s.status !== "paused") throw new Error("Session déjà terminée.");
      const current = this.repo.running(user);
      const now = this.now();
      if (now < s.updated_at || (current && now < current.updated_at)) throw new Error("Horloge antérieure à la dernière transition.");
      if (current) this.repo.pause(current.id, now);
      this.repo.closePause(id, now);
      this.repo.state(id, "running", now);
      return id;
    });
  }
  stop(user: string, id: string) {
    return this.repo.transaction(() => {
      const s = this.repo.get(user, id);
      if (s.status === "completed") return id;
      const now = this.now();
      if (now < s.updated_at) throw new Error("Horloge antérieure à la dernière transition.");
      this.repo.closePause(id, now);
      this.repo.state(id, "completed", now);
      return id;
    });
  }
  manual(user: string, v: ManualTime) {
    return this.repo.transaction(() => {
      const start = instant(v.started_at),
        end = instant(v.ended_at),
        now = this.now(),
        name = title(v.title);
      if (start >= end || end > now)
        throw new Error("Fin postérieure au début, sans date future.");
      if (!Array.isArray(v.pauses)) throw new Error("Pauses invalides.");
      const pauses = v.pauses
        .map((p) => ({
          started_at: instant(p.started_at),
          ended_at: instant(p.ended_at),
        }))
        .sort((a, b) => a.started_at.localeCompare(b.started_at));
      let previous = start;
      for (const p of pauses) {
        if (
          p.started_at < previous ||
          p.ended_at <= p.started_at ||
          p.ended_at > end
        )
          throw new Error(
            "Les pauses doivent être dans la session et sans chevauchement.",
          );
        previous = p.ended_at;
      }
      const id = v.id ?? crypto.randomUUID();
      if (v.id) {
        if (this.repo.get(user, id).status !== "completed")
          throw new Error(
            "Terminez la session avant de corriger son historique.",
          );
      } else
        this.repo.insert({
          id,
          user_id: user,
          title: name,
          status: "completed",
          source_kind: "manual",
          task_id: null,
          project_id: null,
          goal_id: null,
          life_area_id: null,
          planner_id: null,
          occurrence_key: null,
          planned_minutes: null,
          target_minutes: null,
          started_at: start,
          ended_at: end,
          created_at: now,
          updated_at: now,
        });
      this.repo.correct(id, name, start, end, pauses, now);
      return id;
    });
  }
  snapshot(user: string, timezone: string) {
    const now = this.now(),
      day = calendarDay(new Date(now), timezone),
      from = reminderFromLocal(day + "T00:00", timezone)!,
      to = reminderFromLocal(addDays(day, 1) + "T00:00", timezone)!;
    const unfinished = this.repo.unfinished(user),
      history = this.repo.history(user),
      today = this.repo.range(user, from, to);
    const all = [
        ...new Map(
          [...unfinished, ...history, ...today].map((s) => [s.id, s]),
        ).values(),
      ],
      pauses = this.repo.pauses(all.map((s) => s.id));
    const enrich = (s: TimeSession) => ({
      ...s,
      pauses: pauses.filter((p) => p.session_id === s.id),
      actual_duration: actualSeconds(
        s,
        pauses.filter((p) => p.session_id === s.id),
        now,
      ),
    });
    return {
      now,
      day,
      timezone,
      unfinished: unfinished.map(enrich),
      history: history.map(enrich),
      today_seconds: today.reduce(
        (n, s) =>
          n +
          actualSeconds(
            s,
            pauses.filter((p) => p.session_id === s.id),
            now,
            from,
            to,
          ),
        0,
      ),
    };
  }
}
