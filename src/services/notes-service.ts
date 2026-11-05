import type { SqliteNotesRepository } from "../db/repositories/sqlite-notes-repository";
import type { TaskService } from "./task-service";
import type { NotesCommand, NoteValues } from "../types/notes";
function short(v: string) {
  if (typeof v !== "string" || !v.trim() || v.length > 300)
    throw new Error("Texte requis, 300 caractères maximum.");
  return v.trim();
}
function text(v: string, max: number) {
  if (typeof v !== "string" || v.length > max)
    throw new Error("Texte trop long ou invalide.");
  return v;
}
function values(v: NoteValues) {
  if (!["quick", "full"].includes(v.kind))
    throw new Error("Type de note invalide.");
  return { title: short(v.title), body: text(v.body, 200000), kind: v.kind };
}
export class NotesService {
  constructor(
    private repo: SqliteNotesRepository,
    private tasks: TaskService,
  ) {}
  read(user: string, view: "notes" | "lists", id?: string, archived = false) {
    return {
      notes: this.repo.notes(user, archived),
      lists: this.repo.lists(user, archived),
      note: id && view === "notes" ? this.repo.note(user, id) : null,
      list: id && view === "lists" ? this.repo.list(user, id) : null,
      links: id && view === "notes" ? this.repo.links(id) : [],
      items: id && view === "lists" ? this.repo.items(id) : [],
      references: this.repo.references(user),
    };
  }
  execute(user: string, c: NotesCommand): { id: string; revision?: number } {
    return this.repo.transaction(() => {
      switch (c.kind) {
        case "create-note":
          return { id: this.repo.createNote(user, values(c.values)) };
        case "save-note": {
          this.repo.note(user, c.id);
          if (!Number.isInteger(c.revision) || c.revision < 1)
            throw new Error("Révision invalide.");
          const note = this.repo.saveNote(
            user,
            c.id,
            c.revision,
            values(c.values),
          );
          return { id: note.id, revision: note.revision };
        }
        case "archive-note":
          this.repo.note(user, c.id);
          this.repo.archive(user, c.id, "note", c.archived);
          return { id: c.id };
        case "archive-list":
          this.repo.list(user, c.id);
          this.repo.archive(user, c.id, "list", c.archived);
          return { id: c.id };
        case "link":
          this.repo.note(user, c.id);
          this.repo.link(user, c.id, c.target, c.targetId);
          return { id: c.id };
        case "unlink":
          this.repo.note(user, c.id);
          this.repo.unlink(c.id, c.linkId);
          return { id: c.id };
        case "note-task": {
          const n = this.repo.note(user, c.id);
          if (!c.excerpt.trim() || !n.body.includes(c.excerpt))
            throw new Error("Sélection absente de la note enregistrée.");
          const task = this.tasks.create(user, {
            title: short(c.title),
            description: `Source : /notes?view=notes&id=${n.id}\n\n${text(c.excerpt, 200000).slice(0, 9000)}${c.excerpt.length > 9000 ? "\n[Extrait — sélection complète dans la note source]" : ""}`,
          });
          this.repo.link(user, n.id, "task", task.id);
          return { id: task.id };
        }
        case "save-list": {
          if (
            !["simple", "checklist", "shopping", "wishlist"].includes(
              c.listKind,
            )
          )
            throw new Error("Type de liste invalide.");
          if (c.id) this.repo.list(user, c.id);
          return {
            id: this.repo.saveList(user, c.id, short(c.title), c.listKind),
          };
        }
        case "save-item": {
          if (this.repo.list(user, c.listId).archived)
            throw new Error("Liste archivée.");
          if (c.id) this.repo.item(c.listId, c.id);
          if (
            !Number.isFinite(c.quantity) ||
            c.quantity <= 0 ||
            c.quantity > 1000000
          )
            throw new Error("Quantité invalide.");
          return {
            id: this.repo.saveItem(
              c.listId,
              c.id,
              short(c.label),
              text(c.details, 10000),
              c.quantity,
            ),
          };
        }
        case "toggle-item":
        case "archive-item": {
          this.repo.list(user, c.listId);
          this.repo.item(c.listId, c.id);
          this.repo.itemFlag(
            c.listId,
            c.id,
            c.kind === "toggle-item" ? "completed" : "archived",
            c.value,
          );
          return { id: c.id };
        }
        case "item-task": {
          const list = this.repo.list(user, c.listId),
            item = this.repo.item(c.listId, c.id);
          if (item.task_id) return { id: item.task_id };
          const task = this.tasks.create(user, {
            title: item.label,
            description: `Source : /notes?view=lists&id=${list.id}\n\n${item.details.slice(0, 9000)}${item.details.length > 9000 ? "\n[Détails complets dans la liste source]" : ""}`,
          });
          this.repo.itemTask(item.id, task.id);
          return { id: task.id };
        }
        default:
          throw new Error("Commande invalide.");
      }
    });
  }
}
