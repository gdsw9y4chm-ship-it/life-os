import { createFileRoute } from "@tanstack/react-router";
import { TrackersView } from "../features/practices/trackers";
import { getPractices } from "../features/practices/api";
import { OrganizationError } from "../features/organization/views";
export const Route = createFileRoute("/life_/trackers")({
  validateSearch: (
    s: Record<string, unknown>,
  ): { day?: string; archived: boolean } => ({
    day: typeof s.day === "string" ? s.day : undefined,
    archived: s.archived === true || s.archived === "true",
  }),
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) => getPractices({ data: deps }),
  errorComponent: OrganizationError,
  head: () => ({ meta: [{ title: "Trackers · Life OS" }] }),
  component: () => (
    <TrackersView
      data={Route.useLoaderData()}
      archived={Route.useSearch().archived}
    />
  ),
});
