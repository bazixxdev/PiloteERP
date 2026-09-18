# Cahier des charges — Module Trésorerie (ERP Tiers-Lieu Sud Touraine)

## 1. Objectif

Le module répond à une seule question, celle qui compte pour une asso qui vit sur des versements décalés : ai-je assez de cash, et jusqu'à quand. Le solde réel vient en direct de Pennylane. Le prévisionnel se construit surtout à partir de ce que l'ERP contient déjà — versements d'AAP attendus, masse salariale — plus une poignée de charges saisies. La vue remplace le tableur figé par un suivi qui se met à jour tout seul, et reste beaucoup plus simple que les outils de pilotage financier type finthesis, dont on ne garde que la courbe de trésorerie et les scénarios.

## 2. Principes directeurs

Cinq invariants tiennent tout le module. Chaque choix de conception en découle.

**Pennylane est la source unique du réel.** Le compte Crédit Agricole étant déjà synchronisé dans Pennylane, on lit un solde de trésorerie consolidé, tous comptes rattachés confondus. L'ERP ne gère pas de comptes bancaires, ne réplique pas la structure bancaire, ne neutralise aucun virement interne — Pennylane l'a déjà fait.

**Le solde est juste indépendamment du rapprochement.** Le solde consolidé vient de Pennylane, il est exact par construction, qu'on ait rangé les flux ou non. Le rapprochement ne sert qu'à répondre à « ce qui est tombé correspond-il à ce que j'avais prévu ». Conséquence pratique : le module reste utilisable même à moitié rangé, sans pression de maniaquerie.

**Le prévisionnel se branche sur les modules existants.** La trésorerie n'est pas un huitième silo. Elle met en mouvement dans le temps ce que Financements, Actions et RH décrivent déjà, et ne demande à saisir que ce qu'aucun module ne connaît.

**L'horizon glisse tout seul.** Douze mois en avant, en continu : chaque mois qui passe repousse la fenêtre d'un mois et le nouveau mois hérite automatiquement des flux durables actifs et des versements prévus à cette date. Aucune ressaisie mensuelle.

**Le passé est réel, le futur est prévu, le mois en cours est un mélange à réconcilier.** Le solde de départ de la projection est toujours le solde réel Pennylane du jour ; la partie passée de la courbe est câblée sur le vrai et ne dérive pas.

## 3. Périmètre

Dans le périmètre : solde consolidé live depuis Pennylane ; projection du solde à douze mois glissants ; flux fixes, récurrents variables et ponctuels ; agrégation automatique des versements d'AAP et de la masse salariale ; catégorisation des mouvements ; rapprochement prévu/réel ; scénarios comparables ; alerte de point bas ; comparatif réel vs prévu.

Hors périmètre : tout ce qui est comptable (compte de résultat, bilan, résultat) reste dans Pennylane ; pas de gestion des comptes bancaires dans l'ERP ; pas de visuels configurables à l'infini ; pas de reconnaissance sémantique par IA en V1.

## 4. Source de vérité : Pennylane

Le module lit trois choses de Pennylane : le solde de trésorerie consolidé du jour, les mouvements bancaires (date, libellé, montant, sens), et la classification que le cabinet a déjà posée sur ces mouvements à la comptabilisation — le compte comptable de contrepartie, la catégorie de trésorerie éventuelle, et le tag analytique. Le solde alimente le point de départ de la courbe ; les mouvements et leur classification alimentent le réalisé, la catégorisation et le rapprochement, sans re-tri manuel.

L'API v2 expose ces données. Le scope **« Transactions & Bank accounts »**, ajouté par Pennylane en 2025, donne accès aux comptes bancaires (avec leur solde et le compte comptable associé en 512) et aux transactions bancaires. Le solde consolidé se calcule en sommant les soldes des comptes bancaires rattachés — le Crédit Agricole et le compte pro apparaissant tous deux, la somme est le solde de trésorerie global, sans neutralisation à faire. Les mouvements viennent de l'endpoint des transactions. La balance générale (comptes de classe 5) sert de contrôle croisé du même solde. La classification déjà posée par le cabinet — compte de contrepartie, tag analytique — se lit dans le grand livre, celui-là même que le client Pennylane existant exporte déjà pour le réalisé des fiches AAP : une source, deux usages. Ce client est donc à étendre de la lecture des comptes et des transactions. Nuance de fraîcheur assumée : le solde et les mouvements bruts sont live, tandis que leur ventilation par catégorie suit le rythme de comptabilisation du cabinet — normal, et acceptable pour du pilotage. Prérequis côté compte : le token API doit inclure le scope « Transactions & Bank accounts » en plus du scope ledger déjà utilisé — à activer dans les réglages Pennylane, sous réserve que le plan l'autorise.

