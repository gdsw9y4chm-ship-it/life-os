# Life OS · The Jade Edition

Application personnelle locale. Tasks & Inbox permettent de capturer, clarifier, prioriser et suivre des actions persistées dans SQLite, reliées aux Life Areas, Goals, Projects et Milestones. Today assemble désormais les vraies données du jour ; le Planner organise Events, Time Blocks et placements de Tasks. La documentation produit reste dans [le cahier des charges Notion](https://app.notion.com/p/408ca21a7c3c81ca8b69da346a00fc9e).

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
- Migrations SQL versionnées : `001_users.sql`, `002_core_organization.sql` et `003_tasks_inbox.sql`. La migration Phase 1 est inchangée.
- Tables : `users`, `life_areas`, `goals`, `projects`, `milestones`, `tasks`, `task_checklist_items`, `task_reminders` et table technique `schema_migrations`.
- Toutes les migrations en attente sont appliquées dans une transaction immédiate. Un échec annule la transaction ; un checksum détecte les migrations déjà appliquées qui ont été modifiées. Ajouter une nouvelle migration au registre de `src/db/migrate.ts`, sans modifier celles déjà appliquées.
- `db:seed` exige les migrations préalables. Il crée Jade et ses 11 Life Areas par identifiants stables ; les préférences, renommages, archives et positions existantes ne sont pas réinitialisés. Aucun Goal, Project ou Milestone de démonstration.
- Avatar initial : `NULL`. Thème `jade`, fuseau `Europe/Paris`, semaine `Monday`, langue `fr-FR`. Dates UTC ISO 8601.
- Les lectures web ne lancent ni migration ni seed.
- Les bases, fichiers WAL/SHM, secrets et caches sont exclus de Git.

## Tests

70 tests Bun couvrent la fondation, Core Data et Tasks : migrations, seed, validations, relations, isolation, transitions, dates, archivage, rappels, checklist, ordre, progression et persistance après réouverture. 27 tests Playwright couvrent le shell et les workflows métier desktop/mobile (97 tests au total).

Le factory de tests crée des bases en mémoire. Les tests de persistance utilisent des dossiers temporaires uniques, supprimés après fermeture des connexions. La résolution implicite de la base de développement est refusée lorsque `NODE_ENV=test`. Un test vérifie qu’une base sentinelle configurée par variable d’environnement reste identique octet par octet.

## Architecture

```text
src/routes/                         pages métier, shells futurs et document racine
  ↓
src/features/users|organization|tasks/    fonctions serveur TanStack Start et vues métier
  ↓
src/services/                       services métier, règles de validation et assemblage serveur
  ↓
src/db/repositories/                repositories SQLite indépendants de React
  ↓
src/db/                             connexion, migrations et SQLite

src/types/                          entités et contrats des repositories
src/design-system/tokens/            tokens de fondation
src/design-system/themes/            thème Jade sémantique
src/design-system/assets/            ailes en plumes WebP et polices locales sous OFL
src/tests/                          tests Bun
scripts/                            commandes DB, routes et serveur local
```

`src/components/layout/` contient AppShell, PageLayout, navigation et Quick Add. `src/design-system/components/` contient les primitives génériques. Les helpers React sont dans `lib`. Le module Today de Phase 5 assemble ces données dans un dashboard quotidien. Les moteurs des phases suivantes restent hors périmètre.

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

## Phase 3 · Core Data

Branche `codex/phase-3-core-data`, depuis `main` au commit `2c191ca100ec4db164adfa5f6cf39d9e2d109460`. Référence produit : cahier des charges Notion consulté en lecture seule, sections 13–16, 36–41, 53–54 et 86, complétées par le brief Phase 3. Le suivi Notion d’octobre reste antérieur au merge Phase 2 ; Git fait foi pour l’état du code.

### Modèle et règles

- Une migration additive `002_core_organization.sql` crée quatre tables STRICT, indexées par propriétaire et ordre/statut. Les foreign keys sont actives sur chaque connexion. La migration 001 et son checksum ne changent pas.
- `life_areas` : propriétaire, nom, description et icône facultatives, position, archivage, timestamps. L’icône est une métadonnée neutre ; aucun thème/couleur/DA dans ces données. L’UI utilise actuellement une icône commune. Les nouveaux domaines sont ajoutés après les existants.
- `goals` : résultat souhaité, type `numeric | frequency | duration | milestones | manual`, statut `active | paused | completed | archived`, cible/unité/date facultatives. Aucune analyse ni progression de Goal calculée dans cette phase.
- `projects` : statut `active | paused | waiting | someday | completed | archived`, dates, ordre, mode de progression et liens indépendants vers Life Area et Goal. Les relations facultatives peuvent être ajoutées, changées ou retirées.
- `milestones` : projet obligatoire, titre, description/date facultatives, statut `pending | in_progress | completed`, ordre stable `(position, id)`. Réordonnancement transactionnel de la liste complète ; IDs étrangers, manquants ou dupliqués refusés. L’ordre est éditable par boutons accessibles au clavier et au toucher.
- Les propriétaires sont immuables. Les repositories limitent lectures et mutations à `user_id` ; les milestones sont limités via leur projet. La validation des relations est doublée par des triggers SQLite pour empêcher aussi les références croisées lors d’écritures SQL directes.
- `User → entités` et `Project → Milestones` utilisent `ON DELETE RESTRICT`. Les relations facultatives de Project utilisent `ON DELETE SET NULL`. Aucune suppression physique n’est exposée dans les repositories ou l’UI : archivage et restauration par statut conservent les relations, milestones et timestamps d’origine.
- Noms/titres non vides, enums, nombres finis, progression 0–100, positions entières, dates calendrier ISO `YYYY-MM-DD` et début ≤ deadline sont validés hors React. Les timestamps sont en UTC ISO 8601 ; dates cibles sans heure pour éviter les décalages de fuseau.

### Services et persistance

`OrganizationService` dépend de quatre interfaces de repository. Les règles pures sont dans `organization-rules.ts`. Les implémentations SQLite utilisent des requêtes paramétrées et partagent ces validations ; aucun CRUD générique ni accès SQL dans React. Les fonctions serveur TanStack Start résolvent le profil Jade côté serveur : aucun `user_id` client n’est accepté. Ce profil local fixe n’est pas une authentification multi-utilisateur ; celle-ci reste hors périmètre.

Chaque mutation web est transactionnelle. Le seed regroupe le profil et ses 11 Life Areas dans une transaction. Les identifiants stables empêchent les doublons même après renommage/archivage ; aucun contenu personnel existant n’est écrasé.

### Progression réellement implémentée

- `none` : aucun pourcentage ni barre.
- `manual` : valeur explicite finie entre 0 et 100, zéro inclus. Changer vers un autre mode efface l’ancienne valeur manuelle.
- `milestones` : nombre de milestones `completed` / nombre total du projet, arrondi au pourcentage entier. Sans milestone : valeur absente, invitation à créer une étape. Repasser une étape en cours ou à faire recalcule le résultat.
- `task_based` : mode stocké, aucune progression ; texte « Disponible lorsque les tâches seront intégrées. »
- Le statut du projet reste une décision explicite ; atteindre 100 % ne le termine pas automatiquement.

### Interfaces

- `/life` : onglets Life Areas et Goals. Domaines actifs/archivés, création, modification, archivage/restauration par le champ Visibilité. Goals : liste, création, édition du type/cible/date et changement de statut, y compris archivage.
- `/projects` : sections Active, Paused / Waiting, Someday et Completed / Archived. Création, modification, statut et ouverture du détail. États vides sans données fictives.
- `/projects/$projectId` : vraies relations, dates, progression et milestones ; création, modification, statut et réordonnancement. Aucune fausse section Tasks/Notes/Time.
- Réutilisation des composants Phase 2 : PageLayout, Card, Button, champs, Sheet, Tabs, Badge, Progress, EmptyState, ailes et diamant. Formulaires en dialogue desktop / sheet mobile, validation visible, bouton de sauvegarde occupé, conservation du formulaire sur erreur. Les onglets sont désactivés jusqu’à hydratation, comme les boutons existants, afin d’éviter les clics perdus au chargement.
- Quick Add reste l’aperçu Phase 2 ; les créations métier sont disponibles directement depuis Life et Projects. La navigation vers le détail garde Projects actif.

### Vérification du 3 novembre 2026

39 tests SQLite (13 existants adaptés au nouveau schéma + 26 nouveaux) et 18 tests navigateur (11 existants + 7 nouveaux). Les fixtures métier restent exclusivement dans des bases temporaires de test. Les parcours desktop 1440×1000 et mobile 390×844 couvrent création/édition, relations, archivage, progression, milestones, ordre, persistance après refresh et absence d’erreurs JavaScript sur les parcours normaux. Tests de shell à 320, 390, 768, 1024, 1280 et 1920 px ; formulaire testé aussi à 320×568, erreurs serveur et projet absent vérifiés.

Captures générées par les tests dans `artifacts/phase-3-*` (non versionnées) : Life, Projects, formulaire et détail en desktop/mobile, plus Projects vide. Les projets visibles sur ces captures sont des fixtures isolées, jamais insérées dans la base personnelle.

Commandes : `bun run db:migrate`, `bun run db:seed`, `bun test src/tests`, `PLAYWRIGHT_CHANNEL=chrome bun run test:e2e`, `bun run typecheck`, `bun run lint`, `bun run build`, `git diff --check`. Chrome installé est utilisé car le Chromium propre à Playwright n’est pas installé sur ce Mac. Aucune dépendance ajoutée. Aucun développement Phase 4, push ou merge.

## Phase 4 · Tasks & Inbox

Branche `codex/phase-4-tasks-inbox`, depuis `main` au commit `9c54dbb321a5fa4972926f9570eca7c33cd2fb3c`. Le cahier des charges Notion et son espace LIFE OS ont été consultés en lecture seule ; le brief Phase 4 précise le périmètre. Le suivi Notion reste historiquement antérieur aux merges récents, dont Git fait foi.

### Database et modèle

Migration additive `003_tasks_inbox.sql` : `tasks`, `task_checklist_items`, `task_reminders`, tables STRICT et index sur propriétaire/statut/dates/relations. Les migrations 001 et 002 restent inchangées. Aucun seed de tâches ou de rappels : seul Jade et ses 11 Life Areas sont initialisés.

Task contient le titre, la description, les relations facultatives Project/Milestone/Life Area/Parent Task, statut, priorité, effort, Do Date, Deadline, durée estimée entière, contexte extensible, position, Waiting, timestamps de complétion/archivage et de création/modification. Statuts `inbox | todo | doing | waiting | done | someday`, priorités `must | should | could | none`, efforts `low | medium | deep | none`. Un titre seul suffit ; Inbox et aucune priorité/effort sont les valeurs par défaut.

Do Date et Deadline sont deux dates calendaires indépendantes. Une Do Date après la Deadline reste autorisée : elle décrit un choix de travail, sans déplacer la limite réelle. Aucune Scheduled Time et aucun moteur de récurrence. Une future migration pourra ajouter une relation vers une règle de récurrence et ses occurrences ; aucun champ fictif ni répétition simulée aujourd’hui.

### Relations et historique

- Chaque opération est limitée au profil côté serveur, jamais à un user_id envoyé par le navigateur. Repositories SQL paramétrés, règles métier dans TaskService et fonctions pures, transactions pour les écritures composées. Aucun accès SQLite dans React.
- Une tâche liée à un Project **hérite dynamiquement de sa Life Area**. Le champ propre de la tâche reste NULL dans ce cas ; une Life Area contradictoire est refusée. Modifier la Life Area du Project se reflète immédiatement dans ses tâches. Pour choisir un domaine indépendant, retirer le Project.
- Un Milestone doit appartenir au Project choisi ; sans Project fourni, il permet de déduire son Project. Changer de Project dans l’UI retire le Milestone sélectionné. SQLite empêche aussi le déplacement d’un Milestone lié vers un autre Project.
- Les foreign keys et triggers SQLite doublent les contrôles d’appartenance. Propriétaire de Task immuable ; parent du même utilisateur ; aucun cycle et un seul niveau de sous-tâches, y compris si les enfants sont archivés.
- Une sous-tâche reste indépendante (statut, dates, projet). Sa complétion ne termine pas automatiquement son parent et inversement. Aucun archivage en cascade.
- Archivage indépendant du statut, restaurable, sans suppression des relations, checklist ou rappel. Aucune suppression physique de Task exposée. User/Parent/Checklist/Reminder protègent l’historique par RESTRICT. Suppression physique d’un lien facultatif détache par SET NULL ; archiver un Project préserve ses Tasks.

### Dates, Waiting et Reminder

Les Smart Lists utilisent la date locale du profil (Jade : Europe/Paris), calculée côté serveur ; les timestamps sont en UTC. Passer en `done` enregistre `completed_at` une seule fois ; éditer une tâche déjà terminée ne le réécrit pas. Reopen vers To Do ou autre statut actif efface `completed_at`.

Waiting conserve `waiting_for`, `waiting_since` et `follow_up_date`. La première entrée sans date initialise `waiting_since` au jour du profil. Les informations d’attente restent conservées après un changement de statut et sont modifiables ; elles ne rendent pas une tâche active éligible aux relances. Une relance arrivée ne change jamais automatiquement le statut.

Un rappel facultatif par tâche (contrainte UNIQUE) est enregistré, modifiable et effaçable dans le détail. L’éditeur affiche explicitement le fuseau du profil et convertit vers un instant UTC, indépendamment du fuseau du navigateur. Les heures inexistantes au passage à l’heure d’été sont refusées ; pour une heure répétée à l’automne, la conversion choisit la seconde occurrence en Europe/Paris. **Pas de notification système ni de scheduler dans cette phase** ; l’UI le précise.

### Smart Lists réellement implémentées

Toutes les vues ordinaires excluent les archives. Filtres par contexte, projet, domaine effectif, titre et description combinables.

- Inbox : `inbox`.
- Today : `todo | doing` avec Do Date = aujourd’hui.
- Upcoming : `todo | doing` avec Do Date future.
- Waiting : `waiting`.
- À relancer : `waiting` avec Follow-up ≤ aujourd’hui.
- Overdue : Deadline passée, hors `done` et `someday` ; Waiting reste visible avec son indicateur, sans être présenté comme une action immédiate.
- Someday : `someday`.
- Completed : `done`.
- Sans Do Date : `todo | doing` sans Do Date ; ce n’est pas le futur Scheduled du Planner.
- Toutes : toutes les tâches non archivées ; Archives : tâches archivées, restaurables.

La recherche porte sur titre et description, sans distinction de casse ou d’accents. Pour cette V1, elle filtre les résultats déjà limités au profil et au contexte, sans moteur FTS supplémentaire. La recherche du shell couvre les tâches non archivées, terminées incluses. Le filtre de contexte accepte les six suggestions initiales et des contextes personnalisés. Le nombre et la somme des durées estimées portent sur les tâches affichées, avec mention des durées manquantes.

### Règle de progression task_based

Dénominateur : tâches non archivées et non Someday du Project. Une sous-tâche est exclue du décompte si son parent est lui-même éligible **dans le même Project**. Le parent pèse alors une seule unité et son propre statut décide de sa complétion ; aucun statut agrégé automatique. Si le parent est archivé/Someday/hors de ce Project, l’enfant pertinent compte indépendamment.

Numérateur : tâches `done` parmi ces unités. Pourcentage arrondi à l’entier. Aucun élément éligible = aucune valeur, pas un zéro décoratif. Compléter, rouvrir, archiver, déplacer une tâche ou modifier son statut recalcule la valeur à la lecture. Les modes manual/milestones/none restent disponibles.

### UI

- `/tasks` : navigation Smart Lists desktop, bandeau horizontal mobile, état et filtres conservés dans l’URL. Inbox avec champ Quick Capture : Entrée crée la tâche sans formulaire complet. Actions rapides dans chaque TaskRow : To Do, priorité, Do Date, Project/Life Area, Someday, archivage/restauration.
- Today dans Tasks présente Must / Should / Could / No priority. Depuis la Phase 5, `/today` est un dashboard connecté aux mêmes tâches.
- `/tasks/$taskId` : page de détail responsive, édition complète, Waiting, Reminder, checklist et sous-tâches. Checklist indépendante des Tasks : ajout, renommage, complétion, retrait et réordonnancement accessible par boutons. Sous-tâches ouvertes depuis leur parent comme de vraies Tasks.
- TaskRow est réutilisé dans les vues Tasks, Project et les sous-tâches. Complétion et archivage disposent d’un Undo de la dernière action tant que la liste reste affichée. Reopen et restauration restent possibles ensuite.
- Le bouton + rend Task fonctionnel. Les neuf autres entrées Quick Add restent désactivées. Search cherche les pages et les vraies tâches ; accès aussi depuis le menu mobile.
- Project Detail affiche tâches ouvertes/terminées, Quick Capture lié au Project et vraie progression task_based. Depuis chaque Life Area, « Voir les tâches » ouvre la liste filtrée sur le domaine effectif.
- Composants Jade réutilisés, listes sobres sans grandes cards décoratives. Les formulaires attendent l’hydratation avant interaction ; mutations occupées, erreurs visibles et aucune réussite affichée avant confirmation serveur.

### Validation du 3 novembre 2026

70 tests de données/services (31 nouveaux) et 27 tests navigateur (9 nouveaux), soit **97 tests**. Les tests existants ont été ajustés uniquement aux nouvelles tables, à Task disponible dans Quick Add, au libellé Search et à la progression task_based désormais réelle.

Couverture : capture, clarification, transitions, timestamps, Undo, priorités, Waiting/Follow-ups, dates et fuseaux, contextes, relations croisées refusées, historique, rappels, checklist, hiérarchie, vraie progression, recherche et persistance après fermeture/réouverture ou refresh. Migrations complètes et upgrade depuis Phase 3 vérifiés ; seed réexécuté sans doublons. Fixtures exclusivement dans des bases temporaires isolées.

Navigateurs : Chrome via Playwright, workflows desktop 1440×1000 et mobile 390×844 ; contrôles à 320×568 et régressions du shell jusqu’à 1920 px. Captures `artifacts/phase-4-{today,waiting,detail,project}-{desktop,mobile}.png`, ignorées par Git. Les tâches illustrées sont des fixtures de test, jamais des données ajoutées au profil personnel.

Commandes : `bun run db:migrate`, `bun run db:seed`, `bun test src/tests`, `PLAYWRIGHT_CHANNEL=chrome bun run test:e2e`, `bun run typecheck`, `bun run lint`, `bun run build`, `git diff --check`. Aucune dépendance ajoutée, aucun changement Notion, aucun push/merge. À la livraison de la Phase 4 : aucun Planner, notification système, récurrence exécutée ou module Phase 5.


### Passe UX Tasks

Les onze Smart Lists sont regroupées en Focus, Suivi et Plus sur desktop. Sur mobile, Inbox, Today et Upcoming restent visibles ; Plus ouvre les huit autres vues dans une Sheet, avec la vue active signalée dans le menu et le titre de liste.

Search et Filters partagent une ligne compacte. La Sheet conserve les filtres Context, Project et Life Area et permet de combiner Priority et Effort côté présentation ; les critères restent dans l’URL et suivent les changements de vue.

Le détail présente les propriétés en lecture, avec Terminer/Rouvrir et Modifier. Modifier ouvre le formulaire complet dans une Sheet ; checklist et sous-tâches restent accessibles dans la consultation. Aucun changement de modèle, repository, service, Quick Capture ou progression Project.


## Phase 5 — Today

Source produit lue sans modification : [cahier des charges maître Notion](https://app.notion.com/p/408ca21a7c3c81ca8b69da346a00fc9e), complété par le brief Phase 5. Le suivi Notion porte encore l’ancien avancement Phases 1–2 ; Git constitue la référence de l’état implémenté.

### Lecture du jour

`features/today/api.ts → TodayService → TodayRepository → SQLite`. Une fonction serveur retourne un snapshot transactionnel cohérent : profil, jour local, date localisée, tâches du jour, groupes de priorité, Must, relances dues, compteurs Overdue/Inbox, projets actifs. Le profil est résolu côté serveur et aucune identité n’est acceptée depuis le navigateur.

- Focus réutilise exactement la Smart List Today : To Do / Doing, Do Date égale au jour du profil, sans archives. Waiting, Inbox, Done et Someday ne sont pas présentés comme des actions immédiates.
- Relances : Waiting non archivé avec Follow-up arrivé, les cinq plus anciennes ; le compteur et « Tout voir » donnent accès à la liste complète.
- Overdue : même règle que Tasks, Deadline strictement antérieure, hors Done/Someday/archives. Inbox : compte exact des captures non archivées.
- Quatre Projects actifs maximum, ceux liés au Focus d’abord, puis date de modification décroissante, avec ordre stable par ID.
- Progression réelle : manual, milestones ou task_based. Aucun pourcentage pour none ou pour un calcul sans dénominateur. Le calcul task_based exclut Someday/archives et ne compte pas une sous-tâche si son parent éligible est dans le même projet, comme Project Detail.
- « Tâches ouvertes » compte les tâches non terminées, hors Someday/archives, sous-tâches comprises ; c’est distinct du dénominateur de progression.
- Nom, locale et timezone viennent du User. Le jour est calculé une seule fois par snapshot ; week_start n’intervient pas dans une vue quotidienne sans semaine. Revalidation au retour dans l’onglet et au changement de jour, vérifié toutes les minutes.

### Requêtes et mises à jour

Au plus **sept lectures SQL** par snapshot Today, profil compris (hors lecture du profil déjà utilisée par l’App Shell). Aucun N+1 : les agrégats Tasks/Milestones sont groupés uniquement pour les quatre projets retenus. Aucun chargement de l’historique des tâches ou de tous les objets Projects. Les tâches du jour restent toutes affichées ; les compteurs Inbox/Overdue sont calculés dans SQLite.

Les listes légères id/titre et id/nom nécessaires aux actions rapides sont chargées à la première ouverture, pas au chargement du dashboard. Les mutations Task n’assemblent plus des références Projects/Milestones inutilisées. Les commandes métier sont inchangées.

TaskList/TaskRow, complétion, actions rapides et Undo sont réutilisés. La liste reste montée lorsqu’un groupe ou tout le Focus devient vide, pour préserver Undo. L’invalidation du routeur actualise Focus, compteurs et progression sans recharger le document.

### Interface et périmètre

Header compact Great Vibes, date réelle, greeting du profil et ailes en plumes discrètes. Résumé du jour, Focus avec Must accentués et groupes vides masqués, relances et signal Overdue conditionnels, quatre projets, rappel Inbox si nécessaire. Desktop en deux colonnes ; mobile dans l’ordre Focus → relances → retard → projets → Inbox. État vide unique, avec diamant ponctuel et lien vers les tâches sans Do Date.

Un composant Planning discret indique la disponibilité future du Planner. Aucun calendrier, horaire, événement, habitude, routine, temps suivi ou score inventé. Le Timer existant reste « à venir ». Aucun moteur de Phase 6 n’est développé.

### Validation Phase 5

- 83 tests data/service, dont 13 nouveaux : priorités, exclusions, relances dues/futures, compteurs, sélection des projets, modes de progression, sous-tâches, complétion/Undo, changement de jour, locale/timezone/DST, séparation des profils, vide et nombre fixe de requêtes.
- 35 tests navigateur, dont 8 nouveaux Today : états vide/peu rempli/rempli, compteurs, groupes, complétion, Undo de la dernière tâche, actions rapides, progression, Quick Add, navigation et persistance après rechargement.
- Today contrôlé en 1440, 390 et 320 px ; shell également couvert de 320 à 1920 px.
- Fixtures uniquement dans un répertoire temporaire créé pour Playwright. Le script exige le marqueur de test et un chemin sous le dossier temporaire ; il ne lit jamais LIFE_OS_DB_PATH et n’écrit jamais dans la base personnelle. Pas d’endpoint de fixture dans l’app.
- Typecheck, lint, build et `git diff --check` réussis, avec vérification visuelle des captures et persistance après rechargement.
- Captures ignorées par Git dans `artifacts/phase-5-*.png`, notamment Today desktop/mobile, état vide et journée peu remplie.

Aucune dépendance ni migration ajoutée. Développement local sur `codex/phase-5-today`, sans push ni merge.


## Phase 6 — Planner

Day, Week (grille desktop), Month et Agenda ; mobile centré sur une journée avec navigation de dates. Création, édition, retrait, drag & drop et resize ; les alternatives par formulaire restent accessibles au clavier et sur mobile. Les chevauchements disposent de colonnes séparées. Today affiche le planning réel du jour.

Migration additive `004_planner.sql` : `planner_series`, `events`, `time_blocks`, `scheduled_tasks`, `planner_exceptions`. Les migrations 001–003 sont intactes. Un Scheduled Task référence la Task existante ; déplacer ou retirer son créneau ne modifie jamais Do Date, Deadline ou Reminder et ne supprime pas la Task. Les liens de contexte des Time Blocks sont préparés pour le Timer.

Récurrences daily, weekly avec jours choisis, monthly et intervalles. Modification d'une occurrence par exception, de cette occurrence et des suivantes par scission de série, ou de la série entière. Les exceptions conservent leurs clés d'origine ; après une modification du motif, seules les clés encore éligibles apparaissent. Retrait sans suppression physique de l'historique. Les durées sont réelles ; les ancrages restent locaux au fuseau de la série. Voir [les décisions du sprint](docs/sprint-decisions.md), notamment les règles Timer validées par Jade.

Les interfaces External Event/provider et Routine Placement sont préparées, sans connexion externe ni Routine fictive. Les références Tasks à planifier et deadlines sont plafonnées respectivement à 100 et 200 ; le lien Tasks donne accès à la liste complète. Les séries sont filtrées par fenêtre et leurs exceptions chargées en lot. Les futurs travaux peuvent borner aussi l'historique d'exceptions d'une série très longue.

Validation : 102 tests data/service et 39 tests navigateur (141 au total), typecheck, lint, build, desktop/mobile et `git diff --check`. Les 19 nouveaux tests unitaires couvrent notamment les récurrences, exceptions, DST, changements de portée, liens, isolation et chevauchements ; 4 nouveaux parcours navigateur couvrent les mutations, drag/resize, refresh et Today. Migrations sur base vide et upgrade vérifiés ; seed idempotent. Base personnelle sauvegardée avant migration, données préexistantes inchangées, intégrité SQLite `ok`, aucune violation de foreign key. Fixtures seulement dans les bases temporaires de test.

Captures locales ignorées par Git : `artifacts/phase-6-week-desktop.png`, `artifacts/phase-6-week-mobile.png`, `artifacts/phase-6-month-small.png`.

## Phase 7 — Timer & Focus

Migration additive `005_time_focus.sql` : `time_sessions` et `time_pauses`, index unique partiel `WHERE status='running'`. Plusieurs sessions en pause sont autorisées. Pause & Start suspend l'ancienne session et démarre la nouvelle dans une transaction ; Resume suspend d'abord l'éventuelle session running. Seul Stop / Finish termine. Une pause n'est jamais une complétion.

Le calcul `actual_duration` est exprimé en secondes, dérivé des timestamps et des pauses persistées. Il ne dépend pas d'un compteur navigateur. Les totaux journaliers coupent les intervalles aux minuits du fuseau du profil, y compris au changement d'heure. Le navigateur ne fait qu'afficher le temps écoulé et relire périodiquement le serveur, ainsi qu'au retour dans l'onglet.

Timer disponible depuis Task, Project, Life Area, Time Block, Scheduled Task et Quick Add. Le contexte est un snapshot Task → Project → Goal / Life Area ; les liens historiques sont conservés. Planned duration est figée depuis l'occurrence du Planner ; la correction du temps réel ne réécrit jamais le planning. Les valeurs source Habit/Routine sont réservées pour la Phase 9, sans objets fictifs ni actions actives.

Focus propose l'activité, la durée, l'objectif facultatif 25/45/60/90 minutes ou libre, les liens Task/Project, la checklist réelle, Pause et Finish. Atteindre l'objectif ne termine pas automatiquement la session. Les sessions en pause restent visibles et reprenables ; les 50 dernières sessions terminées sont consultables et corrigibles. Saisie manuelle et corrections début/fin/pauses en heure locale, avec refus des intervalles inversés, futurs, hors session ou chevauchants. Le contexte historique reste immuable. Les entrées manuelles peuvent chevaucher d'autres sessions : elles représentent une correction explicite et ne sont pas des sessions running.

La barre Timer persiste desktop/mobile ; Today affiche le temps réel suivi aujourd'hui, la session running et son Planned vs Actual lorsqu'il existe. Les objectifs de cette phase sont des objectifs de session ; les quotas récurrents par domaine restent pour une évolution dédiée.

Validation Phase 7 : 125 tests de données/services (23 nouveaux), 48 parcours navigateur au total (régression complète des 47 premiers, puis 9 parcours Timer dont le nouveau test de précision). Typecheck, lint, build et `git diff --check`. Captures `artifacts/phase-7-focus-{desktop,mobile,small}.png` ; desktop 1440 px, mobile 390/320 px. Migration/seed vérifiés sur base vide et upgrade ; sauvegarde de la base personnelle, données précédentes inchangées, integrity_check `ok`, foreign_key_check vide. Aucun fixture personnel. Les champs horaires inchangés conservent secondes, millisecondes et occurrence DST d'origine.

## Phase 8 — Notes & Lists

Migration additive `006_notes_lists.sql` : `notes`, `note_links`, `personal_lists`, `list_items`. Les migrations historiques restent intactes. Notes Quick/Full, titres et contenus persistés ; éditeur texte léger avec commandes Markdown et aperçu sûr (titres, paragraphes, puces, numéros, checklist interactive, liens et citations). Le HTML brut n'est jamais exécuté et seuls http/https/mailto sont autorisés dans les liens. Aucun système Documents ou stockage de pièces jointes n'est ajouté.

L'autosave sérialise les écritures, compare la révision SQLite, conserve un brouillon local par note et onglet et protège contre l'écrasement d'une version plus récente. Le cache de route ne remplace jamais une révision déjà confirmée. Navigation : les modifications en attente sont envoyées ; fermeture/refresh : le brouillon reste local jusqu'à confirmation serveur. En cas de conflit, conserver comme nouvelle note ou abandonner explicitement le brouillon pour recharger le serveur. Les brouillons d'autres onglets sont récupérables sans les supprimer. Si le stockage local est indisponible, l'interface demande de garder la page ouverte jusqu'à confirmation serveur.

Relations vers Project, Life Area, Goal, Task, Event et Note, avec foreign keys et contrôle du propriétaire. Note ↔ Note visible dans les deux sens. Une sélection enregistrée devient Task sans modifier la note ; lien source consultable depuis Task. Les extraits trop longs sont bornés dans la description Task, avec mention explicite et lien vers le contenu complet conservé dans la source.

Lists : Simple, Checklist, Shopping et Wishlist ; éléments, détails, quantité, complétion, édition, retrait avec Undo. Conversion d'un élément en Task idempotente, sans suppression de l'élément. Archivage/restauration des notes et listes. Le Global Search couvre titres/contenus Notes et titres/éléments Lists, sans distinction de casse ou d'accents ; archives exclues. Quick Add Note est fonctionnel.

Validation Phase 8 : 145 tests data/service (20 nouveaux), 57 tests navigateur (9 nouveaux), typecheck, lint, build, desktop/mobile et `git diff --check`. Conflit entre onglets, texte long, restauration hors connexion, archives, sélection → Task, liens sources, listes, Undo, Quick Note, recherche et checklist interactive vérifiés. Migration/seed base vide et upgrade ; sauvegarde personnelle, données existantes inchangées, intégrité SQLite `ok`, foreign_key_check vide. Captures `artifacts/phase-8-{note,list}-{desktop,mobile}.png`. Aucun fixture personnel.

## Phase 9 — Habits, Routines & Trackers

`/life/habits`, `/routines` et `/life/trackers` utilisent le Design System Jade et sont accessibles depuis Life. Habits : jours précis, quotas de jours réussis par semaine/mois, intervalle en jours, quantité/durée, Done/Skip/Missed, pauses temporaires et historique. Les règles sont versionnées, les quotas ne créent pas d'échecs quotidiens artificiels. Une Habit de durée peut lancer le Timer ; les sessions terminées contribuent en temps réel hors pauses, selon le fuseau du profil.

Routines : édition et ordre des étapes Simple/Checklist/Task/Habit/Timer, passages guidés persistants Previous/Next/Done/Skip, Timer global facultatif. Chaque passage conserve une copie de ses étapes ; les modifications du modèle ne changent pas le passé. Les actions Done sur les sources liées sont transactionnelles. Une action Skip n'achève jamais un Timer ; Finish reste explicite.

Trackers : Number/Duration/Counter/Boolean/Scale, unité, cible facultative, fréquence d'observation et historique daté. Les compteurs s'incrémentent atomiquement ; limites d'échelle/Boolean/durées et dépassements numériques contrôlés. Aucun Mood par défaut. Archivage et restauration préservent toutes les entrées. Today affiche jusqu'à 5 Habits et 3 Routines réelles, avec complétion sans rechargement complet.

Migration additive `007_practices.sql` : `habits`, `habit_rules`, `habit_entries`, `habit_pauses`, `routines`, `routine_steps`, `routine_runs`, `routine_run_steps`, `trackers`, `tracker_entries` ; trois références facultatives ajoutées à `time_sessions`. Foreign keys, ownership, snapshots et bornes numériques protégés. Migrations 001–006 inchangées, aucune dépendance ajoutée. `SqlitePracticeRepository` et `PracticeService` restent derrière les fonctions serveur de la feature ; aucune requête SQLite dans les composants. Les lectures d'historique sont bornées (14 jours Habits visibles, 90 jours Trackers, 100 passages) ; choisir une date plus ancienne donne accès à l'historique antérieur sans supprimer de données.

Les décisions métier et limites sont explicites dans `docs/sprint-decisions.md`. La Phase 10 Insights & Reset n'est pas commencée dans ce sprint : priorité à la validation complète des Phases 6–9.

Validation Phase 9 : 177 tests data/service (32 nouveaux), 64 parcours navigateur (7 nouveaux), typecheck, lint, build et `git diff --check`. Quotas hebdomadaires/mensuels, jours précis, intervalle, timezone/DST, pauses, règles historiques, Skip/Missed, Timer/corrections, Routine Runs/checklists/liens/snapshots, valeurs/limites des Trackers, ownership et persistance après réouverture couverts. Régression desktop/mobile complète ; captures `artifacts/phase-9-{habits,routine,trackers}-{desktop,mobile}.png` et `phase-9-small.png`. Migration/seed sur base vide et upgrade ; sauvegarde personnelle avant migration, données préexistantes inchangées, `integrity_check=ok`, aucune violation de foreign key. Les données des captures proviennent uniquement des bases temporaires de test.

## Polish UX transversal — Phases 6 à 9

Planner : navigation allégée, légende Event/Time Block/Task, blocs courts centrés sur le titre et zone À planifier plus lisible. Focus : scène centrée sur le temps, ailes et cristal réutilisés, commandes Pause/Finish et sessions en pause compactes. Notes : ouverture en lecture pour les notes existantes, passage explicite à Modifier, accès conservé aux brouillons/conflits et contrôles complets ; terminer l'édition attend la sauvegarde. Habits et Trackers : tableaux de bord compacts, action Done/+1 immédiate, détail dépliable avec toutes les commandes et historiques. Routines : passage guidé prioritaire, cartes secondaires et historique discrets. Aucun modèle métier ni migration modifié.

Validation polish : 177 tests data/service et 66 tests navigateur, typecheck, lint, build et diff check réussis. Les parcours existants restent couverts ; deux nouveaux parcours desktop/mobile vérifient le mode lecture, huit Habits, les détails à la demande, le compteur compact et un bloc Planner de 15 minutes. Captures locales `artifacts/polish-{planner,focus,notes,habits,routines,trackers}-{desktop,mobile}.png`.

## Phase 10 — Insights & guided resets

Review remplace son shell par Week/Month, Tracked Time, répartition Life Area/Project, Planned vs Actual des créneaux chronométrés, Tasks, Waiting actuel, Habits et cibles de session existantes. Life Balance compare la semaine aux quatre semaines précédentes, sans score. Les projets affichent temps, progression réelle actuelle, compteurs et dernière activité enregistrée. Les limites historiques sont visibles dans l'interface et précisées dans `docs/sprint-decisions.md`.

Weekly Reset : Inbox → Overdue → Waiting → Projects → Habits → Time Review → Weekly Priorities → Plan Next Week. Monthly Reset : Last Month → Clean Up → Projects → Goals → Focus Areas → Month Calendar → Monthly Priorities. Le mensuel relit le mois précédent celui sélectionné. Done/Skip, Previous/Next, notes et trois priorités maximum sont persistés ; terminer toutes les étapes conserve le bilan. Complétion de Tasks réelle, accès direct aux modules existants, aucune génération implicite de tâches. Les saisies non sauvegardées sont protégées lors des changements d'étape/navigation ; une révision protège les éditions concurrentes.

Migration additive `008_reviews.sql` : `reset_runs`, identité de période immuable, foreign key profil, unicité utilisateur/type/période et révision. Aucun changement des migrations 001–007, aucune dépendance ajoutée. Les rapports sont assemblés en lecture transactionnelle par `ReviewService`, derrière `SqliteReviewRepository` et les repositories existants. Les actions de Reset utilisent une transaction immédiate. Les listes d'action sont limitées à 30 éléments et renvoient à Tasks pour la liste complète ; les 50 derniers passages sont présentés. Les données personnelles ne reçoivent aucune fixture.

Validation Phase 10 : 201 tests data/service (24 nouveaux) et 71 tests navigateur (5 nouveaux), soit 272 tests. Régression navigateur complète réussie, puis cinq parcours Review revérifiés après les dernières retouches. Typecheck, lint, build, desktop/mobile 1440/390/320 px et `git diff --check` réussis. Périodes/année bissextile, timezone/DST, bornes locales, pauses, snapshots, comparaison prévue sans doublons, activité récente fiable, Habits, resets idempotents, notes/priorités, protection des brouillons, concurrence et persistance après réouverture vérifiés. Migration 008 testée sur base vide et upgrade, puis appliquée à la base personnelle après sauvegarde : données antérieures inchangées, intégrité `ok`, foreign_key_check vide. Captures `artifacts/phase-10-{insights,weekly-reset,monthly-reset}-{desktop,mobile}.png` et `phase-10-empty-small.png`. Phase 11 non commencée.
