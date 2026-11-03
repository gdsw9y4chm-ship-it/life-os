import { connectDatabase, databasePath } from "../db/connection";
import { SqlitePlannerRepository } from "../db/repositories/sqlite-planner-repository";
import { SqliteUserRepository } from "../db/repositories/sqlite-user-repository";
import { requireRecord } from "./organization-rules";
import { PlannerService } from "./planner-service";
import { calendarDay } from "./task-rules";
import { taskSelection } from "../db/repositories/sqlite-task-repository";
import type { TaskSummary } from "../types/task";
export function withPlanner<T>(
  action: (
    service: PlannerService,
    user: NonNullable<ReturnType<SqliteUserRepository["getCurrent"]>>,
    db: ReturnType<typeof connectDatabase>,
  ) => T,
) {
  const db = connectDatabase(databasePath());
  try {
    return db.transaction(() =>
      action(
        new PlannerService(new SqlitePlannerRepository(db)),
        requireRecord(new SqliteUserRepository(db).getCurrent()),
        db,
      ),
    )();
  } finally {
    db.close();
  }
}
export function readPlanner(from: string, to: string) {
  return withPlanner((service, user, db) => ({
    user,
    today: calendarDay(new Date(), user.timezone),
    items: service.list(user.id, from, to, user.timezone),
    tasks: db
      .query<TaskSummary, [string, string]>(
        taskSelection +
          ` WHERE t.user_id=? AND t.archived_at IS NULL AND t.status IN ('todo','doing')
  AND NOT EXISTS (SELECT 1 FROM scheduled_tasks st JOIN planner_series s ON s.id=st.id WHERE st.task_id=t.id AND s.archived=0 AND (s.until_day IS NULL OR s.until_day>=?) AND NOT EXISTS(SELECT 1 FROM planner_exceptions x WHERE x.series_id=s.id AND x.occurrence_day=substr(s.start_local,1,10) AND x.cancelled=1 AND s.frequency='once'))
  ORDER BY t.priority,t.created_at LIMIT 100`,
      )
      .all(user.id, calendarDay(new Date(), user.timezone)),
    deadlines: db
      .query<
        { id: string; title: string; deadline: string },
        [string, string, string]
      >("SELECT id,title,deadline FROM tasks WHERE user_id=? AND archived_at IS NULL AND status NOT IN ('done','someday') AND deadline BETWEEN ? AND ? ORDER BY deadline LIMIT 200")
      .all(user.id, from, to),
  }));
}
