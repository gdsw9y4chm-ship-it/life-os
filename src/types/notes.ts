export interface Note {
  id: string;
  user_id: string;
  kind: "quick" | "full";
  title: string;
  body: string;
  revision: number;
  archived: number;
  created_at: string;
  updated_at: string;
}
export interface PersonalList {
  id: string;
  user_id: string;
  kind: "simple" | "checklist" | "shopping" | "wishlist";
  title: string;
  archived: number;
  created_at: string;
  updated_at: string;
}
export interface ListItem {
  id: string;
  list_id: string;
  label: string;
  details: string;
  quantity: number;
  completed: number;
  position: number;
  archived: number;
  task_id: string | null;
}
export type LinkKind =
  | "project"
  | "life_area"
  | "goal"
  | "task"
  | "event"
  | "note";
export interface NoteLink {
  id: string;
  kind: LinkKind;
  target_id: string;
  title: string;
  day?: string;
}
export type NoteValues = Pick<Note, "title" | "body" | "kind">;
export type NotesCommand =
  | { kind: "create-note"; values: NoteValues }
  | { kind: "save-note"; id: string; revision: number; values: NoteValues }
  | { kind: "archive-note" | "archive-list"; id: string; archived: boolean }
  | { kind: "link"; id: string; target: LinkKind; targetId: string }
  | { kind: "unlink"; id: string; linkId: string }
  | { kind: "note-task"; id: string; excerpt: string; title: string }
  | {
      kind: "save-list";
      id?: string;
      title: string;
      listKind: PersonalList["kind"];
    }
  | {
      kind: "save-item";
      listId: string;
      id?: string;
      label: string;
      details: string;
      quantity: number;
    }
  | {
      kind: "toggle-item" | "archive-item";
      listId: string;
      id: string;
      value: boolean;
    }
  | { kind: "item-task"; listId: string; id: string };
