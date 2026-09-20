# SEC-08 — Révocation du flux ICS à la désactivation

## Cause racine

`app/api/agenda/[token]/route.ts` recherchait une personne par `icsToken`, puis générait le flux sans vérifier `Person.active`. Le token personnel restait donc utilisable après désactivation.

Les tokens sont générés par `newToken()`/`randomBytes(18)` lors de la création des personnes et ne disposent pas d’une rotation automatique au départ.

## Correction

Le handler vérifie désormais `p?.active` avant d’appeler `personEvents`. Une personne inactive obtient `404 Flux introuvable`; aucune donnée agenda n’est chargée ni sérialisée.

Aucune rotation de token n’a été ajoutée : le refus serveur sur une personne inactive est la protection principale et évite de modifier le modèle de token. Une réactivation rend le token existant à nouveau utilisable, conformément au comportement retenu.

## Tests

`tests/security/sec-08-ics-disabled.spec.ts` vérifie avec PostgreSQL et HTTP :

- personne active → flux 200 et calendrier valide ;
- désactivation → ancienne URL 404 ;
- réactivation → flux 200 ;
- le flux d’équipe n’est pas modifié.

Exécution dédiée SEC-08 + SEC-09 : **2/2 réussis**.

Contrôles complémentaires : tests unitaires **12/12**, lint **OK**, TypeScript **OK**, build production **OK**.

## Flux équipe et limites

Le token `settings.teamIcsToken` est partagé et n’est pas lié à une personne ; la désactivation d’un membre ne le révoque donc pas. Cette politique d’équipe reste inchangée. La rotation manuelle des tokens personnels n’existe pas dans le modèle actuel et reste une évolution distincte.

## Verdict

**SEC-08 CORRIGÉ**.

