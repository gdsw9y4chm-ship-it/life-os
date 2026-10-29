import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "../components/layout/page-shell";
import { destinations } from "../components/layout/navigation";
export const Route = createFileRoute("/today")({
  head: () => ({ meta: [{ title: "Today · Life OS" }] }),
  component: () => <PageShell destination={destinations[0]} />,
});
