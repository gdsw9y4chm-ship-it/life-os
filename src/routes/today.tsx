import { getTodayPractices } from "../features/practices/api";
import { createFileRoute } from "@tanstack/react-router";
import { getToday } from "../features/today/api";
import { TodayView } from "../features/today/view";
import { Button } from "../design-system/components/primitives";
export const Route = createFileRoute("/today")({
  loader: async () => {
    const [today, practices] = await Promise.all([
      getToday(),
      getTodayPractices(),
    ]);
    return { ...today, practices };
  },
  head: () => ({ meta: [{ title: "Today · Life OS" }] }),
  pendingComponent: () => (
    <div className="page-layout" role="status">
      Chargement de votre journée…
    </div>
  ),
  errorComponent: ({ reset }) => (
    <div className="page-layout">
      <h1>Today</h1>
      <p role="alert">Votre journée n’a pas pu être chargée.</p>
      <Button onClick={reset}>Réessayer</Button>
    </div>
  ),
  component: () => <TodayView data={Route.useLoaderData()} />,
});
