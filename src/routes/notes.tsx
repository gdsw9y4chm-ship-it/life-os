import { createFileRoute } from "@tanstack/react-router";
import { NotesView } from "../features/notes/view";
import { getNotes } from "../features/notes/api";
import { OrganizationError } from "../features/organization/views";
export const Route = createFileRoute("/notes")({
  validateSearch: (
    s: Record<string, unknown>,
  ): { view: "notes" | "lists"; id?: string; archived: boolean } => ({
    view: s.view === "lists" ? ("lists" as const) : ("notes" as const),
    id: typeof s.id === "string" ? s.id : undefined,
    archived: s.archived === true || s.archived === "true",
  }),
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) => getNotes({ data: deps }),
  errorComponent: OrganizationError,
  component: () => {
    const data = Route.useLoaderData(),
      search = Route.useSearch();
    return (
      <NotesView data={data} view={search.view} archived={search.archived} />
    );
  },
});
