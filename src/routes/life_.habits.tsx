import { createFileRoute } from "@tanstack/react-router";
import { HabitsView } from "../features/practices/habits";
import { getPractices } from "../features/practices/api";
import { OrganizationError } from "../features/organization/views";
export const Route = createFileRoute("/life_/habits")({
  validateSearch: (
    s: Record<string, unknown>,
  ): { day?: string; archived: boolean } => ({
    day: typeof s.day === "string" ? s.day : undefined,
    archived: s.archived === true || s.archived === "true",
  }),
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) => getPractices({ data: deps }),
  errorComponent: OrganizationError,
  head: () => ({ meta: [{ title: "Habits · Life OS" }] }),
  component: () => (
    <HabitsView
      data={Route.useLoaderData()}
      archived={Route.useSearch().archived}
    />
  ),
});
