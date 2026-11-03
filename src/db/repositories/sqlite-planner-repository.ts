import type { Database } from "bun:sqlite";
import type {
  PlannerSeries,
  PlannerInput,
  PlannerException,
} from "../../types/planner";
type Row = Omit<PlannerSeries, "weekdays"> & { weekdays: string };
const select = `SELECT s.*, e.location,e.description,b.project_id,b.life_area_id,st.task_id,t.status AS task_status FROM planner_series s LEFT JOIN events e ON e.id=s.id LEFT JOIN time_blocks b ON b.id=s.id LEFT JOIN scheduled_tasks st ON st.id=s.id LEFT JOIN tasks t ON t.id=st.task_id`;
const decode = (r: Row): PlannerSeries => ({
  ...r,
  weekdays: JSON.parse(r.weekdays),
});
export class SqlitePlannerRepository {
  constructor(readonly db: Database) {}
  get(user: string, id: string) {
    const row = this.db
      .query<Row, [string, string]>(select + " WHERE s.user_id=? AND s.id=?")
      .get(user, id);
    if (!row) throw new Error("Élément de planning introuvable.");
    return decode(row);
  }
  list(user: string, from: string, to: string) {
    return this.db
      .query<Row, [string, string, string, string, string, string]>(
        select +
          ` WHERE s.user_id=? AND s.archived=0 AND (
   (substr(s.start_local,1,10)<=? AND (s.until_day IS NULL OR s.until_day>=?) AND (s.frequency!='once' OR substr(s.start_local,1,10)>=?)) OR
   EXISTS(SELECT 1 FROM planner_exceptions x WHERE x.series_id=s.id AND substr(x.start_local,1,10) BETWEEN ? AND ?))`,
      )
      .all(user, to, from, from, from, to)
      .map(decode);
  }
  exceptions(ids: string[]) {
    return ids.length
      ? this.db
          .query<
            PlannerException,
            string[]
          >(`SELECT * FROM planner_exceptions WHERE series_id IN (${ids.map(() => "?").join(",")})`)
          .all(...ids)
      : [];
  }
  create(user: string, v: PlannerInput) {
    const id = crypto.randomUUID(),
      now = new Date().toISOString();
    this.db
      .query(
        "INSERT INTO planner_series(id,user_id,kind,title,start_local,duration_minutes,timezone,frequency,interval_count,weekdays,until_day,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
      )
      .run(
        id,
        user,
        v.kind,
        v.title,
        v.start_local,
        v.duration_minutes,
        v.timezone,
        v.frequency,
        v.interval_count,
        JSON.stringify(v.weekdays),
        v.until_day,
        now,
        now,
      );
    if (v.kind === "event")
      this.db
        .query("INSERT INTO events(id,location,description) VALUES(?,?,?)")
        .run(id, v.location ?? "", v.description ?? "");
    if (v.kind === "time_block")
      this.db
        .query(
          "INSERT INTO time_blocks(id,project_id,life_area_id) VALUES(?,?,?)",
        )
        .run(id, v.project_id ?? null, v.life_area_id ?? null);
    if (v.kind === "scheduled_task")
      this.db
        .query("INSERT INTO scheduled_tasks(id,task_id) VALUES(?,?)")
        .run(id, v.task_id!);
    return this.get(user, id);
  }
  update(user: string, id: string, v: PlannerInput) {
    this.db
      .query(
        "UPDATE planner_series SET title=?,start_local=?,duration_minutes=?,timezone=?,frequency=?,interval_count=?,weekdays=?,until_day=?,updated_at=? WHERE user_id=? AND id=?",
      )
      .run(
        v.title,
        v.start_local,
        v.duration_minutes,
        v.timezone,
        v.frequency,
        v.interval_count,
        JSON.stringify(v.weekdays),
        v.until_day,
        new Date().toISOString(),
        user,
        id,
      );
    if (v.kind === "event")
      this.db
        .query("UPDATE events SET location=?,description=? WHERE id=?")
        .run(v.location ?? "", v.description ?? "", id);
    return this.get(user, id);
  }
  exception(id: string, key: string, v: Partial<PlannerInput> | null) {
    this.db
      .query(
        "INSERT INTO planner_exceptions(series_id,occurrence_day,cancelled,start_local,duration_minutes,title) VALUES(?,?,?,?,?,?) ON CONFLICT(series_id,occurrence_day) DO UPDATE SET cancelled=excluded.cancelled,start_local=excluded.start_local,duration_minutes=excluded.duration_minutes,title=excluded.title",
      )
      .run(
        id,
        key,
        v ? 0 : 1,
        v?.start_local ?? null,
        v?.duration_minutes ?? null,
        v?.title ?? null,
      );
  }
  archive(user: string, id: string) {
    this.db
      .query("UPDATE planner_series SET archived=1 WHERE user_id=? AND id=?")
      .run(user, id);
  }
  transaction<T>(action: () => T) {
    return this.db.transaction(action).immediate();
  }
}
