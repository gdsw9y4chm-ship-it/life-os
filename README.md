# Life OS · The Jade Edition

Application personnelle locale. La Phase 2 apporte le Design System Jade et un shell responsive ; les pages métier restent explicitement à venir. Le profil est réellement lu dans SQLite. La documentation produit reste dans [le cahier des charges Notion](https://app.notion.com/p/408ca21a7c3c81ca8b69da346a00fc9e).

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
src/routes/                         pages shells et document racine
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
src/design-system/themes/            thème Jade sémantique
src/design-system/assets/            ailes en plumes WebP et polices locales sous OFL
src/tests/                          tests Bun
scripts/                            commandes DB, routes et serveur local
```

`src/components/layout/` contient AppShell, PageLayout, navigation et Quick Add. `src/design-system/components/` contient les primitives génériques. Les dossiers `integrations` et `lib` seront créés lorsqu’ils auront une responsabilité réelle. Aucun module métier des phases suivantes n’est initialisé.

## Décisions techniques

- `bun:sqlite` évite une dépendance ORM ou un driver natif supplémentaire. Le contrat `UserRepository` sépare le service du stockage ; un futur backend pourra fournir une autre implémentation.
- Migrations SQL explicites et transactionnelles : surface petite, schéma lisible, contrôle d’intégrité versionné.
- Une connexion courte est ouverte et fermée par lecture du profil ; pas de connexion globale conservée lors du rechargement Vite.
- Thème en variables CSS : couleurs blush/rose/charcoal, surfaces, texte, bordures, typographie, espacements, rayons, ombres, blur et motion. Polices libres servies localement, ailes en plumes, cristal rose facetté, diamant iconographique, dentelle ton sur ton, satin et tulle CSS. Aucun appel à un service de polices à l’exécution.
- TypeScript 6.0.3 est fixé car la version installée de typescript-eslint ne prend pas en charge TypeScript 7.0.
- Initialisation minimale suivant les [conventions officielles de TanStack Start](https://tanstack.com/start/latest/docs/framework/react/build-from-scratch), sans dépendance cloud ni authentification.

## Audit initial

Le dossier parent était un miroir du projet ChatGPT « Objectif », sans Git ni application. Ses fichiers de référence et `notion-reorganisation/` ont été conservés. Aucun Life OS n’a été trouvé dans ce dossier ou dans `~/Projects`. Un dépôt indépendant a été créé dans `life-os/` sur `codex/phase-1-foundation`, sans remote.

Bun et Node étaient absents du PATH. Bun 1.4.4 a été installé depuis la distribution officielle ; le runtime Node 24.19.0 fourni par l’environnement a servi à la vérification navigateur. La page Notion de référence a été consultée en lecture seule. Son titre réel est « LIFE OS · Cahier des charges complet — V1 ».


## Phase 2 · Design System + App Shell

Branche : `codex/phase-2-design-system-app-shell`, depuis le commit Phase 1 `6be96ac7aca39cf5e9db16f2d0d16bec23b578be`. Le schéma, les migrations et les services de données de la Phase 1 restent inchangés.

### Navigation et périmètre

`/` redirige vers `/today`. Les routes `/today`, `/planner`, `/projects`, `/tasks`, `/notes`, `/routines`, `/life` et `/review` utilisent PageLayout et affichent un état « à venir », sans données métier fictives. `/design-system` présente les composants et leurs états ; les interactions de démonstration ne sont pas persistées.

Sidebar desktop, navigation mobile Today / Planner / + / Projects / Life jusqu’à 900 px, menu donnant accès à toutes les pages, profil SQLite en lecture seule, emplacement du futur timer. Search filtre uniquement les destinations de navigation, pas des données métier. Quick Add ouvre une surface accessible avec dix actions explicitement désactivées.

### Tokens et composants

`tokens/base.css` définit typographie, espacements, rayons, motion et dimensions. `themes/theme-jade.css` définit couleurs sémantiques, surfaces, textes, bordures, ombres, blur, textures et opacité des ornements. Les composants n’embarquent pas de palette métier ; un futur thème peut fournir les mêmes variables.

Button, IconButton, Input, Textarea, Select natif, Checkbox, Toggle, Badge, Card, Section, Divider, Dialog, Sheet, Tooltip, Dropdown, Tabs, Progress, EmptyState, Avatar et NavigationItem sont réutilisables. Les contrôles natifs conservent leur sémantique et leurs labels ; les overlays et onglets reposent sur Radix pour le focus, Échap et les interactions clavier. Les éléments décoratifs sont ignorés par les lecteurs d’écran. Le mouvement réduit est respecté.

### Choix visuels et licences

- Titres calligraphiques : **Great Vibes** (alternative libre à la référence Angel, dont le fichier exact n’est pas fourni).
- Interface : **Manrope**, graisse variable ; titres éditoriaux ponctuels : Georgia, police système.
- Great Vibes et Manrope : licences SIL Open Font License 1.1 conservées dans `src/design-system/assets/fonts/`. Sources officielles : [Great Vibes](https://github.com/google/fonts/tree/main/ofl/greatvibes), [Manrope](https://github.com/google/fonts/tree/main/ofl/manrope). Fichiers web latins optimisés issus de Google Fonts, hébergés dans le dépôt : environ 54 Ko au total, accents français inclus ; repli système pour d’autres écritures.
- Palette : blush `#fbf5f4`, lingerie `#e8a7bc`, dusty rose `#a9697d`, crème `#fffcf8`, noir `#19171b`, charcoal `#302b31`, argent `#c5c2c9`. Accents et textes secondaires utilisent des variantes plus sombres pour le contraste.
- Ailes à plumes : asset photographique généré avec l’outil imagegen intégré, fond transparent, WebP 1000×500 de 138 Ko, via AngelWings. L’ancien SVG est conservé comme source historique non utilisée. Crystal apporte un cristal rose très pâle facetté ; Diamond conserve la variante iconographique.
- Matières : un seul bandeau satin/tulle et une dentelle florale ton sur ton très discrète en haut de sidebar ; aucune texture ajoutée aux cards, aucun glitter animé. Branding Angel en grande calligraphie, LIFE OS en dessous. Les petites citations en script ont été retirées. Accent fonctionnel rose lingerie #a53e65, états sélectionnés #f1cada ; fond blush inchangé.
- Icônes : Lucide, licence ISC distribuée avec la dépendance.

### Tests navigateur

```sh
bun x playwright install chromium
bun run test:e2e
```

Si Google Chrome est déjà installé :

```sh
PLAYWRIGHT_CHANNEL=chrome bun run test:e2e
```

Playwright démarre son propre serveur sur `127.0.0.1:3100` et utilise une base temporaire créée et seedée par `scripts/e2e-server.ts`, supprimée à l’arrêt. Il ne réutilise jamais la base de développement ni le serveur d’aperçu. Les captures et traces d’échec restent dans `artifacts/`, ignoré par Git.

Les 11 tests navigateur s’ajoutent aux 13 tests SQLite (24 tests au total). Ils couvrent les huit routes et leurs rechargements, les états actifs, le vrai profil seedé, la recherche de pages, Quick Add, les zones tactiles, les champs, onglets, menus, infobulles, le focus et les dialogues. Formats vérifiés : 1920×1080, 1280×800, 1024×768, 768×1024, 390×844 et 320×568.


### Passe visuelle du 3 novembre 2026

Architecture, navigation, fonctions et tests existants inchangés. Même branche Phase 2 ; commit amendé avant toute publication. Captures locales : `artifacts/angel-final-desktop.png`, `artifacts/angel-final-mobile.png` et variantes Quick Add.

Asset final : `src/design-system/assets/angel-feather-wings.webp`. Génération par l’outil imagegen intégré, puis redimensionnement/encodage WebP avec conservation de l’alpha. Prompt de génération :

> Use case: product-mockup. Asset type: transparent decorative cutout for a restrained premium lingerie-inspired personal app. A pair of real white feather angel wings, airy, soft, delicately layered individual natural feathers with fine down, photographic couture prop quality. Both wings sweep outward and slightly upward, a wide gently curved silhouette, symmetrical overall with natural subtle asymmetry. Wings occupy the image with small margins, no body, no person, no lettering, no logo, no geometric line art, no halo, no glitter. Soft studio light, warm ivory white highlights, very subtle silver-gray depth between feathers, exquisite realistic feather texture. True transparent background with clean delicate feather edges; no background shadow rectangle. Landscape composition approximately 2:1, feather wings only. Restrained ethereal elegance, light enough to sit on blush satin in a UI header.
