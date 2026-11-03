# Life OS · The Jade Edition

Application personnelle locale. Tasks & Inbox permettent de capturer, clarifier, prioriser et suivre des actions persistées dans SQLite, reliées aux Life Areas, Goals, Projects et Milestones. Le Planner et le dashboard Today restent à venir. La documentation produit reste dans [le cahier des charges Notion](https://app.notion.com/p/408ca21a7c3c81ca8b69da346a00fc9e).

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

`src/components/layout/` contient AppShell, PageLayout, navigation et Quick Add. `src/design-system/components/` contient les primitives génériques. Les helpers React sont dans `lib`. Aucun module métier de Phase 5 ou des phases suivantes n’est initialisé.

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
- Today dans Tasks présente Must / Should / Could / No priority ; `/today` reste le shell de Phase 2.
- `/tasks/$taskId` : page de détail responsive, édition complète, Waiting, Reminder, checklist et sous-tâches. Checklist indépendante des Tasks : ajout, renommage, complétion, retrait et réordonnancement accessible par boutons. Sous-tâches ouvertes depuis leur parent comme de vraies Tasks.
- TaskRow est réutilisé dans les vues Tasks, Project et les sous-tâches. Complétion et archivage disposent d’un Undo de la dernière action tant que la liste reste affichée. Reopen et restauration restent possibles ensuite.
- Le bouton + rend Task fonctionnel. Les neuf autres entrées Quick Add restent désactivées. Search cherche les pages et les vraies tâches ; accès aussi depuis le menu mobile.
- Project Detail affiche tâches ouvertes/terminées, Quick Capture lié au Project et vraie progression task_based. Depuis chaque Life Area, « Voir les tâches » ouvre la liste filtrée sur le domaine effectif.
- Composants Jade réutilisés, listes sobres sans grandes cards décoratives. Les formulaires attendent l’hydratation avant interaction ; mutations occupées, erreurs visibles et aucune réussite affichée avant confirmation serveur.

### Validation du 3 novembre 2026

70 tests de données/services (31 nouveaux) et 27 tests navigateur (9 nouveaux), soit **97 tests**. Les tests existants ont été ajustés uniquement aux nouvelles tables, à Task disponible dans Quick Add, au libellé Search et à la progression task_based désormais réelle.

Couverture : capture, clarification, transitions, timestamps, Undo, priorités, Waiting/Follow-ups, dates et fuseaux, contextes, relations croisées refusées, historique, rappels, checklist, hiérarchie, vraie progression, recherche et persistance après fermeture/réouverture ou refresh. Migrations complètes et upgrade depuis Phase 3 vérifiés ; seed réexécuté sans doublons. Fixtures exclusivement dans des bases temporaires isolées.

Navigateurs : Chrome via Playwright, workflows desktop 1440×1000 et mobile 390×844 ; contrôles à 320×568 et régressions du shell jusqu’à 1920 px. Captures `artifacts/phase-4-{today,waiting,detail,project}-{desktop,mobile}.png`, ignorées par Git. Les tâches illustrées sont des fixtures de test, jamais des données ajoutées au profil personnel.

Commandes : `bun run db:migrate`, `bun run db:seed`, `bun test src/tests`, `PLAYWRIGHT_CHANNEL=chrome bun run test:e2e`, `bun run typecheck`, `bun run lint`, `bun run build`, `git diff --check`. Aucune dépendance ajoutée, aucun changement Notion, aucun push/merge. Aucun Planner, notification système, récurrence exécutée ou module Phase 5.


### Passe UX Tasks

Les onze Smart Lists sont regroupées en Focus, Suivi et Plus sur desktop. Sur mobile, Inbox, Today et Upcoming restent visibles ; Plus ouvre les huit autres vues dans une Sheet, avec la vue active signalée dans le menu et le titre de liste.

Search et Filters partagent une ligne compacte. La Sheet conserve les filtres Context, Project et Life Area et permet de combiner Priority et Effort côté présentation ; les critères restent dans l’URL et suivent les changements de vue.

Le détail présente les propriétés en lecture, avec Terminer/Rouvrir et Modifier. Modifier ouvre le formulaire complet dans une Sheet ; checklist et sous-tâches restent accessibles dans la consultation. Aucun changement de modèle, repository, service, Quick Capture ou progression Project.
