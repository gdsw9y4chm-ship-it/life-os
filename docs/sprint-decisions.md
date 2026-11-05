# Décisions produit du sprint

## Timer — décision explicite de Jade
- Au maximum une Time Session en état running par utilisateur.
- Plusieurs sessions paused peuvent coexister ; paused n'est pas active au sens de cette contrainte.
- Pause & Start suspend la session running puis démarre la nouvelle, atomiquement.
- Reprendre une session paused met d'abord en pause la session running éventuelle.
- Une pause ne termine jamais implicitement une session. Stop / Finish termine explicitement.
- Les pauses sont persistées et exclues de actual_duration.
- SQLite doit utiliser un index unique partiel sur user_id WHERE status = 'running', et non sur toutes les sessions non terminées.

## Planner
Les dates de calendrier sont des dates locales du profil. Les séries conservent leur fuseau, une ancre locale et une durée réelle en minutes. Une occurrence déplacée conserve sa clé d'origine ; elle ne décale pas les suivantes. Les journées mensuelles inexistantes sont omises (31 février n'est pas transformé en 28 février). Les heures locales inexistantes lors du changement d'heure sont omises dans une série, et refusées lors d'une saisie explicite.

Le retrait d'un placement ne modifie ni la Task, ni Do Date, ni Deadline, ni Reminder. Les événements externes restent une interface de provider, sans connexion externe.

## Timer — précisions techniques
`actual_duration` est calculée en secondes depuis les horodatages persistés et les intervalles de pause. Elle n'est pas un compteur modifié par JavaScript. Le contexte (Task/Project/Goal/Life Area) et la durée prévue sont figés à la création, pour protéger l'historique. Les corrections manuelles ne modifient pas ce contexte ni le Planner.
Les durées cibles sont facultatives et ne provoquent jamais de Finish automatique. Les quotas récurrents par domaine ne sont pas introduits dans cette phase. Les sources Habit/Routine sont réservées dans le schéma pour être reliées aux objets réels en Phase 9.

## Notes & Lists
Éditeur texte avec Markdown et aperçu, sans HTML exécutable ni moteur de documents. Autosave à révision optimiste et brouillons locaux séparés par onglet ; aucune résolution automatique destructive des conflits. Une conversion garde toujours la source, même quand la description Task ne peut contenir qu'un extrait. Les liens et archives préservent les objets d'origine.

## Habits, Routines & Trackers
- Une fréquence « X fois par semaine/mois » compte des **jours réussis distincts**, pas des échecs quotidiens. La semaine suit `user.week_start`, les dates suivent le fuseau du profil. L'objectif est plafonné au nombre de jours éligibles de la période (création et pauses prises en compte) ; une période entièrement en pause est neutre. Une période passée insuffisamment remplie peut être `missed`, sans inventer des entrées quotidiennes.
- Les règles d'une Habit sont versionnées par date d'effet. Une modification s'applique aujourd'hui, les versions antérieures restent conservées. Une pause est un intervalle de jours locaux ; reprendre rend aujourd'hui éligible et conserve les jours précédents en pause. Une pause/reprise le même jour n'ajoute pas de journée neutralisée.
- Une seule entrée manuelle par Habit et jour. Les valeurs partielles ont un état `progress` ; `done`, `skip` et `missed` restent explicites. Pour une cible de durée, seules les Time Sessions **completed** liées à la Habit contribuent, en minutes réelles, réparties entre les journées du profil et hors pauses. Les corrections Timer se reflètent sans créer ni doubler d'entrée. La valeur manuelle représente du temps supplémentaire non chronométré. Skip/Missed explicites prévalent sur le calcul.
- Les Routine Runs conservent une copie de leurs étapes. Renommer, réordonner ou retirer une étape du modèle ne réécrit pas un passage commencé. Previous/Next déplacent le curseur sans marquer Done. Done sur une Task/Habit met à jour l'objet réel ; Skip ne le termine pas. Un passage se termine lorsque toutes ses étapes ont été traitées.
- Pour une étape Timer, **Finish & Done** termine explicitement ses sessions, y compris paused. Skip les conserve. Le Timer global facultatif est indépendant et se termine explicitement dans Focus ; finir une routine ne termine pas automatiquement le Timer global.
- Les Trackers conservent une valeur datée par jour, une note et une fréquence d'observation. Un Counter accepte un incrément atomique ; les autres saisies remplacent la valeur du jour. Une absence de valeur n'est jamais un zéro inventé. Type, unité et bornes d'échelle restent fixes après création pour préserver l'historique ; titre, cible et fréquence restent modifiables. Aucun suivi d'humeur n'est créé par défaut.
- Les archives conservent les données et relations. Aucun effacement physique des historiques n'est exposé. Les accès Habit/Routine/Tracker sont disponibles depuis Life ; Today présente une sélection compacte de données réelles. Les raccourcis Quick Add supplémentaires restent pour une passe dédiée (les captures Task/Note et le Timer existants sont inchangés).

## Insights & Resets — Phase 10
- Week suit le début de semaine du profil ; Month suit le mois civil. Les bornes sont converties dans le fuseau du profil avant intersection des Time Sessions. Le temps réel inclut les intervalles suivis en cours et exclut toutes les pauses. Les ventilations utilisent le contexte figé des sessions, pas les relations actuelles des Tasks.
- Life Balance montre des durées et parts du temps enregistré, sans score. La comparaison Week utilise les 28 jours précédant la semaine affichée, divisés par quatre ; elle mesure uniquement les enregistrements conservés et ne présume pas d'une couverture complète de la vie réelle.
- Planned vs Actual compare uniquement les occurrences du Planner réellement reliées à des sessions. La durée prévue conservée est comptée une fois par occurrence, même si plusieurs sessions y sont liées. Le temps réel est limité à la période affichée ; le prévu reste la durée complète conservée de l'occurrence. Les créneaux jamais chronométrés ne deviennent pas des échecs fictifs.
- Tasks créées/terminées s'appuient sur les dates conservées. Une complétion annulée n'est plus comptée. Waiting, Inbox, Overdue, états et progression des Projects sont **actuels**, explicitement étiquetés. Les historiques d'état non stockés ne sont pas reconstruits.
- L'activité récente d'un Project prend en compte sa dernière modification, celles de ses Tasks et ses sessions. « Aucune activité enregistrée depuis 28 jours » n'est affiché que si tous ces indices sont antérieurs ; le calcul reste actuel même dans un ancien bilan. Ce n'est pas une conclusion sur le travail hors application.
- Habits : états journaliers calculés avec les versions des règles, pauses, entrées et sessions terminées. Les quotas hebdomadaires/mensuels ne créent pas de Missed quotidien fictif. Time Targets affiche les seules cibles de session existantes ; les quotas récurrents par domaine restent différés.
- Weekly Reset porte sur la semaine sélectionnée ; Monthly Reset, lancé depuis Month, relit le mois précédent et mène au calendrier du mois sélectionné. Les dates du bilan sont affichées et figées sur le passage. Un seul passage par utilisateur, type et début de période ; reprise idempotente, historique conservé.
- Les huit/sept étapes conservent Done/Skip, curseur, notes et jusqu'à trois priorités saisies. Next/Previous ne valident rien. Les priorités ne créent pas implicitement de Tasks. Les actions Tasks passent par le service existant ; les autres modules restent accessibles par liens directs, sans dupliquer leurs règles.
- Révisions optimistes sur les resets : un autre onglet ne peut pas écraser une version plus récente. Les saisies non enregistrées bloquent le changement d'étape ; quitter exige un choix explicite. Aucun score de productivité ni historique inventé. Aucune Phase 11.
