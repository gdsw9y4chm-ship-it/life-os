import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "../components/layout/page-shell";
import { destinations } from "../components/layout/navigation";
export const Route = createFileRoute("/tasks")({
  head: () => ({ meta: [{ title: "Tasks · Life OS" }] }),
  component: () => <PageShell destination={destinations[3]} />,
});
