# Interface et navigation

Le menu a été rangé par usage le 27/09/2026 (spec `docs/superpowers/specs/2026-09-27-menu-par-usage-design.md`) : 12 sections et 35 entrées devenues 6 sections. Il redevient illisible dès qu'un module ajoute « son » entrée ou « sa » section.

## Quand lire ce fichier
- Avant d'ajouter ou de renommer une entrée dans `lib/navigation.ts`, une page, un onglet, un bouton d'export.
- Avant de créer un module d'instance qui a des écrans.

## Règles
- **ALWAYS** — la première section rassemble le quotidien (« Mon travail ») ; les suivantes sont rangées par objet : Projets, Financements, Réseau, Ressources, Admin.
- **ALWAYS** — une entrée de menu = un endroit où l'on va. Une vue d'une même liste = un onglet dans la page (`components/shell/page-tabs.tsx`). Un document produit = un bouton. Un moment de l'année = un bouton, ou une entrée affichée seulement en saison (`lib/season.ts`).
- **NEVER** — une section définie par un groupe de personnes (« Direction ») : les droits masquent des entrées, ils ne créent pas de section.
- **NEVER** — une nouvelle section pour un module : ses écrans vont dans la section de leur objet.
- **ALWAYS** — une adresse rattachée à une entrée sans en être une (sous-page, page d'onglet) est déclarée dans `alsoPaths` de la feuille ou `also` de la section, pour que l'entrée reste active.
- **ALWAYS** — un libellé de menu qui contient un mot métier passe par `lib/vocab.ts`.
