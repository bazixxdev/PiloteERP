# Charte graphique du prototype « Pilote »

Direction donnée le 12/09/2026 : le site de la CRESS associe un bleu profond, du corail, des fonds crème et des touches menthe, des titres sans sérif et des formes arrondies. La maquette reste autonome (aucune police distante) : elle utilise une police disponible sur l'ordinateur.

| Rôle | Couleur | Token |
|---|---|---|
| Navigation, actions principales | bleu profond `#1b4f8a` (barre latérale `#173f6f`) | `--primary`, `--sidebar` |
| Accents graphiques (jauges, badges « à traiter », bouton d'action secondaire) | corail `#f0705e` | `--coral` |
| Fond de page | crème `#fbf8f2` | `--background` |
| Touches positives (fait, validé, dans l'objectif) | menthe `#2e9e6b` / fond `#dcf3ea` | `--mint`, `--mint-soft` |
| Alerte modérée (J-30, enveloppe > 80 %) | ambre `#e9a23b` / fond `#fdf1dc` | `--warning` |
| Alerte forte (retard, dépassement, refus) | rouge `#d64541` / fond `#fbe3e2` | `--danger` |
| Texte | bleu nuit `#1b2a41` | `--foreground` |

- Police : `"Avenir Next", "Segoe UI", "Helvetica Neue", Arial, sans-serif` (titres et texte). Chiffres tabulaires dans les tableaux.
- Rayon des formes : `0.75rem` (boutons, cartes, badges arrondis).
- Logo : `public/logo-cress.png` (fourni), affiché en haut de la barre latérale sur fond blanc arrondi.
- Statuts d'édition : re-challengée (ambre), proposée (bleu clair), validée (menthe), en cours (bleu), bilan fait (gris).
- États d'action : à faire (gris), en cours (bleu), fait (menthe), en retard (corail/rouge).
