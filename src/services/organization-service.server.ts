import { SqliteTaskRepository } from "../db/repositories/sqlite-task-repository";
import { connectDatabase, databasePath } from "../db/connection";
import { SqliteLifeAreaRepository } from "../db/repositories/sqlite-life-area-repository";
import { SqliteGoalRepository } from "../db/repositories/sqlite-goal-repository";
import { SqliteProjectRepository } from "../db/repositories/sqlite-project-repository";
import { SqliteMilestoneRepository } from "../db/repositories/sqlite-milestone-repository";
import { INITIAL_USER_ID } from "../db/repositories/sqlite-user-repository";
import { OrganizationService } from "./organization-service";
export function withOrganization<T>(
  action: (service: OrganizationService, userId: string) => T,
): T {
  const db = connectDatabase(databasePath());
  try {
    const service = new OrganizationService(
      new SqliteLifeAreaRepository(db),
      new SqliteGoalRepository(db),
      new SqliteProjectRepository(db),
      new SqliteMilestoneRepository(db),
      new SqliteTaskRepository(db),
    );
    // V1 local profile is resolved on the server, never accepted from a client payload.
    return db.transaction(() => action(service, INITIAL_USER_ID)).immediate();
  } finally {
    db.close();
  }
}
