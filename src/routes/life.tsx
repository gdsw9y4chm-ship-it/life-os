import { createFileRoute } from "@tanstack/react-router";
import { getOrganization } from "../features/organization/api";
import { LifeView, OrganizationError } from "../features/organization/views";
export const Route = createFileRoute("/life")({
  head: () => ({ meta: [{ title: "Life · Life OS" }] }),
  loader: () => getOrganization(),
  errorComponent: OrganizationError,
  component: () => <LifeView data={Route.useLoaderData()} />,
});
