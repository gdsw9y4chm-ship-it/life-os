import { connectDatabase, databasePath } from "../db/connection";
import { SqlitePracticeRepository } from "../db/repositories/sqlite-practice-repository";
import { SqliteTaskRepository } from "../db/repositories/sqlite-task-repository";
import { SqliteProjectRepository } from "../db/repositories/sqlite-project-repository";
import { SqliteLifeAreaRepository } from "../db/repositories/sqlite-life-area-repository";
import { SqliteMilestoneRepository } from "../db/repositories/sqlite-milestone-repository";
import { SqliteUserRepository } from "../db/repositories/sqlite-user-repository";
import { TaskService } from "./task-service";
import { PracticeService } from "./practice-service";
import { requireRecord } from "./organization-rules";
export function withPractice<T>(
  fn: (
    s: PracticeService,
    u: NonNullable<ReturnType<SqliteUserRepository["getCurrent"]>>,
  ) => T,
) {
  const db = connectDatabase(databasePath());
  try {
    return db.transaction(() => {
      const u = requireRecord(new SqliteUserRepository(db).getCurrent()),
        tasks = new TaskService(
          new SqliteTaskRepository(db),
          new SqliteProjectRepository(db),
          new SqliteLifeAreaRepository(db),
          new SqliteMilestoneRepository(db),
          u.timezone,
        );
      return fn(
        new PracticeService(new SqlitePracticeRepository(db), tasks),
        u,
      );
    })();
  } finally {
    db.close();
  }
}
