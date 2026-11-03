import type { Database } from "bun:sqlite";
import type {
  TodayRepository,
  TodayCounts,
  ProjectAggregate,
} from "../../types/today";
import type { Project } from "../../types/organization";
import type { TaskSummary } from "../../types/task";
import { SqliteTaskRepository, taskSelection } from "./sqlite-task-repository";

export class SqliteTodayRepository implements TodayRepository {
  constructor(private readonly db: Database) {}
  todayTasks(userId: string, day: string) {
    return new SqliteTaskRepository(this.db).list(userId, {
      view: "today",
      today: day,
    });
  }
  followUps(userId: string, day: string) {
    return this.db
      .query<TaskSummary, [string, string]>(
        `${taskSelection}
      WHERE t.user_id = ? AND t.archived_at IS NULL AND t.status = 'waiting' AND t.follow_up_date <= ?
      ORDER BY t.follow_up_date, t.position, t.id LIMIT 5`,
      )
      .all(userId, day);
  }
  counts(userId: string, day: string): TodayCounts {
    // Counts stay in SQLite: no Inbox or overdue history is materialized.
    return this.db
      .query<TodayCounts, [string, string, string, string, string]>(
        `
      SELECT
        COUNT(CASE WHEN status = 'inbox' THEN 1 END) AS inboxCount,
        COUNT(CASE WHEN status NOT IN ('done','someday') AND deadline < ? THEN 1 END) AS overdueCount,
        COUNT(CASE WHEN status = 'waiting' AND follow_up_date <= ? THEN 1 END) AS followUpCount,
        (SELECT COUNT(*) FROM projects p WHERE p.user_id = ? AND p.status = 'active'
          AND EXISTS (SELECT 1 FROM tasks t WHERE t.user_id = p.user_id AND t.project_id = p.id
            AND t.archived_at IS NULL AND t.status IN ('todo','doing') AND t.do_date = ?)) AS todayProjectCount
      FROM tasks WHERE user_id = ? AND archived_at IS NULL
    `,
      )
      .get(day, day, userId, day, userId)!;
  }
  activeProjects(userId: string, day: string) {
    return this.db
      .query<
        Project & { life_area_name: string | null; today_task_count: number },
        [string, string]
      >(
        `
      SELECT p.*, a.name AS life_area_name,
        (SELECT COUNT(*) FROM tasks t WHERE t.user_id = p.user_id AND t.project_id = p.id
          AND t.archived_at IS NULL AND t.status IN ('todo','doing') AND t.do_date = ?) AS today_task_count
      FROM projects p LEFT JOIN life_areas a ON a.id = p.life_area_id AND a.user_id = p.user_id
      WHERE p.user_id = ? AND p.status = 'active'
      ORDER BY (today_task_count > 0) DESC, p.updated_at DESC, p.id LIMIT 4
    `,
      )
      .all(day, userId);
  }
  taskAggregates(userId: string, ids: string[]): ProjectAggregate[] {
    if (!ids.length) return [];
    // Match taskBasedProgress: count a child only when its eligible parent is not in this project.
    return this.db
      .query<ProjectAggregate, string[]>(
        `
      WITH scoped AS (
        SELECT t.project_id, t.status,
          NOT EXISTS (SELECT 1 FROM tasks parent WHERE parent.id = t.parent_task_id
            AND parent.user_id = t.user_id AND parent.project_id = t.project_id
            AND parent.archived_at IS NULL AND parent.status != 'someday') AS counted
        FROM tasks t WHERE t.user_id = ? AND t.project_id IN (${ids.map(() => "?").join(",")})
          AND t.archived_at IS NULL AND t.status != 'someday'
      )
      SELECT project_id, COUNT(CASE WHEN status != 'done' THEN 1 END) AS open_count,
        SUM(counted) AS total, SUM(CASE WHEN status = 'done' THEN counted ELSE 0 END) AS done
      FROM scoped GROUP BY project_id
    `,
      )
      .all(userId, ...ids);
  }
  milestoneAggregates(userId: string, ids: string[]) {
    if (!ids.length) return [];
    return this.db
      .query<Omit<ProjectAggregate, "open_count">, string[]>(
        `
      SELECT m.project_id, COUNT(*) AS total, SUM(m.status = 'completed') AS done
      FROM milestones m JOIN projects p ON p.id = m.project_id
      WHERE p.user_id = ? AND p.id IN (${ids.map(() => "?").join(",")}) GROUP BY m.project_id
    `,
      )
      .all(userId, ...ids);
  }
}
