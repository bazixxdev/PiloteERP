// Guide de l'outil (lot C, refait le 26/09 à la demande de Gaël) : chaque mot expliqué une fois pour toutes, rangé par
// chapitre, avec l'endroit où on le trouve. Seule source : la page /aide (bouton Aide de la barre latérale) l'affiche.
// Les mots qui changent d'un client à l'autre (lot I) viennent de lib/vocab.ts : « pôle » ici, « équipe » chez TLST ; « année » partout depuis le 26/09.
// Attention au test d'habillage TLST : aucune chaîne ne doit contenir « dition » (donc pas de « conditionné »).
import { V, cap, le, un, du, de, au, pl, ppe } from "@/lib/vocab";
import type { InstanceModuleKey } from "@/lib/modules";

export type LexiqueEntry = {
  term: string;
  def: string;
  where?: string; // où le trouver dans l'outil
  example?: string;
  module?: InstanceModuleKey; // affiché seulement si le module est actif sur l'instance
};

export type LexiqueChapter = { id: string; title: string; intro: string; entries: LexiqueEntry[] };

export function lexique(): LexiqueChapter[] {
  const teamClash = V.pole.one === "équipe"; // chez TLST, « équipe » désigne déjà le grand domaine
  return [
    {
      id: "structure",
      title: `Comment un ${V.projet.one} est construit`,
      intro: `Trois niveaux emboîtés : le ${V.projet.one} (ce qui dure), ${le(V.edition)} (le ${V.projet.one} sur une année précise, une page par an), ${pl(V.action)} (ce qu'on fait dans l'année).`,
      entries: [
        { term: cap(V.projet), def: `Ce qui dure d'une année sur l'autre : un nom, ${un(V.pole)} principal, ${un(V.pilote)}, un garant, un code analytique, une raison d'être. On n'y travaille pas directement : sa fiche sert de sommaire à ses ${pl(V.edition)} et récapitule ses financements.`, where: `Projets › Projets`, example: "« Mois de l'ESS » (MOI-01)" },
        { term: cap(V.edition), def: `Le ${V.projet.one} pour une année donnée : il y en a une par an. C'est là qu'on travaille : la fiche, ${pl(V.action)}, le budget, les financements, l'équipe, le temps, les documents. Elle n'a pas de nom propre, elle porte celui du ${V.projet.one} et son année.`, where: `Sur la fiche du ${V.projet.one}, cliquer sur l'année`, example: "« Mois de l'ESS 2026 »" },
        { term: cap(V.action), def: `Un morceau de travail daté dans ${le(V.edition)} : un nom, un responsable, un jalon, un état (à faire, en cours, fait) et un objectif d'heures. Elle peut aussi porter un contenu, un lieu, des participants, être rattachée à une ligne de financement ou publiée dans l'agenda du site. Cliquer sur son nom ouvre son détail.`, where: `${cap(V.edition)} › onglet ${cap(pl(V.action))}`, example: "« Soirée de lancement », « Publication du baromètre »" },
        { term: "Jalon", def: `La date ${du(V.action)}. Passée sans que ce soit fait, elle apparaît en retard (rouge) dans la frise, dans Ma semaine et sur l'écran café.`, where: `${cap(V.edition)} › onglet ${cap(pl(V.action))} › frise chronologique` },
        { term: "Tâche", def: `Une chose précise à faire par une personne, avec une case à cocher et une échéance. Elle peut se rattacher à un ${V.projet.one}, à ${un(V.action)} ou à un dossier de financement, ou rester personnelle. Une ${V.action.one} est un résultat attendu ; une tâche est un geste.`, where: "Mon travail › Tâches", example: "« Appeler la mairie pour la salle »" },
        { term: "Fiche", def: `Le document ${du(V.edition)}, en quatre couches remplies par des personnes différentes : 1. cadre stratégique (${le(V.direction)}), 2. cadre de moyens (${le(V.raf)} et ${le(V.direction)}), 3. proposition opérationnelle (${le(V.pilote)}), 4. validation (${le(V.codir)} puis le CA). S'y ajoutent la logistique et, en fin d'année, le bilan. Elle s'exporte en Word.`, where: `${cap(V.edition)} › onglet Fiche` },
        { term: `Statut ${du(V.edition)}`, def: "Proposée (la fiche se rédige), re-challengée (renvoyée pour être retravaillée), validée, en cours, bilan fait. Une fois la fiche validée, on ne la modifie plus directement : on propose une modification, qui est acceptée ou refusée.", where: `En-tête ${du(V.edition)}` },
        { term: "Réalisation", def: "Un fait noté au fil de l'année, avec une date et éventuellement un chiffre. On les note au moment où ça arrive ; le bilan les reprend.", where: `${cap(V.edition)} › onglet ${cap(pl(V.action))}`, example: "« 42 inscrits à l'atelier du 12 mars »" },
        { term: "Indicateur", def: "Une cible chiffrée fixée en rédigeant la fiche, et son réalisé mis à jour dans l'année. Coché « imposé » quand un financeur l'exige.", where: `${cap(V.edition)} › onglet ${cap(pl(V.action))}`, example: "Structures accompagnées : cible 5, réalisé 3" },
        { term: "Reconduire", def: `Créer ${le(V.edition)} de l'année suivante à partir de celle-ci. Sont recopiés : la fiche, ${pl(V.action)} (décalées d'un an), les lignes de financement (montants vidés) et l'équipe. Budget, temps et bilan repartent de zéro.`, where: `Menu « … » ${du(V.edition)}, ou Séminaire` },
        { term: "Démarrage avant notification", def: `Signale qu'on démarre ${le(V.edition)} sans attendre la réponse d'un financeur : on travaille, mais l'argent n'est pas encore acquis.`, where: `En-tête ${du(V.edition)}` },
        { term: "Récurrent, archivé", def: `Récurrent : le ${V.projet.one} revient chaque année, le séminaire propose de le reconduire. Archivé : le ${V.projet.one} sort de la liste courante, ses ${pl(V.edition)} restent lisibles.`, where: `Fiche du ${V.projet.one} › Identité` },
      ],
    },
    {
      id: "roles",
      title: "Qui porte quoi",
      intro: `Chaque ${V.projet.one} a une personne qui le fait avancer, une personne qui en répond, et des instances qui décident.`,
      entries: [
        { term: cap(ppe(V.pole, "principal")), def: `${cap(le(V.pole))} qui porte le ${V.projet.one}. Ses membres le voient dans leur périmètre ; son responsable en est le garant.`, where: `Fiche du ${V.projet.one} › Identité` },
        { term: cap(ppe(V.pole, "associé")), def: `${cap(un(V.pole))} de plus, quand le ${V.projet.one} est commun à plusieurs. Ses membres le voient aussi, son responsable y a les mêmes droits que le garant. Facultatif.`, where: `Fiche du ${V.projet.one} › Identité` },
        { term: cap(V.pilote), def: `La personne qui fait avancer le ${V.projet.one} : elle rédige la proposition (couche 3 de la fiche), tient ${pl(V.action)}, demande les validations, fait le bilan.`, where: `Fiche du ${V.projet.one} › Identité` },
        { term: "Garant", def: `Le responsable ${du(V.pole)} qui répond du ${V.projet.one}. Il ne fait pas à la place ${du(V.pilote)} : il valide au niveau 2 et tranche quand ${le(V.pilote)} fait lui-même une demande.`, where: `Fiche du ${V.projet.one} › Identité` },
        { term: "Sponsor", def: `Le membre ${du(V.codir)} qui soutient le ${V.projet.one} en instance. Facultatif.`, where: "Fiche › couche 2" },
        { term: `Équipe ${du(V.edition)}`, def: `Les personnes qui travaillent sur ${le(V.edition)} cette année, avec leurs jours prévus.${teamClash ? ` À ne pas confondre avec ${le(V.pole)} au sens du grand domaine : ici, ce sont des personnes.` : ""}`, where: `${cap(V.edition)} › onglet Fiche (équipe) et onglet Temps` },
        { term: cap(V.direction), def: `Écrit le cadre stratégique des fiches, valide au niveau 3, arbitre les alertes, administre l'outil avec ${le(V.raf)}.` },
        { term: cap(V.raf), def: "Tient l'argent : enveloppes, devis et factures, lignes de financement, versements, réalisé comptable. Administre l'outil." },
        { term: cap(V.codir), def: "L'instance qui décide : valide les fiches au séminaire, suit le portefeuille, règle les alertes par une décision datée.", where: `${cap(V.direction)} › Écran ${V.codir.one}` },
        { term: "CA", def: `Le conseil d'administration : dernier niveau de validation d'une fiche (couche 4). Ses décisions se consignent dans l'outil.` },
      ],
    },
    {
      id: "cadre",
      title: "Pourquoi on le fait : le cadre",
      intro: "Le plan stratégique dit où on va sur plusieurs années ; le plan opérationnel dit ce qu'on fait cette année pour y aller.",
      entries: [
        { term: "Plan stratégique, axe stratégique", def: `Le plan stratégique fixe les grandes orientations sur plusieurs années. L'axe stratégique dit à laquelle le ${V.projet.one} contribue : un champ libre sur le ${V.projet.one}, précisé chaque année dans la couche 1 de la fiche (« ambition, chantier du plan stratégique »).`, where: `Fiche du ${V.projet.one} › Identité ; Fiche › couche 1` },
        { term: "Raison d'être", def: `La grande mission à laquelle le ${V.projet.one} se rattache, choisie dans une liste tenue dans l'admin. Elle range les ${pl(V.projet)} et structure le plan opérationnel.`, where: `Fiche du ${V.projet.one} › Identité`, example: "« Accompagner la transition et les coopérations »" },
        { term: "Plan opérationnel", def: `Ce qu'on fait concrètement une année donnée : l'ensemble des fiches de l'année, rangées par ${V.pole.one} puis par raison d'être. L'outil l'assemble en un seul document Word, sans copier-coller.`, where: `Projets › Projets (bouton d'export) ou menu « … » ${du(V.edition)}` },
        { term: "Textes de rattachement", def: `Les politiques publiques auxquelles le ${V.projet.one} se rattache : stratégie régionale de l'ESS (SRESS), stratégie nationale (SNESS), autres textes. Utile pour les dossiers de financement.`, where: "Fiche › couche 1" },
        { term: "Séminaire", def: `Le rendez-vous annuel où ${le(V.codir)} décide, pour chaque ${V.projet.one} : reconduire, ajuster ou arrêter. L'outil crée ensuite les ${pl(V.edition)} de l'année suivante d'un coup et montre la charge de chacun.`, where: `${cap(V.direction)} › Séminaire` },
        { term: "Code analytique", def: `Le code comptable du ${V.projet.one}. Il relie la comptabilité à l'outil : c'est par lui que les dépenses et recettes enregistrées en compta retrouvent leur ${V.projet.one}. Une ligne de financement peut avoir le sien.`, where: `Fiche du ${V.projet.one} › Identité`, example: "MOI-01, FSE-26" },
      ],
    },
    {
      id: "recettes",
      title: "L'argent qui entre : financeurs et financements",
      intro: "Du repérage à l'encaissement : un appel à projets repéré devient un dossier ; le dossier obtenu se répartit en lignes de financement ; chaque ligne attend ses versements et doit ses livrables.",
      entries: [
        { term: "Financeur", def: "Une organisation qui paie : Région, État, Europe, fondation, collectivité… Ce n'est pas une liste à part : c'est un genre d'organisation de l'annuaire, et une même structure peut être financeur et partenaire.", where: "Annuaire › Organisations", example: "Région, ADEME, Fondation de France" },
        { term: "Dispositif", def: "Le nom du programme du financeur sous lequel on demande l'argent : l'appel, le fonds, la ligne budgétaire. Un même financeur a plusieurs dispositifs. Il se note sur l'appel, le dossier et la ligne de financement.", example: "Région → « Cap Asso » ; État → « FDVA » ; Europe → « FSE+ »" },
        { term: "Appel à projets", def: `Une occasion de financement repérée, avant toute décision : financeur, dispositif, date limite, montant visé. On la classe « à étudier », « on dépose » ou « écarté ». « Étudier » ouvre un dossier de financement.`, where: "Financements › Appels à projets", example: "AAP Transition écologique ADEME 2027", module: "veille" },
        { term: "Dossier de financement", def: "Une demande à un financeur, suivie de bout en bout : à étudier, réponse en cours (qui rédige, qui aide, sources, tâches, pièces), déposé, puis obtenu — ou refusé, écarté, avec le pourquoi. Il peut couvrir plusieurs années et plusieurs projets.", where: "Financements › Dossiers de financement", example: "AAP Transition écologique · ADEME · 42 000 € par an sur 2 ans" },
        { term: "Financement obtenu", def: `Un dossier gagné, sous sa forme réelle : convention, arrêté attributif, lettre de notification, contrat de mécénat, bon de commande, cotisation, ou sans formalisme. Il porte le montant notifié, sa répartition sur les ${pl(V.edition)} et ses versements.`, where: "Financements › Financements obtenus", example: "Fondation Terre d'Avenir · contrat de mécénat · 50 000 € sur 3 ans" },
        { term: "Ligne de financement", def: `Le cas courant : un financeur, sur un ${V.projet.one}, pour une année. Elle porte le dispositif, le montant demandé et obtenu, un statut, les livrables et les versements. Quand elle vient d'un dossier pluriannuel, c'est la part de ce dossier affectée à cette année-là.`, where: `${cap(V.edition)} › onglet Budget › Recettes et financeurs`, example: "Région → Mois de l'ESS 2026 : 20 000 €" },
        { term: "Statut d'un financement", def: "À déposer → déposé → notifié (le financeur a répondu oui) → conventionné (c'est signé) → justifié (les preuves ont été rendues)." },
        { term: "Demandé, notifié, obtenu, affecté", def: `Demandé : ce qu'on a sollicité. Notifié : ce que le financeur a accordé sur le dossier. Obtenu : la part accordée au ${V.projet.one} pour une année. Affecté : la part d'un dossier pluriannuel déjà répartie ; le reste est à répartir.` },
        { term: "Convention pluriannuelle", def: `L'exception : un accord qui couvre plusieurs années ou plusieurs ${pl(V.projet)}. Ses lignes de financement sont ses affectations, plafonnées au montant notifié ; ses versements sont des tranches.`, example: "FSE 2026-2028" },
        { term: "Financer plusieurs années", def: `Trois cas. 1. Le même financeur, redemandé chaque année : un dossier par année, chacun avec sa ligne sur ${le(V.edition)} concerné${V.edition.gender === "f" ? "e" : ""} ; en reconduisant, la ligne repart « à déposer ». 2. Un financeur qui accorde plusieurs années d'un coup : un seul dossier (par exemple 2026-2028), réparti en une ligne par année, jamais au-delà du montant notifié ; il reste rattaché quand on reconduit. 3. Un financeur différent selon l'année : chaque ${V.edition.one} a ses propres lignes. Plusieurs financeurs sur la même année, c'est plusieurs lignes.`, example: "ADEME 2026 puis Région 2027 ; ou ADEME 90 000 € sur 2026-2028, 30 000 € par an" },
        { term: "Versement", def:`L'argent attendu puis reçu (acompte, solde, tranche), sur une ligne ou sur un dossier. « Reçu » se coche à la main par ${le(V.raf)} ou ${le(V.direction)} ; un retard les prévient.`, example: "Acompte 50 % Région, solde après justificatifs" },
        { term: "Livrable", def: `Ce qu'on doit rendre au financeur, avec sa date : bilan, justificatifs, mentions. Rappels à l'avance ${au(V.pilote)} et ${au(V.raf)}.`, example: "Bilan intermédiaire FSE au 30/06" },
        { term: "Qui finance quoi", def: `Le tableau croisé de l'année : une ligne par ${V.projet.one}, une colonne par financeur, avec les ${pl(V.projet)} sans financement et les livrables en retard.`, where: "Financements › Qui finance quoi" },
      ],
    },
    {
      id: "depenses",
      title: "L'argent qui sort : budget et dépenses",
      intro: `Chaque ${V.projet.one} a, chaque année, un plafond de dépenses ; chaque dépense passe par un devis validé puis une facture, et l'outil calcule ce qui reste.`,
      entries: [
        { term: "Enveloppe", def: `Le plafond de dépenses directes ${du(V.edition)}. Deux montants portent ce nom : celui écrit dans la fiche (couche 2, « budget prévisionnel · dépenses directes » : ce qu'on prévoit ; c'est lui que montre la fiche du ${V.projet.one}) et l'« enveloppe validée » saisie par ${le(V.raf)} dans l'onglet Budget, qui sert aux calculs et aux alertes.`, where: `${cap(V.edition)} › onglet Budget`, example: "Enveloppe 8 000 € : alerte quand réalisé + engagé approche du plafond" },
        { term: "Budget prévisionnel", def: `Le détail du prévu par catégorie (personnel, achats, prestations, déplacements…), soumis puis validé, puis comparé au réalisé. Le personnel se calcule depuis le temps prévu.`, where: `${cap(V.edition)} › onglet Budget › Prévisionnel`, module: "budget" },
        { term: "Devis, facture", def: `Un devis validé compte comme engagé ; la facture rattachée le transforme en réalisé. Rien n'est compté deux fois.`, where: `${cap(V.edition)} › onglet Budget › Dépenses` },
        { term: "Engagé, réalisé, reste", def: "Réalisé : ce qui est facturé ou payé. Engagé : les devis validés pas encore facturés. Reste : enveloppe − réalisé − engagé.", example: "Enveloppe 8 000 €, devis validé 1 000 € : reste 7 000 €" },
        { term: "Réalisé comptable", def: "Les charges et produits lus dans le grand livre de la comptabilité, rapprochés par le code analytique.", where: `${cap(V.edition)} › onglet Budget › Réalisé comptable` },
        { term: "Validation", def: `Une demande d'accord avant de dépenser ou d'engager (devis, achat…). Trois niveaux selon le montant et l'enveloppe restante : 1 ${le(V.pilote)}, 2 le garant, 3 ${le(V.direction)}. On ne valide jamais sa propre demande.`, where: `Bouton « Demander une validation » ${du(V.edition)} ; Demandes` },
        { term: "Demande", def: "Un besoin adressé à quelqu'un de la maison : retour sur le site, chiffres, salle à réserver… Les validations arrivent au même endroit.", where: "Demandes" },
      ],
    },
    {
      id: "temps",
      title: "Le temps",
      intro: "On prévoit des jours, on saisit des heures, on compare.",
      entries: [
        { term: "Jours vendus, prévus, disponibles", def: "Vendus : les jours écrits dans les conventions des financeurs. Prévus : la charge de travail qu'on s'attend à y passer. Disponibles : les jours de travail de la personne sur l'année, congés déduits.", where: `${cap(V.edition)} › onglet Temps` },
        { term: "Plan de charge", def: "Les jours prévus de chaque personne, mois par mois, face à ce qu'elle peut faire. Montre les mois en dépassement. Figé au séminaire, il reste modifiable mais les changements sont signalés.", where: "Projets › Plan de charge" },
        { term: "Ma répartition", def: `La saisie de son temps : les heures passées sur chaque ${V.projet.one} et ${V.action.one}, plus le temps hors ${pl(V.projet)} (fonctionnement, réunions, congés) sous des codes de temps.`, where: "Temps › Ma répartition" },
        { term: "Rythme", def: "Les heures de travail attendues de la personne, jour par jour, semaine paire et impaire. Sert à calculer ce qu'elle doit saisir et sa capacité.", where: "Admin › Personnes" },
        { term: "Clôture mensuelle", def: "Le verrou d'un mois une fois le temps vérifié : on ne peut plus y modifier les heures.", where: "Temps › Clôture mensuelle" },
      ],
    },
    {
      id: "suivi",
      title: "Suivre et décider",
      intro: "Les écrans de lecture et les rendez-vous qui s'en servent.",
      entries: [
        { term: "Portefeuille, Mes projets", def: `Le tableau des ${pl(V.projet)} de l'année : statut, prochain jalon, enveloppe consommée, temps, alertes. « Mes projets » pour chacun, « Portefeuille » pour ${le(V.codir)}.`, where: "Projets › Portefeuille" },
        { term: "Vue annuelle", def: `Personnes × mois : qui porte quels jalons, et les jours vendus face aux jours disponibles. Sert en réunion ${de(V.pole)}.`, where: "Projets › Vue annuelle" },
        { term: `Écran ${V.codir.one}, écran café`, def: `Écrans à projeter. ${cap(le(V.codir))} : alertes et validations en attente, décisions. Café : la quinzaine à venir, les retards, qui attend quoi de qui.`, where: cap(V.direction) },
        { term: "Alerte", def: `Un signal calculé sur ${le(V.edition)} d'un ${V.projet.one} : enveloppe presque consommée, livrable proche ou en retard, versement en retard, jalon ou temps dépassé, validation en attente… Une décision d'instance peut la régler ; elle s'éteint alors avec la référence de la décision.`, where: `En-tête ${du(V.edition)}, Portefeuille` },
        { term: "Décision", def: `Ce qu'une instance a tranché (${V.codir.one}, réunion ${de(V.pole)}, revue trimestrielle, bureau ou CA), daté et rattaché ${au(V.edition)}.` },
        { term: "Fil", def: `La discussion ${du(V.edition)} : des messages datés à l'équipe projet.`, where: `Bouton « Fil » ${du(V.edition)}` },
        { term: "Échéances, notifications", def: "Échéances : ce qui arrive (livrables, versements, jalons), avec rappels avant la date. Notifications : ce qui vous a été adressé.", where: "Échéances" },
        { term: "Ma semaine", def: "Sa page d'accueil : ses jalons, tâches, demandes et échéances des jours qui viennent.", where: "Mon travail › Ma semaine" },
        { term: "Délégation", def: `Ce que ${le(V.direction)} confie à une personne sur un ${V.projet.one}, pour l'année, écrit noir sur blanc : les attendus (ce qu'on attend d'elle), les limites (ce qu'elle peut décider seule, jusqu'où) et les contrôles (comment on fait le point). La personne en prend connaissance en un clic, ce qui est redemandé à chaque modification ; la délégation est présentée au CA. La vue reprend ${pl(V.action)}, indicateurs et livrables de la personne, filtrés par période.`, where: "Mon travail › Ma délégation", example: "« Délégation totale sur les ateliers, dans la limite de 500 € par achat ; point mensuel avec la coordination »", module: "delegation" },
        { term: "Point de contrôle", def: `${cap(un(V.action))} marquée comme rendez-vous de contrôle d'une délégation : bilan intermédiaire, planning de dépenses à rendre.`, where: `Détail ${du(V.action)}`, module: "delegation" },
      ],
    },
    {
      id: "annuaire",
      title: "Annuaire et relations",
      intro: "Un seul annuaire pour les structures, un seul pour les personnes extérieures.",
      entries: [
        { term: "Organisation", def: `Toute structure avec laquelle ${le(V.org)} travaille. Elle a un ou plusieurs genres : financeur, fournisseur, partenaire, réseau, collectivité, adhérent.`, where: "Annuaire › Organisations", example: "La Région : financeur et collectivité" },
        { term: "Partenaire", def: `Une organisation liée à un ${V.projet.one} pour ce qu'elle y fait (co-organise, accueille, intervient). Un partenaire n'est pas forcément un financeur.`, where: "Fiche › partenaires" },
        { term: "Contact", def: "Une personne extérieure : interlocuteur d'un financeur, invité, membre d'un réseau. Avec ou sans organisation, avec des mots-clés.", where: "Annuaire › Contacts" },
        { term: "Liste de contacts", def: `Une sélection de contacts faite par quelqu'un (invités d'un événement, réseau thématique), avec ses propres colonnes, une visibilité, éventuellement un ${V.projet.one}. Import de fichier, export CSV, envoi vers Brevo.`, where: "Annuaire › Contacts" },
        { term: "Liste de base", def: "Une liste calculée par genre d'organisation (les interlocuteurs des financeurs, des partenaires…). On ne l'alimente pas à la main : on rattache le contact à son organisation.", where: "Annuaire › Contacts" },
        { term: "Liste Brevo", def: "Une liste de l'outil d'emailing Brevo, suivie en lecture dans Contacts. Les désinscrits sont marqués et jamais renvoyés.", where: "Annuaire › Contacts" },
        { term: "Adhérent, adhésion", def: `Un adhérent est une structure ou une personne qui adhère ${au(V.org)}. L'adhésion est son engagement pour une année : collège, cotisation, statut (à régler, réglée, exonérée, annulée). « À jour » = réglée ou exonérée.`, where: "Adhérents", example: "Coop'Alim Berry · 2026 · Coopératives · 180 € · réglée", module: "adherents" },
        { term: "Collège, cotisation", def: "Le collège est la famille de l'adhérent (associations, coopératives, mutuelles…), qui fixe souvent sa cotisation. La cotisation est le montant dû pour l'année ; HelloAsso peut l'enregistrer automatiquement.", where: "Adhérents › Cotisations", module: "adherents" },
      ],
    },
    {
      id: "outils",
      title: "Autres outils",
      intro: "Ce qui sert au quotidien, en dehors du pilotage lui-même.",
      entries: [
        { term: "Documents", def: `Les fichiers joints ${au(V.edition)} et les liens vers le NAS, Teams ou OneNote. Le chemin du dossier sur le serveur est proposé automatiquement.`, where: `${cap(V.edition)} › onglet Documents` },
        { term: "Notes", def: `Notes de réunion, rattachées à un ${V.projet.one} ou transverses ; privées par défaut, partageables.`, where: "Mon travail › Notes" },
        { term: "Plan de trésorerie", def: "Douze mois à partir du solde en banque : versements attendus, factures, cotisations, dépenses régulières (salaires, loyer). Montre le point bas et le seuil d'alerte.", where: "Trésorerie", module: "tresorerie" },
        { term: "Prêt de matériel", def: `Un matériel de l'inventaire sorti chez quelqu'un (équipe, contact, organisation), pour un ${V.projet.one} ou non, avec une date de retour.`, where: "Prêts", example: "Kakemono × 2 · pour le forum · retour le 22 septembre", module: "materiel" },
      ],
    },
  ];
}