Mode dégradé : sans accès Pennylane configuré, le module ne casse pas. Il affiche un état explicite, la projection fonctionne sur les seuls flux prévus saisis et dérivés des modules, et le solde de départ peut être renseigné manuellement en attendant. C'est le même principe de dégradation que les briques HelloAsso et Pennylane réalisé.

## 5. Le modèle de flux

Un flux prévu porte une nature, qui décrit son degré de certitude — distinct de sa périodicité. Trois natures, tirées directement de ton plan de trésorerie.

**Fixe** — même montant, même échéance, quasi certain. URSSAF, mutuelle, assurances, télécom, prélèvement à la source, prestation informatique à montant contractuel. On le connaît au centime, il se reconduit tel quel, on n'y touche jamais.

**Récurrent variable** — ça tombe chaque mois mais le montant bouge. Autres prestataires et dépenses d'actions, achats et restauration, déplacements, expertise comptable. Le montant projeté est une estimation, pas une certitude : moyenne des derniers mois ou dernier réalisé. L'outil le marque comme estimé et te laisse le corriger sans casser la règle.

**Ponctuel** — une date, un montant précis. Versement d'AAP, travaux, achat exceptionnel. Posé à sa date, sans reconduction.

### Début et fin

Les flux durables — fixes et récurrents variables — portent une date de début obligatoire et une date de fin optionnelle. La fenêtre glissante ne projette chaque flux que sur les mois compris dans cet intervalle. Trois cas couverts par le même champ :

- en cours sans fin connue (assurances, prestation informatique) : début renseigné, fin vide, reconduction indéfinie tant qu'on ne clôture pas ;
- fin à date connue (abonnement résilié, prêt qui se termine, prestation bornée) : la fin est posée, le flux disparaît de la projection après ;
- début dans le futur (loyer qui démarre à l'ouverture du lieu, charge liée à une embauche) : le flux n'apparaît qu'à partir de sa date de début, ce qui permet de projeter proprement l'effet d'un changement à venir.

Le ponctuel n'a pas besoin d'intervalle : il a déjà sa date unique.

### D'où vient chaque flux

Chaque flux prévu a une source, qui détermine s'il est saisi ou dérivé d'un autre module :

- **Solde et flux réels passés** : Pennylane.
- **Encaissements de subventions** (ponctuels) : module Financements, les `Versement` attendus des fiches AAP, avec leur date et leur montant prévus.
- **Masse salariale** (fixe, avec fin) : module RH, les contrats en cours et leur coût chargé mensuel. La fin d'un CDD étant portée par le contrat, le salaire projeté s'arrête tout seul à la fin du contrat — la masse salariale prévisionnelle décroît d'elle-même quand un CDD n'est pas renouvelé.
- **Dépenses d'actions** (à terme) : module Actions, le budget prévi alloué des `ActionAap`, quand une action est datée.
- **Charges récurrentes** (fixes ou variables) que ces modules ne connaissent pas : saisies dans le module, ou initialisées depuis la moyenne mensuelle Pennylane au démarrage.
- **Ponctuels divers** (travaux, achats) : saisis à la main.

## 6. Les catégories

Les catégories sont les tiennes, tirées du plan de trésorerie réel, pas réinventées.

Encaissements : prestations, ventes et produits d'activité ; subventions et financements reçus (déclinés par financeur via les versements d'AAP) ; remboursements et avoirs ; autres encaissements et apports.

Décaissements : salaires nets ; cotisations URSSAF ; mutuelle santé ; prélèvement à la source et impôts ; retraite et prévoyance ; assurances ; électricité ; télécommunications ; expertise comptable ; prestations informatiques ; médecine du travail et frais de personnel ; travaux et investissements ; autres prestataires et dépenses d'actions ; déplacements et notes de frais ; communication, logiciels et abonnements ; achats, fournitures, restauration et événementiel ; frais bancaires et divers.

La liste est modifiable : on peut ajouter, renommer, désactiver une catégorie sans toucher au code.

## 7. La fenêtre glissante

L'horizon est de douze mois glissants, cohérent avec des subventions annuelles. Il avance automatiquement : à chaque changement de mois, la fenêtre se décale et le mois entrant reçoit les occurrences de tous les flux durables actifs sur cet intervalle, plus les ponctuels posés à cette date.

