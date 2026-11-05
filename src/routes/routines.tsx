import { createFileRoute } from "@tanstack/react-router";
import { RoutinesView } from "../features/practices/routines";
import { getPractices } from "../features/practices/api";
import { OrganizationError } from "../features/organization/views";
export const Route = createFileRoute("/routines")({
  validateSearch: (
    s: Record<string, unknown>,
  ): { routineId?: string; runId?: string; archived: boolean } => ({
    routineId: typeof s.routineId === "string" ? s.routineId : undefined,
    runId: typeof s.runId === "string" ? s.runId : undefined,
    archived: s.archived === true || s.archived === "true",
  }),
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) => getPractices({ data: deps }),
  errorComponent: OrganizationError,
  head: () => ({ meta: [{ title: "Routines · Life OS" }] }),
  component: () => (
    <RoutinesView
      data={Route.useLoaderData()}
      archived={Route.useSearch().archived}
    />
  ),
});
