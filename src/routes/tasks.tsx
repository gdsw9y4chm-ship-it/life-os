import { createFileRoute } from "@tanstack/react-router";
import { getTasks } from "../features/tasks/api";
import { TasksView } from "../features/tasks/view";
import type { TaskSearch } from "../features/tasks/view";
import {
  taskViews,
  taskPriorities,
  taskEfforts,
  type TaskPriority,
  type TaskEffort,
  type TaskView,
} from "../types/task";
import { OrganizationError } from "../features/organization/views";
export const Route = createFileRoute("/tasks")({
  validateSearch: (search: Record<string, unknown>): TaskSearch => ({
    view: taskViews.includes(search.view as TaskView)
      ? (search.view as TaskView)
      : "inbox",
    context: typeof search.context === "string" ? search.context : "",
    q: typeof search.q === "string" ? search.q : "",
    project: typeof search.project === "string" ? search.project : "",
    area: typeof search.area === "string" ? search.area : "",
    priority: taskPriorities.includes(search.priority as TaskPriority)
      ? (search.priority as TaskPriority)
      : "",
    effort: taskEfforts.includes(search.effort as TaskEffort)
      ? (search.effort as TaskEffort)
      : "",
  }),
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) =>
    getTasks({
      data: {
        view: deps.view,
        context: deps.context,
        search: deps.q,
        projectId: deps.project,
        areaId: deps.area,
      },
    }),
  head: () => ({ meta: [{ title: "Tasks · Life OS" }] }),
  errorComponent: OrganizationError,
  component: TasksPage,
});
function TasksPage() {
  const navigate = Route.useNavigate();
  const search = Route.useSearch();
  return (
    <TasksView
      data={Route.useLoaderData()}
      search={search}
      onFilter={(next) =>
        void navigate({
          search: { ...search, ...next },
          replace: true,
          resetScroll: false,
        })
      }
    />
  );
}