La vue ne démarre pas au jour J. Elle remonte au moins au premier janvier de l'exercice en cours pour afficher le réel des mois déjà passés — de janvier à aujourd'hui, lus de Pennylane. La courbe est donc continue : le réalisé depuis le début de l'année, puis la projection sur les douze mois à venir. Cet historique sert à trois choses : voir d'où l'on vient, calculer les moyennes des récurrents variables sur des mois réels plutôt qu'à vide, et alimenter le contrôle réel contre prévu du §14.

La projection se calcule mois par mois. Solde de départ égale le solde réel consolidé Pennylane du jour. Puis, pour chaque mois : plus les encaissements attendus, moins les décaissements attendus, égale le solde de fin de mois projeté, qui devient le solde d'ouverture du mois suivant.

### Socle certain et zone estimée

La courbe distingue deux niveaux. Le socle certain agrège les soldes réels, les flux fixes et les versements confirmés — ce qui ne bougera pas ou peu. La zone estimée ajoute les récurrents variables, marqués comme incertains. Pour une asso qui joue son point bas à quelques milliers d'euros près, savoir si le creux de juillet est certain ou estimé change la décision. La vue rend cette incertitude visible plutôt que de la masquer derrière un trait unique.

### Recalcul automatique des variables (option)

Par catégorie, on peut activer un recalcul automatique du montant des récurrents variables : au lieu d'une moyenne figée une fois, le flux reprend chaque mois la moyenne glissante des derniers mois réels lus dans Pennylane. La projection s'affine alors d'elle-même à mesure que les mois tombent, sans retouche manuelle. Option, pas défaut.

## 8. Réel, prévu et mois en cours

Chaque mois a un statut. Les mois clos sont réels : on lit Pennylane, le prévu ne sert plus qu'à mesurer l'écart. Les mois futurs sont prévus. Le mois en cours est partiel, et c'est là que tout se joue.

Pour le mois en cours, chaque catégorie affiche trois chiffres au lieu d'un : le prévu (ce qui était posé), le réalisé (ce que Pennylane a vu tomber à ce jour) et le reste attendu (prévu moins réalisé, ce qui doit encore arriver d'ici la fin du mois). La courbe du mois en cours combine le réel déjà encaissé et le reste attendu, donc elle vit en direct : chaque encaissement qui tombe fait reculer le reste attendu et confirme le solde d'autant.

### Le report des attendus non réalisés

Un encaissement attendu qui ne tombe pas ne s'évapore pas quand le mois se clôt. Il se reporte au mois suivant, en flux prévu résiduel, tant qu'on ne l'a pas annulé. C'est le piège du tableur figé — un revenu prévu qui ne vient pas fausse tout si on l'oublie. Ici il reste visible, en retard, jusqu'à résolution.

