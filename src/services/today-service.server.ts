import { PlannerService } from "./planner-service";
import { SqlitePlannerRepository } from "../db/repositories/sqlite-planner-repository";
import { connectDatabase, databasePath } from "../db/connection";
import { SqliteUserRepository } from "../db/repositories/sqlite-user-repository";
import { SqliteTodayRepository } from "../db/repositories/sqlite-today-repository";
import { requireRecord } from "./organization-rules";
import { TodayService } from "./today-service";
import type { TaskReferences } from "../types/task";

export function readToday() {
  const db = connectDatabase(databasePath());
  try {
    return db.transaction(() => {
      const user = requireRecord(new SqliteUserRepository(db).getCurrent());
      const today = new TodayService(new SqliteTodayRepository(db)).read(user);
      return {
        ...today,
        planning: new PlannerService(new SqlitePlannerRepository(db)).list(
          user.id,
          today.day,
          today.day,
          user.timezone,
        ),
      };
    })();
  } finally {
    db.close();
  }
}
export function readTodayReferences(): TaskReferences {
  const db = connectDatabase(databasePath());
  try {
    return db.transaction(() => {
      const user = requireRecord(new SqliteUserRepository(db).getCurrent());
      return {
        projects: db
          .query<
            { id: string; title: string },
            [string]
          >("SELECT id, title FROM projects WHERE user_id = ? ORDER BY position, id")
          .all(user.id),
        areas: db
          .query<
            { id: string; name: string },
            [string]
          >("SELECT id, name FROM life_areas WHERE user_id = ? ORDER BY position, id")
          .all(user.id),
      };
    })();
  } finally {
    db.close();
  }
}
