import { useHydrated } from "../../lib/use-hydrated";
import { useState, useRef, useEffect } from "react";
import { Link, useNavigate, useRouter } from "@tanstack/react-router";
import { PageLayout } from "../../components/layout/page-shell";
import {
  Button,
  Input,
  Select,
  Checkbox,
  Textarea,
} from "../../design-system/components/primitives";
import { Sheet } from "../../design-system/components/overlays";
import { getNotes, saveNotes } from "./api";
import { useNoteAutosave } from "./autosave";
import { NotePreview } from "./markdown";
import type {
  Note,
  NoteLink,
  NotesCommand,
  ListItem,
  PersonalList,
} from "../../types/notes";
type Data = Awaited<ReturnType<typeof getNotes>>;
const labels = {
  simple: "Simple",
  checklist: "Checklist",
  shopping: "Shopping",
  wishlist: "Wishlist",
};
export function useNotesMutation() {
  const router = useRouter(),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    lock = useRef(false);
  async function run(data: NotesCommand) {
    if (lock.current) return null;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const r = await saveNotes({ data });
      if (!r.ok) {
        setError(r.error);
        return null;
      }
      await router.invalidate();
      return r.id;
    } catch {
      setError("Enregistrement impossible.");
      return null;
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return { busy, error, run };
}
export function NotesView({
  data,
  view,
  archived,
}: {
  data: Data;
  view: "notes" | "lists";
  archived: boolean;
}) {
  const hydrated = useHydrated(),
    navigate = useNavigate(),
    mutation = useNotesMutation(),
    [query, setQuery] = useState("");
  async function create() {
    const id = await mutation.run(
      view === "notes"
        ? {
            kind: "create-note",
            values: { title: "Sans titre", body: "", kind: "full" },
          }
        : { kind: "save-list", title: "Nouvelle liste", listKind: "simple" },
    );
    if (id)
      void navigate({ to: "/notes", search: { view, id, archived: false } });
  }
  return (
    <div className="notes-page">
      <PageLayout title="Notes" subtitle="Vos idées, vos mots et vos listes.">
        <nav className="time-actions" aria-label="Notes et Lists">
          <Link to="/notes" search={{ view: "notes", archived: false }}>
            Notes
          </Link>
          <Link to="/notes" search={{ view: "lists", archived: false }}>
            Lists
          </Link>
          <Button
            disabled={mutation.busy || !hydrated}
            onClick={() => void create()}
          >
            {view === "notes" ? "Nouvelle note" : "Nouvelle liste"}
          </Button>
          <Link to="/notes" search={{ view, archived: !archived }}>
            {archived ? "Actives" : "Archives"}
          </Link>
        </nav>
        {mutation.error && <p role="alert">{mutation.error}</p>}
        <div
          className={`notes-workspace ${data.note || data.list ? "has-selection" : ""}`}
        >
          <aside className="notes-index">
            <Input
              label="Filtrer les titres"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {(view === "notes" ? data.notes : data.lists)
              .filter((n) =>
                n.title.toLocaleLowerCase().includes(query.toLocaleLowerCase()),
              )
              .map((n) => (
                <Link
                  className={
                    n.id === (data.note?.id ?? data.list?.id) ? "selected" : ""
                  }
                  key={n.id}
                  to="/notes"
                  search={{ view, id: n.id, archived }}
                >
                  {n.title}
                  {view==="lists"&&<small>{n.kind}</small>}
                </Link>
              ))}
            {!(view === "notes" ? data.notes : data.lists).length && (
              <p>
                {archived
                  ? "Aucune archive."
                  : "Un espace libre pour vos idées."}
              </p>
            )}
          </aside>
          <section className="notes-content">
            {(data.note || data.list) && (
              <Link
                className="notes-back"
                to="/notes"
                search={{ view, archived }}
              >
                ← Toutes les {view === "notes" ? "notes" : "listes"}
              </Link>
            )}
            {data.note ? (
              <NoteEditor key={data.note.id} note={data.note} data={data} />
            ) : data.list ? (
              <ListEditor
                key={data.list.id}
                list={data.list}
                items={data.items}
              />
            ) : (
              <p>
                Sélectionnez ou créez{" "}
                {view === "notes" ? "une note" : "une liste"}.
              </p>
            )}
          </section>
        </div>
      </PageLayout>
    </div>
  );
}
function NoteEditor({ note, data }: { note: Note; data: Data }) {
  const hydrated = useHydrated(),
    a = useNoteAutosave(note, data.userId),
    m = useNotesMutation(),
    navigate = useNavigate(),
    [reading, setReading] = useState(!!note.body),
    [preview, setPreview] = useState(false),
    [selection, setSelection] = useState(""),
    [taskTitle, setTaskTitle] = useState(""),
    [taskOpen, setTaskOpen] = useState(false),
    [ref, setRef] = useState(""),
    editor = useRef<HTMLTextAreaElement>(null);
  const change = (patch: Partial<typeof a.values>) =>
    a.change({ ...a.values, ...patch });
  async function copy() {
    const id = await m.run({ kind: "create-note", values: a.values });
    if (id) {
      a.clearDraft();
      void navigate({
        to: "/notes",
        search: { view: "notes", id, archived: false },
      });
    }
  }
  function format(prefix: string) {
    const element = editor.current,
      at = element?.selectionStart ?? a.values.body.length,
      start = a.values.body.lastIndexOf("\n", at - 1) + 1;
    change({
      body: a.values.body.slice(0, start) + prefix + a.values.body.slice(start),
    });
    element?.focus();
  }
  if (reading)
    return (
      <article className="note-reading">
        <header>
          <h2>{a.values.title}</h2>
          <Button onClick={() => setReading(false)}>Modifier</Button>
          <details>
            <summary>Autres actions</summary>
            <Button variant="ghost" onClick={() => setReading(false)}>
              Relations et gestion
            </Button>
          </details>
        </header>
        <NotePreview
          body={a.values.body}
          onChange={note.archived ? undefined : (body) => change({ body })}
        />
        {a.conflict && (
          <p role="alert">
            Une autre version existe. Ouvrez Modifier pour conserver votre
            brouillon.
          </p>
        )}
        {a.recoveries.length > 0 && (
          <Button onClick={() => setReading(false)}>
            Brouillons à restaurer
          </Button>
        )}
        {a.status !== "Enregistré" && <p role="status">{a.status}</p>}
      </article>
    );
  return (
    <div className="note-editor">
      <Button
        variant="secondary"
        onClick={async () => {
          if (note.archived || (await a.flush())) setReading(true);
        }}
      >
        Terminer la modification
      </Button>
      <Input
        label="Titre de la note"
        value={a.values.title}
        disabled={!!note.archived || !hydrated}
        onChange={(e) => change({ title: e.target.value })}
        maxLength={300}
      />
      <Select
        label="Type de note"
        value={a.values.kind}
        disabled={!!note.archived || !hydrated}
        onChange={(e) => change({ kind: e.target.value as Note["kind"] })}
      >
        <option value="quick">Quick Note</option>
        <option value="full">Full Note</option>
      </Select>
      <div className="note-recoveries">
        {a.recoveries.map((r) => (
          <Button
            key={r.id}
            variant="secondary"
            onClick={() => a.restore(r.draft)}
          >
            Restaurer le brouillon : {r.draft.values.title}
          </Button>
        ))}
      </div>
      <div className="time-actions">
        <Button variant="secondary" onClick={() => setPreview(!preview)}>
          {preview ? "Écrire" : "Aperçu"}
        </Button>
        {!note.archived && (
          <Button variant="ghost" onClick={() => void a.flush()}>
            Enregistrer maintenant
          </Button>
        )}
        <span role="status">{a.status}</span>
      </div>
      {a.conflict && (
        <div className="note-conflict" role="alert">
          <p>
            Votre texte local reste intact. Conservez-le comme nouvelle note ou
            rechargez explicitement la version serveur.
          </p>
          <Button onClick={() => void copy()}>
            Conserver comme nouvelle note
          </Button>
          <Button variant="secondary" onClick={a.discard}>
            Abandonner le brouillon local
          </Button>
        </div>
      )}
      {!preview && !note.archived && (
        <div className="note-toolbar" aria-label="Format de note">
          {[
            ["Titre", "# "],
            ["Sous-titre", "## "],
            ["Puces", "- "],
            ["Numéros", "1. "],
            ["Checklist", "- [ ] "],
            ["Citation", "> "],
            ["Lien", "[texte](https://)"],
          ].map(([label, prefix]) => (
            <button key={label} onClick={() => format(prefix)}>
              {label}
            </button>
          ))}
        </div>
      )}
      {preview || note.archived ? (
        <NotePreview
          body={a.values.body}
          onChange={note.archived ? undefined : (body) => change({ body })}
        />
      ) : (
        <label className="field">
          <span>Contenu de la note</span>
          <textarea
            ref={editor}
            disabled={!hydrated}
            aria-label="Contenu de la note"
            value={a.values.body}
            onChange={(e) => change({ body: e.target.value })}
            onSelect={(e) => {
              const el = e.currentTarget;
              setSelection(el.value.slice(el.selectionStart, el.selectionEnd));
            }}
            placeholder="Écrivez librement. # titre, - liste, - [ ] checklist, > citation…"
          />
        </label>
      )}
      {!note.archived && (
        <Button
          variant="secondary"
          disabled={!selection.trim() || m.busy || a.conflict}
          onClick={() => {
            setTaskTitle(selection.trim().slice(0, 300));
            setTaskOpen(true);
          }}
        >
          Transformer la sélection en Task
        </Button>
      )}
      <section className="note-relations">
        <h3>Liens</h3>
        {data.links.map((link) => (
          <div className="time-actions" key={link.id}>
            <RelatedLink link={link} />
            <Button
              variant="ghost"
              disabled={m.busy}
              onClick={() =>
                void m.run({ kind: "unlink", id: note.id, linkId: link.id })
              }
            >
              Délier
            </Button>
          </div>
        ))}
        {!note.archived && (
          <form
            className="time-actions"
            onSubmit={(e) => {
              e.preventDefault();
              const [target, ...rest] = ref.split(":");
              void m.run({
                kind: "link",
                id: note.id,
                target: target as NoteLink["kind"],
                targetId: rest.join(":"),
              });
            }}
          >
            <Select
              label="Lier un objet"
              value={ref}
              onChange={(e) => setRef(e.target.value)}
            >
              <option value="">Choisir…</option>
              {data.references
                .filter((r) => r.id !== note.id)
                .map((r) => (
                  <option key={r.kind + r.id} value={r.kind + ":" + r.id}>
                    {r.kind} · {r.title}
                  </option>
                ))}
            </Select>
            <Button type="submit" disabled={!ref || m.busy}>
              Lier
            </Button>
          </form>
        )}
      </section>
      <Button
        variant="ghost"
        disabled={m.busy}
        onClick={async () => {
          if (!note.archived && !(await a.flush())) return;
          const saved = await m.run({
            kind: "archive-note",
            id: note.id,
            archived: !note.archived,
          });
          if (saved)
            void navigate({
              to: "/notes",
              search: { view: "notes", archived: !note.archived },
            });
        }}
      >
        {note.archived ? "Restaurer la note" : "Archiver la note"}
      </Button>
      {m.error && <p role="alert">{m.error}</p>}
      <Sheet
        title="Créer une Task depuis la note"
        description="La sélection reste dans la note ; la Task conserve un lien vers sa source."
        open={taskOpen}
        onOpenChange={setTaskOpen}
        trigger={<span />}
      >
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (await a.flush()) {
              const id = await m.run({
                kind: "note-task",
                id: note.id,
                excerpt: selection,
                title: taskTitle,
              });
              if (id) setTaskOpen(false);
            }
          }}
        >
          <Input
            label="Titre de la Task"
            value={taskTitle}
            onChange={(e) => setTaskTitle(e.target.value)}
            required
            maxLength={300}
          />
          <Button type="submit" disabled={m.busy}>
            Créer la Task
          </Button>
          {m.error && <p role="alert">{m.error}</p>}
        </form>
      </Sheet>
    </div>
  );
}
export function RelatedLink({ link }: { link: NoteLink }) {
  if (link.kind === "task")
    return (
      <Link to="/tasks/$taskId" params={{ taskId: link.target_id }}>
        {link.title}
      </Link>
    );
  if (link.kind === "project")
    return (
      <Link to="/projects/$projectId" params={{ projectId: link.target_id }}>
        {link.title}
      </Link>
    );
  if (link.kind === "note")
    return (
      <Link
        to="/notes"
        search={{ view: "notes", id: link.target_id, archived: false }}
      >
        {link.title}
      </Link>
    );
  if (link.kind === "event")
    return (
      <Link to="/planner" search={{ view: "agenda", day: link.day ?? "" }}>
        {link.title} · Event
      </Link>
    );
  return (
    <Link to="/life">
      {link.title} · {link.kind}
    </Link>
  );
}
function ListEditor({
  list,
  items,
}: {
  list: PersonalList;
  items: ListItem[];
}) {
  const hydrated = useHydrated(),
    m = useNotesMutation(),
    navigate = useNavigate(),
    [title, setTitle] = useState(list.title),
    [kind, setKind] = useState(list.kind),
    [item, setItem] = useState<ListItem | null | undefined>(undefined),
    [undo, setUndo] = useState<string | null>(null);
  useEffect(() => {
    setTitle(list.title);
    setKind(list.kind);
  }, [list.updated_at, list.title, list.kind]);
  return (
    <div className="list-editor">
      <form
        className="time-actions"
        onSubmit={(e) => {
          e.preventDefault();
          void m.run({ kind: "save-list", id: list.id, title, listKind: kind });
        }}
      >
        <Input
          label="Titre de la liste"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          disabled={!!list.archived || !hydrated || m.busy}
        />
        <Select
          label="Type de liste"
          value={kind}
          onChange={(e) => setKind(e.target.value as PersonalList["kind"])}
          disabled={!!list.archived || !hydrated || m.busy}
        >
          {Object.entries(labels).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </Select>
        <Button type="submit" disabled={m.busy || !!list.archived}>
          Enregistrer la liste
        </Button>
      </form>
      {!list.archived && (
        <Button disabled={m.busy || !hydrated} onClick={() => setItem(null)}>
          Ajouter un élément
        </Button>
      )}
      <ul className="personal-list">
        {items.map((i) => (
          <li key={i.id}>
            <div>
              {kind !== "simple" ? (
                <Checkbox
                  label={i.label}
                  checked={!!i.completed}
                  disabled={m.busy || !!list.archived}
                  onChange={(e) =>
                    void m.run({
                      kind: "toggle-item",
                      listId: list.id,
                      id: i.id,
                      value: e.target.checked,
                    })
                  }
                />
              ) : (
                <strong>{i.label}</strong>
              )}
              {i.details && <p>{i.details}</p>}
              {kind === "shopping" && <small>Quantité : {i.quantity}</small>}
            </div>
            <div className="time-actions">
              {i.task_id ? (
                <Link to="/tasks/$taskId" params={{ taskId: i.task_id }}>
                  Task liée
                </Link>
              ) : (
                <Button
                  variant="ghost"
                  disabled={m.busy || !!list.archived}
                  onClick={() =>
                    void m.run({ kind: "item-task", listId: list.id, id: i.id })
                  }
                >
                  Créer une Task
                </Button>
              )}
              <Button
                variant="ghost"
                disabled={!!list.archived || !hydrated || m.busy}
                onClick={() => setItem(i)}
              >
                Modifier
              </Button>
              <Button
                variant="ghost"
                disabled={m.busy || !!list.archived}
                onClick={async () => {
                  if (
                    await m.run({
                      kind: "archive-item",
                      listId: list.id,
                      id: i.id,
                      value: true,
                    })
                  )
                    setUndo(i.id);
                }}
              >
                Retirer
              </Button>
            </div>
          </li>
        ))}
      </ul>
      {!items.length && <p>Votre liste est vide.</p>}
      {undo && (
        <Button
          onClick={async () => {
            await m.run({
              kind: "archive-item",
              listId: list.id,
              id: undo,
              value: false,
            });
            setUndo(null);
          }}
        >
          Annuler le retrait
        </Button>
      )}
      <Button
        variant="ghost"
        disabled={m.busy}
        onClick={async () => {
          const saved = await m.run({
            kind: "archive-list",
            id: list.id,
            archived: !list.archived,
          });
          if (saved)
            void navigate({
              to: "/notes",
              search: { view: "lists", archived: !list.archived },
            });
        }}
      >
        {list.archived ? "Restaurer la liste" : "Archiver la liste"}
      </Button>
      {m.error && <p role="alert">{m.error}</p>}
      <Sheet
        title="Élément de liste"
        description="Une idée, un achat ou une chose à garder."
        open={item !== undefined}
        onOpenChange={(v) => {
          if (!v) setItem(undefined);
        }}
        trigger={<span />}
      >
        {item !== undefined && (
          <ItemEditor
            listId={list.id}
            item={item}
            close={() => setItem(undefined)}
          />
        )}
      </Sheet>
    </div>
  );
}
function ItemEditor({
  listId,
  item,
  close,
}: {
  listId: string;
  item: ListItem | null;
  close: () => void;
}) {
  const m = useNotesMutation(),
    [label, setLabel] = useState(item?.label ?? ""),
    [details, setDetails] = useState(item?.details ?? ""),
    [quantity, setQuantity] = useState(item?.quantity ?? 1);
  return (
    <form
      className="time-form"
      onSubmit={async (e) => {
        e.preventDefault();
        if (
          await m.run({
            kind: "save-item",
            listId,
            id: item?.id,
            label,
            details,
            quantity,
          })
        )
          close();
      }}
    >
      <Input
        label="Élément"
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        required
        maxLength={300}
      />
      <Textarea
        label="Détails"
        value={details}
        onChange={(e) => setDetails(e.target.value)}
      />
      <Input
        label="Quantité"
        type="number"
        min="0.01"
        step="any"
        value={quantity}
        onChange={(e) => setQuantity(Number(e.target.value))}
      />
      <Button type="submit" disabled={m.busy}>
        Enregistrer l’élément
      </Button>
      {m.error && <p role="alert">{m.error}</p>}
    </form>
  );
}