Trois issues quand un versement prévu se confronte au réel :
- il tombe comme prévu : le flux passe réalisé au montant prévu, écart nul ;
- il tombe partiellement (par exemple 6 k au lieu de 10 k) : le flux passe réalisé à 6 k, et l'outil demande si le reste est encore attendu (il glisse au mois suivant) ou s'il est acté comme perdu (l'écart se clôture) ;
- il ne tombe pas : le flux reste attendu et non réalisé, reporté au mois suivant.

Le même mécanisme vaut pour les décaissements : un salaire réellement débité, une charge estimée à 300 qui sort à 350, le réel remplace le prévu et l'écart se lit.

## 9. Le rapprochement

Il faut distinguer deux choses qu'on confondait au départ, et c'est ce qui rendait le rapprochement trop lourd. Ranger un mouvement dans une catégorie — est-ce une assurance, un salaire — c'est la catégorisation, traitée au §10, et automatique parce que Pennylane l'a déjà faite. Rattacher un encaissement réel au flux prévu qu'il vient solder — le versement d'AAP que j'attendais — c'est le rapprochement, l'objet de cette section, et beaucoup plus léger qu'un tri ligne par ligne.

Le tag analytique fait l'essentiel du travail. Un encaissement tagué « O2R » se rattache au versement O2R attendu par son code analytique, pas en devinant au montant — la même clé que pour le réalisé des fiches. Restent à traiter à la main les cas où le tag manque, où le versement arrive fractionné ou groupé : un petit nombre, pas chaque ligne. L'outil propose ces appariements probables plutôt que de les appliquer d'office, et ce qui n'est pas rattaché reste visible des deux côtés, jamais perdu en silence.

### Rapprochement partiel et plusieurs-à-plusieurs

Un flux prévu n'est pas « soldé ou pas », il se remplit au fur et à mesure. Un acompte de 4 k tombe, on le rattache, le prévu passe à « 4 k réalisés, 6 k attendus » ; le solde de 6 k arrive plus tard, on complète. Un flux prévu peut donc être rapproché à plusieurs mouvements Pennylane, et un gros mouvement Pennylane peut se ventiler sur plusieurs flux prévus. C'est du plusieurs-à-plusieurs avec un montant affecté par lien, pas un appariement un pour un — et c'est précisément ce qui manque aux tableurs.

Un flux prévu porte donc un statut : prévu, réalisé, partiel, en retard.

## 10. La catégorisation

La catégorie d'un mouvement n'est pas à deviner : Pennylane l'a déjà. À la comptabilisation, le cabinet affecte chaque mouvement à un compte de contrepartie — le 616 pour une assurance, le 626 pour du télécom, le 641 pour un salaire — et pose le cas échéant une catégorie de trésorerie et un tag analytique. Le module lit cette classification au lieu de la refaire. C'est la correction du premier jet, où chaque ligne se qualifiait à la main.

Concrètement, une table de correspondance traduit le rangement Pennylane en catégories de l'ERP, posée une seule fois et calée avec 03 EXPERT. Elle accepte deux sources, au choix : le compte de contrepartie (le 616 vers Assurances, le 626 vers Télécommunications) et, si tu préfères piloter par tes tags, un groupe de tags Pennylane « type de dépense » vers les catégories de l'app. La correspondance autorise le regroupement — plusieurs comptes ou plusieurs tags Pennylane vers une même catégorie de l'ERP — pour que ta nomenclature reste simple sans épouser le plan comptable. Pour t'éviter de la construire à blanc, l'app découvre les comptes et les tags réellement présents dans tes écritures et te propose une correspondance de départ, que tu valides ou ajustes en un seul passage ; un compte ou un tag nouveau qui apparaît est signalé avec une correspondance suggérée. Le tag projet, lui, donne l'AAP. Aucune qualification au quotidien.

La seule exception, honnête : un mouvement récent que le cabinet n'a pas encore comptabilisé n'a ni compte de contrepartie ni catégorie. Celui-là attend la compta, ou se range à la main si tu veux le voir tout de suite — un résiduel petit et récent, pas la masse. Des règles de libellé simples (un libellé contenant « URSSAF » vers cotisations) peuvent dégrossir ce résiduel en complément, jamais à la place du compte comptable, qui ne se trompe pas là où un libellé bancaire obscur, si.

### Les suggestions in-app

L'app apporte une aide à la décision, toujours sous forme de proposition validée d'un clic, jamais d'application silencieuse. Quatre endroits où elle intervient : proposer la correspondance de départ entre tes comptes ou tags Pennylane et les catégories de l'ERP ; deviner la catégorie d'un mouvement récent non encore comptabilisé à partir de son libellé ; proposer le rattachement probable d'un encaissement à un versement d'AAP attendu quand le tag ne tranche pas ; repérer un paiement qui revient chaque mois et suggérer d'en faire un flux récurrent.

Ces suggestions restent des propositions. Rien ne modifie ta trésorerie ni ta compta sans ton accord, et le solde reste juste sans elles. Le socle de la catégorisation demeure le rangement comptable ; l'IA ne fait que dégrossir ce qui n'est pas encore rangé et proposer les rapprochements ambigus, là où tu passais du temps à la main.

## 11. Le branchement aux modules

La trésorerie lit les autres modules plutôt que de ressaisir.

**Financements** : les `Versement` attendus des fiches AAP sont les encaissements ponctuels de subventions. La trésorerie les pose sur la courbe à leur date prévue. FSE, Fondation de France, ADEME, DREETS, État tombent tout seuls.

**RH** : les contrats et leur coût chargé mensuel alimentent la masse salariale, avec l'arrêt automatique en fin de contrat.

**Actions** : à terme, le budget prévi des `ActionAap` datées alimente les décaissements « dépenses d'actions ».

### La règle prévu/réel entre fiche AAP et Pennylane

Deux modules peuvent dire « l'argent est arrivé » : le versement marqué reçu dans la fiche AAP, et le rapprochement Pennylane. Ils ne doivent pas se contredire. Règle retenue : **Pennylane fait foi pour le cash** — l'argent est réellement là ou pas. Le rapprochement d'un mouvement Pennylane à un versement d'AAP met à jour le statut de ce versement dans la fiche du même coup. On range une fois, les deux modules sont d'accord, et la fiche AAP se tient à jour d'elle-même.

### Le code analytique, clé de jointure

La fiche AAP porte son `codeAnalytique`, le tag Pennylane le porte aussi. C'est cette clé, pas le montant, qui permet de rapprocher un encaissement Pennylane au bon versement du bon AAP. Le pont Pennylane spécifié pour le réalisé sert donc aussi à la trésorerie — même jointure, deux usages.

## 12. Les scénarios

Un scénario est le prévisionnel de base plus des ajustements : désactiver un versement d'AAP, décaler une date, modifier un montant, ajouter une embauche ou une charge. Deux courbes se comparent, le nouveau point bas s'affiche. Cas concrets tirés de ta réalité : « et si le FSE d'août glisse de deux mois », « et si l'ADEME est refusé », « et si on embauche en septembre ». Ton besoin maximum réel — de l'ordre de −19 k fin juillet, avant le versement FSE de début août — est exactement ce que cette vue doit rendre visible d'un coup d'œil.

Les scénarios sont dupliquables et nommables. Le scénario de base reste intact ; un scénario n'écrase jamais les flux réels.

## 13. Les alertes

Un seuil de sécurité paramétrable. La vue signale chaque mois où le solde projeté passe sous le seuil — ton indicateur « BESOIN ». C'est le seul vrai automatisme du module, et le plus important pour une asso qui vit sur des versements décalés. L'alerte tient compte du socle certain et de la zone estimée : un point bas certain n'a pas le même poids qu'un point bas qui dépend d'une estimation.

## 14. Réel contre prévu

Sur les mois clos, le solde réel consolidé Pennylane doit coller au projeté, comme ton contrôle janvier-juin à écart zéro. Un écart par catégorie signale une estimation à réajuster — un poste variable systématiquement sous-évalué, un versement toujours en retard d'un mois. Cet apprentissage affine les projections des mois suivants, surtout quand le recalcul automatique des variables est activé.

## 15. Les écrans

**Page trésorerie.** La grande courbe du solde projeté, avec le socle certain et la zone estimée distingués, et le scénario superposé au scénario de base. Des barres de flux net mensuel. Un choix mensuel ou journalier. Un bandeau d'alerte « point bas : X € en mois Y ». Un sélecteur de scénario. Lisible par le bureau, sans formation.

**Tableau des flux.** Par mois et par catégorie, ton plan de trésorerie mais vivant, avec les trois chiffres prévu / réalisé / reste sur le mois en cours et les mois à venir.

**Écran de rapprochement et catégorisation.** Les mouvements Pennylane non affectés d'un côté, les flux prévus en attente de l'autre, les suggestions d'appariement à confirmer, le rattachement partiel, et la catégorisation par règles avec correction manuelle. C'est le « rangement ».

**Réglages.** Le seuil de sécurité, les catégories, les flux récurrents et leurs dates de début et de fin, l'activation du recalcul automatique par catégorie, les règles de catégorisation.

## 16. Modèle de données (esquisse)

Le brief technique figera le schéma ; voici les entités et leurs champs structurants.

**Solde consolidé** : un instantané lu de Pennylane — date, montant — rafraîchi à chaque synchro, calculé comme la somme des soldes des comptes bancaires rattachés. Pas de gestion de comptes dans l'ERP.

**Règle de flux récurrent** : libellé, sens, nature (fixe ou récurrent variable), catégorie, montant de base, périodicité, date de début, date de fin optionnelle, source (saisi, masse salariale, dépense d'action), recalcul automatique oui/non.

**Flux prévu (occurrence)** : rattaché ou non à une règle, mois concerné, catégorie, sens, montant prévu, montant réalisé, statut (prévu, réalisé, partiel, en retard), estimé oui/non, source, référence à l'objet d'origine (versement d'AAP, contrat, action).

**Mouvement réel** : lu des transactions bancaires Pennylane — date, libellé, montant, sens. Enrichi de la classification déjà posée par le cabinet : compte comptable de contrepartie, catégorie de trésorerie Pennylane éventuelle, tag analytique. La catégorie de trésorerie de l'ERP s'en déduit par la table de correspondance ci-dessous ; l'AAP par le tag.

**Rapprochement** : lien plusieurs-à-plusieurs entre flux prévu et mouvement réel, avec le montant affecté par lien.

**Catégorie de flux** : nom, sens, nature par défaut, active oui/non.

**Correspondance de rangement vers catégorie** : la table qui traduit le rangement Pennylane — compte de contrepartie et/ou tag « type de dépense » — en catégorie de trésorerie de l'ERP, avec regroupement possible (plusieurs comptes ou tags vers une catégorie). Posée une fois avec 03 EXPERT, enrichie des correspondances découvertes automatiquement et validées. C'est le cœur de la catégorisation.

**Règle de libellé (résiduel)** : motif de libellé vers catégorie, en complément, seulement pour les mouvements non encore comptabilisés qui n'ont pas de compte de contrepartie. Les suggestions IA s'appliquent sur ce même résiduel.

**Scénario** : nom, plus une liste d'ajustements (désactiver un flux, décaler une date, modifier un montant, ajouter un flux).

**Seuil de sécurité** : montant paramétrable.

## 17. Robustesse

Le module ne casse jamais. Sans Pennylane, il tourne en mode dégradé sur les flux prévus. Sans rapprochement, le solde reste juste. Sans catégorisation, les flux existent, non rangés. Chaque brique manquante dégrade une lecture, jamais l'ensemble. C'est ce qui rend le module adoptable progressivement, comme les autres.

## 18. Hors périmètre et plus tard

L'aide IA entre en V1, mais uniquement comme suggestions validées (§10) — jamais d'automatisme sur ta compta. Restent dehors, à décider ensuite : l'export du plan de trésorerie pour le bureau ; la trésorerie par action ou par axe, une fois les actions datées ; les notifications actives quand un point bas franchit le seuil ; un apprentissage des suggestions à partir de tes validations passées.

## 19. Points techniques

La principale inconnue est levée : l'API Pennylane expose bien les comptes bancaires avec leurs soldes et les transactions, via le scope « Transactions & Bank accounts » (voir §4). Le solde consolidé se lit en sommant les soldes des comptes ; les mouvements viennent de l'endpoint des transactions ; la balance générale (classe 5) sert de contrôle. Restent à caler au moment du brief, sans blocage de conception : le chemin exact des endpoints (à confirmer sur le `llms.txt` de la doc Pennylane), la vérification que le plan du compte autorise ce scope, la fréquence de synchro (à la demande, quotidienne, mensuelle), et le rythme de matérialisation des occurrences de la fenêtre glissante (calcul à la volée ou stockage).

## 20. Séquençage de construction

Trois lots, testables à chaque fin de lot, alignés sur ce que Claude Code a proposé sur le repo :

1. **Socle flux et projection, entièrement en mode dégradé** — schéma et migration, seed des catégories du §6, permissions `tresorerie.*`, moteur de projection (fenêtre glissante, socle certain contre zone estimée, point bas), navigation et page `/tresorerie` (courbe, barres de flux net, bandeau d'alerte, tableau des flux prévu/réalisé/reste), réglages (seuil, catégories, flux récurrents et dates), solde de départ saisi à la main. Utilisable seul.
2. **Branchement aux modules existants, en lecture** — encaissements de subvention dérivés des `Versement` des fiches AAP à leur date, masse salariale dérivée des contrats RH avec arrêt en fin de contrat, rapprochement prévu/réel manuel et report des attendus non tombés. La trésorerie lit les versements, elle n'écrit pas encore dans leur statut.
3. **Interco Pennylane live, rangement et scénarios** — synchro du solde consolidé, des mouvements bancaires et de leur classification lue du grand livre (endpoints comptes, transactions et grand livre, scope « Transactions & Bank accounts » plus ledger), chargement de l'historique depuis le premier janvier de l'exercice, table de correspondance rangement Pennylane vers catégories avec découverte automatique, écran de rapprochement plusieurs-à-plusieurs par tag pour le résiduel, suggestions IA in-app (§10), écriture-retour « Pennylane fait foi » vers le statut des versements (§11), scénarios comparés, réel contre prévu sur les mois clos.

Les lots 1 et 2 ne dépendent pas de l'accès Pennylane et peuvent être construits tout de suite ; le lot 3 s'allume quand le scope est activé sur le token. Les suggestions IA du lot 3 s'appuient sur le même mécanisme d'appel au modèle que le reste de l'ERP, sans stocker les libellés au-delà du besoin.
