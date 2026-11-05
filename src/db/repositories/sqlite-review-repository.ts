import type { Database } from "bun:sqlite";
import type { Task } from "../../types/task";
import type { LifeArea, Goal } from "../../types/organization";
import type { ResetRun, ResetKind } from "../../types/review";
type Row = Omit<ResetRun, "steps" | "priorities" | "notes"> & {
  steps: string;
  priorities: string;
  notes: string;
};
const decode = (r: Row): ResetRun => ({
  ...r,
  steps: JSON.parse(r.steps),
  priorities: JSON.parse(r.priorities),
  notes: JSON.parse(r.notes),
});
export class SqliteReviewRepository {
  constructor(readonly db: Database) {}
  lastTimes(user: string, now: string) {
    return this.db
      .query<
        { project_id: string; last: string },
        [string, string]
      >("SELECT project_id,MAX(CASE WHEN status='running' THEN ? ELSE COALESCE(ended_at,updated_at) END) AS last FROM time_sessions WHERE user_id=? AND project_id IS NOT NULL GROUP BY project_id")
      .all(now, user);
  }
  tasks(user: string) {
    return this.db
      .query<Task, [string]>("SELECT * FROM tasks WHERE user_id=?")
      .all(user);
  }
  areas(user: string) {
    return this.db
      .query<
        LifeArea,
        [string]
      >("SELECT * FROM life_areas WHERE user_id=? ORDER BY position")
      .all(user);
  }
  goals(user: string) {
    return this.db
      .query<
        Goal,
        [string]
      >("SELECT * FROM goals WHERE user_id=? AND status!='archived' ORDER BY updated_at DESC")
      .all(user);
  }
  run(user: string, id: string) {
    const row = this.db
      .query<
        Row,
        [string, string]
      >("SELECT * FROM reset_runs WHERE user_id=? AND id=?")
      .get(user, id);
    if (!row) throw new Error("Reset introuvable.");
    return decode(row);
  }
  runs(user: string) {
    return this.db
      .query<
        Row,
        [string]
      >("SELECT * FROM reset_runs WHERE user_id=? ORDER BY period_start DESC,created_at DESC LIMIT 50")
      .all(user)
      .map(decode);
  }
  start(
    user: string,
    kind: ResetKind,
    from: string,
    to: string,
    steps: number,
    now: string,
  ) {
    const old = this.db
      .query<
        { id: string },
        [string, string, string]
      >("SELECT id FROM reset_runs WHERE user_id=? AND kind=? AND period_start=?")
      .get(user, kind, from);
    if (old) return old.id;
    const id = crypto.randomUUID();
    this.db
      .query(
        "INSERT INTO reset_runs(id,user_id,kind,period_start,period_end,steps,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)",
      )
      .run(
        id,
        user,
        kind,
        from,
        to,
        JSON.stringify(Array(steps).fill(null)),
        now,
        now,
      );
    return id;
  }
  save(r: ResetRun, now: string) {
    const result = this.db
      .query(
        "UPDATE reset_runs SET cursor=?,steps=?,priorities=?,notes=?,completed_at=?,updated_at=?,revision=revision+1 WHERE id=? AND user_id=? AND revision=?",
      )
      .run(
        r.cursor,
        JSON.stringify(r.steps),
        JSON.stringify(r.priorities),
        JSON.stringify(r.notes),
        r.completed_at,
        now,
        r.id,
        r.user_id,
        r.revision,
      );
    if (!result.changes)
      throw new Error(
        "Ce Reset a changé dans un autre onglet. Actualisez avant de réessayer.",
      );
  }
  transaction<T>(fn: () => T) {
    return this.db.transaction(fn).immediate();
  }
}
