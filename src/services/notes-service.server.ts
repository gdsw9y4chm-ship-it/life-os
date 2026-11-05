import { connectDatabase, databasePath } from "../db/connection";
import { SqliteNotesRepository } from "../db/repositories/sqlite-notes-repository";
import { SqliteTaskRepository } from "../db/repositories/sqlite-task-repository";
import { SqliteProjectRepository } from "../db/repositories/sqlite-project-repository";
import { SqliteLifeAreaRepository } from "../db/repositories/sqlite-life-area-repository";
import { SqliteMilestoneRepository } from "../db/repositories/sqlite-milestone-repository";
import { SqliteUserRepository } from "../db/repositories/sqlite-user-repository";
import { TaskService } from "./task-service";
import { NotesService } from "./notes-service";
import { requireRecord } from "./organization-rules";
export function withNotes<T>(
  fn: (
    s: NotesService,
    u: NonNullable<ReturnType<SqliteUserRepository["getCurrent"]>>,
    r: SqliteNotesRepository,
  ) => T,
) {
  const db = connectDatabase(databasePath());
  try {
    return db.transaction(() => {
      const u = requireRecord(new SqliteUserRepository(db).getCurrent()),
        r = new SqliteNotesRepository(db),
        tasks = new TaskService(
          new SqliteTaskRepository(db),
          new SqliteProjectRepository(db),
          new SqliteLifeAreaRepository(db),
          new SqliteMilestoneRepository(db),
          u.timezone,
        );
      return fn(new NotesService(r, tasks), u, r);
    })();
  } finally {
    db.close();
  }
}
