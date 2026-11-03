import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { getTasks } from "./api";
import type { TaskSummary } from "../../types/task";
export function TaskSearchResults({
  query,
  onNavigate,
}: {
  query: string;
  onNavigate: () => void;
}) {
  const [state, setState] = useState<{
    query: string;
    results: TaskSummary[];
    error: boolean;
  } | null>(null);
  useEffect(() => {
    if (!query.trim()) return;
    let current = true;
    const timer = setTimeout(() => {
      getTasks({ data: { search: query } })
        .then((data) => {
          if (current) setState({ query, results: data.tasks, error: false });
        })
        .catch(() => {
          if (current) setState({ query, results: [], error: true });
        });
    }, 200);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [query]);
  if (!query.trim())
    return (
      <p className="field-hint">
        Saisissez un titre ou un extrait de description pour retrouver une
        tâche.
      </p>
    );
  if (state?.query !== query) return <p role="status">Recherche des tâches…</p>;
  if (state.error) return <p role="alert">Recherche indisponible.</p>;
  return (
    <nav aria-label="Tâches trouvées" className="search-results">
      <h3>Tasks</h3>
      {state.results.map((task) => (
        <Link
          key={task.id}
          to="/tasks/$taskId"
          params={{ taskId: task.id }}
          onClick={onNavigate}
        >
          {task.title}
        </Link>
      ))}
      {!state.results.length && <p role="status">Aucune tâche trouvée.</p>}
    </nav>
  );
}
