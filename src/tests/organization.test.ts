import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import type { Database } from "bun:sqlite";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { connectDatabase, createTestDatabase } from "../db/connection";
import { migrate, migrations } from "../db/migrate";
import { seedJade, jadeLifeAreas } from "../db/seed";
import { INITIAL_USER_ID as jade } from "../db/repositories/sqlite-user-repository";
import { SqliteLifeAreaRepository } from "../db/repositories/sqlite-life-area-repository";
import { SqliteGoalRepository } from "../db/repositories/sqlite-goal-repository";
import { SqliteProjectRepository } from "../db/repositories/sqlite-project-repository";
import { SqliteMilestoneRepository } from "../db/repositories/sqlite-milestone-repository";
import { OrganizationService } from "../services/organization-service";
import { projectProgress } from "../services/organization-rules";
import {
  goalTypes,
  goalStatuses,
  projectStatuses,
  progressModes,
  milestoneStatuses,
} from "../types/organization";
import type {
  GoalInput,
  ProjectInput,
  MilestoneInput,
} from "../types/organization";
let db: Database;
let areas: SqliteLifeAreaRepository,
  goals: SqliteGoalRepository,
  projects: SqliteProjectRepository,
  milestones: SqliteMilestoneRepository;
const other = "isolated-test-user";
beforeEach(() => {
  db = createTestDatabase();
  migrate(db);
  seedJade(db);
  db.query(
    "INSERT INTO users SELECT ?, ?, avatar, theme, timezone, week_start, locale, created_at, updated_at FROM users WHERE id = ?",
  ).run(other, "Test only", jade);
  areas = new SqliteLifeAreaRepository(db);
  goals = new SqliteGoalRepository(db);
  projects = new SqliteProjectRepository(db);
  milestones = new SqliteMilestoneRepository(db);
});
afterEach(() => db.close());
function project(input: Partial<ProjectInput> = {}) {
  return projects.create(jade, { title: "Test project", ...input });
}

