import type { Database } from 'bun:sqlite';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const usersSql = readFileSync(new URL('./migrations/001_users.sql', import.meta.url), 'utf8');

export interface Migration { version: number; name: string; sql: string }
export const migrations: readonly Migration[] = [
  { version: 1, name: 'users', sql: usersSql },
];

export function migrate(db: Database, steps: readonly Migration[] = migrations): void {
  db.transaction(() => {
    db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      checksum TEXT NOT NULL,
      applied_at TEXT NOT NULL
    ) STRICT`);
    const applied = db.query<{ version: number; checksum: string }, []>(
      'SELECT version, checksum FROM schema_migrations ORDER BY version',
    ).all();
    for (const record of applied) {
      const step = steps.find((item) => item.version === record.version);
      if (!step || createHash('sha256').update(step.sql).digest('hex') !== record.checksum) {
        throw new Error(`Migration ${record.version} differs from the applied schema.`);
      }
    }
    let previous = 0;
    for (const step of steps) {
      if (step.version <= previous) throw new Error('Migrations must have unique ascending versions.');
      previous = step.version;
      if (applied.some((record) => record.version === step.version)) continue;
      db.exec(step.sql);
      db.query('INSERT INTO schema_migrations (version, name, checksum, applied_at) VALUES (?, ?, ?, ?)')
        .run(step.version, step.name, createHash('sha256').update(step.sql).digest('hex'), new Date().toISOString());
    }
  }).immediate();
}
