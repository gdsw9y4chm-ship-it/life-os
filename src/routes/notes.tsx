import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "../components/layout/page-shell";
import { destinations } from "../components/layout/navigation";
export const Route = createFileRoute("/notes")({
  head: () => ({ meta: [{ title: "Notes · Life OS" }] }),
  component: () => <PageShell destination={destinations[4]} />,
});
