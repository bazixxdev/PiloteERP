# Charte graphique du prototype « Pilote »

Direction V2 donnée le 13/09/2026 (maquette `CRESS/maquette V2.html`, inspirée du site de la CRESS Pays de la Loire ; ce n'est pas une charte officielle). Aucune police distante : titres en Trebuchet MS (présente sur Windows et macOS), texte en police système.

| Rôle | Couleur | Token |
|---|---|---|
| Actions principales, titres, navigation active | bleu profond `#004D6D` | `--primary` |
| Accent d'identité (soulignement des onglets, repère « aujourd'hui ») — jamais en texte courant ni en bouton | corail `#EA5427` | `--coral` |
| Touches douces (jauges neutres, pastilles) | menthe `#85C8B5` | `--mint-pale` |
| Confirmation (fait, validé, dans l'objectif) | vert `#226552` / fond `#E5F1EB` | `--mint`, `--mint-soft` |
| Vigilance (J−30, enveloppe ≥ 80 %, validation en attente) | ocre `#8C601B` / fond `#FAF0D8` | `--warning`, `--warning-foreground`, `--warning-soft` |
| Retard, dépassement, refus | terre `#A24533` / fond `#FAE9E2` | `--danger`, `--danger-soft` |
| Fond des écrans | papier `#F7F7F3` | `--background` |
| Surfaces | blanc `#FFFFFF`, séparateurs `#DCE3E5` | `--card`, `--border` |
| Texte | encre `#243D49`, secondaire `#5E6C72` | `--foreground`, `--muted-foreground` |
| Barre latérale | fond clair `#EEF4F6`, entrée active `#D9E9EF` | `--sidebar`, `--sidebar-accent` |
| Accueil / crème | `#F8E9C6` | `--sand` |

- Rayons : 8 px pour les cartes (`rounded-2xl`), 6 px pour les champs et boutons, 4 px pour les badges (`rounded-sm`).
- Badges de statut : symbole écrit avant le libellé (○ ◐ ✓ ! ↻ ◷), jamais la couleur seule.
- Jauges fines (5 px) avec le pourcentage écrit ; jauge scindée réalisé / engagé sur le budget.
- Logo : `public/clients/cress/logo.png` (lot I : par client, avec `logo-white.png`, `mark.png`, `favicon.png` ; ex-`public/logo-cress.png`) (465 × 187, fond transparent, retravaillé depuis le JPG fourni) en haut de la barre latérale ; `public/logo-cress-mark.png` (tourbillon seul) pour la barre réduite et la barre haute mobile.
- Mobile (< 768 px) : barre latérale masquée, navigation basse à trois entrées (Ma semaine / Mes temps / Projets), saisie des temps jour par jour avec la semaine visible ; cibles tactiles 44 px.
- Statuts d'édition : re-challengée (ocre), proposée (gris), validée (vert), en cours (bleu), bilan fait (gris).
