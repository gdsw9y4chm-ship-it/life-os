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
