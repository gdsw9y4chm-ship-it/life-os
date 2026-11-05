import type { Database } from "bun:sqlite";
import type {
  Note,
  PersonalList,
  ListItem,
  NoteValues,
  LinkKind,
  NoteLink,
} from "../../types/notes";
export const linkColumns = {
  project: "project_id",
  life_area: "life_area_id",
  goal: "goal_id",
  task: "task_id",
  event: "event_id",
  note: "note_target_id",
} as const;
const tables = {
  project: "projects",
  life_area: "life_areas",
  goal: "goals",
  task: "tasks",
  event: "planner_series",
  note: "notes",
} as const;
export class SqliteNotesRepository {
  constructor(readonly db: Database) {
    db.function("notes_fold", (value) =>
      typeof value === "string"
        ? value
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase()
        : "",
    );
  }
  transaction<T>(f: () => T) {
    return this.db.transaction(f).immediate();
  }
  note(user: string, id: string) {
    const n = this.db
      .query<
        Note,
        [string, string]
      >("SELECT * FROM notes WHERE user_id=? AND id=?")
      .get(user, id);
    if (!n) throw new Error("Note introuvable.");
    return n;
  }
  list(user: string, id: string) {
    const n = this.db
      .query<
        PersonalList,
        [string, string]
      >("SELECT * FROM personal_lists WHERE user_id=? AND id=?")
      .get(user, id);
    if (!n) throw new Error("Liste introuvable.");
    return n;
  }
  notes(user: string, archived: boolean) {
    return this.db
      .query<
        Omit<Note, "body">,
        [string, number]
      >("SELECT id,user_id,kind,title,revision,archived,created_at,updated_at FROM notes WHERE user_id=? AND archived=? ORDER BY updated_at DESC")
      .all(user, +archived);
  }
  lists(user: string, archived: boolean) {
    return this.db
      .query<
        PersonalList,
        [string, number]
      >("SELECT * FROM personal_lists WHERE user_id=? AND archived=? ORDER BY updated_at DESC")
      .all(user, +archived);
  }
  items(listId: string) {
    return this.db
      .query<
        ListItem,
        [string]
      >("SELECT * FROM list_items WHERE list_id=? AND archived=0 ORDER BY position,id")
      .all(listId);
  }
  item(listId: string, id: string) {
    const i = this.db
      .query<
        ListItem,
        [string, string]
      >("SELECT * FROM list_items WHERE list_id=? AND id=?")
      .get(listId, id);
    if (!i) throw new Error("Élément introuvable.");
    return i;
  }
  createNote(user: string, v: NoteValues) {
    const id = crypto.randomUUID(),
      now = new Date().toISOString();
    this.db
      .query(
        "INSERT INTO notes(id,user_id,title,body,kind,created_at,updated_at) VALUES(?,?,?,?,?,?,?)",
      )
      .run(id, user, v.title, v.body, v.kind, now, now);
    return id;
  }
  saveNote(user: string, id: string, revision: number, v: NoteValues) {
    const r = this.db
      .query(
        "UPDATE notes SET title=?,body=?,kind=?,revision=revision+1,updated_at=? WHERE user_id=? AND id=? AND revision=? AND archived=0",
      )
      .run(
        v.title,
        v.body,
        v.kind,
        new Date().toISOString(),
        user,
        id,
        revision,
      );
    if (r.changes !== 1)
      throw new Error(
        "Conflit : la note a changé dans un autre onglet ou est archivée. Votre brouillon est conservé.",
      );
    return this.note(user, id);
  }
  archive(user: string, id: string, kind: "note" | "list", archived: boolean) {
    this.db
      .query(
        `UPDATE ${kind === "note" ? "notes" : "personal_lists"} SET archived=?,updated_at=? ${kind === "note" ? ",revision=revision+1" : ""} WHERE user_id=? AND id=?`,
      )
      .run(+archived, new Date().toISOString(), user, id);
  }
  saveList(
    user: string,
    id: string | undefined,
    title: string,
    kind: PersonalList["kind"],
  ) {
    const now = new Date().toISOString();
    if (id)
      this.db
        .query(
          "UPDATE personal_lists SET title=?,kind=?,updated_at=? WHERE user_id=? AND id=?",
        )
        .run(title, kind, now, user, id);
    else {
      id = crypto.randomUUID();
      this.db
        .query(
          "INSERT INTO personal_lists(id,user_id,title,kind,created_at,updated_at) VALUES(?,?,?,?,?,?)",
        )
        .run(id, user, title, kind, now, now);
    }
    return id;
  }
  saveItem(
    list: string,
    id: string | undefined,
    label: string,
    details: string,
    quantity: number,
  ) {
    if (id)
      this.db
        .query(
          "UPDATE list_items SET label=?,details=?,quantity=? WHERE list_id=? AND id=?",
        )
        .run(label, details, quantity, list, id);
    else {
      id = crypto.randomUUID();
      this.db
        .query(
          "INSERT INTO list_items(id,list_id,label,details,quantity,position) SELECT ?,?,?,?,?,COALESCE(MAX(position),-1)+1 FROM list_items WHERE list_id=?",
        )
        .run(id, list, label, details, quantity, list);
    }
    return id;
  }
  itemFlag(
    list: string,
    id: string,
    field: "completed" | "archived",
    value: boolean,
  ) {
    this.db
      .query(`UPDATE list_items SET ${field}=? WHERE list_id=? AND id=?`)
      .run(+value, list, id);
  }
  itemTask(id: string, task: string) {
    this.db.query("UPDATE list_items SET task_id=? WHERE id=?").run(task, id);
  }
  link(user: string, id: string, kind: LinkKind, target: string) {
    if (kind === "note" && id === target)
      throw new Error("Une note ne peut pas se lier à elle-même.");
    const column = linkColumns[kind],
      table = tables[kind];
    if (!column) throw new Error("Relation invalide.");
    const r = this.db
      .query(
        `SELECT id FROM ${table} WHERE user_id=? AND id=? ${kind === "event" ? "AND kind='event'" : ""}`,
      )
      .get(user, target);
    if (!r) throw new Error("Objet lié introuvable.");
    this.db
      .query(
        `INSERT OR IGNORE INTO note_links(id,note_id,${column}) VALUES(?,?,?)`,
      )
      .run(crypto.randomUUID(), id, target);
  }
  links(id: string): NoteLink[] {
    const result: NoteLink[] = [];
    for (const kind of Object.keys(linkColumns) as LinkKind[]) {
      const column = linkColumns[kind];
      result.push(
        ...this.db
          .query<
            NoteLink,
            [string]
          >(`SELECT l.id,'${kind}' AS kind,t.id AS target_id,t.${kind === "life_area" ? "name" : "title"} AS title ${kind === "event" ? ",substr(t.start_local,1,10) AS day" : ""} FROM note_links l JOIN ${tables[kind]} t ON t.id=l.${column} WHERE l.note_id=?`)
          .all(id),
      );
    }
    result.push(
      ...this.db
        .query<
          NoteLink,
          [string]
        >("SELECT l.id,'note' AS kind,n.id AS target_id,n.title FROM note_links l JOIN notes n ON n.id=l.note_id WHERE l.note_target_id=?")
        .all(id),
    );
    return result;
  }
  unlink(id: string, link: string) {
    this.db
      .query(
        "DELETE FROM note_links WHERE id=? AND (note_id=? OR note_target_id=?)",
      )
      .run(link, id, id);
  }
  references(user: string) {
    const result: { kind: LinkKind; id: string; title: string }[] = [];
    for (const kind of Object.keys(tables) as LinkKind[])
      result.push(
        ...this.db
          .query<
            { kind: LinkKind; id: string; title: string },
            [string]
          >(`SELECT '${kind}' AS kind,id,${kind === "life_area" ? "name" : "title"} AS title FROM ${tables[kind]} WHERE user_id=? ${kind === "event" ? "AND kind='event'" : ""} ORDER BY ${kind === "life_area" ? "name" : "title"} LIMIT 200`)
          .all(user),
      );
    return result;
  }
  search(user: string, q: string) {
    const term =
      "%" +
      q
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[\\%_]/g, "\\$&") +
      "%";
    return this.db
      .query<
        { id: string; title: string; kind: "note" | "list" },
        [string, string, string, string, string, string]
      >(`SELECT id,title,'note' AS kind FROM notes WHERE user_id=? AND archived=0 AND (notes_fold(title) LIKE ? ESCAPE '\\' OR notes_fold(body) LIKE ? ESCAPE '\\') UNION ALL SELECT id,title,'list' AS kind FROM personal_lists WHERE user_id=? AND archived=0 AND (notes_fold(title) LIKE ? ESCAPE '\\' OR EXISTS(SELECT 1 FROM list_items i WHERE i.list_id=personal_lists.id AND i.archived=0 AND notes_fold(i.label) LIKE ? ESCAPE '\\')) LIMIT 30`)
      .all(user, term, term, user, term, term);
  }
  sources(user: string, task: string) {
    return this.db
      .query<
        { id: string; title: string; kind: "note" | "list" },
        [string, string, string, string]
      >("SELECT n.id,n.title,'note' AS kind FROM note_links l JOIN notes n ON n.id=l.note_id WHERE n.user_id=? AND l.task_id=? UNION SELECT l.id,l.title,'list' AS kind FROM list_items i JOIN personal_lists l ON l.id=i.list_id WHERE l.user_id=? AND i.task_id=?")
      .all(user, task, user, task);
  }
}
