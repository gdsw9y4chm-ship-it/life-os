import type { Database } from 'bun:sqlite';
import type { User, UserRepository } from '../../types/user';

// Stable identity makes repeat seeds safe even if the profile is renamed later.
export const INITIAL_USER_ID = '3c54e01b-8364-49aa-ae8f-09a57659f507';

export class SqliteUserRepository implements UserRepository {
  constructor(private readonly db: Database) {}

  getCurrent(): User | null {
    return this.db.query<User, [string]>('SELECT * FROM users WHERE id = ?').get(INITIAL_USER_ID);
  }

  seedInitial(): User {
    const now = new Date().toISOString();
    this.db.query(`INSERT INTO users
      (id, name, avatar, theme, timezone, week_start, locale, created_at, updated_at)
      VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO NOTHING`)
      .run(INITIAL_USER_ID, 'Jade', 'jade', 'Europe/Paris', 'Monday', 'fr-FR', now, now);
    const user = this.getCurrent();
    if (!user) throw new Error('Initial user could not be created.');
    return user;
  }
}
