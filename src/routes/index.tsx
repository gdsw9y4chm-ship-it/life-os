import { createFileRoute } from '@tanstack/react-router';
import { getCurrentUser } from '../features/users/current-user';

export const Route = createFileRoute('/')({
  loader: () => getCurrentUser(),
  component: Foundation,
  pendingComponent: () => <main aria-busy="true"><h1>Life OS</h1><p>Chargement du profil…</p></main>,
  errorComponent: ({ reset }) => <main><h1>Life OS</h1><p role="alert">Le profil est indisponible pour le moment.</p><button type="button" onClick={reset}>Réessayer</button></main>,
});

function Foundation() {
  const user = Route.useLoaderData();
  return (
    <main>
      <p className="eyebrow">Phase 1 · Foundation</p>
      <h1>Life OS</h1>
      {user ? <>
        <p className="status">Foundation ready</p>
        <section aria-labelledby="profile-title">
          <h2 id="profile-title">{user.name}</h2>
          <dl>
            <div><dt>Fuseau horaire</dt><dd>{user.timezone}</dd></div>
            <div><dt>Thème</dt><dd>{user.theme}</dd></div>
            <div><dt>Langue</dt><dd>{user.locale}</dd></div>
            <div><dt>Début de semaine</dt><dd>{user.week_start}</dd></div>
          </dl>
        </section>
      </> : <p>Aucun profil initialisé.</p>}
    </main>
  );
}
