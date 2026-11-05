import { useRouter } from "@tanstack/react-router";
import { readDrafts, writeDraft, removeDraft, type NoteDraft } from "./drafts";
import { useEffect, useRef, useState, useCallback } from "react";
import type { Note, NoteValues } from "../../types/notes";
import { saveNotes } from "./api";
export function useNoteAutosave(note: Note, userId: string) {
  const router=useRouter();
  const initial = { title: note.title, body: note.body, kind: note.kind };
  const [recoveries, setRecoveries] = useState<
      { id: string; draft: NoteDraft }[]
    >([]),
    tab = useRef("");
  const [values, setValues] = useState<NoteValues>(initial),
    [status, setStatus] = useState("Enregistré"),
    [conflict, setConflict] = useState(false);
  const current = useRef({ values: initial, sequence: 0 }),
    ack = useRef(0),
    revision = useRef(note.revision),
    mounted = useRef(false),
    pending = useRef<Promise<boolean> | null>(null),
    blocked = useRef(false);
  const key = `life-os:note-draft:${userId}:${note.id}`;
  const persist = useCallback(() => {
    try {
      writeDraft(key, tab.current, {
        values: current.current.values,
        revision: revision.current,
        updated: Date.now(),
      });
    } catch {
      setStatus(
        "Sauvegarde locale indisponible : gardez cette page ouverte jusqu’à confirmation serveur.",
      );
    }
  }, [key]);
  const flush = useCallback(async (): Promise<boolean> => {
    if (blocked.current || note.archived) return false;
    if (pending.current) return pending.current;
    if (current.current.sequence === ack.current) return true;
    const work = (async () => {
      try {
        while (current.current.sequence !== ack.current) {
          const sent = { ...current.current };
          if (mounted.current) setStatus("Enregistrement…");
          const result = await saveNotes({
            data: {
              kind: "save-note",
              id: note.id,
              revision: revision.current,
              values: sent.values,
            },
          });
          if (!result.ok) {
            if (result.error.startsWith("Conflit")) {
              blocked.current = true;
              if (mounted.current) setConflict(true);
            }
            if (mounted.current) setStatus(result.error);
            return false;
          }
          revision.current = result.revision!;
          ack.current = sent.sequence;
          if (current.current.sequence === sent.sequence) {
            try {
              removeDraft(key, tab.current);
            } catch {
              /* Server confirmation remains authoritative. */
            }
          } else persist();
        }
        if (mounted.current) {setStatus("Enregistré");void router.invalidate().catch(()=>{});}
        return true;
      } catch {
        if (mounted.current)
          setStatus(
            "Hors connexion ou erreur serveur. Brouillon conservé sur cet appareil.",
          );
        return false;
      } finally {
        pending.current = null;
      }
    })();
    pending.current = work;
    return work;
  }, [key, note.id, note.archived, persist, router]);
  function restore(draft: NoteDraft) {
    const conflict = draft.revision !== revision.current;
    blocked.current = conflict;
    setConflict(conflict);
    revision.current = draft.revision;
    current.current = { values: draft.values, sequence: ack.current + 1 };
    setValues(draft.values);
    setStatus(
      conflict
        ? "Conflit : un brouillon local et une version serveur différente existent."
        : "Brouillon local restauré",
    );
    persist();
  }
  useEffect(() => {
    mounted.current = true;
    try {
      tab.current =
        sessionStorage.getItem("life-os:note-tab") || crypto.randomUUID();
      sessionStorage.setItem("life-os:note-tab", tab.current);
      const drafts = readDrafts(key),
        own = drafts[tab.current];
      setRecoveries(
        Object.entries(drafts)
          .filter(([id]) => id !== tab.current)
          .map(([id, draft]) => ({ id, draft })),
      );
      if (own) {
        if (JSON.stringify(own.values) === JSON.stringify(initial))
          removeDraft(key, tab.current);
        else restore(own);
      }
    } catch {
      setStatus("Impossible de lire le brouillon local.");
    }
    const leave = (e: BeforeUnloadEvent) => {
      if (current.current.sequence !== ack.current) {
        persist();
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", leave);
    return () => {
      mounted.current = false;
      void flush();
      window.removeEventListener("beforeunload", leave);
    };
    // A keyed editor owns one note for its entire lifetime.
  }, [key]);
  useEffect(() => {
    if (note.archived) return;
    const timer = setTimeout(
      () =>
        void flush().then((ok) => {
          if (ok && mounted.current && current.current.sequence !== ack.current)
            void flush();
        }),
      600,
    );
    return () => clearTimeout(timer);
  }, [values, flush, note.archived]);
  useEffect(() => {
    let live = true;
    const sync = async () => {
      if (pending.current) await pending.current;
      if (!live || note.revision < revision.current) return;
      if (current.current.sequence === ack.current) {
        revision.current = note.revision;
        const next = { title: note.title, body: note.body, kind: note.kind };
        current.current = { ...current.current, values: next };
        setValues(next);
      } else if (note.revision === revision.current) {
        blocked.current = false;
        setConflict(false);
      } else {
        blocked.current = true;
        setConflict(true);
        setStatus(
          "Conflit : une nouvelle version serveur existe. Votre brouillon est conservé.",
        );
      }
    };
    void sync();
    return () => {
      live = false;
    };
  }, [note.revision, note.title, note.body, note.kind]);
  function change(next: NoteValues) {
    current.current = { values: next, sequence: current.current.sequence + 1 };
    setValues(next);
    setStatus("Modifications en attente");
    persist();
  }
  function clearDraft() {
    blocked.current = true;
    ack.current = current.current.sequence;
    try {
      removeDraft(key, tab.current);
    } catch {
      /* Server copy remains safe. */
    }
  }
  function discard() {
    clearDraft();
    window.location.reload();
  }
  return {
    values,
    change,
    status,
    conflict,
    flush,
    discard,
    clearDraft,
    recoveries,
    restore,
  };
}
