// Données de démonstration : tout est fictif (personnes, montants, dates).
import { PrismaClient } from "@prisma/client";
import { REF_DEFAULTS } from "../lib/refs";
import { dayjs } from "../lib/format";
import { DEFAULT_RHYTHMS, expectedHoursOn, rhythmAt } from "../lib/time";
import { randomBytes } from "node:crypto";
import { mkdirSync, writeFileSync, readdirSync, unlinkSync } from "node:fs";
import path from "node:path";

const prisma = new PrismaClient();

// Générateur déterministe pour un seed reproductible.
let seedState = 20260912;
function rnd(): number {
  seedState |= 0;
  seedState = (seedState + 0x6d2b79f5) | 0;
  let t = Math.imul(seedState ^ (seedState >>> 15), 1 | seedState);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const pick = <T>(arr: T[]): T => arr[Math.floor(rnd() * arr.length)];
const between = (a: number, b: number) => a + Math.floor(rnd() * (b - a + 1));
const today = dayjs("2026-09-12");
const d = (offsetDays: number) => today.add(offsetDays, "day").toDate();

// Petit PDF valide d'une page avec un titre : sert de pièce jointe fictive.
function placeholderPdf(title: string): Buffer {
  const text = title.replace(/[()\\]/g, "");
  const objs = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${text.length + 60} >>\nstream\nBT /F1 18 Tf 60 760 Td (${text}) Tj ET\nBT /F1 11 Tf 60 730 Td (Document fictif - prototype Pilote) Tj ET\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let out = "%PDF-1.4\n";
  const offsets: number[] = [];
  objs.forEach((o, i) => { offsets.push(out.length); out += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const xref = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` + offsets.map((o) => String(o).padStart(10, "0") + " 00000 n \n").join("");
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, "latin1");
}

const UPLOADS = process.env.UPLOAD_DIR ?? path.join(process.cwd(), "uploads");
function storePdf(title: string): { storedName: string; size: number } {
  mkdirSync(UPLOADS, { recursive: true });
  const storedName = `${randomBytes(12).toString("hex")}.pdf`;
  const buf = placeholderPdf(title);
  writeFileSync(path.join(UPLOADS, storedName), buf);
  return { storedName, size: buf.length };
}

async function reset() {
  await prisma.attachment.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.decision.deleteMany();
  await prisma.expense.deleteMany();
  await prisma.weekDeclaration.deleteMany();
  await prisma.personRhythmPeriod.deleteMany();
  await prisma.rhythm.deleteMany();
  try { for (const f of readdirSync(UPLOADS)) if (f.endsWith(".pdf")) unlinkSync(path.join(UPLOADS, f)); } catch { /* dossier absent */ }
  await prisma.changeLog.deleteMany();
  await prisma.comment.deleteMany();
  await prisma.docLink.deleteMany();
  await prisma.indicator.deleteMany();
  await prisma.validationRequest.deleteMany();
  await prisma.monthLock.deleteMany();
  await prisma.timeEntry.deleteMany();
  await prisma.deliverable.deleteMany();
  await prisma.action.deleteMany();
  await prisma.fundingLine.deleteMany();
  await prisma.editionPersonDays.deleteMany();
  await prisma.convention.deleteMany();
  await prisma.editionTeam.deleteMany();
  await prisma.edition.deleteMany();
  await prisma.project.deleteMany();
  await prisma.personTimeCode.deleteMany();
  await prisma.projectPole.deleteMany();
  await prisma.pole.updateMany({ data: { leadId: null } });
  await prisma.person.deleteMany();
  await prisma.pole.deleteMany();
  await prisma.timeCode.deleteMany();
  await prisma.mission.deleteMany();
  await prisma.funder.deleteMany();
  await prisma.refValue.deleteMany();
  await prisma.settings.deleteMany();
}

async function main() {
  await reset();

  await prisma.settings.create({
    data: {
      id: 1,
      teamIcsToken: randomBytes(18).toString("base64url"),
      apiToken: randomBytes(18).toString("base64url"),
      timeRules:
        "Chaque salarié·e saisit ses heures chaque semaine, au plus tard le lundi suivant. Les réunions transverses (café du lundi, réunion d'équipe) vont sur « Fonctionnement ». Les congés et absences vont sur « Non travaillé ». La RAF verrouille le mois dans les dix jours qui suivent.",
    },
  });

  for (const [family, defs] of Object.entries(REF_DEFAULTS)) {
    await prisma.refValue.createMany({ data: defs.map((v, i) => ({ family, code: v.code, label: v.label, color: v.color ?? null, order: i })) });
  }

  const rhythms = await Promise.all(DEFAULT_RHYTHMS.map((r, i) => prisma.rhythm.create({ data: { ...r, order: i } })));
  const rhythmByCode = (code: string) => rhythms.find((r) => r.code === code)!;

  const funderNames = ["Région", "État", "FSE", "ADEME", "Banque des Territoires", "DREETS", "Cap'Asso", "ESS France", "Cotisations"];
  const funders = await Promise.all(funderNames.map((name) => prisma.funder.create({ data: { name } })));

  // Contacts des financeurs : personnes inventées, adresses en @exemple.fr ; le premier de chaque financeur est le contact principal.
  const contactsSeed: Record<number, { firstName: string; lastName: string; role: string; email: string; phone?: string }[]> = {
    0: [{ firstName: "Hélène", lastName: "Marchand", role: "Chargée de mission ESS", email: "h.marchand@exemple.fr", phone: "02 00 00 00 01" }, { firstName: "Karim", lastName: "Bensaïd", role: "Gestionnaire des conventions", email: "k.bensaid@exemple.fr" }],
    1: [{ firstName: "Louise", lastName: "Renard", role: "Instructrice DDETS", email: "l.renard@exemple.fr", phone: "02 00 00 00 02" }],
    2: [{ firstName: "Paul", lastName: "Ferreira", role: "Chargé de mission FSE+", email: "p.ferreira@exemple.fr" }, { firstName: "Anaïs", lastName: "Dupuis", role: "Contrôleuse de service fait", email: "a.dupuis@exemple.fr" }],
    3: [{ firstName: "Sami", lastName: "Kaci", role: "Ingénieur transition", email: "s.kaci@exemple.fr" }],
    4: [{ firstName: "Clémence", lastName: "Robert", role: "Directrice territoriale adjointe", email: "c.robert@exemple.fr" }],
    5: [{ firstName: "Marc", lastName: "Lévy", role: "Chargé de développement", email: "m.levy@exemple.fr" }],
    7: [{ firstName: "Nora", lastName: "Achour", role: "Responsable réseau", email: "n.achour@exemple.fr" }],
  };
  for (const [idx, list] of Object.entries(contactsSeed)) {
    for (const [i, c] of list.entries()) await prisma.funderContact.create({ data: { funderId: funders[Number(idx)].id, ...c, primary: i === 0 } });
  }

  // Conventions partagées : FSE 2026-2028 (DLA + sensibilisation) ; CPO Région 2025-2027 pour les projets Région pluriannuels.
  const fseConv = await prisma.convention.create({ data: { funderId: funders[2].id, reference: "FSE-2026-2028", scheme: "FSE+ 2021-2027 — axe inclusion", label: "Convention FSE+ inclusion 2026-2028", startYear: 2026, endYear: 2028, status: "contracted", amountRequested: 180000, amountNotified: 165000, submittedAt: dayjs("2025-10-15").toDate(), notifiedAt: dayjs("2026-02-20").toDate(), signedAt: dayjs("2026-03-28").toDate(), notes: "Trois ans, deux projets ; clés de répartition dans l'onglet FSE de l'Excel RAF." } });
  const cpoConv = await prisma.convention.create({ data: { funderId: funders[0].id, reference: "CPO-REGION-2025-2027", scheme: "Convention pluriannuelle d'objectifs", label: "CPO Région 2025-2027", startYear: 2025, endYear: 2027, status: "contracted", amountRequested: 240000, amountNotified: 225000, submittedAt: dayjs("2024-10-01").toDate(), notifiedAt: dayjs("2025-01-15").toDate(), signedAt: dayjs("2025-02-10").toDate() } });

  const missions = await Promise.all(
    [
      "Représenter et défendre l'ESS régionale",
      "Observer et rendre visible l'ESS",
      "Accompagner la transition et les coopérations",
      "Sensibiliser, former et communiquer",
    ].map((name, i) => prisma.mission.create({ data: { name, order: i } })),
  );

  const timeCodes = await Promise.all(
    [
      { code: "FONCT", label: "Fonctionnement (réunions transverses, vie d'équipe)", kind: "operating" },
      { code: "GEST", label: "Gestion administrative et financière", kind: "operating" },
      { code: "COM", label: "Communication interne", kind: "operating" },
      { code: "FORM", label: "Formation reçue", kind: "operating" },
      { code: "NT", label: "Non travaillé (congés, absences)", kind: "non_worked" },
    ].map((t, i) => prisma.timeCode.create({ data: { ...t, order: i } })),
  );

  const poles = await Promise.all(
    ["Représentation et observation", "Transition et coopération territoriale", "Sensibilisation et communication"].map((name) => prisma.pole.create({ data: { name } })),
  );

  type P = { name: string; role: string; rhythm: string; pole: number | null; days: number };
  const peopleDefs: P[] = [
    { name: "Claire Vasseur", role: "director", rhythm: "option_b", pole: null, days: 205 },
    { name: "Nadia Ferrand", role: "raf", rhythm: "option_a", pole: null, days: 200 },
    { name: "Léa Morin", role: "assistant", rhythm: "part_time", pole: null, days: 160 },
    { name: "Julien Barbot", role: "pole_lead", rhythm: "option_b", pole: 0, days: 205 },
    { name: "Sophie Delaunay", role: "pole_lead", rhythm: "option_a", pole: 1, days: 200 },
    { name: "Maxime Roussel", role: "pilot", rhythm: "option_a", pole: 0, days: 200 },
    { name: "Inès Cabral", role: "pilot", rhythm: "option_b", pole: 0, days: 205 },
    { name: "Thomas Guérin", role: "pilot", rhythm: "option_a", pole: 1, days: 200 },
    { name: "Camille Aubert", role: "pilot", rhythm: "part_time", pole: 1, days: 160 },
    { name: "Yasmine Benali", role: "pilot", rhythm: "option_a", pole: 1, days: 200 },
    { name: "Hugo Lemaire", role: "pilot", rhythm: "option_b", pole: 2, days: 205 },
    { name: "Élise Fontaine", role: "pilot", rhythm: "option_a", pole: 2, days: 200 },
    { name: "Romain Tessier", role: "pilot", rhythm: "option_a", pole: 2, days: 200 },
    { name: "Lucas Perrin", role: "contributor", rhythm: "apprentice", pole: 2, days: 120 },
    { name: "Manon Girard", role: "contributor", rhythm: "apprentice", pole: 1, days: 120 },
  ];
  const people: Awaited<ReturnType<typeof prisma.person.create>>[] = [];
  for (let i = 0; i < peopleDefs.length; i++) {
    const p = peopleDefs[i];
    people.push(
      await prisma.person.create({
        data: { name: p.name, role: p.role, workRhythm: p.rhythm, availableDays: p.days, poleId: p.pole === null ? null : poles[p.pole].id, order: i, icsToken: randomBytes(18).toString("base64url") },
      }),
    );
  }
  const [director, raf, assistant, leadA, leadB] = people;
  // Périodes de rythme : tout le monde depuis le 01/01/2026 ; Camille passe à 80 % au 1er septembre ; Thomas passe d'option A à B au 1er juillet.
  for (const p of people) {
    if (p.name === "Camille Aubert") {
      await prisma.personRhythmPeriod.create({ data: { personId: p.id, rhythmId: rhythmByCode("option_a").id, from: dayjs("2026-01-01").toDate(), to: dayjs("2026-08-31").toDate() } });
      await prisma.personRhythmPeriod.create({ data: { personId: p.id, rhythmId: rhythmByCode("part_time").id, from: dayjs("2026-09-01").toDate() } });
    } else if (p.name === "Thomas Guérin") {
      await prisma.personRhythmPeriod.create({ data: { personId: p.id, rhythmId: rhythmByCode("option_a").id, from: dayjs("2026-01-01").toDate(), to: dayjs("2026-06-30").toDate() } });
      await prisma.personRhythmPeriod.create({ data: { personId: p.id, rhythmId: rhythmByCode("option_b").id, from: dayjs("2026-07-01").toDate() } });
      await prisma.person.update({ where: { id: p.id }, data: { workRhythm: "option_b" } });
    } else {
      await prisma.personRhythmPeriod.create({ data: { personId: p.id, rhythmId: rhythmByCode(p.workRhythm).id, from: dayjs("2026-01-01").toDate() } });
    }
  }
  const personsWithRhythm = await prisma.person.findMany({ include: { rhythmPeriods: { include: { rhythm: true } } } });
  await prisma.pole.update({ where: { id: poles[0].id }, data: { leadId: leadA.id } });
  await prisma.pole.update({ where: { id: poles[1].id }, data: { leadId: leadB.id } });
  await prisma.pole.update({ where: { id: poles[2].id }, data: { leadId: director.id } });

  // Codes de temps utiles par poste
  for (const p of people) {
    const codes = p.role === "raf" || p.role === "assistant" ? timeCodes : timeCodes.filter((t) => ["FONCT", "FORM", "NT"].includes(t.code));
    await prisma.personTimeCode.createMany({ data: codes.map((t) => ({ personId: p.id, timeCodeId: t.id })) });
  }

  const pilotsOf = (poleIdx: number) => people.filter((p, i) => peopleDefs[i].pole === poleIdx && (p.role === "pilot"));
  const membersOf = (poleIdx: number) => people.filter((p, i) => peopleDefs[i].pole === poleIdx);

  type PD = { name: string; code: string; pole: number; mission: number; actions: string[]; funders: number[]; envelope: number; secondary?: number[] };
  const projectDefs: PD[] = [
    { name: "Vœux et assemblée générale", code: "REP-01", pole: 0, mission: 0, actions: ["Préparer les vœux", "Convoquer l'AG", "Rapport d'activité", "Logistique de l'AG", "Bilan de l'AG"], funders: [8, 0], envelope: 9000 },
    { name: "AIESSE et campagnes électorales", code: "REP-02", pole: 0, mission: 0, actions: ["Note de positionnement", "Rencontres candidats", "Lettre AIESSE n°1", "Lettre AIESSE n°2", "Plaidoyer régional"], funders: [0, 8, 7], envelope: 6000 },
    { name: "Réseau Femmes et ESS", code: "REP-03", pole: 0, mission: 0, actions: ["Cycle de rencontres", "Baromètre égalité", "Restitution publique"], funders: [1, 0], envelope: 12000 },
    { name: "Observatoire régional (ORESS)", code: "OBS-01", pole: 0, mission: 1, actions: ["Collecte des données", "Chiffres de l'emploi", "Petit-déjeuner ORESS", "Note de conjoncture", "Mise à jour du site", "Comité technique"], funders: [0, 1, 7], envelope: 18000 },
    { name: "Étude santé et économie", code: "OBS-02", pole: 0, mission: 1, actions: ["Cadrage", "Entretiens", "Rédaction", "Restitution"], funders: [0, 5], envelope: 15000 },
    { name: "Chroniquer la TESS", code: "TES-01", pole: 1, mission: 2, actions: ["Repérage d'initiatives", "Rédaction des chroniques", "Diffusion", "Bilan annuel"], funders: [3, 0], envelope: 8000 },
    { name: "Cycle de conférences transition", code: "TES-02", pole: 1, mission: 2, actions: ["Programme", "Intervenants", "Conférence 1", "Conférence 2", "Conférence 3", "Évaluation"], funders: [3, 0, 4], envelope: 14000 },
    { name: "Mobilité solidaire", code: "TES-03", pole: 1, mission: 2, actions: ["Diagnostic territorial", "Ateliers", "Note d'opportunité"], funders: [3, 1], envelope: 10000 },
    { name: "Carte et ressource TESS", code: "TES-04", pole: 1, mission: 2, actions: ["Collecte", "Cartographie", "Publication", "Animation"], funders: [0, 4], envelope: 7000 },
    { name: "Lab des coopérations", code: "TES-05", pole: 1, mission: 2, actions: ["Appel à projets", "Sélection", "Accompagnement", "Journée du lab", "Bilan"], funders: [4, 0, 1], envelope: 22000 },
    { name: "Club des collectivités", code: "COO-01", pole: 1, mission: 2, actions: ["Réunion 1", "Réunion 2", "Réunion 3", "Newsletter club"], funders: [0, 8], envelope: 5000 },
    { name: "PTCE et ESSOR", code: "COO-02", pole: 1, mission: 2, actions: ["Animation du réseau", "Plateforme ESSOR", "Rencontre régionale", "Suivi des PTCE", "Bilan"], funders: [1, 0, 5], envelope: 20000 },
    { name: "Dispositif local d'accompagnement (DLA)", code: "DLA-01", pole: 1, mission: 2, actions: ["Diagnostics", "Ingénieries collectives", "Comité d'appui", "Reporting national", "Bilan qualitatif", "Bilan financier"], funders: [1, 2, 4, 0], envelope: 45000 },
    { name: "Structures en difficulté", code: "COO-03", pole: 1, mission: 2, actions: ["Référencement", "Orientation AIO", "Ingénieries"], funders: [5, 0], envelope: 9000 },
    { name: "Mois de l'ESS et Prix ESS", code: "SEN-01", pole: 2, mission: 3, actions: ["Appel à événements", "Programme régional", "Jury du Prix", "Soirée de remise", "Communication", "Bilan"], funders: [0, 7, 8], envelope: 16000 },
    { name: "Sensibilisation des jeunes", code: "SEN-02", pole: 2, mission: 3, secondary: [0], actions: ["Interventions hors scolaire", "Relations universités", "Forums et salons", "Kit pédagogique"], funders: [0, 1, 2], envelope: 11000 },
    { name: "Newsletter et lettre aux adhérents", code: "COM-01", pole: 2, mission: 3, actions: ["Newsletter mensuelle", "Lettre aux adhérents", "Base de contacts"], funders: [8, 0], envelope: 3000 },
    { name: "Refonte du site internet", code: "COM-02", pole: 2, mission: 3, actions: ["Cahier des charges", "Choix du prestataire", "Recette", "Mise en ligne", "Formation de l'équipe"], funders: [0, 4, 8], envelope: 25000 },
    { name: "Forum régional de l'ESS", code: "SEN-03", pole: 2, mission: 3, secondary: [1], actions: ["Lieu et date", "Programme", "Partenaires", "Inscriptions", "Jour J", "Bilan"], funders: [0, 1, 7], envelope: 30000 },
    { name: "Communauté des financeurs", code: "COO-04", pole: 1, mission: 0, secondary: [0], actions: ["Cartographie des financeurs", "Rencontre annuelle", "Fiches dispositifs"], funders: [4, 0, 5], envelope: 6000 },
  ];

  const deliverableLabels = ["Bilan qualitatif", "Bilan financier", "Justificatifs de dépenses", "Rapport intermédiaire", "Mentions du financeur"];
  const stakesTexts = [
    "Renforcer la visibilité de l'ESS auprès des décideurs régionaux.",
    "Consolider un dispositif reconduit chaque année, sans perdre les acquis.",
    "Structurer une action nouvelle avec des partenaires encore à confirmer.",
    "Tenir l'engagement pris auprès des financeurs sur les indicateurs.",
  ];

  const allEditions: { id: string; projectId: string; year: number; poleIdx: number; pilotId: string; actionIds: string[]; actionOwners: Record<string, string>; teamIds: string[] }[] = [];

  for (let pi = 0; pi < projectDefs.length; pi++) {
    const pd = projectDefs[pi];
    const pilots = pilotsOf(pd.pole);
    const pilot = pilots[pi % pilots.length];
    const guarantor = pd.pole === 0 ? leadA : pd.pole === 1 ? leadB : director;
    const project = await prisma.project.create({
      data: { name: pd.name, analyticCode: pd.code, poleId: poles[pd.pole].id, pilotId: pilot.id, guarantorId: guarantor.id, missionId: missions[pd.mission].id, recurring: true, createdAt: dayjs("2024-01-15").toDate(),
        secondaryPoles: { create: (pd.secondary ?? []).map((sp) => ({ poleId: poles[sp].id })) } },
    });

    const years: { year: number; status: string }[] = [
      { year: 2025, status: "closed" },
      { year: 2026, status: "in_progress" },
    ];
    // Un projet sur deux a déjà son édition 2027 : reconduite (proposée) ou à ajuster (re-challengée), en cohérence avec la décision consignée sur 2026.
    const next2027 = pi % 2 === 0 ? (pi % 4 === 0 ? "proposed" : "rechallenged") : null;
    if (next2027) years.push({ year: 2027, status: next2027 });

    for (const y of years) {
      const members = membersOf(pd.pole).filter((m) => m.id !== pilot.id);
      const fromSecondary = (pd.secondary ?? []).flatMap((sp) => pilotsOf(sp).slice(0, 1));
      const team = [pilot, ...members.slice(0, between(1, 3)), ...fromSecondary, ...(pi % 5 === 0 ? [director] : []), ...(pi % 7 === 0 ? [raf] : [])];
      const isPast = y.year === 2025;
      const isFuture = y.year === 2027;
      const filledByDirection = !isFuture || pi % 4 === 0;

      const edition = await prisma.edition.create({
        data: {
          projectId: project.id,
          year: y.year,
          status: y.status,
          decisionDate: isFuture ? null : dayjs(`${y.year - 1}-12-10`).toDate(),
          conditionalStart: isFuture && pi % 6 === 0,
          stakes: filledByDirection ? pick(stakesTexts) : null,
          axis: filledByDirection ? `Mission ${pd.mission + 1} du plan opérationnel` : null,
          sressMeasure: filledByDirection ? "Mesure SRESS n°" + between(1, 12) : null,
          yearPriorities: filledByDirection ? "Consolider les partenariats existants et sécuriser le financement pluriannuel." : null,
          expectedOutcome: filledByDirection ? "Un bilan réutilisable dans le rapport d'activité, des indicateurs financeurs tenus." : null,
          plannedFunders: filledByDirection ? pd.funders.map((f) => funderNames[f]).join(", ") : null,
          directExpenseEnvelope: filledByDirection ? pd.envelope : null,
          fte: filledByDirection ? Math.round((team.length * 0.3 + 0.2) * 10) / 10 : null,
          imposedIndicators: filledByDirection && pd.funders.includes(2) ? "Nombre de participants, nombre de structures accompagnées, répartition femmes / hommes." : filledByDirection ? "Nombre de participants, nombre de structures touchées." : null,
          operationalObjectives: isFuture ? null : `Mener à bien les ${pd.actions.length} actions prévues et tenir les jalons.`,
          calendar: isFuture ? null : "Lancement au premier trimestre, temps fort au second semestre, bilan en décembre.",
          partners: isFuture ? null : "Réseau régional, collectivités partenaires, têtes de réseau nationales.",
          method: isFuture ? null : "Groupe de travail mensuel, points d'étape en réunion de pôle.",
          governance: isFuture ? null : "COPIL semestriel avec les financeurs ; suivi en CODIR trimestriel.",
          ownIndicators: isFuture ? null : "Nombre d'événements, taux de satisfaction, retombées presse.",
          timeNeed: isFuture ? null : `${between(30, 120)} jours toutes personnes confondues`,
          budgetNeed: isFuture ? null : `${pd.envelope} € de dépenses directes`,
          // Décision du séminaire consignée sur l'édition N : « ajuster » si la 2027 est re-challengée, « reconduire » sinon ; 2025 est reconduite.
          codirDecision: isFuture ? null : y.year === 2026 && next2027 === "rechallenged" ? "adjust" : "renew",
          codirDate: isFuture ? null : dayjs(`${y.year - 1}-12-10`).toDate(),
          boardValidated: !isFuture,
          boardDate: isFuture ? null : dayjs(`${y.year - 1}-12-18`).toDate(),
          venues: isPast ? "Orléans, Tours, Blois" : null,
          evaluation: isPast ? "Objectifs atteints à 90 % ; la fréquentation a dépassé la cible." : null,
          report: isPast ? `Bilan ${y.year} — ${pd.name}\n\nLe projet a été mené conformément au cadre validé. Les actions prévues ont été réalisées, les livrables financeurs remis dans les délais. Points d'amélioration : anticiper la communication et mieux répartir le temps entre les membres de l'équipe.` : null,
          budgetEnvelope: isFuture ? null : pd.envelope,
          spent: isFuture ? 0 : Math.round(pd.envelope * (isPast ? 0.1 : [0.05, 0.08, 0.04, 0.03, 0.06][pi % 5])), // réalisé hors devis (frais divers)
          team: { create: team.map((p) => ({ personId: p.id })) },
          personDays: { create: team.map((p, i) => { const planned = i === 0 ? between(20, 60) : between(5, 25); return { personId: p.id, plannedDays: planned, soldDays: Math.round(planned * [0.5, 0.8, 1, 1.2][between(0, 3)]) }; }) },
          indicators: {
            create: [
              { label: "Participants", target: String(between(50, 400)), actual: isFuture ? null : String(between(40, 350)), imposed: true, order: 0 },
              { label: "Structures touchées", target: String(between(10, 80)), actual: isFuture ? null : String(between(8, 70)), imposed: true, order: 1 },
              { label: "Taux de satisfaction", target: "85 %", actual: isFuture ? null : `${between(78, 96)} %`, imposed: false, order: 2 },
            ],
          },
          docLinks: {
            create: [
              { label: "Dossier de référence", url: `\\\\cress\\Partage\\Action\\${pd.code}\\${y.year}`, codirOnly: false },
              { label: "Convention signée", url: `\\\\cress\\Partage\\Budget et convention\\${y.year}\\${pd.code}-convention.pdf`, codirOnly: false },
              ...(y.year === 2026 ? [{ label: "Note CODIR sur le financement", url: `\\\\cress\\Partage\\Siege\\CODIR\\${pd.code}-note.docx`, codirOnly: true }] : []),
              ...(["SEN-01", "COM-02", "SEN-03"].includes(pd.code) ? [{ label: "Canal Teams du projet", url: `https://teams.microsoft.com/l/channel/demo-${pd.code.toLowerCase()}`, codirOnly: false }] : []),
              ...(pd.pole === 1 ? [{ label: "Carnet OneNote du pôle", url: `https://onenote.example/pole-transition/${pd.code}`, codirOnly: false }] : []),
            ],
          },
        },
      });

      // Dépenses directes : devis engagés, factures rattachées (pas de double comptage)
      if (!isFuture) {
        const share = isPast ? [0.3, 0.25, 0.2] : [[0.1, 0.1], [0.25, 0.15], [0.3, 0.2, 0.1], [0.5, 0.3], [0.45, 0.35, 0.15]][pi % 5];
        const suppliers = ["Imprimerie du Loiret", "Traiteur Les Saveurs", "Studio Graphique Nord", "Location Salle Beaugency", "Cabinet Études & Co", "Transport Berry"];
        for (let xi = 0; xi < share.length; xi++) {
          const committed = Math.round(pd.envelope * share[xi]);
          const spent = isPast ? committed : Math.round(committed * [0, 0.4, 1, 0.9][(pi + xi) % 4]);
          await prisma.expense.create({
            data: { editionId: edition.id, label: ["Impression du programme", "Prestation traiteur", "Conception graphique", "Location de salle", "Étude externe", "Déplacements partenaires"][(pi + xi) % 6], supplier: suppliers[(pi + xi) % 6], committed, spent, status: isPast || spent >= committed ? "closed" : "open", reference: `FAC-${y.year}-${100 + pi * 3 + xi}`, createdAt: dayjs(`${y.year}-0${(xi % 8) + 1}-15`).toDate() },
          });
        }
      }

      // Actions
      const actionIds: string[] = [];
      const actionOwners: Record<string, string> = {};
      const nActions = isFuture ? pd.actions.length : pd.actions.length;
      for (let ai = 0; ai < nActions; ai++) {
        const owner = team[ai % team.length];
        let milestone: Date;
        let state: string;
        if (isPast) {
          milestone = dayjs(`2025-0${(ai % 9) + 1}-15`).toDate();
          state = "done";
        } else if (isFuture) {
          milestone = dayjs(`2027-0${(ai % 9) + 1}-15`).toDate();
          state = "todo";
        } else {
          const offset = -120 + ai * 40 + (pi % 5) * 7; // jalons répartis de -120 à +200 jours
          milestone = d(offset);
          state = offset < -10 ? (rnd() < 0.92 ? "done" : "doing") : offset < 20 ? "doing" : "todo";
        }
        const publicNames = ["Petit-déjeuner ORESS", "Conférence 1", "Conférence 2", "Conférence 3", "Soirée de remise", "Jour J", "Journée du lab", "Rencontre régionale", "Rencontre annuelle", "Restitution publique"];
        const a = await prisma.action.create({
          data: { editionId: edition.id, name: pd.actions[ai], ownerId: owner.id, milestoneDate: milestone, timeTarget: between(4, 20) * 7, state, order: ai, isPublic: publicNames.includes(pd.actions[ai]) },
        });
        actionIds.push(a.id);
        actionOwners[a.id] = owner.id;
      }

      // Lignes de financement (jamais mono-financeur)
      const fundingIds: string[] = [];
      for (let fi = 0; fi < pd.funders.length; fi++) {
        const f = funders[pd.funders[fi]];
        const requested = Math.round((pd.envelope * (fi === 0 ? 0.5 : 0.3)) / 100) * 100 + 2000;
        const status = isPast ? "justified" : isFuture ? "to_submit" : ["contracted", "notified", "submitted", "contracted"][fi % 4];
        const line = await prisma.fundingLine.create({
          data: {
            editionId: edition.id,
            funderId: f.id,
            scheme: f.name === "FSE" ? "FSE+ 2021-2027 — axe inclusion" : f.name === "Région" ? "Convention pluriannuelle d'objectifs" : f.name === "Cotisations" ? "Fonds propres" : "Appel à projets " + y.year,
            status,
            amountRequested: requested,
            amountGranted: status === "to_submit" || status === "submitted" ? null : requested - between(0, 15) * 100,
            submittedAt: status === "to_submit" ? null : dayjs(`${y.year - 1}-11-${10 + fi}`).toDate(),
            answeredAt: ["notified", "contracted", "justified"].includes(status) ? dayjs(`${y.year}-02-${10 + fi}`).toDate() : null,
            contractedAt: ["contracted", "justified"].includes(status) ? dayjs(`${y.year}-03-${10 + fi}`).toDate() : null,
            analyticCode: `${pd.code}-${f.name.slice(0, 3).toUpperCase()}`,
            allocationKeyRef: `Clé ${y.year} — onglet ${pd.code}`,
            multiYear: f.name === "FSE" || (f.name === "Région" && pi % 3 === 0),
            notes: fi === 0 ? "Financeur principal." : null,
            conventionId: f.name === "FSE" && y.year >= 2026 ? fseConv.id : f.name === "Région" && pi % 3 === 0 && y.year >= 2025 && y.year <= 2027 ? cpoConv.id : null,
          },
        });
        fundingIds.push(line.id);
        if (y.year === 2026 && ["contracted", "justified"].includes(status)) {
          const pdf = storePdf(`Convention ${f.name} ${y.year} - ${pd.name}`);
          await prisma.attachment.create({ data: { editionId: edition.id, fundingLineId: line.id, kind: "contract", label: `Convention ${f.name} ${y.year}`, fileName: `${pd.code}-${f.name}-convention-${y.year}.pdf`, mimeType: "application/pdf", uploadedById: raf.id, createdAt: dayjs(`${y.year}-03-${12 + fi}`).toDate(), ...pdf } });
          if (fi === 0) {
            const pdf2 = storePdf(`Notification ${f.name} ${y.year} - ${pd.name}`);
            await prisma.attachment.create({ data: { editionId: edition.id, fundingLineId: line.id, kind: "notification", label: `Courrier de notification ${f.name}`, fileName: `${pd.code}-${f.name}-notification.pdf`, mimeType: "application/pdf", uploadedById: raf.id, createdAt: dayjs(`${y.year}-02-${12 + fi}`).toDate(), ...pdf2 } });
          }
        }
        if (!isFuture) {
          const nDeliv = between(1, 2);
          for (let di = 0; di < nDeliv; di++) {
            const due = isPast ? dayjs(`2026-0${di + 2}-28`).toDate() : d(between(-3, 150));
            await prisma.deliverable.create({
              data: { fundingLineId: line.id, label: deliverableLabels[(fi + di) % deliverableLabels.length], dueDate: due, done: isPast, doneAt: isPast ? due : null },
            });
          }
        }
      }
      // Rattacher quelques actions à une ligne
      for (let ai = 0; ai < actionIds.length; ai += 2) {
        await prisma.action.update({ where: { id: actionIds[ai] }, data: { fundingLineId: fundingIds[ai % fundingIds.length] } });
      }

      if (y.year === 2026) {
        await prisma.comment.createMany({
          data: [
            { editionId: edition.id, authorId: pilot.id, body: "Point d'étape fait en réunion de pôle : les partenaires sont confirmés.", createdAt: d(-25) },
            { editionId: edition.id, authorId: guarantor.id, body: "Merci. Pensez à mettre à jour le livrable financeur avant l'échéance.", createdAt: d(-20) },
          ],
        });
        await prisma.changeLog.createMany({
          data: [
            { editionId: edition.id, field: "stakes", before: null, after: "Renforcer…", authorId: director.id, createdAt: dayjs("2025-11-20").toDate() },
            { editionId: edition.id, field: "operationalObjectives", before: null, after: "Mener à bien…", authorId: pilot.id, createdAt: dayjs("2026-01-08").toDate() },
          ],
        });
      }

      allEditions.push({ id: edition.id, projectId: project.id, year: y.year, poleIdx: pd.pole, pilotId: pilot.id, actionIds, actionOwners, teamIds: team.map((t) => t.id) });
    }
  }

  // Temps saisis : 8 semaines pour 10 personnes, 2 en retard, juillet verrouillé.
  const editions2026 = allEditions.filter((e) => e.year === 2026);
  const timeKeepers = [director, raf, ...people.filter((p) => p.poleId)].slice(0, 12);
  const lateOnes = [timeKeepers[6].id, timeKeepers[9].id];
  const fonct = timeCodes.find((t) => t.code === "FONCT")!;
  const startWeek = today.subtract(7, "week").startOf("isoWeek");
  for (const p of timeKeepers.slice(0, 10)) {
    const myEditions = editions2026.filter((e) => e.teamIds.includes(p.id));
    for (let w = 0; w < 8; w++) {
      const weekStart = startWeek.add(w, "week");
      if (lateOnes.includes(p.id) && w >= 6) continue; // deux personnes en retard sur les deux dernières semaines
      for (let day = 0; day < 5; day++) {
        const date = weekStart.add(day, "day");
        if (date.isAfter(today)) continue;
        const pr = personsWithRhythm.find((x) => x.id === p.id)!;
        const rhythm = rhythmAt(pr, date, rhythms);
        const dailyHours = rhythm ? expectedHoursOn(rhythm, date) : 7;
        if (dailyHours === 0) continue; // jour non travaillé (vendredi option B, temps partiel)
        let left = dailyHours;
        const fonctHours = day === 0 ? 1.5 : 0;
        if (fonctHours) {
          await prisma.timeEntry.create({ data: { personId: p.id, timeCodeId: fonct.id, date: date.toDate(), hours: fonctHours, locked: date.month() === 6 } });
          left -= fonctHours;
        }
        const startIdx = myEditions.length ? between(0, myEditions.length - 1) : 0;
        const chosen = [...myEditions.slice(startIdx), ...myEditions.slice(0, startIdx)].slice(0, between(1, Math.min(3, myEditions.length)));
        for (let ci = 0; ci < chosen.length; ci++) {
          const e = chosen[ci];
          const hours = ci === chosen.length - 1 ? Math.round(left * 4) / 4 : Math.min(left, between(1, 4));
          if (hours <= 0) continue;
          left -= hours;
          const mine = e.actionIds.filter((id) => e.actionOwners[id] === p.id);
          const actionId = mine.length && rnd() < 0.75 ? mine[between(0, mine.length - 1)] : null;
          await prisma.timeEntry.create({ data: { personId: p.id, projectId: e.projectId, actionId, date: date.toDate(), hours, locked: date.month() === 6, comment: rnd() < 0.1 ? "Déplacement inclus" : null } });
        }
      }
    }
    await prisma.monthLock.create({ data: { personId: p.id, month: "2026-07", lockedById: raf.id, lockedAt: dayjs("2026-08-08").toDate() } });
    // Semaines déclarées complètes : toutes sauf la dernière (et aucune pour les retardataires sur septembre)
    for (let w = 0; w < 7; w++) {
      const ws = startWeek.add(w, "week");
      if (lateOnes.includes(p.id) && w >= 5) continue;
      await prisma.weekDeclaration.create({ data: { personId: p.id, week: `${ws.isoWeekYear()}-W${String(ws.isoWeek()).padStart(2, "0")}`, declaredAt: ws.add(5, "day").toDate() } });
    }
  }

  // Validations : 6 en attente d'âges différents, 3 approuvées
  const kinds = ["quote", "expense", "sending", "quote", "scope_change", "quote"];
  const labels = ["Devis traiteur soirée", "Frais de déplacement partenaires", "Envoi de la newsletter spéciale", "Devis impression programme", "Extension du périmètre à deux départements", "Devis prestataire vidéo"];
  const amounts = [1800, 320, null, 640, null, 4200];
  const ages = [1, 3, 6, 9, 14, 21];
  for (let i = 0; i < 6; i++) {
    const e = editions2026[i * 3];
    const v = await prisma.validationRequest.create({
      data: {
        editionId: e.id,
        actionId: e.actionIds[0],
        kind: kinds[i],
        label: labels[i],
        requesterId: e.pilotId,
        amount: amounts[i],
        attachmentUrl: null,
        requiredLevel: (() => { const a = amounts[i]; return a === null ? 1 : a > 3000 ? 3 : a > 500 ? 2 : 1; })(),
        status: "pending",
        targetDelayDays: 5,
        createdAt: d(-ages[i]),
      },
    });
    if (amounts[i]) {
      const pdf = storePdf(`${labels[i]} - ${amounts[i]} EUR`);
      await prisma.attachment.create({ data: { editionId: e.id, validationId: v.id, kind: "quote", label: labels[i], fileName: `devis-2026-${100 + i}.pdf`, mimeType: "application/pdf", uploadedById: e.pilotId, createdAt: d(-ages[i]), ...pdf } });
    }
  }
  for (let i = 0; i < 3; i++) {
    const e = editions2026[i * 3 + 1];
    const v = await prisma.validationRequest.create({
      data: {
        editionId: e.id,
        kind: "quote",
        label: ["Devis location de salle", "Devis graphiste", "Devis intervenant"][i],
        requesterId: e.pilotId,
        amount: [900, 1500, 600][i],
        attachmentUrl: null,
        requiredLevel: 2,
        status: "approved",
        deciderId: i === 0 ? director.id : leadB.id,
        decidedAt: d(-between(5, 30)),
        decisionComment: "OK, dans l'enveloppe.",
        targetDelayDays: 5,
        createdAt: d(-between(31, 60)),
      },
    });
    await prisma.expense.create({ data: { editionId: e.id, label: ["Devis location de salle", "Devis graphiste", "Devis intervenant"][i], committed: [900, 1500, 600][i], spent: [900, 0, 600][i], status: i === 1 ? "open" : "closed", validationId: v.id, reference: i === 1 ? null : `FAC-2026-${300 + i}` } });
    const pdf = storePdf(`${["Devis location de salle", "Devis graphiste", "Devis intervenant"][i]}`);
    await prisma.attachment.create({ data: { editionId: e.id, validationId: v.id, kind: "quote", label: ["Devis location de salle", "Devis graphiste", "Devis intervenant"][i], fileName: `devis-2026-${200 + i}.pdf`, mimeType: "application/pdf", uploadedById: e.pilotId, createdAt: v.createdAt, ...pdf } });
  }

  // Relances de temps déjà envoyées par la RAF aux deux retardataires (notification dans l'outil)
  for (const id of lateOnes) {
    await prisma.notification.create({ data: { personId: id, senderId: raf.id, kind: "time_reminder", title: "Temps de septembre 2026 à compléter", body: `${raf.name} vous demande de compléter et déclarer vos semaines de septembre 2026 avant la clôture.`, link: "/temps", createdAt: d(-1) } });
  }

  // Décisions d'instance récentes
  const dec = [
    { i: 0, instance: "codir", body: "Report du petit-déjeuner ORESS à novembre ; le pilote confirme la date au prochain CODIR.", follow: 1, due: 20 },
    { i: 3, instance: "codir", body: "Enveloppe maintenue ; pas de nouvelle dépense sans validation direction jusqu'au bilan.", follow: null, due: null },
    { i: 5, instance: "pole", body: "Le bilan qualitatif ADEME est relu par le responsable de pôle avant envoi.", follow: 0, due: 10 },
    { i: 8, instance: "quarterly", body: "Indicateurs de fréquentation en retrait : cible 2027 à revoir au séminaire.", follow: null, due: null },
  ];
  for (const x of dec) {
    const e = editions2026[x.i];
    await prisma.decision.create({ data: { editionId: e.id, instance: x.instance, body: x.body, authorId: x.instance === "pole" ? leadB.id : director.id, followUpId: x.follow === null ? null : x.follow === 0 ? e.pilotId : e.teamIds[1] ?? e.pilotId, dueDate: x.due ? d(x.due) : null, decidedAt: d(-between(2, 25)) } });
  }

  // Trois fiches projets 2026 remplies au format du gabarit CRESS (textes transposés des fiches réelles, sans personne réelle),
  // avec, sur l'une, les remarques de la direction accrochées aux rubriques — comme les commentaires Word.
  const fiche = async (code: string, data: Record<string, unknown>) => {
    const e = await prisma.edition.findFirst({ where: { year: 2026, project: { analyticCode: code } } });
    if (e) await prisma.edition.update({ where: { id: e.id }, data });
    return e;
  };
  await fiche("COM-02", {
    operationalObjectives: "Moderniser l'image de la CRESS avec un site clair, accessible et cohérent avec son identité.\nAméliorer la lisibilité de l'offre de services et des missions auprès des acteurs de l'ESS.\nFaciliter l'accès à l'information pour les différents publics (adhérents, partenaires, grand public).\nRenforcer la visibilité de l'ESS en région Centre-Val de Loire.",
    quantitativeObjectives: "Un site livré et mis en ligne dans l'année ; indicateurs de fréquentation suivis (Matomo) ; conformité RGAA vérifiée.",
    content: "Le site devra être conçu dans une logique d'UX design, centré sur les besoins des utilisateurs. Un temps de réflexion collective pourra être prévu.\nValeur ajoutée : un site plus ergonomique et intuitif ; une meilleure visibilité des actions et de l'impact de la CRESS ; un outil centralisé pour fédérer et informer l'écosystème ESS régional ; un gain de temps pour l'équipe grâce à une gestion de contenus simplifiée ; une image renforcée de professionnalisme auprès des partenaires institutionnels.\nLe site intégrera les indicateurs de suivi (Matomo), respectera le RGAA et des pratiques de communication digitale responsables, et répondra aux exigences minimales de cybersécurité.",
    audience: "Structures de l'ESS ; adhérents et futurs adhérents ; collectivités territoriales et partenaires institutionnels ; porteurs de projets et entrepreneurs de l'ESS ; grand public intéressé par l'ESS.",
    governance: "Sponsor : direction. Équipe projet : chargé·e de communication et consultation du reste de l'équipe. Sollicitation ponctuelle d'adhérents ou de membres du CA, et d'homologues communication d'autres CRESS si besoin.",
    calendar: "Phase 1 – Diagnostic et cadrage : analyse de l'existant, recueil des besoins (mois 1).\nPhase 2 – Conception : arborescence, maquettes, choix du prestataire (mois 2 à 4).\nPhase 3 – Développement et recette (mois 5 à 8).\nPhase 4 – Mise en ligne, formation de l'équipe, communication (mois 9).",
    deliveryDate: dayjs("2026-11-30").toDate(),
    sponsorId: director.id,
  });
  await fiche("TES-03", {
    operationalObjectives: "Réaliser une note d'opportunité 2026 sur une filière en lien avec la transition écologique, pour valoriser les filières ou ensembles d'initiatives stratégiques à développer à l'échelle régionale.\nPorter un plaidoyer économique qui alimente les acteurs de l'ESS comme les acteurs publics, voire privés.",
    quantitativeObjectives: "Une note publiée dans l'année ; un questionnaire diffusé à la liste TE et aux adhérents pour choisir le thème.",
    content: "Le thème 2026 se choisit avec une grille d'évaluation et un questionnaire (réemploi, textile, mobilité, BTP). Sujet validé en mars 2026 : réemploi.\nModèle éprouvé par ESS France et une autre CRESS : périmètre et poids économique de la filière, enjeux, état des lieux et rôle de l'ESS, opportunités et défis.\nLe chargé de mission transition écologique est pleinement associé ; le travail garde un lien avec le forum TESS 2026.",
    audience: "Acteurs de l'ESS, acteurs publics, acteurs privés souhaitant rejoindre l'ESS.",
    snessLink: "Axe transition écologique (à venir)",
    sponsorId: director.id,
  });
  const aser = await fiche("COO-02", {
    operationalObjectives: "Répondre à la demande publique et privée en achats socialement et écologiquement responsables : être identifié par les acheteurs, repérer les besoins et les mettre en lien avec les acteurs du territoire, déployer une offre de service CRESS sinon.\nPromouvoir et renforcer l'offre de biens et de services de l'ESS : visibiliser l'offre existante (cartographie, événements, mise en lien), identifier les besoins des organisations ESS pour mieux répondre à la commande publique et privée.",
    quantitativeObjectives: "Constitution d'un réseau d'acheteurs ; 6 entretiens acheteurs avec préconisations d'action ; un groupe d'action animé toute l'année.",
    content: "Webinaire de novembre (61 participants) et forum (environ 120 participants) : besoins identifiés — mieux connaître les besoins des acheteurs publics, renforcer les capacités de l'ESS à répondre à la commande publique, renforcer la visibilité de l'offre ESS, améliorer la mobilisation des acheteurs.\nGroupe d'action animé tout au long de l'année avec les têtes de réseau de l'insertion et de l'emploi.\nLien avec les notes d'opportunité, le forum et la cartographie.",
    audience: "Acheteurs publics et privés de la région ; structures de l'ESS en capacité de répondre à la commande publique.",
    calendar: "À préciser dans le rétroplanning.",
    sponsorId: director.id,
  });
  if (aser) {
    const rq = (field: string, body: string, day: string) => ({ editionId: aser.id, field, body, authorId: director.id, createdAt: dayjs(day).toDate() });
    await prisma.fieldRemark.createMany({ data: [
      rq("content", "À retirer la partie « identifier les filières » : voir faire une fiche filière, ou indiquer les enjeux de filières dans le contexte.", "2026-03-13"),
      rq("calendar", "Non complété. Les dates jalons a minima : la semaine ASER, ceux posés aussi avec l'ADEME, les dates des entretiens, les GT, la sortie de l'offre.", "2026-03-13"),
      rq("quantitativeObjectives", "Préciser le nombre d'acheteurs visés dans le réseau et l'échéance.", "2026-03-13"),
    ] });
    await prisma.notification.create({ data: { personId: (await prisma.project.findFirst({ where: { analyticCode: "COO-02" } }))!.pilotId, senderId: director.id, kind: "info", title: "Remarques sur la fiche PTCE et ESSOR · 2026", body: "3 remarques de la direction à traiter (contenu, calendrier, objectifs quantitatifs).", link: `/edition/${aser.id}?onglet=fiche`, createdAt: dayjs("2026-03-13").toDate() } });
  }

  console.log(`Seed terminé : ${people.length} personnes, ${projectDefs.length} projets, ${allEditions.length} éditions.`);
  void assistant;
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
