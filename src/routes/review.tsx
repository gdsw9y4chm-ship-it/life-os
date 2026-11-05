import { createFileRoute } from "@tanstack/react-router";
import { ReviewView } from "../features/review/view";
import { getReview } from "../features/review/api";
import { OrganizationError } from "../features/organization/views";
export const Route = createFileRoute("/review")({
  validateSearch: (
    s: Record<string, unknown>,
  ): { mode: "week" | "month"; day?: string; runId?: string } => ({
    mode: s.mode === "month" ? "month" : "week",
    day: typeof s.day === "string" ? s.day : undefined,
    runId: typeof s.runId === "string" ? s.runId : undefined,
  }),
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) => getReview({ data: deps }),
  errorComponent: OrganizationError,
  head: () => ({ meta: [{ title: "Review · Life OS" }] }),
  component: () => <ReviewView data={Route.useLoaderData()} />,
});
