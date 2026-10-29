import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "../components/layout/page-shell";
import { destinations } from "../components/layout/navigation";
export const Route = createFileRoute("/projects")({
  head: () => ({ meta: [{ title: "Projects · Life OS" }] }),
  component: () => <PageShell destination={destinations[2]} />,
});
