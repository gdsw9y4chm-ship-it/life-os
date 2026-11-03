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
