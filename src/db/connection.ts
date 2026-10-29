import { Database } from 'bun:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

export function databasePath(): string {
  if (process.env.NODE_ENV === 'test') {
    throw new Error('Tests must explicitly use an isolated database.');
  }
  return resolve(process.env.LIFE_OS_DB_PATH || './data/life-os.sqlite');
}

export function connectDatabase(path: string): Database {
  if (path !== ':memory:') mkdirSync(dirname(resolve(path)), { recursive: true });
  const db = new Database(path, { create: true, strict: true });
  db.exec('PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
  if (path !== ':memory:') db.exec('PRAGMA journal_mode = WAL;');
  return db;
}

// The test factory never reads environment configuration or opens a disk file.
export function createTestDatabase(): Database {
  return connectDatabase(':memory:');
}
