// Lexique de l'outil (lot C) : ce que chaque mot veut dire, une fois pour toutes. À faire valider le 28/09 (question 1 du
// cahier des charges). Sert au dialogue « Lexique » (matrice, portefeuille, projets) — jamais en dur ailleurs.
export const LEXIQUE: { term: string; def: string; example: string }[] = [
  { term: "Projet", def: "Ce qui se répète d'une année sur l'autre : un code analytique, un pilote, un pôle, une mission du plan opérationnel.", example: "« Mois de l'ESS » (MOI-01)" },
  { term: "Édition", def: "Le projet une année donnée : la fiche en quatre couches, le budget, l'équipe, le temps, les financements, la décision du CODIR. C'est l'objet que l'on pilote.", example: "« Mois de l'ESS 2026 »" },
  { term: "Action", def: "Une étape ou une occurrence dans l'édition : un jalon daté, un responsable, un état, éventuellement publique (flux agenda du site).", example: "« Soirée de lancement 14/11 », « Publication du baromètre »" },
  { term: "Financeur", def: "L'organisation qui paie. Ses interlocuteurs sont tenus par la RAF.", example: "Région, FSE, État / DREETS, ADEME" },
  { term: "Ligne de financement", def: "Le cas courant : un financement d'un financeur pour une édition — demandé, obtenu, code analytique, livrables, versements. Sans convention rattachée, c'est un financement annuel propre à l'édition.", example: "Région → Mois de l'ESS 2026 : 20 000 €" },
  { term: "Convention", def: "L'exception : un accord qui couvre plusieurs années ou plusieurs projets. Ses lignes de financement sont ses affectations, plafonnées au montant notifié ; ses versements sont des tranches.", example: "FSE 2026-2028, CPO État du DLA" },
  { term: "Livrable", def: "Ce que l'on doit au financeur, daté : bilan, justificatifs, mentions. Rappels à J-30 et J-7 au pilote et à la RAF.", example: "Bilan intermédiaire FSE au 30/06" },
  { term: "Versement", def: "L'argent attendu puis reçu, sur une ligne (cas courant) ou sur une convention (tranches). « Reçu » est posé par la RAF ou la direction ; un retard les prévient.", example: "Acompte 50 % Région, solde après justificatifs" },
  { term: "Appel à projets", def: "Une opportunité de financement repérée, avant toute décision. Le CODIR dit « à étudier », « on dépose » ou « écarté » ; « Étudier » crée la convention à déposer.", example: "AAP Transition écologique ADEME 2027" },
  { term: "Dépense", def: "Engagée quand le devis est approuvé, réalisée quand la facture est rattachée ; jamais comptée deux fois. Tenue par la RAF.", example: "Prestation graphiste 1 800 €" },
  { term: "Enveloppe", def: "Le budget de dépenses directes validé pour l'édition (couche 2). La couverture compare l'obtenu des financeurs à cette enveloppe.", example: "Enveloppe 14 000 €, obtenu 13 300 € : couverture 95 %" },
  { term: "Code analytique", def: "La clé qui relie la comptabilité à l'outil : sur le projet et sur chaque ligne de financement. C'est par lui que le réalisé comptable se rapprochera des éditions.", example: "MOI-01, FSE-26" },
];
