import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "../components/layout/page-shell";
import { destinations } from "../components/layout/navigation";
export const Route = createFileRoute("/life")({
  head: () => ({ meta: [{ title: "Life · Life OS" }] }),
  component: () => <PageShell destination={destinations[6]} />,
});
