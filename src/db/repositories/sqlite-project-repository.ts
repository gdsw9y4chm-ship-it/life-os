import type { Database } from "bun:sqlite";
import type {
  Project,
  ProjectInput,
  ProjectRepository,
} from "../../types/organization";
import {
  projectValues,
  requireRecord,
} from "../../services/organization-rules";
type Row = Project;
export class SqliteProjectRepository implements ProjectRepository {
  constructor(private readonly db: Database) {}
  list(userId: string): Project[] {
    return this.db
      .query<
        Row,
        [string]
      >("SELECT * FROM projects WHERE user_id = ? ORDER BY position, id")
      .all(userId);
  }
  get(userId: string, id: string): Project | null {
    const row = this.db
      .query<
        Row,
        [string, string]
      >("SELECT * FROM projects WHERE user_id = ? AND id = ?")
      .get(userId, id);
    return row;
  }
  create(userId: string, input: ProjectInput): Project {
    const v = projectValues(input);
    this.relations(userId, v.life_area_id, v.goal_id);
    const id = crypto.randomUUID(),
      now = new Date().toISOString();
    this.db
      .query(
        "INSERT INTO projects (id, user_id, title, description, status, life_area_id, goal_id, start_date, deadline, progress_mode, manual_progress, position, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      )
      .run(
        id,
        userId,
        v.title,
        v.description,
        v.status,
        v.life_area_id,
        v.goal_id,
        v.start_date,
        v.deadline,
        v.progress_mode,
        v.manual_progress,
        v.position,
        now,
        now,
      );
    return requireRecord(this.get(userId, id));
  }
  update(userId: string, id: string, input: Partial<ProjectInput>): Project {
    const current = requireRecord(this.get(userId, id));
    const v = projectValues({ ...current, ...input });
    this.relations(userId, v.life_area_id, v.goal_id);
    this.db
      .query(
        "UPDATE projects SET title = ?, description = ?, status = ?, life_area_id = ?, goal_id = ?, start_date = ?, deadline = ?, progress_mode = ?, manual_progress = ?, position = ?, updated_at = ? WHERE user_id = ? AND id = ?",
      )
      .run(
        v.title,
        v.description,
        v.status,
        v.life_area_id,
        v.goal_id,
        v.start_date,
        v.deadline,
        v.progress_mode,
        v.manual_progress,
        v.position,
        new Date().toISOString(),
        userId,
        id,
      );
    return requireRecord(this.get(userId, id));
  }
  archive(userId: string, id: string) {
    return this.update(userId, id, { status: "archived" });
  }

  private relations(userId: string, area: string | null, goal: string | null) {
    if (area)
      requireRecord(
        this.db
          .query("SELECT id FROM life_areas WHERE id = ? AND user_id = ?")
          .get(area, userId),
      );
    if (goal)
      requireRecord(
        this.db
          .query("SELECT id FROM goals WHERE id = ? AND user_id = ?")
          .get(goal, userId),
      );
  }
}