describe("Core migration and seed", () => {
  test("upgrades an existing Phase 1 database without altering its profile", () => {
    const old = createTestDatabase();
    try {
      migrate(old, migrations.slice(0, 1));
      old
        .query(
          "INSERT INTO users VALUES (?, 'Custom Jade', NULL, 'jade', 'Europe/Paris', 'Monday', 'fr-FR', 'before', 'before')",
        )
        .run(jade);
      migrate(old);
      seedJade(old);
      migrate(old);
      seedJade(old);
      expect(old.query("SELECT name, created_at FROM users").get()).toEqual({
        name: "Custom Jade",
        created_at: "before",
      });
      expect(new SqliteLifeAreaRepository(old).list(jade)).toHaveLength(11);
      expect(old.query("PRAGMA foreign_key_check").all()).toEqual([]);
    } finally {
      old.close();
    }
  });
  test("seeds exactly the 11 Jade Life Areas and no demo business data", () => {
    expect(areas.list(jade).map((area) => area.name)).toEqual([
      ...jadeLifeAreas,
    ]);
    expect(areas.list(jade).every((area) => area.user_id === jade)).toBe(true);
    expect(goals.list(jade)).toEqual([]);
    expect(projects.list(jade)).toEqual([]);
    expect(db.query("SELECT * FROM milestones").all()).toEqual([]);
  });
  test("repeated seeds preserve renamed, archived and reordered areas", () => {
    const first = areas.list(jade)[0];
    areas.update(jade, first.id, {
      name: "My personal space",
      is_archived: true,
      position: 42,
    });
    const before = areas.list(jade);
    seedJade(db);
    seedJade(db);
    expect(areas.list(jade)).toEqual(before);
  });
  test("foreign keys reject orphan data and all constraints survive fresh migration", () => {
    expect(() => areas.create("missing", { name: "Orphan" })).toThrow();
    expect(() =>
      goals.create("missing", { title: "Orphan", type: "manual" }),
    ).toThrow();
    expect(() => projects.create("missing", { title: "Orphan" })).toThrow();
    expect(() =>
      milestones.create(jade, "missing", { title: "Orphan" }),
    ).toThrow();
    expect(db.query("PRAGMA foreign_key_check").all()).toEqual([]);
  });
});
describe("Life Areas", () => {
  test("create, get, edit, archive and restore preserve the record", () => {
    const area = areas.create(jade, {
      name: " Travel ",
      description: "A place",
      icon: "compass",
    });
    expect(area.name).toBe("Travel");
    expect(area.is_archived).toBe(false);
    expect(
      areas.update(jade, area.id, { name: "Voyages", description: null })
        .description,
    ).toBeNull();
    expect(areas.archive(jade, area.id).is_archived).toBe(true);
    expect(areas.update(jade, area.id, { is_archived: false }).created_at).toBe(
      area.created_at,
    );
  });
  test("user isolation covers list, get, update and archive", () => {
    const area = areas.create(other, { name: "Private" });
    expect(areas.get(jade, area.id)).toBeNull();
    expect(areas.list(jade).some((a) => a.id === area.id)).toBe(false);
    expect(() => areas.update(jade, area.id, { name: "Wrong" })).toThrow();
    expect(() => areas.archive(jade, area.id)).toThrow();
  });
  test("reorder is atomic, scoped and rejects duplicate or missing IDs", () => {
    const ids = areas
      .list(jade)
      .map((a) => a.id)
      .reverse();
    areas.reorder(jade, ids);
    expect(areas.list(jade).map((a) => a.id)).toEqual(ids);
    expect(() => areas.reorder(jade, [...ids.slice(1), ids[1]])).toThrow();
    expect(() => areas.reorder(jade, ids.slice(1))).toThrow();
    expect(() => areas.reorder(other, ids)).toThrow();
    expect(areas.list(jade).map((a) => a.id)).toEqual(ids);
  });
  test("rejects empty names, bad archive values and fractional positions", () => {
    expect(() => areas.create(jade, { name: "  " })).toThrow();
    expect(() => areas.create(jade, { name: "A", position: 0.5 })).toThrow();
    expect(() =>
      areas.create(jade, {
        name: "A",
        is_archived: "yes" as unknown as boolean,
      }),
    ).toThrow();
  });
});
describe("Goals", () => {
  test("supports all types and statuses without needing a Project", () => {
    for (const type of goalTypes) {
      const goal = goals.create(jade, {
        title: type,
        type,
        target_value: 10,
        target_unit: "hours",
        target_date: "2028-02-29",
      });
      for (const status of goalStatuses)
        expect(goals.update(jade, goal.id, { status }).status).toBe(status);
      expect(
        goals.update(jade, goal.id, { target_value: null }).target_value,
      ).toBeNull();
    }
    expect(projects.list(jade)).toEqual([]);
  });
  test("rejects invalid types, statuses, values and calendar dates", () => {
    for (const input of [
      { type: "unknown" },
      { status: "unknown" },
      { target_value: -1 },
      { target_value: Infinity },
      { target_date: "2027-02-29" },
    ]) {
      expect(() =>
        goals.create(jade, {
          title: "Goal",
          type: "manual",
          ...input,
        } as GoalInput),
      ).toThrow();
    }
  });
  test("get, edit and archive are user scoped", () => {
    const goal = goals.create(other, { title: "Private", type: "numeric" });
    expect(goals.get(jade, goal.id)).toBeNull();
    expect(goals.list(jade)).toEqual([]);
    expect(() => goals.update(jade, goal.id, { title: "Wrong" })).toThrow();
    expect(() => goals.archive(jade, goal.id)).toThrow();
  });
});
describe("Projects and relationships", () => {
  test("optional links are independent and can be added or detached", () => {
    const p = project();
    expect(p.life_area_id).toBeNull();
    expect(p.goal_id).toBeNull();
    const area = areas.list(jade)[0],
      goal = goals.create(jade, { title: "Outcome", type: "manual" });
    expect(
      projects.update(jade, p.id, { life_area_id: area.id, goal_id: goal.id }),
    ).toMatchObject({ life_area_id: area.id, goal_id: goal.id });
    expect(
      projects.update(jade, p.id, { life_area_id: null, goal_id: null }),
    ).toMatchObject({ life_area_id: null, goal_id: null });
  });
  test("supports each status, including archive without deleting milestones", () => {
    const p = project();
    milestones.create(jade, p.id, { title: "Keep" });
    for (const status of projectStatuses)
      expect(projects.update(jade, p.id, { status }).status).toBe(status);
    expect(projects.archive(jade, p.id).status).toBe("archived");
    expect(milestones.list(jade, p.id)).toHaveLength(1);
  });
  test("all modes have explicit progress semantics", () => {
    for (const progress_mode of progressModes) {
      const p = project({ progress_mode, manual_progress: 35 });
      expect(projectProgress(p, [])).toBe(
        progress_mode === "manual" ? 35 : null,
      );
    }
  });
  test("validates finite manual progress, including zero and 100", () => {
    for (const manual_progress of [-1, 101, Infinity, NaN, null, undefined])
      expect(() =>
        project({ progress_mode: "manual", manual_progress }),
      ).toThrow();
    for (const manual_progress of [0, 42.5, 100])
      expect(
        project({ progress_mode: "manual", manual_progress }).manual_progress,
      ).toBe(manual_progress);
    const p = project({ progress_mode: "manual", manual_progress: 50 });
    expect(
      projects.update(jade, p.id, { progress_mode: "none" }).manual_progress,
    ).toBeNull();
    expect(() =>
      projects.update(jade, p.id, { progress_mode: "manual" }),
    ).toThrow();
  });
  test("rejects invalid status, mode, dates and reversed deadlines", () => {
    for (const input of [
      { status: "bad" },
      { progress_mode: "bad" },
      { start_date: "tomorrow" },
      { start_date: "2026-11-10", deadline: "2026-11-01" },
    ])
      expect(() => project(input as Partial<ProjectInput>)).toThrow();
  });
  test("user isolation covers reads, writes and both optional links", () => {
    const area = areas.create(other, { name: "Private" }),
      goal = goals.create(other, { title: "Private", type: "manual" });
    const p = projects.create(other, { title: "Private" });
    expect(projects.get(jade, p.id)).toBeNull();
    expect(projects.list(jade)).toEqual([]);
    expect(() => projects.update(jade, p.id, { title: "Wrong" })).toThrow();
    expect(() => projects.archive(jade, p.id)).toThrow();
    for (const link of [
      { life_area_id: area.id },
      { goal_id: goal.id },
      { goal_id: "missing" },
    ]) {
      expect(() => project(link)).toThrow();
      const own = project();
      expect(() => projects.update(jade, own.id, link)).toThrow();
    }
  });
  test("SQLite also blocks cross-owner links and ownership changes", () => {
    const area = areas.create(other, { name: "Private" }),
      goal = goals.create(other, { title: "Private", type: "manual" }),
      p = project();
    expect(() =>
      db
        .query("UPDATE projects SET life_area_id = ? WHERE id = ?")
        .run(area.id, p.id),
    ).toThrow();
    expect(() =>
      db
        .query("UPDATE projects SET goal_id = ? WHERE id = ?")
        .run(goal.id, p.id),
    ).toThrow();
    for (const [table, id] of [
      ["life_areas", area.id],
      ["goals", goal.id],
      ["projects", p.id],
    ])
      expect(() =>
        db
          .query(`UPDATE ${table} SET user_id = ? WHERE id = ?`)
          .run(table === "projects" ? other : jade, id),
      ).toThrow();
  });
  test("archiving parents preserves links; physical deletion detaches optional links", () => {
    const area = areas.list(jade)[0],
      goal = goals.create(jade, { title: "Outcome", type: "manual" });
    const p = project({ life_area_id: area.id, goal_id: goal.id });
    areas.archive(jade, area.id);
    goals.archive(jade, goal.id);
    expect(projects.get(jade, p.id)).toMatchObject({
      life_area_id: area.id,
      goal_id: goal.id,
    });
    db.query("DELETE FROM life_areas WHERE id = ?").run(area.id);
    db.query("DELETE FROM goals WHERE id = ?").run(goal.id);
    expect(projects.get(jade, p.id)).toMatchObject({
      life_area_id: null,
      goal_id: null,
    });
  });
  test("physical deletion cannot destroy user or milestone history", () => {
    const p = project();
    milestones.create(jade, p.id, { title: "History" });
    expect(() =>
      db.query("DELETE FROM projects WHERE id = ?").run(p.id),
    ).toThrow();
    expect(() =>
      db.query("DELETE FROM users WHERE id = ?").run(jade),
    ).toThrow();
  });
});
describe("Milestones", () => {
  test("creates in stable order, edits, completes and reorders", () => {
    const p = project(),
      a = milestones.create(jade, p.id, { title: "First" }),
      b = milestones.create(jade, p.id, { title: "Second" });
    expect([a.position, b.position]).toEqual([0, 1]);
    for (const status of milestoneStatuses)
      expect(
        milestones.update(jade, a.id, { title: "Edited", status }).status,
      ).toBe(status);
    milestones.reorder(jade, p.id, [b.id, a.id]);
    expect(milestones.list(jade, p.id).map((m) => m.id)).toEqual([b.id, a.id]);
  });
  test("rejects invalid ordering without partial changes", () => {
    const p = project(),
      a = milestones.create(jade, p.id, { title: "First" }),
      b = milestones.create(jade, p.id, { title: "Second" });
    for (const ids of [[a.id, a.id], [b.id], [a.id, "missing"]])
      expect(() => milestones.reorder(jade, p.id, ids)).toThrow();
    expect(milestones.list(jade, p.id).map((m) => m.id)).toEqual([a.id, b.id]);
  });
  test("user and project scope is enforced for every operation", () => {
    const p = projects.create(other, { title: "Private" }),
      m = milestones.create(other, p.id, { title: "Private" });
    expect(milestones.get(jade, m.id)).toBeNull();
    expect(() => milestones.list(jade, p.id)).toThrow();
    expect(() => milestones.create(jade, p.id, { title: "Wrong" })).toThrow();
    expect(() => milestones.update(jade, m.id, { title: "Wrong" })).toThrow();
    expect(() => milestones.reorder(jade, p.id, [m.id])).toThrow();
    const own = project(),
      ownM = milestones.create(jade, own.id, { title: "Own" });
    const service = new OrganizationService(areas, goals, projects, milestones);
    expect(() =>
      service.execute(jade, {
        kind: "milestone",
        id: ownM.id,
        projectId: project().id,
        values: { title: "Moved" },
      }),
    ).toThrow();
  });
  test("progress comes only from completed milestones of this project", () => {
    const p = project({ progress_mode: "milestones" }),
      a = milestones.create(jade, p.id, { title: "One" });
    milestones.create(jade, p.id, { title: "Two", status: "completed" });
    const foreign = milestones.create(jade, project().id, {
      title: "Elsewhere",
      status: "completed",
    });
    expect(projectProgress(p, [...milestones.list(jade, p.id), foreign])).toBe(
      50,
    );
    milestones.update(jade, a.id, { status: "completed" });
    expect(projectProgress(p, milestones.list(jade, p.id))).toBe(100);
    milestones.update(jade, a.id, { status: "pending" });
    expect(projectProgress(p, milestones.list(jade, p.id))).toBe(50);
  });
  test("rejects invalid status, position and target date", () => {
    const p = project();
    for (const input of [
      { status: "bad" },
      { position: -1 },
      { target_date: "2026-02-30" },
    ])
      expect(() =>
        milestones.create(jade, p.id, {
          title: "M",
          ...input,
        } as MilestoneInput),
      ).toThrow();
  });
});
test("organization persists through a complete database close and reopen", () => {
  const directory = mkdtempSync(join(tmpdir(), "life-os-core-")),
    path = join(directory, "test.sqlite");
  const first = connectDatabase(path);
  migrate(first);
  seedJade(first);
  const area = new SqliteLifeAreaRepository(first).list(jade)[0];
  const goal = new SqliteGoalRepository(first).create(jade, {
    title: "Persistent goal",
    type: "manual",
  });
  const p = new SqliteProjectRepository(first).create(jade, {
    title: "Persistent project",
    life_area_id: area.id,
    goal_id: goal.id,
  });
  const m = new SqliteMilestoneRepository(first).create(jade, p.id, {
    title: "Persistent milestone",
  });
  first.close();
  const second = connectDatabase(path);
  try {
    expect(new SqliteProjectRepository(second).get(jade, p.id)).toEqual(p);
    expect(new SqliteMilestoneRepository(second).get(jade, m.id)).toEqual(m);
  } finally {
    second.close();
    rmSync(directory, { recursive: true });
  }
});
