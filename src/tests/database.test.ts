import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import type { Database } from 'bun:sqlite';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { connectDatabase, createTestDatabase, databasePath } from '../db/connection';
import { migrate, migrations } from '../db/migrate';
import { INITIAL_USER_ID, SqliteUserRepository } from '../db/repositories/sqlite-user-repository';
import { UserService } from '../services/user-service';

let db: Database;
beforeEach(() => { db = createTestDatabase(); });
afterEach(() => { db.close(); });

function service() { return new UserService(new SqliteUserRepository(db)); }

describe('SQLite foundation', () => {
  test('connects with foreign keys enabled', () => {
    expect(db.query('SELECT 1 AS value').get()).toEqual({ value: 1 });
    expect(db.query('PRAGMA foreign_keys').get()).toEqual({ foreign_keys: 1 });
  });

  test('migrates a clean database and records the schema version', () => {
    migrate(db);
    expect(db.query('SELECT name FROM sqlite_master WHERE type = ? ORDER BY name').all('table'))
      .toEqual([{ name: 'schema_migrations' }, { name: 'users' }]);
    expect(db.query('SELECT version, name FROM schema_migrations').all()).toEqual([{ version: 1, name: 'users' }]);
  });

  test('migrations can run twice without changing data', () => {
    migrate(db);
    const user = service().initializeProfile();
    migrate(db);
    expect(service().getCurrentUser()).toEqual(user);
    expect(db.query('SELECT count(*) AS count FROM schema_migrations').get()).toEqual({ count: 1 });
  });

  test('rejects edited migration history', () => {
    migrate(db);
    expect(() => migrate(db, [{ version: 1, name: 'users', sql: 'SELECT 1;' }])).toThrow('differs');
  });

  test('rolls back a failed migration including its partial DDL', () => {
    migrate(db);
    expect(() => migrate(db, [...migrations, { version: 2, name: 'broken', sql: 'CREATE TABLE partial (id TEXT); INVALID SQL;' }])).toThrow();
    expect(db.query("SELECT name FROM sqlite_master WHERE name = 'partial'").get()).toBeNull();
    expect(db.query('SELECT count(*) AS count FROM schema_migrations').get()).toEqual({ count: 1 });
  });

  test('returns null before the initial seed', () => {
    migrate(db);
    expect(service().getCurrentUser()).toBeNull();
  });

  test('seeds the real Jade profile with required preferences and UTC dates', () => {
    migrate(db);
    const user = service().initializeProfile();
    expect(user).toMatchObject({ id: INITIAL_USER_ID, name: 'Jade', avatar: null, theme: 'jade', timezone: 'Europe/Paris', week_start: 'Monday', locale: 'fr-FR' });
    expect(new Date(user.created_at).toISOString()).toBe(user.created_at);
    expect(user.updated_at).toBe(user.created_at);
    expect(service().getCurrentUser()).toEqual(user);
  });

  test('seed is idempotent and preserves changed preferences and timestamps', () => {
    migrate(db);
    service().initializeProfile();
    db.query('UPDATE users SET name = ?, timezone = ? WHERE id = ?').run('Jade personnalisée', 'Europe/London', INITIAL_USER_ID);
    const before = service().getCurrentUser();
    if (!before) throw new Error("Expected seeded user");
    expect(service().initializeProfile()).toEqual(before);
    expect(service().initializeProfile()).toEqual(before);
    expect(db.query('SELECT count(*) AS count FROM users').get()).toEqual({ count: 1 });
  });

  test('enforces valid weekday and nonempty name', () => {
    migrate(db);
    service().initializeProfile();
    expect(() => db.exec("UPDATE users SET week_start = 'Invalid'")).toThrow();
    expect(() => db.exec("UPDATE users SET name = ''")).toThrow();
  });

  test('independent test databases do not share state', () => {
    migrate(db);
    service().initializeProfile();
    const other = createTestDatabase();
    try {
      migrate(other);
      expect(new SqliteUserRepository(other).getCurrent()).toBeNull();
    } finally { other.close(); }
  });

  test('test factory ignores a configured disk database and leaves its bytes unchanged', () => {
    const directory = mkdtempSync(join(tmpdir(), 'life-os-isolation-'));
    const path = join(directory, 'development-sentinel.sqlite');
    const disk = connectDatabase(path);
    migrate(disk);
    new SqliteUserRepository(disk).seedInitial();
    disk.close();
    const before = readFileSync(path);
    const original = process.env.LIFE_OS_DB_PATH;
    process.env.LIFE_OS_DB_PATH = path;
    const isolated = createTestDatabase();
    try {
      migrate(isolated);
      new SqliteUserRepository(isolated).seedInitial();
      isolated.exec('DELETE FROM users');
      expect(readFileSync(path)).toEqual(before);
    } finally {
      isolated.close();
      if (original === undefined) delete process.env.LIFE_OS_DB_PATH;
      else process.env.LIFE_OS_DB_PATH = original;
      rmSync(directory, { recursive: true });
    }
  });

  test('test environment refuses the implicit development connection', () => {
    expect(process.env.NODE_ENV).toBe('test');
    expect(() => databasePath()).toThrow('isolated database');
  });

  test('seed persists after closing and reopening a disk database', () => {
    const directory = mkdtempSync(join(tmpdir(), 'life-os-persistence-'));
    const path = join(directory, 'test.sqlite');
    const first = connectDatabase(path);
    migrate(first);
    const user = new SqliteUserRepository(first).seedInitial();
    first.close();
    const reopened = connectDatabase(path);
    try { expect(new SqliteUserRepository(reopened).getCurrent()).toEqual(user); }
    finally { reopened.close(); rmSync(directory, { recursive: true }); }
  });
});
