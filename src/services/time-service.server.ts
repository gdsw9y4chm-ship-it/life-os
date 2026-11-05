import { connectDatabase, databasePath } from "../db/connection";
import { SqliteUserRepository } from "../db/repositories/sqlite-user-repository";
import { SqliteTimeRepository } from "../db/repositories/sqlite-time-repository";
import { TimeService } from "./time-service";
import { requireRecord } from "./organization-rules";
export function withTime<T>(
  fn: (
    service: TimeService,
    user: NonNullable<ReturnType<SqliteUserRepository["getCurrent"]>>,
  ) => T,
) {
  const db = connectDatabase(databasePath());
  try {
    return db.transaction(() =>
      fn(
        new TimeService(new SqliteTimeRepository(db)),
        requireRecord(new SqliteUserRepository(db).getCurrent()),
      ),
    )();
  } finally {
    db.close();
  }
}
