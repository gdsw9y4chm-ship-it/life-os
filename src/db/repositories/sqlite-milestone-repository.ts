import type { Database } from "bun:sqlite";
import type {
  Milestone,
  MilestoneInput,
  MilestoneRepository,
} from "../../types/organization";
import {
  milestoneValues,
  requireRecord,
  validateOrder,
} from "../../services/organization-rules";
export class SqliteMilestoneRepository implements MilestoneRepository {
  constructor(private readonly db: Database) {}
  private project(userId: string, id: string) {
    requireRecord(
      this.db
        .query("SELECT id FROM projects WHERE user_id = ? AND id = ?")
        .get(userId, id),
    );
  }
  list(userId: string, projectId: string): Milestone[] {
    this.project(userId, projectId);
    return this.db
      .query<
        Milestone,
        [string]
      >("SELECT * FROM milestones WHERE project_id = ? ORDER BY position, id")
      .all(projectId);
  }
  get(userId: string, id: string): Milestone | null {
    return this.db
      .query<
        Milestone,
        [string, string]
      >("SELECT m.* FROM milestones m JOIN projects p ON p.id = m.project_id WHERE p.user_id = ? AND m.id = ?")
      .get(userId, id);
  }
  create(userId: string, projectId: string, input: MilestoneInput): Milestone {
    return this.db
      .transaction(() => {
        this.project(userId, projectId);
        const next = this.db
          .query<
            { position: number },
            [string]
          >("SELECT COALESCE(MAX(position), -1) + 1 AS position FROM milestones WHERE project_id = ?")
          .get(projectId)!.position;
        const v = milestoneValues({
          ...input,
          position: input.position ?? next,
        });
        const id = crypto.randomUUID(),
          now = new Date().toISOString();
        this.db
          .query(
            "INSERT INTO milestones (id, project_id, title, description, status, position, target_date, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
          )
          .run(
            id,
            projectId,
            v.title,
            v.description,
            v.status,
            v.position,
            v.target_date,
            now,
            now,
          );
        return requireRecord(this.get(userId, id));
      })
      .immediate();
  }
  update(
    userId: string,
    id: string,
    input: Partial<MilestoneInput>,
  ): Milestone {
    const current = requireRecord(this.get(userId, id));
    const v = milestoneValues({ ...current, ...input });
    this.db
      .query(
        "UPDATE milestones SET title = ?, description = ?, status = ?, position = ?, target_date = ?, updated_at = ? WHERE id = ? AND project_id IN (SELECT id FROM projects WHERE user_id = ?)",
      )
      .run(
        v.title,
        v.description,
        v.status,
        v.position,
        v.target_date,
        new Date().toISOString(),
        id,
        userId,
      );
    return requireRecord(this.get(userId, id));
  }
  reorder(userId: string, projectId: string, ids: string[]) {
    this.db
      .transaction(() => {
        validateOrder(this.list(userId, projectId), ids);
        ids.forEach((id, position) => this.update(userId, id, { position }));
      })
      .immediate();
  }
}
