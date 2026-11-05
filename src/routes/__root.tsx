import { TimeProvider } from "../features/time/provider";
import {
  createRootRoute,
  HeadContent,
  Outlet,
  Scripts,
} from "@tanstack/react-router";
import { AppShell } from "../components/layout/app-shell";
import { getCurrentUser } from "../features/users/current-user";
import styles from "../design-system/styles.css?url";
export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1, viewport-fit=cover",
      },
      { title: "Life OS · The Jade Edition" },
      {
        name: "description",
        content: "Votre espace personnel, à votre image.",
      },
    ],
    links: [
      { rel: "stylesheet", href: styles },
      { rel: "icon", href: "data:," },
    ],
  }),
  loader: async () => {
    try {
      return { user: await getCurrentUser(), profileUnavailable: false };
    } catch {
      return { user: null, profileUnavailable: true };
    }
  },
  component: Root,
  notFoundComponent: () => (
    <div className="page-layout">
      <h1>Page introuvable</h1>
      <a href="/today">Retour à Today</a>
    </div>
  ),
});
function Root() {
  const { user, profileUnavailable } = Route.useLoaderData();
  return (
    <html lang="fr" data-theme="jade">
      <head>
        <HeadContent />
      </head>
      <body>
        <TimeProvider>
          <AppShell user={user} profileUnavailable={profileUnavailable}>
            <Outlet />
          </AppShell>
        </TimeProvider>
        <Scripts />
      </body>
    </html>
  );
}
