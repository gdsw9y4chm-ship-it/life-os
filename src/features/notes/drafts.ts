import type { NoteValues } from "../../types/notes";
export interface NoteDraft {
  values: NoteValues;
  revision: number;
  updated: number;
}
// Each tab writes a separate storage key, so concurrent drafts cannot overwrite one another.
export function readDrafts(key: string): Record<string, NoteDraft> {
  const result: Record<string, NoteDraft> = {};
  for (let i = 0; i < localStorage.length; i++) {
    const stored = localStorage.key(i);
    if (!stored?.startsWith(key + ":")) continue;
    try {
      const d = JSON.parse(localStorage.getItem(stored)!);
      if (
        d &&
        typeof d.values?.title === "string" &&
        typeof d.values?.body === "string" &&
        ["quick", "full"].includes(d.values.kind) &&
        Number.isInteger(d.revision)
      )
        result[stored.slice(key.length + 1)] = d;
    } catch {
      /* Preserve malformed storage rather than deleting it. */
    }
  }
  return result;
}
export function writeDraft(key: string, id: string, draft: NoteDraft) {
  localStorage.setItem(key + ":" + id, JSON.stringify(draft));
}
export function removeDraft(key: string, id: string) {
  localStorage.removeItem(key + ":" + id);
}
