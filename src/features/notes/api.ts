import { createServerFn } from "@tanstack/react-start";
import type { NotesCommand } from "../../types/notes";
export const getNotes = createServerFn({ method: "GET" })
  .validator(
    (v: { view: "notes" | "lists"; id?: string; archived?: boolean }) => v,
  )
  .handler(async ({ data }) => {
    const { withNotes } = await import("../../services/notes-service.server");
    return withNotes((s, u) => ({
      ...s.read(u.id, data.view, data.id, data.archived),
      userId: u.id,
    }));
  });
export const saveNotes = createServerFn({ method: "POST" })
  .validator((v: NotesCommand) => v)
  .handler(async ({ data }) => {
    try {
      const { withNotes } = await import("../../services/notes-service.server");
      const result = withNotes((s, u) => s.execute(u.id, data));
      return { ok: true as const, ...result };
    } catch (e) {
      return {
        ok: false as const,
        error: e instanceof Error ? e.message : "Enregistrement impossible.",
      };
    }
  });
export const searchNotes = createServerFn({ method: "GET" })
  .validator((q: string) => q)
  .handler(async ({ data }) => {
    const { withNotes } = await import("../../services/notes-service.server");
    return withNotes((_, u, r) => r.search(u.id, data.trim().slice(0, 300)));
  });
export const taskNoteSources = createServerFn({ method: "GET" })
  .validator((id: string) => id)
  .handler(async ({ data }) => {
    const { withNotes } = await import("../../services/notes-service.server");
    return withNotes((_, u, r) => r.sources(u.id, data));
  });
