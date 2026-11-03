import type { Database } from "bun:sqlite";
import type {
  LifeArea,
  LifeAreaInput,
  LifeAreaRepository,
} from "../../types/organization";
import {
  lifeAreaValues,
  requireRecord,
  validateOrder,
} from "../../services/organization-rules";
type Row = Omit<LifeArea, "is_archived"> & { is_archived: number };
export class SqliteLifeAreaRepository implements LifeAreaRepository {
  constructor(private readonly db: Database) {}
  list(userId: string): LifeArea[] {
    return this.db
      .query<Row, [string]>(
        "SELECT * FROM life_areas WHERE user_id = ? ORDER BY position, id",
      )
      .all(userId)
      .map((row) => ({ ...row, is_archived: !!row.is_archived }));
  }
  get(userId: string, id: string): LifeArea | null {
    const row = this.db
      .query<
        Row,
        [string, string]
      >("SELECT * FROM life_areas WHERE user_id = ? AND id = ?")
      .get(userId, id);
    return row ? { ...row, is_archived: !!row.is_archived } : null;
  }
  create(userId: string, input: LifeAreaInput): LifeArea {
    return this.db
      .transaction(() => {
        const next = this.db
          .query<
            { position: number },
            [string]
          >("SELECT COALESCE(MAX(position), -1) + 1 AS position FROM life_areas WHERE user_id = ?")
          .get(userId)!.position;
        const v = lifeAreaValues({
          ...input,
          position: input.position ?? next,
        });

        const id = crypto.randomUUID(),
          now = new Date().toISOString();
        this.db
          .query(
            "INSERT INTO life_areas (id, user_id, name, description, icon, position, is_archived, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
          )
          .run(
            id,
            userId,
            v.name,
            v.description,
            v.icon,
            v.position,
            Number(v.is_archived),
            now,
            now,
          );
        return requireRecord(this.get(userId, id));
      })
      .immediate();
  }
  update(userId: string, id: string, input: Partial<LifeAreaInput>): LifeArea {
    const current = requireRecord(this.get(userId, id));
    const v = lifeAreaValues({ ...current, ...input });

    this.db
      .query(
        "UPDATE life_areas SET name = ?, description = ?, icon = ?, position = ?, is_archived = ?, updated_at = ? WHERE user_id = ? AND id = ?",
      )
      .run(
        v.name,
        v.description,
        v.icon,
        v.position,
        Number(v.is_archived),
        new Date().toISOString(),
        userId,
        id,
      );
    return requireRecord(this.get(userId, id));
  }
  archive(userId: string, id: string) {
    return this.update(userId, id, { is_archived: true });
  }

  reorder(userId: string, ids: string[]) {
    this.db
      .transaction(() => {
        validateOrder(this.list(userId), ids);
        ids.forEach((id, index) =>
          this.update(userId, id, { position: index }),
        );
      })
      .immediate();
  }
}
