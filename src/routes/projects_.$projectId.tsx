import { createFileRoute } from "@tanstack/react-router";
import {
  getOrganization,
  getProjectDetail,
} from "../features/organization/api";
import {
  ProjectDetailView,
  OrganizationError,
} from "../features/organization/views";
export const Route = createFileRoute("/projects_/$projectId")({
  head: () => ({ meta: [{ title: "Project · Life OS" }] }),
  loader: async ({ params }) => {
    const [data, detail] = await Promise.all([
      getOrganization(),
      getProjectDetail({ data: params.projectId }),
    ]);
    return { data, detail };
  },
  errorComponent: OrganizationError,
  component: () => <ProjectDetailView {...Route.useLoaderData()} />,
});
