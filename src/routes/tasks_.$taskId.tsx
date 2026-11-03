import { createFileRoute } from "@tanstack/react-router";
import { getTask } from "../features/tasks/api";
import { TaskDetailView } from "../features/tasks/detail";
import { OrganizationError } from "../features/organization/views";
export const Route = createFileRoute("/tasks_/$taskId")({
  loader: ({ params }) => getTask({ data: params.taskId }),
  head: () => ({ meta: [{ title: "Task · Life OS" }] }),
  errorComponent: OrganizationError,
  component: () => <TaskDetailView data={Route.useLoaderData()} />,
});
