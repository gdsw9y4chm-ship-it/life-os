import type { Database } from "bun:sqlite";
import type { Goal, GoalInput, GoalRepository } from "../../types/organization";
import { goalValues, requireRecord } from "../../services/organization-rules";
type Row = Goal;
export class SqliteGoalRepository implements GoalRepository {
  constructor(private readonly db: Database) {}
  list(userId: string): Goal[] {
    return this.db
      .query<
        Row,
        [string]
      >("SELECT * FROM goals WHERE user_id = ? ORDER BY created_at, id")
      .all(userId);
  }
  get(userId: string, id: string): Goal | null {
    const row = this.db
      .query<
        Row,
        [string, string]
      >("SELECT * FROM goals WHERE user_id = ? AND id = ?")
      .get(userId, id);
    return row;
  }
  create(userId: string, input: GoalInput): Goal {
    const v = goalValues(input);

    const id = crypto.randomUUID(),
      now = new Date().toISOString();
    this.db
      .query(
        "INSERT INTO goals (id, user_id, title, description, type, status, target_value, target_unit, target_date, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      )
      .run(
        id,
        userId,
        v.title,
        v.description,
        v.type,
        v.status,
        v.target_value,
        v.target_unit,
        v.target_date,
        now,
        now,
      );
    return requireRecord(this.get(userId, id));
  }
  update(userId: string, id: string, input: Partial<GoalInput>): Goal {
    const current = requireRecord(this.get(userId, id));
    const v = goalValues({ ...current, ...input });

    this.db
      .query(
        "UPDATE goals SET title = ?, description = ?, type = ?, status = ?, target_value = ?, target_unit = ?, target_date = ?, updated_at = ? WHERE user_id = ? AND id = ?",
      )
      .run(
        v.title,
        v.description,
        v.type,
        v.status,
        v.target_value,
        v.target_unit,
        v.target_date,
        new Date().toISOString(),
        userId,
        id,
      );
    return requireRecord(this.get(userId, id));
  }
  archive(userId: string, id: string) {
    return this.update(userId, id, { status: "archived" });
  }
}
