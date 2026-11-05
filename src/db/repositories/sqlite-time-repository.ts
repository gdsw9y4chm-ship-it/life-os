import type { Database } from "bun:sqlite";
import type { TimeSession, TimePause, TimeSource } from "../../types/time";
export class SqliteTimeRepository {
  constructor(readonly db: Database) {}
  transaction<T>(fn: () => T) {
    return this.db.transaction(fn).immediate();
  }
  get(user: string, id: string) {
    const s = this.db
      .query<
        TimeSession,
        [string, string]
      >("SELECT * FROM time_sessions WHERE user_id=? AND id=?")
      .get(user, id);
    if (!s) throw new Error("Session introuvable.");
    return s;
  }
  running(user: string) {
    return this.db
      .query<
        TimeSession,
        [string]
      >("SELECT * FROM time_sessions WHERE user_id=? AND status='running'")
      .get(user);
  }
  unfinished(user: string) {
    return this.db
      .query<
        TimeSession,
        [string]
      >("SELECT * FROM time_sessions WHERE user_id=? AND status!='completed' ORDER BY started_at DESC")
      .all(user);
  }
  history(user: string) {
    return this.db
      .query<
        TimeSession,
        [string]
      >("SELECT * FROM time_sessions WHERE user_id=? AND status='completed' ORDER BY started_at DESC LIMIT 50")
      .all(user);
  }
  range(user: string, from: string, to: string) {
    return this.db
      .query<
        TimeSession,
        [string, string, string]
      >("SELECT * FROM time_sessions WHERE user_id=? AND started_at<? AND (ended_at IS NULL OR ended_at>?)")
      .all(user, to, from);
  }
  habitRange(user: string, from: string, to: string) {
    return this.db
      .query<
        TimeSession,
        [string, string, string]
      >("SELECT * FROM time_sessions WHERE user_id=? AND habit_id IS NOT NULL AND status='completed' AND started_at<? AND ended_at>?")
      .all(user, to, from);
  }
  pauses(ids: string[]) {
    return ids.length
      ? this.db
          .query<
            TimePause,
            string[]
          >(`SELECT * FROM time_pauses WHERE session_id IN (${ids.map(() => "?").join(",")}) ORDER BY started_at`)
          .all(...ids)
      : [];
  }
  insert(s: TimeSession) {
    const keys = Object.keys(s) as (keyof TimeSession)[];
    this.db
      .query(
        `INSERT INTO time_sessions (${keys.join(",")}) VALUES (${keys.map(() => "?").join(",")})`,
      )
      .run(...keys.map((k) => s[k] ?? null));
  }
  state(id: string, status: TimeSession["status"], now: string) {
    this.db
      .query(
        "UPDATE time_sessions SET status=?,ended_at=?,updated_at=? WHERE id=?",
      )
      .run(status, status === "completed" ? now : null, now, id);
  }
  pause(id: string, now: string) {
    this.db
      .query("INSERT INTO time_pauses(id,session_id,started_at) VALUES(?,?,?)")
      .run(crypto.randomUUID(), id, now);
    this.state(id, "paused", now);
  }
  closePause(id: string, now: string) {
    this.db
      .query(
        "UPDATE time_pauses SET ended_at=? WHERE session_id=? AND ended_at IS NULL",
      )
      .run(now, id);
  }
  correct(
    id: string,
    title: string,
    start: string,
    end: string,
    pauses: { started_at: string; ended_at: string }[],
    now: string,
  ) {
    this.db
      .query(
        "UPDATE time_sessions SET title=?,started_at=?,ended_at=?,updated_at=? WHERE id=?",
      )
      .run(title, start, end, now, id);
    this.db.query("DELETE FROM time_pauses WHERE session_id=?").run(id);
    for (const p of pauses)
      this.db
        .query(
          "INSERT INTO time_pauses(id,session_id,started_at,ended_at) VALUES(?,?,?,?)",
        )
        .run(crypto.randomUUID(), id, p.started_at, p.ended_at);
  }
  context(user: string, source: TimeSource) {
    const result = {
      title: "Session libre",
      habit_id: null as string | null,
      routine_run_id: null as string | null,
      routine_run_step_id: null as string | null,
      task_id: null as string | null,
      project_id: null as string | null,
      goal_id: null as string | null,
      life_area_id: null as string | null,
    };
    if (source.kind === "task") {
      const t = this.db
        .query<
          {
            title: string;
            project_id: string | null;
            life_area_id: string | null;
          },
          [string, string]
        >(
          "SELECT title,project_id,life_area_id FROM tasks WHERE user_id=? AND id=?",
        )
        .get(user, source.id!);
      if (!t) throw new Error("Task introuvable.");
      Object.assign(result, t, { task_id: source.id });
    } else if (source.kind === "project") result.project_id = source.id!;
    else if (source.kind === "life_area") result.life_area_id = source.id!;
    if (source.kind === "habit") {
      const h = this.db
        .query<
          { title: string; life_area_id: string | null },
          [string, string]
        >("SELECT title,life_area_id FROM habits WHERE user_id=? AND id=? AND archived=0")
        .get(user, source.id!);
      if (!h) throw new Error("Habit introuvable.");
      Object.assign(result, h, { habit_id: source.id });
    }
    if (source.kind === "routine") {
      const r = this.db
        .query<
          { title: string },
          [string, string]
        >("SELECT title FROM routine_runs WHERE user_id=? AND id=? AND status='running'")
        .get(user, source.id!);
      if (!r) throw new Error("Routine Run actif introuvable.");
      result.title = r.title;
      result.routine_run_id = source.id!;
      if (source.key) {
        const step = this.db
          .query<
            { title: string },
            [string, string]
          >("SELECT title FROM routine_run_steps WHERE run_id=? AND id=? AND kind='timer' AND status='pending'")
          .get(source.id!, source.key);
        if (!step) throw new Error("Étape Timer introuvable.");
        result.title = step.title;
        result.routine_run_step_id = source.key;
      }
    }
    if (result.project_id) {
      const p = this.db
        .query<
          {
            title: string;
            goal_id: string | null;
            life_area_id: string | null;
          },
          [string, string]
        >(
          "SELECT title,goal_id,life_area_id FROM projects WHERE user_id=? AND id=?",
        )
        .get(user, result.project_id);
      if (!p) throw new Error("Project introuvable.");
      result.goal_id = p.goal_id;
      result.life_area_id = p.life_area_id ?? result.life_area_id;
      if (source.kind === "project") result.title = p.title;
    }
    if (result.life_area_id) {
      const a = this.db
        .query<
          { name: string },
          [string, string]
        >("SELECT name FROM life_areas WHERE user_id=? AND id=?")
        .get(user, result.life_area_id);
      if (!a) throw new Error("Life Area introuvable.");
      if (source.kind === "life_area") result.title = a.name;
    }
    return result;
  }
}
