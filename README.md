# Life OS · Phase 1 — Foundation

Fondations locales de l’espace personnel Life OS. Cette phase affiche uniquement le profil réellement lu dans SQLite. La documentation produit reste dans [le cahier des charges Notion](https://app.notion.com/p/408ca21a7c3c81ca8b69da346a00fc9e).

## Stack

React 19.3.1, TanStack Start 1.169.4, TanStack Router 1.170.46, TypeScript 6.0.3, Bun 1.4.4, SQLite intégré à Bun, Vite 8.3.5. Versions exactes dans `package.json`, résolution reproductible dans `bun.lock`.

## Installation et lancement

Prérequis : Bun 1.4.4 ([installation officielle](https://bun.sh/docs/installation)). Sur le Mac utilisé pour cette phase, Bun est installé dans `~/.bun/bin/bun`. Si nécessaire, ajouter son dossier au PATH pour le terminal courant :

```sh
export PATH="$HOME/.bun/bin:$PATH"
```

Depuis le dossier `life-os` :

```sh
bun install --frozen-lockfile
bun run db:migrate
bun run db:seed
bun run dev
```

Ouvrir `http://127.0.0.1:3000`. Les serveurs écoutent uniquement sur la boucle locale. Node n’est pas nécessaire aux scripts du projet : les outils JavaScript sont exécutés avec Bun.

Pour exécuter le build local :

```sh
bun run build
bun run start
```

`PORT=3001 bun run start` permet de choisir un autre port. Le lanceur sert les assets de `dist/client` et le handler SSR de TanStack Start depuis `dist/server`. Lancer les commandes depuis la racine du dépôt.

## Commandes de validation

```sh
bun run test
bun run typecheck
bun run lint
bun run build
```

Le typecheck génère l’arbre des routes avant de vérifier les types ; il fonctionne aussi sur un checkout neuf. L’arbre généré et les sorties de build sont ignorés par Git. Les règles ESLint interdisent les imports directs de SQLite, des repositories et des services dans les routes et composants.

## Base de données

- Emplacement par défaut : `data/life-os.sqlite`, relatif à la racine du dépôt.
- Configuration facultative : copier `.env.example` vers `.env` et adapter `LIFE_OS_DB_PATH`.
- Connexion centralisée dans `src/db/connection.ts` : clés étrangères activées, délai d’attente de 5 secondes, WAL pour les bases sur disque.
- Migration SQL versionnée dans `src/db/migrations/001_users.sql`.
- Tables : `users` et table technique `schema_migrations`.
- Toutes les migrations en attente sont appliquées dans une transaction immédiate. Un échec annule la transaction ; un checksum détecte les migrations déjà appliquées qui ont été modifiées. Ajouter une nouvelle migration au registre de `src/db/migrate.ts`, sans modifier celles déjà appliquées.
- `db:seed` exige les migrations préalables. Il crée Jade une seule fois par identifiant UUID stable et ne réinitialise pas les préférences existantes.
- Avatar initial : `NULL`. Thème `jade`, fuseau `Europe/Paris`, semaine `Monday`, langue `fr-FR`. Dates UTC ISO 8601.
- Les lectures web ne lancent ni migration ni seed.
- Les bases, fichiers WAL/SHM, secrets et caches sont exclus de Git.

## Tests

13 tests Bun couvrent connexion, migrations, réexécution, détection d’historique modifié, rollback, état vide, seed, idempotence, contraintes, récupération du profil, isolation et persistance après réouverture.

Le factory de tests crée des bases en mémoire. Les tests de persistance utilisent des dossiers temporaires uniques, supprimés après fermeture des connexions. La résolution implicite de la base de développement est refusée lorsque `NODE_ENV=test`. Un test vérifie qu’une base sentinelle configurée par variable d’environnement reste identique octet par octet.

## Architecture

```text
src/routes/                         UI temporaire et document racine
  ↓
src/features/users/                 fonction serveur TanStack Start
  ↓
src/services/                       UserService et assemblage serveur
  ↓
src/db/repositories/                implémentation SQLite de UserRepository
  ↓
src/db/                             connexion, migrations et SQLite

src/types/                          contrat User / UserRepository
src/design-system/tokens/            tokens de fondation
src/design-system/themes/            thème Jade minimal
src/design-system/assets/            emplacement réservé aux futurs assets
src/tests/                          tests Bun
scripts/                            commandes DB, routes et serveur local
```

Les dossiers `components`, `integrations` et `lib` seront créés lorsqu’ils auront une responsabilité réelle. Aucun module métier des phases suivantes n’est initialisé.

## Décisions techniques

- `bun:sqlite` évite une dépendance ORM ou un driver natif supplémentaire. Le contrat `UserRepository` sépare le service du stockage ; un futur backend pourra fournir une autre implémentation.
- Migrations SQL explicites et transactionnelles : surface petite, schéma lisible, contrôle d’intégrité versionné.
- Une connexion courte est ouverte et fermée par lecture du profil ; pas de connexion globale conservée lors du rechargement Vite.
- Thème en variables CSS : couleurs blush/rose/charcoal, surfaces, texte, bordures, typographie, espacements, rayons, ombres, blur et motion. Polices système, sans téléchargement externe. Aucun décor Angel avancé.
- TypeScript 6.0.3 est fixé car la version installée de typescript-eslint ne prend pas en charge TypeScript 7.0.
- Initialisation minimale suivant les [conventions officielles de TanStack Start](https://tanstack.com/start/latest/docs/framework/react/build-from-scratch), sans dépendance cloud ni authentification.

## Audit initial

Le dossier parent était un miroir du projet ChatGPT « Objectif », sans Git ni application. Ses fichiers de référence et `notion-reorganisation/` ont été conservés. Aucun Life OS n’a été trouvé dans ce dossier ou dans `~/Projects`. Un dépôt indépendant a été créé dans `life-os/` sur `codex/phase-1-foundation`, sans remote.

Bun et Node étaient absents du PATH. Bun 1.4.4 a été installé depuis la distribution officielle ; le runtime Node 24.19.0 fourni par l’environnement a servi à la vérification navigateur. La page Notion de référence a été consultée en lecture seule. Son titre réel est « LIFE OS · Cahier des charges complet — V1 ».
