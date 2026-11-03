import { createFileRoute } from "@tanstack/react-router";
import { getOrganization } from "../features/organization/api";
import {
  ProjectsView,
  OrganizationError,
} from "../features/organization/views";
export const Route = createFileRoute("/projects")({
  head: () => ({ meta: [{ title: "Projects · Life OS" }] }),
  loader: () => getOrganization(),
  errorComponent: OrganizationError,
  component: () => <ProjectsView data={Route.useLoaderData()} />,
});
