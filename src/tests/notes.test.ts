import { beforeEach, afterEach, test, expect } from "bun:test";
import type { Database } from "bun:sqlite";
import { createTestDatabase, connectDatabase } from "../db/connection";
import { migrate, migrations } from "../db/migrate";
import { seedJade } from "../db/seed";
import { INITIAL_USER_ID as user } from "../db/repositories/sqlite-user-repository";
import { SqliteNotesRepository } from "../db/repositories/sqlite-notes-repository";
import { SqliteTaskRepository } from "../db/repositories/sqlite-task-repository";
import { SqliteProjectRepository } from "../db/repositories/sqlite-project-repository";
import { SqliteGoalRepository } from "../db/repositories/sqlite-goal-repository";
import { SqliteLifeAreaRepository } from "../db/repositories/sqlite-life-area-repository";
import { SqliteMilestoneRepository } from "../db/repositories/sqlite-milestone-repository";
import { TaskService } from "../services/task-service";
import { NotesService } from "../services/notes-service";
import { safeLink } from "../features/notes/markdown";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
let db: Database, r: SqliteNotesRepository, s: NotesService, tasks: TaskService;
const v = {
  title: "Idée",
  body: "# Titre\nTexte à transformer\n- [ ] Checklist",
  kind: "full" as const,
};
function setup(database: Database) {
  r = new SqliteNotesRepository(database);
  tasks = new TaskService(
    new SqliteTaskRepository(database),
    new SqliteProjectRepository(database),
    new SqliteLifeAreaRepository(database),
    new SqliteMilestoneRepository(database),
  );
  s = new NotesService(r, tasks);
}
beforeEach(() => {
  db = createTestDatabase();
  migrate(db);
  seedJade(db);
  setup(db);
});
afterEach(() => db.close());
const note = () => s.execute(user, { kind: "create-note", values: v }).id;
const list = (
  kind: "simple" | "checklist" | "shopping" | "wishlist" = "simple",
) => s.execute(user, { kind: "save-list", title: "Liste", listKind: kind }).id;
test("additive Notes migration preserves Timer and seed", () => {
  const old = createTestDatabase();
  migrate(old, migrations.slice(0, 5));
  seedJade(old);
  const before = old.query("SELECT * FROM users").all();
  migrate(old);
  seedJade(old);
  expect(old.query("SELECT * FROM users").all()).toEqual(before);
  expect(old.query("PRAGMA integrity_check").get()).toEqual({
    integrity_check: "ok",
  });
  expect(old.query("PRAGMA foreign_key_check").all()).toEqual([]);
  old.close();
});
test("quick and full notes persist content and revisions", () => {
  const id = note();
  expect(r.note(user, id).body).toBe(v.body);
  s.execute(user, {
    kind: "save-note",
    id,
    revision: 1,
    values: { ...v, kind: "quick", body: "Modifiée" },
  });
  expect(r.note(user, id).revision).toBe(2);
  expect(r.note(user, id).kind).toBe("quick");
});
test("optimistic concurrency refuses stale writes without losing newer content", () => {
  const id = note();
  s.execute(user, {
    kind: "save-note",
    id,
    revision: 1,
    values: { ...v, body: "Premier onglet" },
  });
  expect(() =>
    s.execute(user, {
      kind: "save-note",
      id,
      revision: 1,
      values: { ...v, body: "Ancien onglet" },
    }),
  ).toThrow("Conflit");
  expect(r.note(user, id).body).toBe("Premier onglet");
});
test("long notes within limit retain every character", () => {
  const body = "longue note\n".repeat(12000);
  const id = s.execute(user, {
    kind: "create-note",
    values: { ...v, body },
  }).id;
  expect(r.note(user, id).body).toBe(body);
  expect(() =>
    s.execute(user, {
      kind: "save-note",
      id,
      revision: 1,
      values: { ...v, body: "x".repeat(200001) },
    }),
  ).toThrow();
  expect(r.note(user, id).revision).toBe(1);
});
test("note archive is reversible and excludes search, stale autosave cannot undo it", () => {
  const id = note();
  s.execute(user, { kind: "archive-note", id, archived: true });
  expect(r.search(user, "Idée")).toEqual([]);
  expect(() =>
    s.execute(user, { kind: "save-note", id, revision: 1, values: v }),
  ).toThrow();
  s.execute(user, { kind: "archive-note", id, archived: false });
  expect(r.note(user, id).body).toBe(v.body);
});
test("note selection converts to a Task with bidirectional source and preserves original", () => {
  const id = note(),
    task = s.execute(user, {
      kind: "note-task",
      id,
      excerpt: "Texte à transformer",
      title: "Action",
    }).id;
  expect(tasks.get(user, task).description).toContain(id);
  expect(r.note(user, id).body).toBe(v.body);
  expect(r.links(id)[0].target_id).toBe(task);
  expect(r.sources(user, task)[0].id).toBe(id);
});
test("conversion rejects text absent from the saved note and leaves no Task", () => {
  const id = note();
  expect(() =>
    s.execute(user, {
      kind: "note-task",
      id,
      excerpt: "absent",
      title: "Action",
    }),
  ).toThrow();
  expect(tasks.list(user)).toEqual([]);
});
test("oversized excerpt retains complete source and creates bounded Task description", () => {
  const body = "x".repeat(12000),
    id = s.execute(user, { kind: "create-note", values: { ...v, body } }).id;
  const task = s.execute(user, {
    kind: "note-task",
    id,
    excerpt: body,
    title: "Résumé",
  }).id;
  expect(tasks.get(user, task).description!.length).toBeLessThan(10000);
  expect(r.note(user, id).body).toBe(body);
});
test("all list types preserve their items", () => {
  for (const kind of ["simple", "checklist", "shopping", "wishlist"] as const) {
    const id = list(kind);
    const item = s.execute(user, {
      kind: "save-item",
      listId: id,
      label: "Élément",
      details: "Détails",
      quantity: 2,
    }).id;
    expect(r.list(user, id).kind).toBe(kind);
    expect(r.item(id, item).quantity).toBe(2);
  }
});
test("checklist toggle, edit, removal and undo persist", () => {
  const id = list("checklist"),
    item = s.execute(user, {
      kind: "save-item",
      listId: id,
      label: "Avant",
      details: "",
      quantity: 1,
    }).id;
  s.execute(user, { kind: "toggle-item", listId: id, id: item, value: true });
  s.execute(user, {
    kind: "save-item",
    listId: id,
    id: item,
    label: "Après",
    details: "Test",
    quantity: 3,
  });
  expect(r.item(id, item).completed).toBe(1);
  s.execute(user, { kind: "archive-item", listId: id, id: item, value: true });
  expect(r.items(id)).toEqual([]);
  s.execute(user, { kind: "archive-item", listId: id, id: item, value: false });
  expect(r.items(id)[0].label).toBe("Après");
});
test("list item conversion is idempotent and retains the source", () => {
  const id = list(),
    item = s.execute(user, {
      kind: "save-item",
      listId: id,
      label: "À faire",
      details: "Contexte",
      quantity: 1,
    }).id;
  const a = s.execute(user, { kind: "item-task", listId: id, id: item }).id,
    b = s.execute(user, { kind: "item-task", listId: id, id: item }).id;
  expect(a).toBe(b);
  expect(tasks.list(user)).toHaveLength(1);
  expect(r.items(id)).toHaveLength(1);
  expect(r.sources(user, a)[0].id).toBe(id);
});
test("links support Project, Goal, Area, Task and reciprocal Note", () => {
  const id = note(),
    other = note(),
    area = new SqliteLifeAreaRepository(db).list(user)[0],
    project = new SqliteProjectRepository(db).create(user, { title: "Projet" }),
    goal = new SqliteGoalRepository(db).create(user, {
      title: "Goal",
      type: "manual",
    }),
    task = tasks.create(user, { title: "Action" });
  for (const [kind, target] of [
    ["project", project.id],
    ["goal", goal.id],
    ["life_area", area.id],
    ["task", task.id],
    ["note", other],
  ] as const)
    s.execute(user, { kind: "link", id, target: kind, targetId: target });
  expect(r.links(id)).toHaveLength(5);
  expect(r.links(other)[0].target_id).toBe(id);
  s.execute(user, {
    kind: "link",
    id,
    target: "project",
    targetId: project.id,
  });
  expect(r.links(id)).toHaveLength(5);
  const link = r.links(other)[0];
  s.execute(user, { kind: "unlink", id: other, linkId: link.id });
  expect(r.links(id)).toHaveLength(4);
});
test("self relation and foreign-user objects are rejected", () => {
  const id = note();
  expect(() =>
    s.execute(user, { kind: "link", id, target: "note", targetId: id }),
  ).toThrow();
  expect(() => s.read("other", "notes", id)).toThrow();
  expect(() =>
    s.execute("other", { kind: "save-note", id, revision: 1, values: v }),
  ).toThrow();
  expect(() =>
    s.execute(user, { kind: "link", id, target: "task", targetId: "missing" }),
  ).toThrow();
});
test("item mutation cannot cross a list boundary", () => {
  const a = list(),
    b = list(),
    item = s.execute(user, {
      kind: "save-item",
      listId: a,
      label: "A",
      details: "",
      quantity: 1,
    }).id;
  expect(() =>
    s.execute(user, { kind: "toggle-item", listId: b, id: item, value: true }),
  ).toThrow();
  expect(r.item(a, item).completed).toBe(0);
});
test("search matches note body and list item, excludes archived and treats wildcard literally", () => {
  const n = note(),
    l = list();
  s.execute(user, {
    kind: "save-item",
    listId: l,
    label: "Poires 50%",
    details: "",
    quantity: 1,
  });
  expect(r.search(user, "transformer")[0].id).toBe(n);
  expect(r.search(user, "50%")[0].id).toBe(l);
  expect(r.search(user, "_")).toEqual([]);
  s.execute(user, { kind: "archive-list", id: l, archived: true });
  expect(r.search(user, "Poires")).toEqual([]);
});
test("links only allow safe external protocols in the preview", () => {
  for (const url of [
    "javascript:alert(1)",
    "data:text/html,bad",
    "file:///secret",
    "//example.com",
  ])
    expect(safeLink(url)).toBeNull();
  expect(safeLink("https://example.com")).toBe("https://example.com");
});
test("invalid quantity, title and list kind do not partially write", () => {
  const id = list();
  expect(() =>
    s.execute(user, {
      kind: "save-item",
      listId: id,
      label: "A",
      details: "",
      quantity: 0,
    }),
  ).toThrow();
  expect(() =>
    s.execute(user, { kind: "save-list", title: " ", listKind: "simple" }),
  ).toThrow();
  expect(r.items(id)).toEqual([]);
});
test("notes persist across complete database close and reopen", () => {
  const dir = mkdtempSync(tmpdir() + "/life-os-notes-");
  try {
    let disk = connectDatabase(dir + "/test.sqlite");
    migrate(disk);
    seedJade(disk);
    setup(disk);
    const id = note();
    disk.close();
    disk = connectDatabase(dir + "/test.sqlite");
    expect(new SqliteNotesRepository(disk).note(user, id).body).toBe(v.body);
    disk.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
test("SQLite rejects a foreign-user link even when service checks are bypassed", () => {
  const id = note();
  db.query(
    "INSERT INTO users(id,name,avatar,theme,timezone,week_start,locale,created_at,updated_at) SELECT 'other',name,avatar,theme,timezone,week_start,locale,created_at,updated_at FROM users WHERE id=?",
  ).run(user);
  const other = r.createNote("other", v);
  expect(() =>
    s.execute(user, { kind: "link", id, target: "note", targetId: other }),
  ).toThrow();
  expect(() =>
    db
      .query("INSERT INTO note_links(id,note_id,note_target_id) VALUES(?,?,?)")
      .run("bad", id, other),
  ).toThrow();
});
test("search is case and accent insensitive", () => {
  const id = note();
  expect(r.search(user, "IDEE")[0].id).toBe(id);
});
