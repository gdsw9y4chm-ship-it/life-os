import { useState, useEffect } from "react";
import { Link } from "@tanstack/react-router";
import { searchNotes, taskNoteSources } from "./api";
export function NotesSearchResults({
  query,
  onNavigate,
}: {
  query: string;
  onNavigate: () => void;
}) {
  const [state, setState] = useState<{
    query: string;
    items: Awaited<ReturnType<typeof searchNotes>>;
    error?: boolean;
  } | null>(null);
  useEffect(() => {
    if (!query.trim()) return;
    let live = true;
    const timer = setTimeout(() => {
      void searchNotes({ data: query })
        .then((items) => {
          if (live) setState({ query, items });
        })
        .catch(() => {
          if (live) setState({ query, items: [], error: true });
        });
    }, 200);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [query]);
  if (!query.trim()) return null;
  return (
    <nav aria-label="Notes et listes trouvées" className="search-results">
      <h3>Notes & Lists</h3>
      {state?.query === query ? (
        state.error ? (
          <p role="alert">Recherche indisponible.</p>
        ) : state.items.length ? (
          state.items.map((i) => (
            <Link
              key={i.kind + i.id}
              to="/notes"
              search={{
                view: i.kind === "note" ? "notes" : "lists",
                id: i.id,
                archived: false,
              }}
              onClick={onNavigate}
            >
              {i.title}
            </Link>
          ))
        ) : (
          <p>Aucun résultat.</p>
        )
      ) : (
        <p>Recherche…</p>
      )}
    </nav>
  );
}
export function TaskSources({ id }: { id: string }) {
  const [items, setItems] = useState<
    Awaited<ReturnType<typeof taskNoteSources>>
  >([]);
  useEffect(() => {
    let live = true;
    void taskNoteSources({ data: id })
      .then((data) => {
        if (live) setItems(data);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [id]);
  return items.length ? (
    <section className="note-relations">
      <h3>Sources</h3>
      {items.map((i) => (
        <Link
          key={i.kind + i.id}
          to="/notes"
          search={{
            view: i.kind === "note" ? "notes" : "lists",
            id: i.id,
            archived: false,
          }}
        >
          {i.title}
        </Link>
      ))}
    </section>
  ) : null;
}
