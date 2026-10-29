import { createRootRoute, HeadContent, Outlet, Scripts } from '@tanstack/react-router';
import styles from '../design-system/styles.css?url';

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'Life OS · Foundation' },
      { name: 'description', content: 'Les fondations de votre espace personnel Life OS.' },
    ],
    links: [{ rel: 'stylesheet', href: styles }, { rel: 'icon', href: 'data:,' }],
  }),
  component: Root,
  notFoundComponent: () => <main><h1>Page introuvable</h1><a href="/">Retour à Life OS</a></main>,
});

function Root() {
  return <html lang="fr" data-theme="jade"><head><HeadContent /></head><body><Outlet /><Scripts /></body></html>;
}
