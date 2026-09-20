# SEC-28 — Paiement supprimé indirectement par cascade

## Cause racine

`detachFundingLineFromConvention` considérait une FundingLine vide sans compter ses `payments`. Une ligne portant un paiement pouvait donc être supprimée, et la relation Prisma `Payment.fundingLine -> FundingLine` en `onDelete: Cascade` supprimait le paiement indirectement.

## Correction et politique

Un paiement est désormais un usage métier de la ligne, qu'il soit reçu ou encore attendu. `detachFundingLineFromConvention` charge les paiements et ne supprime la FundingLine que si elle n'a aucun montant, livrable, pièce jointe, action **ni paiement**. Sinon elle détache seulement la convention.

La protection directe de `deletePayment` contre la suppression d'un paiement reçu reste inchangée.

## Cascade Prisma

La FK `Payment.fundingLineId` conserve `onDelete: Cascade` et aucune migration n'a été ajoutée. Le garde applicatif ferme le chemin identifié ; la cascade reste un risque résiduel si une autre suppression directe de FundingLine est introduite ou exécutée hors de cette action. Ce durcissement relève de BLK-03.

## Validation

- Tests historiques paiements/financements/conventions : **4/4 PASS** (`versements.spec.ts`, `dossiers.spec.ts`).
- `npm run test:security` : **33/33 PASS**.
- `npm run test:unit` : **13/13 PASS**.
- `npm run lint` : **PASS**.
- `npx tsc --noEmit` : **PASS**.
- `npm run build` : **PASS**, avertissements Edge Runtime/cache non bloquants.

Le scénario direct Payment reçu reste refusé. Après correction, une FundingLine avec paiement reçu ou attendu n'est plus considérée comme vide et ne peut plus être supprimée par détachement ; le paiement et la ligne restent préservés. Le scénario rouge pré-correction n'a pas été rejoué sur un checkout antérieur.

## Limites

Les suppressions de FundingLine hors `detachFundingLineFromConvention`, la stratégie d'archivage et les courses concurrentes restent à traiter dans BLK-03, BLK-20 et SEC-29.

## Verdict

**SEC-28 CORRIGÉ**

