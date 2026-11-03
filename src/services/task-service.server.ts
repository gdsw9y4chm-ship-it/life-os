import { connectDatabase, databasePath } from "../db/connection";
import { SqliteTaskRepository } from "../db/repositories/sqlite-task-repository";
import { SqliteProjectRepository } from "../db/repositories/sqlite-project-repository";
import { SqliteLifeAreaRepository } from "../db/repositories/sqlite-life-area-repository";
import { SqliteMilestoneRepository } from "../db/repositories/sqlite-milestone-repository";
import { SqliteUserRepository } from "../db/repositories/sqlite-user-repository";
import { TaskService } from "./task-service";
import { requireRecord } from "./organization-rules";
export function withTasks<T>(
  action: (
    service: TaskService,
    userId: string,
    references: ReturnType<typeof referencesFor> & { timezone: string },
  ) => T,
): T {
  const db = connectDatabase(databasePath());
  try {
    const user = requireRecord(new SqliteUserRepository(db).getCurrent());
    const projects = new SqliteProjectRepository(db),
      areas = new SqliteLifeAreaRepository(db),
      milestones = new SqliteMilestoneRepository(db);
    const service = new TaskService(
      new SqliteTaskRepository(db),
      projects,
      areas,
      milestones,
      user.timezone,
    );
    return db
      .transaction(() =>
        action(service, user.id, {
          ...referencesFor(user.id, projects, areas, milestones),
          timezone: user.timezone,
        }),
      )
      .immediate();
  } finally {
    db.close();
  }
}
function referencesFor(
  userId: string,
  projects: SqliteProjectRepository,
  areas: SqliteLifeAreaRepository,
  milestones: SqliteMilestoneRepository,
) {
  const projectList = projects.list(userId);
  return {
    projects: projectList,
    areas: areas.list(userId),
    milestones: projectList.flatMap((project) =>
      milestones.list(userId, project.id),
    ),
  };
}
