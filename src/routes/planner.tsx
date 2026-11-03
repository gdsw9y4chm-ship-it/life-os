import { createFileRoute } from "@tanstack/react-router";
import { getPlanner } from "../features/planner/api";
import {
  PlannerView,
  plannerRange,
  type PlannerViewName,
} from "../features/planner/view";
import { getCurrentUser } from "../features/users/current-user";
import { calendarDay, taskDate } from "../features/planner/calendar";
import { OrganizationError } from "../features/organization/views";
export const Route = createFileRoute("/planner")({
  validateSearch: (search: Record<string, unknown>) => ({
    day: typeof search.day === "string" ? (taskDate(search.day) ?? "") : "",
    view: (["day", "week", "month", "agenda"].includes(String(search.view))
      ? search.view
      : "week") as PlannerViewName,
  }),
  loaderDeps: ({ search }) => search,
  loader: async ({ deps }) => {
    const user = await getCurrentUser();
    if (!user) throw new Error("Profil indisponible.");
    const day = deps.day || calendarDay(new Date(), user.timezone),
      weekStart = [
        "Sunday",
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
      ].indexOf(user.week_start);
    return {
      day,
      data: await getPlanner({ data: plannerRange(day, deps.view, weekStart) }),
    };
  },
  head: () => ({ meta: [{ title: "Planner · Life OS" }] }),
  errorComponent: OrganizationError,
  component: () => {
    const { day, data } = Route.useLoaderData(),
      search = Route.useSearch(),
      navigate = Route.useNavigate();
    return (
      <PlannerView
        data={data}
        day={day}
        view={search.view}
        onNavigate={(next, view) =>
          void navigate({ search: { day: next, view } })
        }
      />
    );
  },
});
