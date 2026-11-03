import type { Database } from "bun:sqlite";
import {
  INITIAL_USER_ID,
  SqliteUserRepository,
} from "./repositories/sqlite-user-repository";
export const jadeLifeAreas = [
  "Personnel",
  "Couple",
  "Maison",
  "Animaux",
  "Beauté",
  "Santé & Sport",
  "Travail & IA",
  "Modèle / Créatif",
  "Administratif",
  "Spiritualité",
  "Social & Loisirs",
] as const;
export function seedJade(db: Database) {
  return db
    .transaction(() => {
      const user = new SqliteUserRepository(db).seedInitial();
      const now = new Date().toISOString();
      jadeLifeAreas.forEach((name, position) => {
        // Stable IDs preserve renamed or archived areas on every subsequent seed.
        db.query(
          "INSERT INTO life_areas (id, user_id, name, position, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO NOTHING",
        ).run(
          `${INITIAL_USER_ID}:area:${position + 1}`,
          user.id,
          name,
          position,
          now,
          now,
        );
      });
      return user;
    })
    .immediate();
}
