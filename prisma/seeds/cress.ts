// Jeu de démonstration de la CRESS (lot I : déplacé tel quel depuis prisma/seed.ts) : tout est fictif (personnes, montants, dates).
import { PrismaClient } from "@prisma/client";
import { findOrCreateOrganisation } from "../../lib/organisations";
import { dayjs } from "../../lib/format";
import { expectedHoursOn, rhythmAt } from "../../lib/time";
import { syncDeadlineNotifications, DEADLINE_KIND } from "../../lib/deadline-notifications";
import { randomBytes } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { Common } from "./common";


// Générateur déterministe pour un seed reproductible.
let seedState = 20260912;
function rnd(): number {
  seedState |= 0;
  seedState = (seedState + 0x6d2b79f5) | 0;
  let t = Math.imul(seedState ^ (seedState >>> 15), 1 | seedState);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const between = (a: number, b: number) => a + Math.floor(rnd() * (b - a + 1));
// Le jeu de démo se cale sur la date du jour : les jalons, livrables et saisies restent cohérents quel que soit le jour de la démo.
const today = dayjs().startOf("day");
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

let UPLOADS = process.env.UPLOAD_DIR ?? path.join(process.cwd(), "uploads");
function storePdf(title: string): { storedName: string; size: number } {
  mkdirSync(UPLOADS, { recursive: true });
  const storedName = `${randomBytes(12).toString("hex")}.pdf`;
  const buf = placeholderPdf(title);
  writeFileSync(path.join(UPLOADS, storedName), buf);
  return { storedName, size: buf.length };
}

export async function seedCress(prisma: PrismaClient, c: Common, uploads: string) {
  UPLOADS = uploads;

  const funderNames = ["Région", "État", "FSE", "ADEME", "Banque des Territoires", "DREETS", "Cap'Asso", "ESS France", "Cotisations"];
  // Genres cumulables (lot E2) : les collectivités et l'État financent ; ESS France est aussi un réseau.
  const funderKinds: Record<string, string> = { "Région": "funder,authority", "État": "funder,authority", "ESS France": "funder,network", "Banque des Territoires": "funder", "DREETS": "funder,authority" };
  const funders = await Promise.all(funderNames.map((name) => prisma.organisation.create({ data: { name, kinds: funderKinds[name] ?? "funder", website: name === "ESS France" ? "https://www.ess-france.org" : null } })));
  // Partenaires et réseaux sans financement, pour l'annuaire.
  const partnerOrgs = await Promise.all([
    { name: "France Active Centre-Val de Loire", kinds: "partner,network", website: "https://www.franceactive-cvl.org" },
    { name: "Université de Tours", kinds: "partner" },
    { name: "Mouvement associatif Centre-Val de Loire", kinds: "network" },
    { name: "Tours Métropole Val de Loire", kinds: "authority,partner" },
  ].map((o) => prisma.organisation.create({ data: o })));

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
    for (const [i, c] of list.entries()) await prisma.contact.create({ data: { organisationId: funders[Number(idx)].id, ...c, primary: i === 0 } });
  }

  // Conventions partagées : FSE 2026-2028 (DLA + sensibilisation) ; CPO Région 2025-2027 pour les projets Région pluriannuels.
  const fseConv = await prisma.convention.create({ data: { funderId: funders[2].id, reference: "FSE-2026-2028", form: "convention", scheme: "FSE+ 2021-2027 — axe inclusion", label: "Convention FSE+ inclusion 2026-2028", startYear: 2026, endYear: 2028, status: "contracted", amountRequested: 180000, amountNotified: 165000, submittedAt: dayjs("2025-10-15").toDate(), notifiedAt: dayjs("2026-02-20").toDate(), signedAt: dayjs("2026-03-28").toDate(), notes: "Trois ans, deux projets ; clés de répartition dans l'onglet FSE de l'Excel RAF." } });
  const cpoConv = await prisma.convention.create({ data: { funderId: funders[0].id, reference: "CPO-REGION-2025-2027", form: "convention", scheme: "Convention pluriannuelle d'objectifs", label: "CPO Région 2025-2027", startYear: 2025, endYear: 2027, status: "contracted", amountRequested: 240000, amountNotified: 225000, submittedAt: dayjs("2024-10-01").toDate(), notifiedAt: dayjs("2025-01-15").toDate(), signedAt: dayjs("2025-02-10").toDate() } });
  // Tranches des conventions partagées (lot A) : versées par l'accord, pas par édition.
  await prisma.payment.createMany({ data: [
    { conventionId: fseConv.id, label: "Avance 2026 (30 %)", amount: 49500, expectedAt: dayjs("2026-04-30").toDate(), receivedAt: dayjs("2026-05-06").toDate(), reference: "FSE-AV-2026" },
    { conventionId: fseConv.id, label: "Acompte 2027 sur bilan intermédiaire", amount: 49500, expectedAt: dayjs("2027-03-31").toDate(), receivedAt: null },
    { conventionId: fseConv.id, label: "Solde 2028 sur bilan final", amount: 66000, expectedAt: dayjs("2028-09-30").toDate(), receivedAt: null },
    { conventionId: cpoConv.id, label: "Tranche 2025", amount: 75000, expectedAt: dayjs("2025-03-31").toDate(), receivedAt: dayjs("2025-04-02").toDate(), reference: "CPO-25" },
    { conventionId: cpoConv.id, label: "Tranche 2026", amount: 75000, expectedAt: dayjs("2026-03-31").toDate(), receivedAt: dayjs("2026-04-14").toDate(), reference: "CPO-26" },
    { conventionId: cpoConv.id, label: "Tranche 2027", amount: 75000, expectedAt: dayjs("2027-03-31").toDate(), receivedAt: null },
  ] });

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
  // Fiche (lot E1) : fonction, téléphone et date d'arrivée fictifs.
  const FICHES: Record<string, [string, string, string]> = {
    "Claire Vasseur": ["Directrice", "02 38 00 00 01", "2019-03-01"],
    "Nadia Ferrand": ["Responsable administrative et financière", "02 38 00 00 02", "2020-09-01"],
    "Léa Morin": ["Assistante de direction", "02 38 00 00 03", "2022-01-10"],
    "Julien Barbot": ["Responsable du pôle Représentation et observation", "06 00 00 00 04", "2017-06-01"],
    "Sophie Delaunay": ["Responsable du pôle Transition et coopération territoriale", "06 00 00 00 05", "2018-11-05"],
    "Maxime Roussel": ["Chargé de mission observation de l'ESS", "06 00 00 00 06", "2021-04-12"],
    "Inès Cabral": ["Chargée de mission plaidoyer et représentation", "06 00 00 00 07", "2023-02-01"],
    "Thomas Guérin": ["Chargé de mission transition écologique", "06 00 00 00 08", "2020-01-06"],
    "Camille Aubert": ["Chargée de mission coopération territoriale", "06 00 00 00 09", "2022-09-01"],
    "Yasmine Benali": ["Chargée de mission emploi et formation", "06 00 00 00 10", "2021-10-04"],
    "Hugo Lemaire": ["Chargé de mission sensibilisation", "06 00 00 00 11", "2019-09-02"],
    "Élise Fontaine": ["Chargée de communication", "06 00 00 00 12", "2023-05-15"],
    "Romain Tessier": ["Chargé de mission événements", "06 00 00 00 13", "2022-03-01"],
    "Lucas Perrin": ["Alternant communication", "06 00 00 00 14", "2025-09-01"],
    "Manon Girard": ["Alternante coopération territoriale", "06 00 00 00 15", "2025-09-01"],
  };
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
  // Comptes de connexion (lot F) : une adresse prenom.nom@exemple.fr et le même mot de passe de démo pour tout le monde
  // (DEMO_PASSWORD, « pilote-demo-2026 » par défaut). Le hachage est celui de better-auth ; aucun mot de passe en clair en base.
  const passwordHash = c.passwordHash;
  const emailOf = c.emailOf;
  const people: Awaited<ReturnType<typeof prisma.person.create>>[] = [];
  for (let i = 0; i < peopleDefs.length; i++) {
    const p = peopleDefs[i];
    const email = emailOf(p.name);
    // Compte « credential » : better-auth exige accountId = id du User (pas l'e-mail), d'où la création en deux temps.
    const user = await prisma.user.create({ data: { name: p.name, email, emailVerified: true } });
    await prisma.account.create({ data: { userId: user.id, accountId: user.id, providerId: "credential", password: passwordHash } });
    people.push(
      await prisma.person.create({
        data: {
          name: p.name, firstName: p.name.split(" ")[0], lastName: p.name.split(" ").slice(1).join(" "),
          jobTitle: FICHES[p.name]?.[0] ?? null, phone: FICHES[p.name]?.[1] ?? null, arrivedAt: FICHES[p.name] ? new Date(FICHES[p.name][2]) : null,
          role: p.role, workRhythm: p.rhythm, availableDays: p.days, poleId: p.pole === null ? null : poles[p.pole].id, order: i, icsToken: randomBytes(18).toString("base64url"), email, userId: user.id,
        },
      }),
    );
  }
  const [director, raf, assistant, leadA, leadB] = people;
  // Périodes de rythme : tout le monde depuis le 01/01/2026 ; Camille passe à 80 % au 1er septembre ; Thomas passe d'option A à B au 1er juillet.
  for (const p of people) {
    if (p.name === "Camille Aubert") {
      await prisma.personRhythmPeriod.create({ data: { personId: p.id, rhythmId: c.rhythmByCode("option_a").id, from: dayjs("2026-01-01").toDate(), to: dayjs("2026-08-31").toDate() } });
      await prisma.personRhythmPeriod.create({ data: { personId: p.id, rhythmId: c.rhythmByCode("part_time").id, from: dayjs("2026-09-01").toDate() } });
    } else if (p.name === "Thomas Guérin") {
      await prisma.personRhythmPeriod.create({ data: { personId: p.id, rhythmId: c.rhythmByCode("option_a").id, from: dayjs("2026-01-01").toDate(), to: dayjs("2026-06-30").toDate() } });
      await prisma.personRhythmPeriod.create({ data: { personId: p.id, rhythmId: c.rhythmByCode("option_b").id, from: dayjs("2026-07-01").toDate() } });
      await prisma.person.update({ where: { id: p.id }, data: { workRhythm: "option_b" } });
    } else {
      await prisma.personRhythmPeriod.create({ data: { personId: p.id, rhythmId: c.rhythmByCode(p.workRhythm).id, from: dayjs("2026-01-01").toDate() } });
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


  // ─────────────────────────────────────────────────────────────────────────────────────────────
  // Projets : vingt projets, chacun avec ses actions datées dans l'année (mois, jour) et ses textes de fiche.
  // Une action dont le jalon est passé est faite, sauf celles marquées `late` (deux dans toute la CRESS : c'est la vie,
  // pas une catastrophe). Les jalons proches sont « en cours », les lointains « à faire ».
  // ─────────────────────────────────────────────────────────────────────────────────────────────
  type A = { name: string; m: number; d?: number; late?: boolean; target?: number; pub?: boolean; desc?: string; venue?: string; who?: string };
  type PD = {
    name: string; code: string; pole: number; mission: number; actions: A[]; funders: number[]; envelope: number; secondary?: number[];
    objectives: string; quantitative: string; content: string; audience: string; partners: string; indicators: [string, string, string | null, boolean][];
    stakes: string; priorities: string; expected: string; timeNeed: string; recurring?: boolean;
  };
  const projectDefs: PD[] = [
    { name: "Vœux et assemblée générale", code: "REP-01", pole: 0, mission: 0, funders: [8, 0], envelope: 9000,
      actions: [{ name: "Préparer les vœux", m: 1, d: 22, target: 35 }, { name: "Convoquer l'AG", m: 5, d: 20, target: 14 }, { name: "Rapport d'activité", m: 5, d: 29, target: 70 }, { name: "Logistique de l'AG", m: 6, d: 18, target: 42, pub: true, venue: "Hôtel de Région, Orléans", desc: "Accueil, émargement, restauration, vote électronique." }, { name: "Bilan de l'AG", m: 9, d: 25, target: 14 }],
      objectives: "Tenir les temps statutaires (vœux, AG) comme des moments de réseau : donner à voir l'année, faire voter les orientations, réunir adhérents et partenaires.",
      quantitative: "150 participants à l'AG ; quorum atteint au premier tour ; rapport d'activité diffusé avant l'AG.",
      content: "Vœux en janvier avec les partenaires institutionnels ; AG statutaire en juin avec un temps d'échange sur le plan stratégique ; rapport d'activité illustré.",
      audience: "Adhérents, administrateurs, partenaires institutionnels (Région, État, collectivités).",
      partners: "Région Centre-Val de Loire, Hôtel de Région (accueil), ESS France.",
      indicators: [["Participants à l'AG", "150", "162", false], ["Adhérents votants", "80", "88", false], ["Rapport d'activité diffusé (J-15)", "oui", "oui", true]],
      stakes: "Une AG qui reste un moment de réseau et pas seulement une formalité.", priorities: "Adosser l'AG au plan stratégique 2027-2030.", expected: "Une participation stable, un rapport d'activité réutilisable pour les financeurs.", timeNeed: "45 jours toutes personnes confondues" },
    { name: "AIESSE et campagnes électorales", code: "REP-02", pole: 0, mission: 0, funders: [0, 8, 7], envelope: 6000,
      actions: [{ name: "Note de positionnement", m: 2, d: 6, target: 28 }, { name: "Rencontres candidats", m: 3, d: 10, target: 42, desc: "Un rendez-vous par liste tête de métropole (Orléans, Tours, Blois)." }, { name: "Lettre AIESSE n°1", m: 4, d: 24, target: 21 }, { name: "Lettre AIESSE n°2", m: 9, d: 19, target: 21 }, { name: "Plaidoyer régional", m: 11, d: 12, target: 35 }],
      objectives: "Porter la voix de l'ESS auprès des élus et candidats : positionner l'ESS dans les programmes municipaux 2026, puis dans les politiques régionales.",
      quantitative: "10 rencontres candidats ; 2 lettres AIESSE ; une note de positionnement reprise par 3 listes.",
      content: "Note de positionnement en 10 propositions ; rencontres bilatérales pendant la campagne municipale ; deux lettres aux élus dans l'année ; contribution au plaidoyer régional d'ESS France.",
      audience: "Candidats et élus municipaux et régionaux, services des collectivités.",
      partners: "ESS France, réseaux adhérents, Association des maires.",
      indicators: [["Rencontres candidats", "10", "11", false], ["Reprises dans les programmes", "3", "4", false], ["Lettres AIESSE envoyées", "2", "1", false]],
      stakes: "Année d'élections municipales : la fenêtre pour inscrire l'ESS dans les programmes.", priorities: "Métropoles d'Orléans et de Tours d'abord.", expected: "Des élus qui connaissent la CRESS avant la première sollicitation.", timeNeed: "40 jours" },
    { name: "Réseau Femmes et ESS", code: "REP-03", pole: 0, mission: 0, funders: [1, 0], envelope: 12000,
      actions: [{ name: "Cycle de rencontres", m: 3, d: 27, target: 56, desc: "Trois rencontres régionales (Tours, Orléans, Châteauroux) : témoignages et ateliers." }, { name: "Baromètre égalité", m: 10, d: 16, target: 70 }, { name: "Restitution publique", m: 12, d: 3, target: 21, pub: true, venue: "Tours, Maison de l'économie sociale" }],
      objectives: "Animer le réseau régional Femmes et ESS ; produire un baromètre égalité femmes-hommes dans l'ESS régionale ; le restituer publiquement.",
      quantitative: "3 rencontres, 120 participantes ; un baromètre publié ; une restitution avec 60 personnes.",
      content: "Cycle de trois rencontres thématiques (gouvernance, rémunérations, entrepreneuriat) ; baromètre construit avec l'Observatoire à partir des données INSEE et d'une enquête adhérents ; restitution en décembre.",
      audience: "Dirigeantes et salariées de l'ESS, réseaux féminins, DREETS (délégation aux droits des femmes).",
      partners: "DREETS, Région, réseaux Femmes des CRESS voisines, ORESS.",
      indicators: [["Participantes aux rencontres", "120", "97", true], ["Structures représentées", "60", "51", true], ["Baromètre publié", "oui", null, false]],
      stakes: "Consolider un réseau né en 2024 et le doter d'un chiffre de référence.", priorities: "Sortir le baromètre avant la restitution.", expected: "Un baromètre cité dans le rapport égalité de la Région.", timeNeed: "60 jours" },
    { name: "Observatoire régional (ORESS)", code: "OBS-01", pole: 0, mission: 1, funders: [0, 1, 7], envelope: 18000,
      actions: [{ name: "Collecte des données", m: 2, d: 13, target: 42 }, { name: "Chiffres de l'emploi", m: 5, d: 6, target: 56, desc: "Panorama 2025 de l'emploi ESS : évolution par secteur et par département." }, { name: "Petit-déjeuner ORESS · mars · emploi", m: 3, d: 18, target: 14, pub: true, desc: "Chiffres de l'emploi ESS 2025 : évolution par secteur, focus sur les services à la personne.", venue: "CRESS, Orléans — salle du CA", who: "Têtes de réseau, DREETS, Région ; 24 inscrits" }, { name: "Note de conjoncture", m: 9, d: 30, target: 28 }, { name: "Mise à jour du site", m: 7, d: 8, target: 14 }, { name: "Comité technique", m: 11, d: 5, target: 7, desc: "Comité technique annuel de l'Observatoire : sources, calendrier 2027, demandes des pôles." }, { name: "Petit-déjeuner ORESS · juin · réemploi", m: 6, d: 24, target: 14, pub: true, desc: "Filière réemploi : état des lieux régional, chiffres et acteurs.", venue: "Tours — tiers-lieu partenaire", who: "Structures du réemploi, ADEME, collectivités ; 31 inscrits" }, { name: "Petit-déjeuner ORESS · octobre · égalité", m: 10, d: 14, target: 14, pub: true, desc: "Baromètre égalité femmes-hommes dans l'ESS régionale.", venue: "CRESS, Orléans", who: "Réseau Femmes et ESS, adhérents" }],
      objectives: "Produire et diffuser les chiffres de l'ESS régionale (emploi, établissements, secteurs) ; répondre aux demandes de données des pôles, des adhérents et des partenaires.",
      quantitative: "Un panorama de l'emploi ; 3 petits-déjeuners (80 inscrits cumulés) ; une note de conjoncture ; 20 demandes de données traitées.",
      content: "Collecte INSEE-ACOSS au premier trimestre, panorama en mai, petits-déjeuners thématiques en mars, juin et octobre, note de conjoncture à la rentrée, comité technique en novembre. L'Observatoire alimente aussi le baromètre égalité et la note d'opportunité réemploi.",
      audience: "Têtes de réseau, collectivités, DREETS, Région, presse régionale ; les autres pôles de la CRESS.",
      partners: "ESS France (ONESS), INSEE, URSSAF-ACOSS, DREETS.",
      indicators: [["Inscrits aux petits-déjeuners", "80", "55", true], ["Demandes de données traitées", "20", "14", false], ["Publications", "3", "2", true]],
      stakes: "L'Observatoire est la fonction support de tous les autres projets : ses chiffres doivent sortir à date.", priorities: "Panorama de l'emploi avant le Mois de l'ESS ; comité technique pour planifier 2027.", expected: "Des chiffres cités par la Région et la presse ; moins de demandes « pour hier ».", timeNeed: "110 jours" },
    { name: "Étude santé et économie", code: "OBS-02", pole: 0, mission: 1, funders: [0, 5], envelope: 15000,
      actions: [{ name: "Cadrage", m: 2, d: 20, target: 21 }, { name: "Entretiens", m: 5, d: 22, target: 56, desc: "Douze entretiens semi-directifs avec des structures de la santé et du médico-social." }, { name: "Rédaction", m: 9, d: 30, target: 70 }, { name: "Restitution", m: 11, d: 20, target: 14, pub: true, venue: "Orléans, ARS" }],
      objectives: "Mesurer le poids de l'ESS dans la santé et le médico-social régional et repérer les coopérations possibles avec l'ARS et les collectivités.",
      quantitative: "12 entretiens ; une étude de 40 pages ; une restitution avec 50 personnes.",
      content: "Cadrage avec l'ARS et la DREETS, entretiens au printemps, rédaction à l'été, restitution en novembre. Livrable : étude, synthèse de 4 pages, jeu de données.",
      audience: "ARS, DREETS, Région, fédérations de la santé et du médico-social.",
      partners: "ARS, DREETS, URIOPSS, Mutualité française.",
      indicators: [["Entretiens réalisés", "12", "12", true], ["Participants à la restitution", "50", null, false]],
      stakes: "Première étude sectorielle de l'Observatoire : elle doit installer une méthode reproductible.", priorities: "Tenir la restitution en novembre, avant les arbitrages budgétaires de l'ARS.", expected: "Une étude qui ouvre une convention ARS en 2027.", timeNeed: "75 jours" },
    { name: "Chroniquer la TESS", code: "TES-01", pole: 1, mission: 2, funders: [3, 0], envelope: 8000,
      actions: [{ name: "Repérage d'initiatives", m: 3, d: 13, target: 21 }, { name: "Rédaction des chroniques", m: 10, d: 9, target: 56, desc: "Dix chroniques dans l'année, une par mois hors été." }, { name: "Diffusion", m: 11, d: 13, target: 14 }, { name: "Bilan annuel", m: 12, d: 11, target: 7 }],
      objectives: "Donner à voir, chaque mois, une initiative de transition écologique et sociale portée par l'ESS régionale.",
      quantitative: "10 chroniques ; 6 000 lectures cumulées ; 4 reprises presse.",
      content: "Repérage avec les adhérents et les collectivités, entretien et rédaction, diffusion newsletter, site et réseaux sociaux ; sélection des chroniques pour le Forum TESS.",
      audience: "Grand public régional, adhérents, collectivités, presse.",
      partners: "ADEME, Région, La Nouvelle République (partenariat éditorial).",
      indicators: [["Chroniques publiées", "10", "7", true], ["Lectures", "6 000", "4 300", false]],
      stakes: "Le récit de la transition par l'ESS, à faible coût, réutilisable partout.", priorities: "Tenir le rythme mensuel.", expected: "Une chronique reprise par la presse par trimestre.", timeNeed: "35 jours" },
    { name: "Cycle de conférences transition", code: "TES-02", pole: 1, mission: 2, funders: [3, 0, 4], envelope: 14000,
      actions: [{ name: "Programme", m: 1, d: 30, target: 21 }, { name: "Intervenants", m: 3, d: 6, target: 28 }, { name: "Conférence 1", m: 4, d: 9, target: 35, pub: true, venue: "Tours, Mame", desc: "Alimentation durable et ESS." }, { name: "Conférence 2", m: 6, d: 11, target: 35, pub: true, venue: "Orléans, Lab'O", desc: "Réemploi et économie circulaire." }, { name: "Conférence 3", m: 10, d: 8, target: 35, pub: true, venue: "Blois, Halle aux grains", desc: "Énergie citoyenne." }, { name: "Évaluation", m: 11, d: 27, target: 14 }],
      objectives: "Trois conférences régionales pour relier transition écologique et ESS, avec les acteurs et les collectivités.",
      quantitative: "3 conférences, 300 participants cumulés, 85 % de satisfaction.",
      content: "Programme construit en janvier avec l'ADEME et la Banque des Territoires ; conférences en avril, juin et octobre dans trois villes ; évaluation en novembre.",
      audience: "Acteurs de l'ESS, collectivités, entreprises engagées, étudiants.",
      partners: "ADEME, Banque des Territoires, Région, tiers-lieux hôtes.",
      indicators: [["Participants cumulés", "300", "214", true], ["Satisfaction", "85 %", "91 %", false], ["Collectivités représentées", "25", "19", true]],
      stakes: "Un cycle attendu par l'ADEME comme vitrine régionale.", priorities: "La troisième conférence à Blois, encore sans salle confirmée en juin.", expected: "Un cycle reconduit en 2027 avec un quatrième partenaire.", timeNeed: "70 jours" },
    { name: "Note d'opportunité réemploi", code: "TES-03", pole: 1, mission: 2, funders: [3, 1], envelope: 10000,
      actions: [{ name: "Diagnostic territorial", m: 4, d: 17, target: 42 }, { name: "Ateliers", m: 6, d: 26, target: 28, desc: "Deux ateliers avec les structures du réemploi (Tours, Chartres)." }, { name: "Note d'opportunité", m: 10, d: 15, target: 56 }],
      objectives: "Réaliser une note d'opportunité 2026 sur une filière en lien avec la transition écologique, pour valoriser les filières ou ensembles d'initiatives stratégiques à développer à l'échelle régionale.\nPorter un plaidoyer économique qui alimente les acteurs de l'ESS comme les acteurs publics, voire privés.",
      quantitative: "Une note publiée dans l'année ; un questionnaire diffusé à la liste TE et aux adhérents pour choisir le thème.",
      content: "Le thème 2026 se choisit avec une grille d'évaluation et un questionnaire (réemploi, textile, mobilité, BTP). Sujet validé en mars 2026 : réemploi.\nModèle éprouvé par ESS France et une autre CRESS : périmètre et poids économique de la filière, enjeux, état des lieux et rôle de l'ESS, opportunités et défis.\nLe chargé de mission transition écologique est pleinement associé ; le travail garde un lien avec le forum TESS 2026.",
      audience: "Acteurs de la filière réemploi, ADEME, Région, collectivités compétentes déchets.",
      partners: "ADEME, ESS France, réseau des ressourceries, collectivités.",
      indicators: [["Structures rencontrées", "15", "13", true], ["Note publiée", "oui", null, true]],
      stakes: "Le financement ADEME couvre la note sans ligne dédiée : le cadrage doit être écrit noir sur blanc.", priorities: "Choisir le thème avant avril ; livrer en octobre.", expected: "Une note reprise dans le plan régional économie circulaire.", timeNeed: "55 jours" },
    { name: "Carte et ressource TESS", code: "TES-04", pole: 1, mission: 2, funders: [0, 4], envelope: 7000,
      actions: [{ name: "Collecte", m: 3, d: 20, target: 28 }, { name: "Cartographie", m: 6, d: 5, target: 35 }, { name: "Publication", m: 9, d: 4, late: true, target: 14, desc: "Mise en ligne de la carte sur le site (dépend de la refonte)." }, { name: "Animation", m: 11, d: 6, target: 21 }],
      objectives: "Cartographier les initiatives de transition écologique et sociale de l'ESS régionale et en faire une ressource consultable.",
      quantitative: "250 initiatives cartographiées ; carte en ligne ; 2 000 consultations.",
      content: "Collecte auprès des adhérents et des collectivités, cartographie sur fond ouvert, publication sur le nouveau site, animation à la rentrée (mises à jour, appels à contributions).",
      audience: "Collectivités, porteurs de projets, grand public.",
      partners: "Banque des Territoires, Région, ESSOR.",
      indicators: [["Initiatives cartographiées", "250", "233", true], ["Consultations", "2 000", null, false]],
      stakes: "La carte dépend de la refonte du site : les deux calendriers doivent se parler.", priorities: "Publier dès que le site le permet.", expected: "Une ressource mise à jour par les acteurs eux-mêmes en 2027.", timeNeed: "30 jours" },
    { name: "Lab des coopérations", code: "TES-05", pole: 1, mission: 2, funders: [4, 0, 1], envelope: 22000,
      actions: [{ name: "Appel à projets", m: 2, d: 27, target: 21 }, { name: "Sélection", m: 4, d: 24, target: 14, desc: "Jury de 8 personnes, 14 candidatures, 6 lauréats." }, { name: "Accompagnement", m: 9, d: 30, target: 84 }, { name: "Journée du lab", m: 10, d: 22, target: 35, pub: true, venue: "Châteauroux, Équinoxe", desc: "Restitution des six coopérations accompagnées, ateliers ouverts." }, { name: "Bilan", m: 12, d: 10, target: 14 }],
      objectives: "Faire émerger et accompagner six coopérations territoriales entre structures de l'ESS, collectivités et entreprises.",
      quantitative: "6 coopérations accompagnées ; 120 participants à la journée du lab ; 3 coopérations poursuivies en 2027.",
      content: "Appel à projets en février, sélection en avril, accompagnement collectif et individuel jusqu'en octobre, journée du lab en octobre, bilan en décembre.",
      audience: "Structures de l'ESS, collectivités, entreprises locales, PTCE.",
      partners: "Banque des Territoires, Région, DREETS, France Active.",
      indicators: [["Coopérations accompagnées", "6", "6", true], ["Participants à la journée du lab", "120", null, true], ["Coopérations poursuivies", "3", null, false]],
      stakes: "Le plus gros financement du pôle : les indicateurs Banque des Territoires sont contractuels.", priorities: "Réussir la journée du lab.", expected: "Trois coopérations qui continuent sans nous.", timeNeed: "120 jours" },
    { name: "Club des collectivités", code: "COO-01", pole: 1, mission: 2, funders: [0, 8], envelope: 5000,
      actions: [{ name: "Réunion 1", m: 3, d: 12, target: 14, desc: "Commande publique responsable." }, { name: "Réunion 2", m: 6, d: 17, target: 14, desc: "Foncier et tiers-lieux." }, { name: "Réunion 3", m: 10, d: 1, target: 14, desc: "Budgets 2027 : où placer l'ESS." }, { name: "Newsletter club", m: 12, d: 4, target: 7 }],
      objectives: "Réunir trois fois par an les collectivités engagées pour l'ESS ; faire circuler les pratiques.",
      quantitative: "3 réunions, 25 collectivités membres, une newsletter.",
      content: "Réunions thématiques d'une demi-journée, alternant visites et ateliers ; newsletter annuelle du club ; lien avec le plaidoyer et la communauté des financeurs.",
      audience: "Élus et techniciens des collectivités (EPCI, départements, Région).",
      partners: "Région, Association des maires, RTES.",
      indicators: [["Collectivités membres", "25", "27", false], ["Participants par réunion", "30", "34", false]],
      stakes: "Le club est la porte d'entrée des collectivités vers tous nos projets.", priorities: "Recruter cinq nouvelles collectivités.", expected: "Des collectivités qui sollicitent la CRESS avant leurs arbitrages.", timeNeed: "25 jours" },
    { name: "PTCE et ESSOR", code: "COO-02", pole: 1, mission: 2, funders: [1, 0, 5], envelope: 20000,
      actions: [{ name: "Animation du réseau", m: 9, d: 30, target: 70 }, { name: "Plateforme ESSOR", m: 5, d: 15, target: 42, desc: "Mise en ligne de la V2 de la plateforme avec les fiches PTCE." }, { name: "Rencontre régionale", m: 11, d: 18, target: 35, pub: true, venue: "Vierzon, PTCE Sud Berry", desc: "Rencontre annuelle des PTCE de la région." }, { name: "Suivi des PTCE", m: 10, d: 23, target: 42 }, { name: "Bilan", m: 12, d: 15, target: 14 }],
      objectives: "Répondre à la demande publique et privée en achats socialement et écologiquement responsables : être identifié par les acheteurs, repérer les besoins et les mettre en lien avec les acteurs du territoire, déployer une offre de service CRESS sinon.\nPromouvoir et renforcer l'offre de biens et de services de l'ESS : visibiliser l'offre existante (cartographie, événements, mise en lien), identifier les besoins des organisations ESS pour mieux répondre à la commande publique et privée.",
      quantitative: "Constitution d'un réseau d'acheteurs ; 6 entretiens acheteurs avec préconisations d'action ; un groupe d'action animé toute l'année.",
      content: "Webinaire de novembre (61 participants) et forum (environ 120 participants) : besoins identifiés — mieux connaître les besoins des acheteurs publics, renforcer les capacités de l'ESS à répondre à la commande publique, renforcer la visibilité de l'offre ESS, améliorer la mobilisation des acheteurs.\nGroupe d'action animé tout au long de l'année avec les têtes de réseau de l'insertion et de l'emploi.\nLien avec les notes d'opportunité, le forum et la cartographie.",
      audience: "Acheteurs publics et privés de la région ; structures de l'ESS en capacité de répondre à la commande publique.",
      partners: "DREETS, Région, France Active, réseau national des PTCE.",
      indicators: [["PTCE accompagnés", "7", "7", true], ["Entretiens acheteurs", "6", "4", false], ["Participants à la rencontre régionale", "80", null, true]],
      stakes: "Structurer un réseau de PTCE encore jeune, sans compétence interne au départ.", priorities: "La rencontre régionale de novembre.", expected: "Un réseau qui se réunit sans la CRESS en 2028.", timeNeed: "90 jours" },
    { name: "Dispositif local d'accompagnement (DLA)", code: "DLA-01", pole: 1, mission: 2, funders: [1, 2, 4, 0], envelope: 45000,
      actions: [{ name: "Diagnostics", m: 9, d: 30, target: 140, desc: "Vingt diagnostics de structures dans l'année." }, { name: "Ingénieries collectives", m: 10, d: 30, target: 84 }, { name: "Comité d'appui", m: 9, d: 24, target: 14, desc: "Comité d'appui de rentrée : validation des ingénieries du second semestre." }, { name: "Reporting national", m: 7, d: 15, target: 21 }, { name: "Bilan qualitatif", m: 12, d: 4, target: 28 }, { name: "Bilan financier", m: 12, d: 18, target: 21 }],
      objectives: "Accompagner les structures employeuses de l'ESS dans la consolidation de leurs emplois : diagnostics, ingénieries individuelles et collectives, suivi.",
      quantitative: "20 diagnostics ; 14 ingénieries individuelles ; 3 ingénieries collectives ; 180 emplois concernés.",
      content: "Accueil et diagnostic des structures orientées par les partenaires, plan d'accompagnement validé en comité d'appui, prestataires sélectionnés, suivi à six mois ; reporting national trimestriel sur l'outil DLA.",
      audience: "Associations et coopératives employeuses de la région, en particulier les moins de 10 salariés.",
      partners: "DREETS, FSE+, Banque des Territoires, Région, France Active, réseaux adhérents.",
      indicators: [["Diagnostics réalisés", "20", "15", true], ["Ingénieries individuelles", "14", "9", true], ["Emplois concernés", "180", "131", true], ["Ingénieries collectives", "3", "2", true]],
      stakes: "Le DLA garde ses outils nationaux ; l'outil de la CRESS suit la charge, les jalons et les livrables FSE.", priorities: "Justificatifs FSE à jour chaque trimestre.", expected: "Un bilan qualitatif prêt pour la DREETS début décembre.", timeNeed: "260 jours" },
    { name: "Structures en difficulté", code: "COO-03", pole: 1, mission: 2, funders: [5, 0], envelope: 9000,
      actions: [{ name: "Référencement", m: 4, d: 3, target: 21 }, { name: "Orientation AIO", m: 9, d: 30, target: 56, desc: "Accueil, information, orientation : 30 orientations attendues dans l'année." }, { name: "Ingénieries", m: 11, d: 27, target: 42 }],
      objectives: "Accueillir, informer et orienter les structures de l'ESS en difficulté vers les bons dispositifs (DLA, France Active, procédures collectives).",
      quantitative: "30 orientations ; 10 ingénieries ; délai de premier rendez-vous inférieur à 10 jours.",
      content: "Guichet permanent (mail, téléphone), rendez-vous sous dix jours, référencement des dispositifs régionaux, ingénieries courtes avec France Active et les experts-comptables partenaires.",
      audience: "Structures de l'ESS fragilisées, dirigeants bénévoles, réseaux adhérents.",
      partners: "DREETS, Région, France Active, CIP, experts-comptables.",
      indicators: [["Orientations", "30", "22", true], ["Délai moyen de premier rendez-vous (jours)", "10", "8", false]],
      stakes: "Un métier de guichet : la charge ne se planifie pas, elle s'absorbe.", priorities: "Tenir le délai de dix jours.", expected: "Aucune structure orientée trop tard.", timeNeed: "50 jours" },
    { name: "Mois de l'ESS et Prix ESS", code: "SEN-01", pole: 2, mission: 3, funders: [0, 7, 8], envelope: 16000,
      actions: [{ name: "Appel à événements", m: 6, d: 30, target: 21 }, { name: "Programme régional", m: 9, d: 30, target: 77, desc: "Programme des événements labellisés, mise en ligne sur le site national." }, { name: "Jury du Prix", m: 10, d: 6, target: 14, venue: "CRESS, Orléans", who: "Jury : Région, Crédit Coopératif, ESS France, deux administrateurs" }, { name: "Soirée de remise", m: 11, d: 19, target: 105, pub: true, venue: "Orléans, Théâtre d'Orléans", desc: "Soirée de remise des Prix ESS régionaux, 200 invités." }, { name: "Communication", m: 10, d: 30, target: 35 }, { name: "Bilan", m: 12, d: 9, target: 14 }],
      objectives: "Coordonner le Mois de l'ESS en région (novembre) et organiser le Prix ESS régional.",
      quantitative: "60 événements labellisés ; 25 candidatures au Prix ; 200 invités à la soirée.",
      content: "Appel à événements en juin, programme régional en septembre, jury en octobre, soirée de remise en novembre, communication tout au long, bilan en décembre.",
      audience: "Structures de l'ESS, grand public, élus, presse.",
      partners: "ESS France, Région, Crédit Coopératif, adhérents organisateurs.",
      indicators: [["Événements labellisés", "60", "48", true], ["Candidatures au Prix", "25", "27", false], ["Invités à la soirée", "200", null, false]],
      stakes: "Le temps fort de visibilité de l'année, avec quatre personnes mobilisées.", priorities: "Un programme complet avant le 30 septembre.", expected: "Une couverture presse dans les six départements.", timeNeed: "95 jours" },
    { name: "Sensibilisation des jeunes", code: "SEN-02", pole: 2, mission: 3, secondary: [0], funders: [0, 1, 2], envelope: 11000,
      actions: [{ name: "Interventions hors scolaire", m: 10, d: 30, target: 56, desc: "Interventions avec les têtes de réseau (missions locales, MJC), pas d'intervention directe en lycée." }, { name: "Relations universités", m: 5, d: 13, target: 28 }, { name: "Forums et salons", m: 10, d: 20, target: 42, pub: true, venue: "Forums SPRO (Tours, Orléans, Bourges)" }, { name: "Kit pédagogique", m: 7, d: 3, target: 35, desc: "Kit « L'ESS en 5 ateliers » pour les têtes de réseau." }],
      objectives: "Faire connaître l'ESS aux jeunes et à ceux qui les accompagnent, par les têtes de réseau plutôt qu'en direct.",
      quantitative: "15 interventions ; 3 forums SPRO ; un kit pédagogique diffusé à 40 structures.",
      content: "Kit pédagogique livré à l'été ; interventions co-animées avec les têtes de réseau ; présence sur les forums SPRO à l'automne ; conventions avec deux universités (interventions facturées).",
      audience: "Jeunes de 16 à 25 ans via missions locales, MJC, universités, CFA.",
      partners: "Région (SPRO), DREETS, FSE+, universités de Tours et d'Orléans, CFA Orléans Métropole.",
      indicators: [["Interventions", "15", "11", true], ["Jeunes touchés", "600", "410", true], ["Structures équipées du kit", "40", "26", false]],
      stakes: "Passer d'interventions en direct à l'outillage des têtes de réseau.", priorities: "Diffuser le kit avant les forums SPRO.", expected: "Des têtes de réseau autonomes sur la sensibilisation.", timeNeed: "80 jours" },
    { name: "Newsletter et lettre aux adhérents", code: "COM-01", pole: 2, mission: 3, funders: [8, 0], envelope: 3000,
      actions: [{ name: "Newsletter mensuelle", m: 10, d: 2, target: 70, desc: "Onze numéros dans l'année." }, { name: "Lettre aux adhérents", m: 6, d: 19, target: 14 }, { name: "Base de contacts", m: 4, d: 10, target: 21 }],
      objectives: "Informer chaque mois l'écosystème régional et, deux fois par an, les adhérents.",
      quantitative: "11 newsletters ; taux d'ouverture 38 % ; 2 lettres aux adhérents.",
      content: "Newsletter mensuelle (actualités, agenda, chroniques), lettre aux adhérents en juin et décembre, base de contacts nettoyée au printemps (RGPD).",
      audience: "4 200 abonnés ; 230 adhérents.",
      partners: "—",
      indicators: [["Newsletters envoyées", "11", "8", false], ["Taux d'ouverture", "38 %", "41 %", false]],
      stakes: "Le canal le moins cher et le plus lu.", priorities: "Ne pas rater un numéro pendant la refonte du site.", expected: "Un taux d'ouverture stable au-dessus de 38 %.", timeNeed: "40 jours" },
    { name: "Refonte du site internet", code: "COM-02", pole: 2, mission: 3, funders: [0, 4, 8], envelope: 25000, recurring: false,
      actions: [{ name: "Cahier des charges", m: 3, d: 6, target: 42 }, { name: "Choix du prestataire", m: 5, d: 15, target: 21, desc: "Trois offres reçues ; prestataire coopératif retenu." }, { name: "Recette", m: 9, d: 28, target: 35 }, { name: "Mise en ligne", m: 11, d: 15, target: 21 }, { name: "Formation de l'équipe", m: 11, d: 30, target: 14 }],
      objectives: "Moderniser l'image de la CRESS avec un site clair, accessible et cohérent avec son identité.\nAméliorer la lisibilité de l'offre de services et des missions auprès des acteurs de l'ESS.\nFaciliter l'accès à l'information pour les différents publics (adhérents, partenaires, grand public).\nRenforcer la visibilité de l'ESS en région Centre-Val de Loire.",
      quantitative: "Un site livré et mis en ligne dans l'année ; indicateurs de fréquentation suivis (Matomo) ; conformité RGAA vérifiée.",
      content: "Le site devra être conçu dans une logique d'UX design, centré sur les besoins des utilisateurs. Un temps de réflexion collective pourra être prévu.\nValeur ajoutée : un site plus ergonomique et intuitif ; une meilleure visibilité des actions et de l'impact de la CRESS ; un outil centralisé pour fédérer et informer l'écosystème ESS régional ; un gain de temps pour l'équipe grâce à une gestion de contenus simplifiée ; une image renforcée de professionnalisme auprès des partenaires institutionnels.\nLe site intégrera les indicateurs de suivi (Matomo), respectera le RGAA et des pratiques de communication digitale responsables, et répondra aux exigences minimales de cybersécurité.",
      audience: "Structures de l'ESS ; adhérents et futurs adhérents ; collectivités territoriales et partenaires institutionnels ; porteurs de projets et entrepreneurs de l'ESS ; grand public intéressé par l'ESS.",
      partners: "Prestataire retenu (coopérative web), Banque des Territoires, homologues communication des CRESS.",
      indicators: [["Site mis en ligne", "oui", null, false], ["Conformité RGAA (audit)", "oui", null, false], ["Visiteurs mensuels (3 mois après)", "5 000", null, false]],
      stakes: "Un chantier ponctuel, avec un prestataire et un budget d'investissement : le seul projet non récurrent du pôle.", priorities: "Recette en septembre, mise en ligne avant le Mois de l'ESS.", expected: "Un site qui sert de support à la carte TESS et à l'agenda régional.", timeNeed: "65 jours" },
    { name: "Forum régional de l'ESS", code: "SEN-03", pole: 2, mission: 3, secondary: [1], funders: [0, 1, 7], envelope: 30000,
      actions: [{ name: "Lieu et date", m: 1, d: 16, target: 7 }, { name: "Programme", m: 4, d: 3, target: 42 }, { name: "Partenaires", m: 5, d: 7, target: 35, desc: "Quatorze exposants confirmés." }, { name: "Inscriptions", m: 6, d: 5, target: 14 }, { name: "Jour J", m: 6, d: 12, target: 56, pub: true, venue: "Tours, Palais des congrès", desc: "Forum régional : plénière, 6 ateliers, village des exposants, 118 participants." }, { name: "Bilan", m: 9, d: 15, target: 21 }],
      objectives: "Réunir une fois par an l'ESS régionale et ses partenaires autour d'un thème : en 2026, « Coopérer pour la transition ».",
      quantitative: "150 participants ; 15 exposants ; un atelier par mission du plan opérationnel.",
      content: "Choix du lieu en janvier, programme en avril, partenaires et exposants en mai, inscriptions en juin, forum le 12 juin à Tours, bilan en septembre.",
      audience: "Structures de l'ESS, collectivités, financeurs, étudiants, presse.",
      partners: "Région, État, ESS France, Palais des congrès de Tours, exposants.",
      indicators: [["Participants", "150", "118", true], ["Exposants", "15", "14", true], ["Satisfaction", "85 %", "88 %", false]],
      stakes: "Projet commun aux deux pôles ; le financeur retient désormais 120 participants dans l'avenant.", priorities: "Bilan et justificatifs État avant fin septembre.", expected: "Un forum 2027 confirmé avec la Région dès décembre.", timeNeed: "85 jours" },
    { name: "Communauté des financeurs", code: "COO-04", pole: 1, mission: 0, secondary: [0], funders: [4, 0, 5], envelope: 6000,
      actions: [{ name: "Cartographie des financeurs", m: 5, d: 28, target: 28 }, { name: "Rencontre annuelle", m: 10, d: 15, target: 28, pub: true, venue: "Orléans, Banque des Territoires", desc: "Rencontre annuelle des financeurs de l'ESS régionale." }, { name: "Fiches dispositifs", m: 11, d: 20, target: 21 }],
      objectives: "Faire se rencontrer les financeurs de l'ESS régionale et rendre lisibles leurs dispositifs pour les structures.",
      quantitative: "15 financeurs à la rencontre annuelle ; 20 fiches dispositifs publiées.",
      content: "Cartographie des financeurs et dispositifs au printemps, rencontre annuelle en octobre, fiches dispositifs diffusées en novembre.",
      audience: "Financeurs publics et privés, structures de l'ESS en recherche de financement.",
      partners: "Banque des Territoires, Région, DREETS, France Active, Crédit Coopératif.",
      indicators: [["Financeurs à la rencontre", "15", null, false], ["Fiches dispositifs", "20", "12", false]],
      stakes: "Projet commun coopération / représentation.", priorities: "La rencontre d'octobre.", expected: "Une communauté qui se réunit deux fois par an en 2027.", timeNeed: "30 jours" },
  ];

  const deliverableLabels = ["Bilan qualitatif", "Bilan financier", "Justificatifs de dépenses", "Rapport intermédiaire", "Mentions du financeur"];
  const allEditions: { id: string; projectId: string; code: string; year: number; poleIdx: number; pilotId: string; actionIds: string[]; actionOwners: Record<string, string>; teamIds: string[] }[] = [];
  const stateOf = (date: dayjs.Dayjs, late?: boolean) => (late ? "doing" : date.isBefore(today, "day") ? "done" : date.diff(today, "day") <= 30 ? "doing" : "todo");

  for (let pi = 0; pi < projectDefs.length; pi++) {
    const pd = projectDefs[pi];
    const pilots = pilotsOf(pd.pole);
    const pilot = pilots[pi % pilots.length];
    const guarantor = pd.pole === 0 ? leadA : pd.pole === 1 ? leadB : director;
    const project = await prisma.project.create({
      data: { name: pd.name, analyticCode: pd.code, poleId: poles[pd.pole].id, pilotId: pilot.id, guarantorId: guarantor.id, missionId: missions[pd.mission].id, recurring: pd.recurring ?? true, createdAt: dayjs("2024-01-15").toDate(),
        secondaryPoles: { create: (pd.secondary ?? []).map((sp) => ({ poleId: poles[sp].id })) } },
    });

    // 2025 clôturée, 2026 en cours ; un projet sur deux a déjà son édition 2027 (reconduite → proposée, ou à ajuster → re-challengée).
    const years: { year: number; status: string }[] = [{ year: 2025, status: "closed" }, { year: 2026, status: "in_progress" }];
    const next2027 = pd.recurring === false ? null : pi % 2 === 0 ? (pi % 4 === 0 ? "proposed" : "rechallenged") : null;
    if (next2027) years.push({ year: 2027, status: next2027 });

    for (const y of years) {
      const members = membersOf(pd.pole).filter((m) => m.id !== pilot.id && m.role !== "pole_lead");
      const lead = membersOf(pd.pole).find((m) => m.role === "pole_lead");
      const fromSecondary = (pd.secondary ?? []).flatMap((sp) => pilotsOf(sp).slice(0, 1));
      const team = [pilot, ...members.slice(0, between(1, 2)), ...(pi % 3 === 0 && lead ? [lead] : []), ...fromSecondary, ...(["SEN-01", "SEN-03", "REP-01"].includes(pd.code) ? [director] : []), ...(["DLA-01", "SEN-03"].includes(pd.code) ? [raf] : [])];
      const isPast = y.year === 2025;
      const isFuture = y.year === 2027;
      const filledByDirection = !isFuture || pi % 4 === 0;

      const edition = await prisma.edition.create({
        data: {
          projectId: project.id,
          year: y.year,
          status: y.status,
          decisionDate: isFuture ? null : dayjs(`${y.year - 1}-12-11`).toDate(),
          conditionalStart: isFuture && pi % 6 === 0,
          stakes: filledByDirection ? pd.stakes : null,
          axis: filledByDirection ? `Mission ${pd.mission + 1} du plan opérationnel` : null,
          sressMeasure: filledByDirection ? `Mesure SRESS n°${(pi % 12) + 1}` : null,
          yearPriorities: filledByDirection ? pd.priorities : null,
          expectedOutcome: filledByDirection ? pd.expected : null,
          plannedFunders: filledByDirection ? pd.funders.map((f) => funderNames[f]).join(", ") : null,
          directExpenseEnvelope: filledByDirection ? pd.envelope : null,
          fte: filledByDirection ? Math.round((team.length * 0.25 + 0.15) * 10) / 10 : null,
          imposedIndicators: filledByDirection ? pd.indicators.filter((i) => i[3]).map((i) => i[0]).join(", ") || null : null,
          operationalObjectives: isFuture ? null : pd.objectives,
          quantitativeObjectives: isFuture ? null : pd.quantitative,
          content: isFuture ? null : pd.content,
          audience: isFuture ? null : pd.audience,
          calendar: isFuture ? null : pd.actions.map((a) => `${a.name} : ${dayjs(`${y.year}-${String(a.m).padStart(2, "0")}-${String(a.d ?? 15).padStart(2, "0")}`).format("D MMMM")}`).join(" · "),
          partners: isFuture ? null : pd.partners,
          method: isFuture ? null : "Point hebdomadaire avec le responsable de pôle ; avancement en réunion de pôle ; le fil du projet dans l'outil.",
          governance: isFuture ? null : ["SEN-03", "SEN-01", "DLA-01", "TES-05"].includes(pd.code) ? "COPIL semestriel avec les financeurs ; suivi en CODIR trimestriel." : "Suivi en réunion de pôle ; CODIR trimestriel.",
          ownIndicators: isFuture ? null : pd.indicators.filter((i) => !i[3]).map((i) => i[0]).join(", ") || null,
          timeNeed: isFuture ? null : pd.timeNeed,
          budgetNeed: isFuture ? null : `${new Intl.NumberFormat("fr-FR").format(pd.envelope)} € de dépenses directes`,
          sponsorId: isFuture ? null : director.id,
          deliveryDate: pd.code === "COM-02" && y.year === 2026 ? dayjs("2026-11-30").toDate() : null,
          codirDecision: isFuture ? null : y.year === 2026 && next2027 === "rechallenged" ? "adjust" : "renew",
          codirDate: isFuture ? null : dayjs(`${y.year - 1}-12-11`).toDate(),
          boardValidated: !isFuture,
          boardDate: isFuture ? null : dayjs(`${y.year - 1}-12-18`).toDate(),
          venues: isPast ? "Orléans, Tours, Blois" : ["SEN-03", "TES-02", "TES-05"].includes(pd.code) ? "Voir les actions : une ville par temps fort." : null,
          equipment: ["SEN-03", "SEN-01", "REP-01"].includes(pd.code) && !isFuture ? "Kakémonos, sono, badges, urnes de vote (AG), stand parapluie." : null,
          evidenceToKeep: !isFuture && pd.funders.includes(2) ? "Feuilles d'émargement signées, supports avec logos FSE+, lettres de mission, temps par personne." : !isFuture ? "Feuilles d'émargement, supports avec logos des financeurs, factures acquittées." : null,
          evaluation: isPast ? "Objectifs atteints à 90 % ; la fréquentation a dépassé la cible sur le temps fort, les indicateurs financeurs ont été tenus." : null,
          report: isPast ? `Bilan ${y.year} — ${pd.name}\n\nLe projet a été mené conformément au cadre validé. Les actions prévues ont été réalisées, les livrables financeurs remis dans les délais.\nPoints d'amélioration : anticiper la communication et mieux répartir le temps entre les membres de l'équipe.` : null,
          budgetEnvelope: isFuture ? null : pd.envelope,
          spent: isFuture ? 0 : Math.round(pd.envelope * (isPast ? 0.12 : [0.04, 0.06, 0.03, 0.05, 0.02][pi % 5])), // réalisé hors devis (frais divers)
          team: { create: team.map((p) => ({ personId: p.id })) },
          personDays: { create: team.map((p, i) => { const planned = i === 0 ? between(25, 55) : between(6, 22); return { personId: p.id, plannedDays: planned, soldDays: i === 0 ? Math.round(planned * [0.8, 1, 1.1][between(0, 2)]) : Math.round(planned * [0.6, 1][between(0, 1)]) }; }) },
          indicators: { create: pd.indicators.map(([label, target, actual, imposed], i) => ({ label, target, actual: isFuture ? null : isPast ? target : actual, imposed, order: i })) },
          docLinks: {
            create: [
              { label: "Dossier de référence", url: `\\\\cress\\Partage\\Action\\${pd.code}\\${y.year}`, codirOnly: false },
              ...(!isFuture ? [{ label: "Convention signée", url: `\\\\cress\\Partage\\Budget et convention\\${y.year}\\${pd.code}-convention.pdf`, codirOnly: false }] : []),
              ...(y.year === 2026 && ["DLA-01", "SEN-03", "TES-05"].includes(pd.code) ? [{ label: "Note CODIR sur le financement", url: `\\\\cress\\Partage\\Siege\\CODIR\\${pd.code}-note.docx`, codirOnly: true }] : []),
              ...(["SEN-01", "COM-02", "SEN-03", "OBS-01", "TES-05"].includes(pd.code) ? [{ label: "Canal Teams du projet", url: `https://teams.microsoft.com/l/channel/demo-${pd.code.toLowerCase()}`, codirOnly: false }] : []),
            ],
          },
        },
      });

      // Dépenses directes 2026 : devis engagés (dont certains issus d'une validation), factures rattachées, circuit facture.
      if (!isFuture) {
        const suppliers = ["Imprimerie du Loiret", "Traiteur Les Saveurs", "Studio Graphique Nord", "Location Salle Beaugency", "Cabinet Études & Co", "Transport Berry"];
        const labelsX = ["Impression du programme", "Prestation traiteur", "Conception graphique", "Location de salle", "Étude externe", "Déplacements partenaires"];
        const natures = ["purchase", "service", "service", "service", "service", "purchase"];
        // Parts d'enveloppe engagées à la mi-septembre : entre 35 et 75 % ; le Mois de l'ESS dépasse (101 %), le Forum est presque au bout (92 %).
        const share = isPast ? [0.35, 0.3, 0.22] : pd.code === "SEN-01" ? [0.45, 0.35, 0.16] : pd.code === "SEN-03" ? [0.25, 0.2, 0.15] : [[0.2, 0.15], [0.3, 0.2], [0.25, 0.2, 0.1], [0.35, 0.2], [0.3, 0.25, 0.12]][pi % 5];
        for (let xi = 0; xi < share.length; xi++) {
          const committed = Math.round(pd.envelope * share[xi]);
          const done = isPast || xi < share.length - 1; // la dernière dépense de l'année est en cours
          const spent = done ? committed : Math.round(committed * [0, 0.5][(pi + xi) % 2]);
          const created = isPast ? dayjs(`2025-0${(xi % 8) + 2}-15`) : dayjs(`2026-0${(xi * 3 + 2) % 9 + 1}-15`);
          await prisma.expense.create({
            data: { editionId: edition.id, label: labelsX[(pi + xi) % 6], supplier: suppliers[(pi + xi) % 6], committed, spent, status: done ? "closed" : "open", reference: done ? `FAC-${y.year}-${100 + pi * 3 + xi}` : null, nature: natures[(pi + xi) % 6], createdAt: created.toDate(),
              invoiceReceivedAt: done ? created.add(35, "day").toDate() : null, paidAt: done ? created.add(60, "day").toDate() : null, serviceDoneAt: done ? created.add(30, "day").toDate() : null, serviceDoneById: done ? pilot.id : null },
          });
        }
      }

      // Actions datées : passées → faites (sauf les deux « late » de l'année), à moins de 30 jours → en cours, au-delà → à faire.
      const actionIds: string[] = [];
      const actionOwners: Record<string, string> = {};
      for (let ai = 0; ai < pd.actions.length; ai++) {
        const a = pd.actions[ai];
        const owner = ai === 0 || ai % 3 === 0 ? pilot : team[ai % team.length];
        const date = dayjs(`${y.year}-${String(a.m).padStart(2, "0")}-${String(a.d ?? 15).padStart(2, "0")}`);
        const state = isPast ? "done" : isFuture ? "todo" : stateOf(date, a.late);
        const created = await prisma.action.create({
          data: { editionId: edition.id, name: a.name, ownerId: owner.id, milestoneDate: date.toDate(), timeTarget: a.target ?? 21, state, order: ai, isPublic: Boolean(a.pub), description: isFuture ? null : a.desc ?? null, venue: isFuture ? null : a.venue ?? null, participants: isFuture ? null : a.who ?? null },
        });
        actionIds.push(created.id);
        actionOwners[created.id] = owner.id;
      }

      // Lignes de financement (jamais mono-financeur) et livrables : passés remis, prochains à 30 jours, un seul en retard (Forum, ESS France).
      const fundingIds: string[] = [];
      for (let fi = 0; fi < pd.funders.length; fi++) {
        const f = funders[pd.funders[fi]];
        const requested = Math.round((pd.envelope * (fi === 0 ? 0.5 : 0.3)) / 100) * 100 + 2000;
        const status = isPast ? "justified" : isFuture ? "to_submit" : fi === 0 ? "contracted" : ["contracted", "notified", "contracted", "submitted"][(pi + fi) % 4];
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

        // Versements (lot A) : les tranches d'une convention partagée (FSE, CPO Région) se lisent sur la convention, pas sur
        // la ligne. Passé : tout est reçu. 2026 : acompte reçu au printemps, solde attendu en fin d'année ; « Cotisations »
        // (fonds propres) ne se verse pas. Un seul versement en retard dans toute la CRESS : le solde ADEME de TES-02.
        const granted = line.amountGranted ?? 0;
        if (!line.conventionId && f.name !== "Cotisations" && granted > 0) {
          if (isPast) {
            await prisma.payment.create({ data: { fundingLineId: line.id, label: "Solde", amount: granted, expectedAt: dayjs("2026-02-28").toDate(), receivedAt: dayjs("2026-03-04").toDate(), reference: `VIR-${pd.code}-25` } });
          } else if (y.year === 2026 && status === "contracted") {
            const acompte = Math.round(granted * 0.5);
            await prisma.payment.create({ data: { fundingLineId: line.id, label: "Acompte 50 %", amount: acompte, expectedAt: dayjs(`2026-04-${10 + fi}`).toDate(), receivedAt: dayjs(`2026-04-${20 + fi}`).toDate(), reference: `VIR-${pd.code}-${f.name.slice(0, 3).toUpperCase()}-1` } });
            const lateOne = pd.code === "TES-02" && fi === 0;
            await prisma.payment.create({ data: { fundingLineId: line.id, label: lateOne ? "Solde après justificatifs" : "Solde", amount: granted - acompte, expectedAt: lateOne ? today.subtract(18, "day").toDate() : dayjs("2026-12-15").toDate(), receivedAt: null, note: lateOne ? "Justificatifs envoyés le 12/08 ; relance faite par téléphone." : null } });
          } else if (y.year === 2026 && status === "notified") {
            // Notifié mais pas encore signé : une avance attendue à la signature.
            await prisma.payment.create({ data: { fundingLineId: line.id, label: "Avance à la signature", amount: Math.round(granted * 0.3), expectedAt: dayjs("2026-10-30").toDate(), receivedAt: null } });
          }
        }
        if (y.year === 2026 && ["contracted", "justified"].includes(status)) {
          const pdf = storePdf(`Convention ${f.name} ${y.year} - ${pd.name}`);
          await prisma.attachment.create({ data: { editionId: edition.id, fundingLineId: line.id, kind: "contract", label: `Convention ${f.name} ${y.year}`, fileName: `${pd.code}-${f.name}-convention-${y.year}.pdf`, mimeType: "application/pdf", uploadedById: raf.id, createdAt: dayjs(`${y.year}-03-${12 + fi}`).toDate(), ...pdf } });
          if (fi === 0) {
            const pdf2 = storePdf(`Notification ${f.name} ${y.year} - ${pd.name}`);
            await prisma.attachment.create({ data: { editionId: edition.id, fundingLineId: line.id, kind: "notification", label: `Courrier de notification ${f.name}`, fileName: `${pd.code}-${f.name}-notification.pdf`, mimeType: "application/pdf", uploadedById: raf.id, createdAt: dayjs(`${y.year}-02-${12 + fi}`).toDate(), ...pdf2 } });
          }
        }
        if (isPast) {
          const due = dayjs(`2026-0${fi + 1}-31`).toDate();
          await prisma.deliverable.create({ data: { fundingLineId: line.id, label: deliverableLabels[fi % deliverableLabels.length], dueDate: due, done: true, doneAt: due } });
        } else if (y.year === 2026) {
          // Calendrier type d'un financeur : rapport intermédiaire remis à l'été, justificatifs à l'automne, bilan en fin d'année.
          const list: { label: string; due: dayjs.Dayjs; done: boolean }[] = fi === 0
            ? [{ label: "Rapport intermédiaire", due: dayjs("2026-07-31"), done: true }, { label: "Bilan qualitatif", due: dayjs("2026-12-15"), done: false }]
            : fi === 1
              ? [{ label: "Justificatifs de dépenses", due: pd.code === "DLA-01" ? today.add(5, "day") : pi % 3 === 0 ? dayjs("2026-10-09") : dayjs("2026-11-13"), done: false }]
              : [{ label: "Mentions du financeur", due: dayjs("2026-06-01"), done: true }];
          if (pd.code === "SEN-03" && fi === 2) list.push({ label: "Rapport intermédiaire", due: today.subtract(2, "day"), done: false }); // le seul livrable en retard de la CRESS
          for (const dl of list) await prisma.deliverable.create({ data: { fundingLineId: line.id, label: dl.label, dueDate: dl.due.toDate(), done: dl.done, doneAt: dl.done ? dl.due.subtract(3, "day").toDate() : null } });
        }
      }
      for (let ai = 0; ai < actionIds.length; ai += 2) await prisma.action.update({ where: { id: actionIds[ai] }, data: { fundingLineId: fundingIds[ai % fundingIds.length] } });

      if (y.year === 2026) {
        await prisma.changeLog.createMany({ data: [
          { editionId: edition.id, field: "stakes", before: null, after: pd.stakes.slice(0, 80), authorId: director.id, createdAt: dayjs("2025-11-20").toDate() },
          { editionId: edition.id, field: "directExpenseEnvelope", before: null, after: String(pd.envelope), authorId: raf.id, createdAt: dayjs("2025-11-27").toDate() },
          { editionId: edition.id, field: "operationalObjectives", before: null, after: pd.objectives.slice(0, 80), authorId: pilot.id, createdAt: dayjs("2026-01-08").toDate() },
          { editionId: edition.id, field: "codirDecision", before: null, after: next2027 === "rechallenged" ? "adjust" : "renew", authorId: director.id, createdAt: dayjs("2025-12-11").toDate() },
        ] });
      }
      allEditions.push({ id: edition.id, projectId: project.id, code: pd.code, year: y.year, poleIdx: pd.pole, pilotId: pilot.id, actionIds, actionOwners, teamIds: team.map((t) => t.id) });
    }
  }
  const editions2026 = allEditions.filter((e) => e.year === 2026);
  const ed = (code: string) => editions2026.find((e) => e.code === code)!;
  const byName = (name: string) => people.find((p) => p.name === name)!;

  // Le Mois de l'ESS dépasse son enveloppe de 160 € : une dépense de plus, réelle, sur la soirée de remise.
  { const e = ed("SEN-01"); const xs = await prisma.expense.findMany({ where: { editionId: e.id } }); const used = (await prisma.edition.findUnique({ where: { id: e.id } }))!.spent + xs.reduce((s, x) => s + x.spent + (x.status === "open" ? Math.max(0, x.committed - x.spent) : 0), 0);
    await prisma.expense.create({ data: { editionId: e.id, label: "Sonorisation de la soirée de remise", supplier: "Sono & Lumière 45", committed: 16160 - used, spent: 0, status: "open", nature: "service", createdAt: dayjs("2026-09-08").toDate() } }); }

  // ─────────────────────────────────────────────────────────────────────────────────────────────
  // Fil de discussion des éditions 2026 : des échanges vrais, datés, entre le pilote, le garant, la RAF, l'équipe.
  // ─────────────────────────────────────────────────────────────────────────────────────────────
  const say = async (code: string, who: { id: string }, body: string, daysAgo: number) => prisma.comment.create({ data: { editionId: ed(code).id, authorId: who.id, body, createdAt: d(-daysAgo) } });
  const ines = byName("Inès Cabral"), maxime = byName("Maxime Roussel"), thomas = byName("Thomas Guérin"), camille = byName("Camille Aubert"), yasmine = byName("Yasmine Benali"), hugo = byName("Hugo Lemaire"), elise = byName("Élise Fontaine"), romain = byName("Romain Tessier"), lucas = byName("Lucas Perrin"), manon = byName("Manon Girard");
  await say("SEN-03", hugo, "Bilan du forum en cours de rédaction : 118 participants, 14 exposants, 88 % de satisfaction sur 61 réponses. Je vise le 15 septembre.", 6);
  await say("SEN-03", raf, "Le rapport intermédiaire pour ESS France était attendu la semaine dernière — il me faut le texte du bilan pour le boucler, même partiel.", 3);
  await say("SEN-03", director, "Le financeur retient 120 participants dans l'avenant : on n'écrit plus 150 nulle part. Sophie a proposé la modification sur la fiche.", 2);
  await say("SEN-01", elise, "Programme régional : 48 événements labellisés à ce jour, 12 dossiers encore incomplets. Je relance les organisateurs cette semaine.", 5);
  await say("SEN-01", director, "Pour la soirée : le théâtre confirme le 19 novembre. Sono à prévoir en plus, on est au bout de l'enveloppe — à voir en CODIR.", 4);
  await say("SEN-01", lucas, "Visuels du Mois en cours ; la déclinaison réseaux sociaux part vendredi.", 1);
  await say("OBS-01", ines, "Note de conjoncture : les données URSSAF du 2e trimestre sont arrivées, rédaction en cours pour le 30.", 8);
  await say("OBS-01", leadA, "Merci. Pour le petit-déjeuner d'octobre, on cale la date avec le Réseau Femmes ? Le 14 leur va.", 7);
  await say("OBS-01", ines, "OK pour le 14 octobre, salle du CA réservée (demande à Léa).", 6);
  await say("DLA-01", thomas, "15 diagnostics faits, 5 en attente d'orientation par France Active. Comité d'appui le 24 : ordre du jour envoyé.", 4);
  await say("DLA-01", raf, "Justificatifs FSE du 3e trimestre à déposer avant le 19 : émargements et lettres de mission, merci de me les mettre dans le dossier.", 2);
  await say("COM-02", romain, "Recette : 60 % des pages validées, il reste l'agenda et la carte TESS. Mise en ligne toujours prévue le 15 novembre.", 3);
  await say("COM-02", camille, "La carte TESS est prête à intégrer : le fichier GeoJSON est dans le dossier du projet.", 2);
  await say("TES-04", camille, "Publication de la carte décalée : elle dépend de la mise en ligne du nouveau site. Je propose de la sortir en même temps, le 15 novembre.", 5);
  await say("TES-04", leadB, "D'accord, mais on l'écrit sur la fiche (jalon à déplacer) pour que le portefeuille ne la compte pas en retard pendant deux mois.", 4);
  await say("TES-05", thomas, "Journée du lab : Équinoxe confirmé pour le 22 octobre, 6 coopérations présentées. Inscriptions ouvertes lundi.", 9);
  await say("TES-02", yasmine, "Conférence 3 à Blois : la Halle aux grains est réservée pour le 8 octobre, intervenants confirmés (Enercoop, SEM Énergie 41).", 12);
  await say("COO-02", thomas, "Rencontre régionale des PTCE le 18 novembre à Vierzon : programme en cours avec le PTCE Sud Berry.", 10);
  await say("REP-03", maxime, "Baromètre égalité : questionnaire clos, 214 réponses. Traitement avec l'Observatoire en septembre-octobre.", 11);
  await say("SEN-02", hugo, "Kit pédagogique diffusé à 26 structures ; les forums SPRO commencent le 20 octobre à Tours.", 14);
  await say("REP-01", assistant, "Bilan de l'AG : émargements et PV rangés dans le dossier ; il manque le retour du questionnaire de satisfaction.", 15);

  // ─────────────────────────────────────────────────────────────────────────────────────────────
  // Temps : huit semaines pour douze personnes. Réaliste : presque tout le monde est à jour, Thomas a oublié un jour en août,
  // Élise n'a pas encore réparti ses deux dernières semaines (septembre, en pleine préparation du Mois de l'ESS). Juillet verrouillé.
  // ─────────────────────────────────────────────────────────────────────────────────────────────
  const fonct = timeCodes.find((t) => t.code === "FONCT")!;
  const gest = timeCodes.find((t) => t.code === "GEST")!;
  const startWeek = today.subtract(7, "week").startOf("isoWeek");
  const timeKeepers = [director, raf, leadA, leadB, maxime, ines, thomas, camille, hugo, elise, romain, lucas, manon];
  const thomasMissedDay = dayjs("2026-08-20");
  for (const p of timeKeepers) {
    const myEditions = editions2026.filter((e) => e.teamIds.includes(p.id));
    for (let w = 0; w < 8; w++) {
      const weekStart = startWeek.add(w, "week");
      if (p.id === elise.id && w >= 6) continue;
      for (let day = 0; day < 5; day++) {
        const date = weekStart.add(day, "day");
        if (date.isAfter(today)) continue;
        if (p.id === thomas.id && date.isSame(thomasMissedDay, "day")) continue;
        const pr = personsWithRhythm.find((x) => x.id === p.id)!;
        const rhythm = rhythmAt(pr, date, c.rhythms);
        const dailyHours = rhythm ? expectedHoursOn(rhythm, date) : 7;
        if (dailyHours === 0) continue;
        let left = dailyHours;
        const fonctHours = day === 0 ? 1.5 : day === 3 && p.role === "pilot" ? 1 : 0; // café du lundi, réunion de pôle le jeudi
        if (fonctHours) { await prisma.timeEntry.create({ data: { personId: p.id, timeCodeId: fonct.id, date: date.toDate(), hours: fonctHours, locked: date.month() === 6 } }); left -= fonctHours; }
        if (p.role === "raf" || p.role === "director") { const g = Math.min(left, p.role === "raf" ? 4 : 2); await prisma.timeEntry.create({ data: { personId: p.id, timeCodeId: gest.id, date: date.toDate(), hours: g, locked: date.month() === 6 } }); left -= g; }
        if (myEditions.length === 0) continue;
        const startIdx = between(0, myEditions.length - 1);
        const chosen = [...myEditions.slice(startIdx), ...myEditions.slice(0, startIdx)].slice(0, between(1, Math.min(3, myEditions.length)));
        for (let ci = 0; ci < chosen.length; ci++) {
          const e = chosen[ci];
          const hours = ci === chosen.length - 1 ? Math.round(left * 4) / 4 : Math.min(left, between(1, 4));
          if (hours <= 0) continue;
          left -= hours;
          const mine = e.actionIds.filter((id) => e.actionOwners[id] === p.id);
          const actionId = mine.length && rnd() < 0.7 ? mine[between(0, mine.length - 1)] : null;
          await prisma.timeEntry.create({ data: { personId: p.id, projectId: e.projectId, actionId, date: date.toDate(), hours, locked: date.month() === 6, comment: rnd() < 0.06 ? "Déplacement inclus" : null } });
        }
      }
    }
    await prisma.monthLock.create({ data: { personId: p.id, month: "2026-07", lockedById: raf.id, lockedAt: dayjs("2026-08-08").toDate() } });
    // Semaines déclarées : tout le monde jusqu'à l'avant-dernière ; la dernière seulement par les plus ponctuels (le vendredi soir).
    const punctual = [director.id, raf.id, leadA.id, leadB.id, ines.id, maxime.id, romain.id];
    for (let w = 0; w < 7; w++) {
      const ws = startWeek.add(w, "week");
      if (p.id === elise.id && w >= 6) continue;
      if (w === 6 && !punctual.includes(p.id)) continue;
      if (p.id === thomas.id && thomasMissedDay.isSame(ws, "isoWeek")) continue;
      await prisma.weekDeclaration.create({ data: { personId: p.id, week: `${ws.isoWeekYear()}-W${String(ws.isoWeek()).padStart(2, "0")}`, declaredAt: ws.add(4, "day").hour(17).toDate() } });
    }
  }
  // Une seule relance en cours : la RAF a relancé Élise hier.
  // Objectifs de temps cohérents avec le réalisé : un objectif se fixe en janvier avec de la marge. Une seule action dépasse
  // vraiment (le jury du Prix, plus long que prévu) : c'est l'alerte « temps hors objectif » de la démo.
  const consumedByAction = await prisma.timeEntry.groupBy({ by: ["actionId"], _sum: { hours: true }, where: { actionId: { not: null } } });
  for (const c of consumedByAction) {
    const a = await prisma.action.findUnique({ where: { id: c.actionId! }, include: { edition: true } });
    if (!a || a.edition.year !== 2026 || a.name === "Jury du Prix") continue;
    const used = c._sum.hours ?? 0;
    const target = Math.max(a.timeTarget ?? 0, Math.ceil((used * (a.state === "done" ? 1.15 : 1.6)) / 7) * 7);
    if (target !== a.timeTarget) await prisma.action.update({ where: { id: a.id }, data: { timeTarget: target } });
  }
  // Au niveau de l'édition aussi : le temps posé sur le projet sans action compte dans le consommé ; l'objectif global garde de la marge.
  for (const e of editions2026) {
    if (e.code === "SEN-01") continue; // le Mois de l'ESS déborde, c'est voulu
    const consumed = (await prisma.timeEntry.aggregate({ _sum: { hours: true }, where: { projectId: e.projectId, date: { gte: new Date("2026-01-01"), lt: new Date("2027-01-01") } } }))._sum.hours ?? 0;
    const actions = await prisma.action.findMany({ where: { editionId: e.id }, orderBy: { order: "asc" } });
    const total = actions.reduce((s, a) => s + (a.timeTarget ?? 0), 0);
    if (consumed > total * 0.9 && actions[0]) await prisma.action.update({ where: { id: actions[0].id }, data: { timeTarget: (actions[0].timeTarget ?? 0) + Math.ceil((consumed * 1.25 - total) / 7) * 7 } });
  }
  // (La relance d'Élise se fait en direct depuis la clôture : rien de pré-envoyé, pour que la démo montre le geste.)

  // ─────────────────────────────────────────────────────────────────────────────────────────────
  // Validations : quatre en attente dans les délais (une seule au-delà de la cible), six décidées avec leur circuit facture.
  // ─────────────────────────────────────────────────────────────────────────────────────────────
  // Base fournisseurs : un fournisseur par nom rencontré sur les devis (plus quelques habituels sans devis en cours).
  const supplierIds = new Map<string, string>();
  const supplierIdFor = async (name?: string, email?: string) => {
    if (!name) return null;
    if (!supplierIds.has(name)) supplierIds.set(name, (await findOrCreateOrganisation(name, "supplier", { email: email ?? null })).id);
    return supplierIds.get(name)!;
  };
  for (const [name, email] of [["Traiteur Les Saveurs", "commande@lessaveurs.exemple.fr"], ["Location Salle Beaugency", "resa@salle-beaugency.exemple.fr"], ["Transport Berry", null]] as const) await supplierIdFor(name, email ?? undefined);
  type V = { code: string; kind: string; label: string; amount: number | null; age: number; level: number; supplier?: string; email?: string; by?: { id: string } };
  const pendingV: V[] = [
    { code: "SEN-01", kind: "quote", label: "Devis sonorisation de la soirée de remise", amount: 480, age: 1, level: 3, supplier: "Sono & Lumière 45", email: "contact@sono-lumiere45.exemple.fr" },
    { code: "TES-02", kind: "quote", label: "Devis captation vidéo conférence 3", amount: 1350, age: 2, level: 2, supplier: "Studio Vidéo Loire", email: "devis@studio-video-loire.exemple.fr" },
    { code: "DLA-01", kind: "expense", label: "Frais de déplacement comité d'appui", amount: 180, age: 3, level: 1 },
    { code: "OBS-01", kind: "quote", label: "Devis impression de la note de conjoncture", amount: 380, age: 2, level: 1, supplier: "Imprimerie du Loiret", email: "devis@imprimerie-loiret.exemple.fr" },
    { code: "REP-02", kind: "sending", label: "Envoi de la lettre AIESSE n°2", amount: null, age: 4, level: 2 },
    { code: "TES-05", kind: "quote", label: "Devis traiteur journée du lab", amount: 2600, age: 7, level: 2, supplier: "Traiteur Les Saveurs", email: "commande@lessaveurs.exemple.fr" },
  ];
  for (const v of pendingV) {
    const e = ed(v.code);
    const r = await prisma.validationRequest.create({ data: { editionId: e.id, actionId: e.actionIds[Math.min(3, e.actionIds.length - 1)], kind: v.kind, label: v.label, requesterId: e.pilotId, amount: v.amount, requiredLevel: v.level, status: "pending", targetDelayDays: 5, createdAt: d(-v.age), supplier: v.supplier ?? null, supplierEmail: v.email ?? null, supplierId: await supplierIdFor(v.supplier, v.email) } });
    if (v.amount && v.kind === "quote") { const pdf = storePdf(`${v.label} - ${v.amount} EUR`); await prisma.attachment.create({ data: { editionId: e.id, validationId: r.id, kind: "quote", label: v.label, fileName: `devis-${v.code.toLowerCase()}-${v.amount}.pdf`, mimeType: "application/pdf", uploadedById: e.pilotId, createdAt: d(-v.age), ...pdf } }); }
  }
  const decidedV: (V & { decided: number; invoice?: "received" | "paid" | null; service?: boolean })[] = [
    { code: "SEN-03", kind: "quote", label: "Devis location Palais des congrès", amount: 4800, age: 120, decided: 115, level: 3, supplier: "Palais des congrès de Tours", email: "location@palais-tours.exemple.fr", by: director, invoice: "paid", service: true },
    { code: "SEN-03", kind: "quote", label: "Devis traiteur du forum", amount: 3100, age: 95, decided: 92, level: 3, supplier: "Traiteur Les Saveurs", email: "commande@lessaveurs.exemple.fr", by: director, invoice: "paid", service: true },
    { code: "OBS-01", kind: "quote", label: "Devis impression du panorama de l'emploi", amount: 640, age: 130, decided: 128, level: 2, supplier: "Imprimerie du Loiret", email: "devis@imprimerie-loiret.exemple.fr", by: leadA, invoice: "paid", service: true },
    { code: "COM-02", kind: "quote", label: "Devis graphiste — charte du nouveau site", amount: 1500, age: 40, decided: 36, level: 2, supplier: "Atelier Graphique Loire", email: "contact@atelier-graphique.exemple.fr", by: director, invoice: "received", service: false },
    { code: "TES-02", kind: "quote", label: "Devis intervenant conférence 2", amount: 600, age: 100, decided: 97, level: 2, supplier: "Coopérative Les Fabricants", email: "bonjour@fabricants.exemple.fr", by: leadB, invoice: "paid", service: true },
    { code: "REP-03", kind: "sending", label: "Envoi du questionnaire baromètre égalité", amount: null, age: 75, decided: 74, level: 2, by: leadA },
  ];
  for (const v of decidedV) {
    const e = ed(v.code);
    const r = await prisma.validationRequest.create({ data: { editionId: e.id, kind: v.kind, label: v.label, requesterId: e.pilotId, amount: v.amount, requiredLevel: v.level, status: "approved", deciderId: v.by!.id, decidedAt: d(-v.decided), decisionComment: v.level === 3 ? "OK, dans l'enveloppe validée." : "OK.", targetDelayDays: 5, createdAt: d(-v.age), supplier: v.supplier ?? null, supplierEmail: v.email ?? null, supplierId: await supplierIdFor(v.supplier, v.email) } });
    if (v.amount) {
      const pdf = storePdf(v.label);
      await prisma.attachment.create({ data: { editionId: e.id, validationId: r.id, kind: "quote", label: v.label, fileName: `devis-${v.code.toLowerCase()}-${v.amount}.pdf`, mimeType: "application/pdf", uploadedById: e.pilotId, createdAt: d(-v.age), ...pdf } });
      const paid = v.invoice === "paid";
      await prisma.expense.create({ data: { editionId: e.id, label: v.label.replace(/^Devis /, ""), supplier: v.supplier ?? null, committed: v.amount, spent: paid ? v.amount : 0, status: paid ? "closed" : "open", validationId: r.id, reference: paid ? `FAC-2026-${400 + v.decided}` : null, nature: "service", createdAt: d(-v.decided), invoiceReceivedAt: v.invoice ? d(-(v.decided - 20)) : null, paidAt: paid ? d(-(v.decided - 45)) : null, serviceDoneAt: v.service ? d(-(v.decided - 18)) : null, serviceDoneById: v.service ? e.pilotId : null } });
    }
  }
  // Une facture attend le service fait de Romain (charte du site) : notification de la RAF.
  await prisma.notification.create({ data: { personId: romain.id, senderId: raf.id, kind: "info", title: "Facture reçue · graphiste — charte du nouveau site (Atelier Graphique Loire)", body: "1 500 € · la prestation est-elle conforme ? Dites-le dans l'onglet Budget (sans bloquer le paiement).", link: `/edition/${ed("COM-02").id}?onglet=budget`, createdAt: d(-16) } });

  // ─────────────────────────────────────────────────────────────────────────────────────────────
  // Décisions d'instance récentes (CODIR, pôle, revue trimestrielle).
  // ─────────────────────────────────────────────────────────────────────────────────────────────
  const dec: { code: string; instance: string; body: string; who: { id: string }; follow?: { id: string }; due?: number; ago: number; alert?: string }[] = [
    { code: "TES-04", instance: "codir", body: "Publication de la carte TESS calée sur la mise en ligne du site (15 novembre) ; le jalon est déplacé sur la fiche.", who: director, follow: camille, due: 5, ago: 3 },
    { code: "SEN-01", instance: "codir", body: "Dépassement de 160 € accepté sur la sonorisation ; aucune autre dépense sans validation direction jusqu'au bilan.", who: director, ago: 3, alert: "envelope" },
    { code: "SEN-03", instance: "codir", body: "Objectif participants aligné sur l'avenant (120) ; rapport intermédiaire ESS France à remettre cette semaine.", who: director, follow: hugo, due: 4, ago: 3 },
    { code: "DLA-01", instance: "pole", body: "Les justificatifs FSE du trimestre sont relus par la RAF avant dépôt ; Thomas les dépose le 18 au plus tard.", who: leadB, follow: thomas, due: 4, ago: 8 },
    { code: "OBS-01", instance: "quarterly", body: "Le comité technique de novembre fixe le calendrier 2027 des publications, avec les besoins des deux pôles.", who: director, follow: ines, due: 52, ago: 25 },
    { code: "COO-02", instance: "pole", body: "La rencontre régionale des PTCE se tient à Vierzon le 18 novembre ; budget déplacements à prévoir.", who: leadB, follow: thomas, ago: 12 },
  ];
  for (const x of dec) await prisma.decision.create({ data: { editionId: ed(x.code).id, instance: x.instance, body: x.body, authorId: x.who.id, followUpId: x.follow?.id ?? null, dueDate: x.due ? d(x.due) : null, decidedAt: d(-x.ago), alertKind: x.alert ?? null } });

  // ─────────────────────────────────────────────────────────────────────────────────────────────
  // Plan de charge : validé au séminaire de décembre 2025 (figé), ventilé par mois autour des jalons pour deux tiers des affectations.
  // Hugo est chargé à l'automne (Mois de l'ESS + forums SPRO + bilan du forum) : un dépassement réel en octobre-novembre.
  // Deux modifications tracées après validation : le report de la carte TESS, la journée du lab.
  // ─────────────────────────────────────────────────────────────────────────────────────────────
  const pdRows = await prisma.editionPersonDays.findMany({ where: { edition: { year: { in: [2026, 2027] } }, plannedDays: { gt: 0 } }, include: { edition: { include: { actions: true } } } });
  let k = 0;
  for (const pd of pdRows) {
    if (k++ % 3 === 2) continue;
    const y = pd.edition.year;
    const peaks = pd.edition.actions.map((a) => a.milestoneDate).filter((x): x is Date => Boolean(x)).map((x) => dayjs(x).month());
    const weights = Array.from({ length: 12 }, (_, i) => 1 + peaks.filter((m) => Math.abs(m - i) <= 1).length * 2 + (i === 7 ? -0.8 : 0));
    const wsum = weights.reduce((a, b) => a + b, 0);
    const data = weights.map((w, i) => ({ editionId: pd.editionId, personId: pd.personId, month: `${y}-${String(i + 1).padStart(2, "0")}`, days: Math.round((pd.plannedDays * w) / wsum * 10) / 10 })).filter((x) => x.days > 0);
    await prisma.plannedLoad.createMany({ data });
  }
  { const boost = await prisma.plannedLoad.findMany({ where: { personId: hugo.id, month: { in: ["2026-10", "2026-11"] } } });
    for (const b of boost) await prisma.plannedLoad.update({ where: { id: b.id }, data: { days: Math.round(b.days * 2.4 * 10) / 10 } }); }
  await prisma.loadFreeze.create({ data: { year: 2026, frozenById: director.id, frozenAt: dayjs("2025-12-11T16:30:00").toDate(), note: "Séminaire des 9-11 décembre 2025" } });
  await prisma.changeLog.createMany({ data: [
    { editionId: ed("TES-04").id, field: `plannedLoad:${camille.id}`, before: "4", after: "1.5 · septembre 2026 · Camille Aubert · après validation du plan de charge", authorId: leadB.id, createdAt: d(-4) },
    { editionId: ed("TES-04").id, field: `plannedLoad:${camille.id}`, before: "1", after: "3.5 · novembre 2026 · Camille Aubert · après validation du plan de charge", authorId: leadB.id, createdAt: d(-4) },
    { editionId: ed("TES-05").id, field: `plannedLoad:${thomas.id}`, before: "5", after: "7 · octobre 2026 · Thomas Guérin · après validation du plan de charge", authorId: thomas.id, createdAt: d(-9) },
  ] });
  await prisma.notification.createMany({ data: [
    { personId: raf.id, senderId: leadB.id, kind: "info", title: "Plan de charge 2026 modifié après validation", body: "Camille Aubert · Carte et ressource TESS · septembre 2026 : 4 → 1.5 j (publication reportée)", link: "/plan-de-charge?debut=2026-01&horizon=12", createdAt: d(-4) },
    { personId: director.id, senderId: thomas.id, kind: "info", title: "Plan de charge 2026 modifié après validation", body: "Thomas Guérin · Lab des coopérations · octobre 2026 : 5 → 7 j", link: "/plan-de-charge?debut=2026-01&horizon=12", createdAt: d(-9), readAt: d(-8) },
  ] });

  // ─────────────────────────────────────────────────────────────────────────────────────────────
  // Relecture des fiches : remarques de la direction et des garants, avec leur motif ; certaines traitées, d'autres ouvertes.
  // Deux propositions de modification sur des fiches validées : une en attente (Forum), une acceptée (DLA).
  // ─────────────────────────────────────────────────────────────────────────────────────────────
  const rq = async (code: string, field: string, body: string, reason: string, who: { id: string }, ago: number, resolvedBy?: { id: string }) =>
    prisma.fieldRemark.create({ data: { editionId: ed(code).id, field, body, reason, authorId: who.id, createdAt: d(-ago), resolvedAt: resolvedBy ? d(-(ago - 3)) : null, resolvedById: resolvedBy?.id ?? null } });
  await rq("COO-02", "content", "Le lien avec la cartographie mérite un paragraphe à part : qui la met à jour, à quel rythme, et ce qu'on en attend pour les acheteurs.", "form", director, 40, thomas);
  await rq("COO-02", "calendar", "Le calendrier est à écrire : au minimum les dates du groupe d'action, des entretiens acheteurs et de la rencontre régionale, pour que le portefeuille les affiche.", "feasibility", director, 40, thomas);
  await rq("COO-02", "quantitativeObjectives", "Combien d'acheteurs dans le réseau à la fin de l'année, et combien de structures ESS accompagnées ? Il nous faut deux chiffres pour le bilan financeur.", "funder", director, 40);
  await rq("TES-03", "content", "Le cadrage ADEME ne mentionne pas la note : écrire ici ce qui a été convenu avec Sami Kaci (périmètre, format, date de remise).", "funder", director, 21, camille);
  await rq("SEN-02", "audience", "« 16-25 ans » : préciser qu'on passe par les têtes de réseau, pas par les lycées — c'est ce qui a été décidé au CODIR de juin.", "strategy", director, 18);
  await rq("REP-03", "quantitativeObjectives", "La DREETS demande un indicateur sur les structures représentées, pas seulement les participantes.", "funder", leadA, 12, maxime);
  await rq("TES-05", "governance", "Ajouter le COPIL Banque des Territoires (deux réunions par an) : c'est contractuel.", "funder", leadB, 9);
  await prisma.notification.createMany({ data: [
    { personId: thomas.id, senderId: director.id, kind: "info", title: "Remarque sur la fiche PTCE et ESSOR · 2026", body: "Objectifs quantitatifs (financeur) : combien d'acheteurs dans le réseau à la fin de l'année…", link: `/edition/${ed("COO-02").id}?onglet=fiche`, createdAt: d(-40), readAt: d(-39) },
    { personId: hugo.id, senderId: director.id, kind: "info", title: "Remarque sur la fiche Sensibilisation des jeunes · 2026", body: "Public / bénéficiaires (stratégie) : préciser qu'on passe par les têtes de réseau…", link: `/edition/${ed("SEN-02").id}?onglet=fiche`, createdAt: d(-18) },
    { personId: thomas.id, senderId: leadB.id, kind: "info", title: "Remarque sur la fiche Lab des coopérations · 2026", body: "Gouvernance (financeur) : ajouter le COPIL Banque des Territoires…", link: `/edition/${ed("TES-05").id}?onglet=fiche`, createdAt: d(-9) },
  ] });
  await prisma.changeProposal.create({ data: { editionId: ed("SEN-03").id, field: "quantitativeObjectives", proposed: "120 participants (au lieu de 150), 15 exposants, un atelier par mission du plan opérationnel.", reason: "Le financeur retient 120 participants dans l'avenant ; la fiche affiche encore 150.", authorId: leadB.id, createdAt: d(-2) } });
  await prisma.notification.create({ data: { personId: hugo.id, senderId: leadB.id, kind: "info", title: "Modification proposée sur Forum régional de l'ESS · 2026", body: "Objectifs quantitatifs — le financeur retient 120 participants dans l'avenant.", link: `/edition/${ed("SEN-03").id}?onglet=fiche`, createdAt: d(-2) } });
  await prisma.changeProposal.create({ data: { editionId: ed("DLA-01").id, field: "quantitativeObjectives", proposed: "20 diagnostics ; 14 ingénieries individuelles ; 3 ingénieries collectives ; 180 emplois concernés.", reason: "La DREETS a ajouté l'indicateur « emplois concernés » dans la convention 2026.", authorId: raf.id, status: "accepted", decidedById: thomas.id, decidedAt: d(-30), comment: "Appliqué, merci.", createdAt: d(-33) } });
  await prisma.changeLog.create({ data: { editionId: ed("DLA-01").id, field: "quantitativeObjectives", before: "20 diagnostics ; 14 ingénieries individuelles ; 3 ingénieries collectives.", after: "20 diagnostics ; 14 ingénieries individuelles ; 3 ingénieries collectives ; 180 emplois concernés.", authorId: thomas.id, createdAt: d(-30) } });

  // ─────────────────────────────────────────────────────────────────────────────────────────────
  // Réalisations consignées au fil de l'année, sur les projets qui ont eu un temps fort.
  // ─────────────────────────────────────────────────────────────────────────────────────────────
  const ach = async (code: string, kind: string, label: string, value: number | null, unit: string | null, day: string, who: { id: string }, actionName?: string) => {
    const e = ed(code);
    const action = actionName ? await prisma.action.findFirst({ where: { editionId: e.id, name: { startsWith: actionName } } }) : null;
    return prisma.achievement.create({ data: { editionId: e.id, kind, label, value, unit, date: dayjs(day).toDate(), authorId: who.id, actionId: action?.id ?? null } });
  };
  await ach("OBS-01", "participants", "Inscrits au petit-déjeuner de mars (emploi)", 24, "personnes", "2026-03-18", ines, "Petit-déjeuner ORESS · mars");
  await ach("OBS-01", "participants", "Inscrits au petit-déjeuner de juin (réemploi)", 31, "personnes", "2026-06-24", ines, "Petit-déjeuner ORESS · juin");
  await ach("OBS-01", "deliverable", "Panorama 2025 de l'emploi ESS publié et envoyé aux têtes de réseau", null, null, "2026-05-06", ines, "Chiffres de l'emploi");
  await ach("OBS-01", "press", "Article dans La Nouvelle République sur les chiffres de l'emploi", null, null, "2026-05-20", ines);
  await ach("SEN-03", "participants", "Inscrits au forum régional", 118, "personnes", "2026-06-12", hugo, "Jour J");
  await ach("SEN-03", "partner", "Partenaires exposants confirmés", 14, "structures", "2026-05-30", hugo, "Partenaires");
  await ach("SEN-03", "press", "Reportage France 3 Centre-Val de Loire au forum", null, null, "2026-06-12", lucas);
  await ach("TES-02", "participants", "Participants à la conférence 1 (Tours, alimentation)", 96, "personnes", "2026-04-09", yasmine, "Conférence 1");
  await ach("TES-02", "participants", "Participants à la conférence 2 (Orléans, réemploi)", 118, "personnes", "2026-06-11", yasmine, "Conférence 2");
  await ach("TES-05", "partner", "Coopérations sélectionnées par le jury", 6, "coopérations", "2026-04-24", thomas, "Sélection");
  await ach("REP-01", "participants", "Participants à l'assemblée générale", 162, "personnes", "2026-06-18", assistant, "Logistique");
  await ach("REP-01", "deliverable", "Rapport d'activité 2025 diffusé aux adhérents", null, null, "2026-06-03", assistant, "Rapport d'activité");
  await ach("REP-03", "participants", "Participantes au cycle de rencontres (3 rencontres)", 97, "personnes", "2026-03-27", maxime, "Cycle de rencontres");
  await ach("DLA-01", "other", "Diagnostics réalisés au 1er septembre", 15, "diagnostics", "2026-09-01", thomas, "Diagnostics");
  await ach("SEN-02", "audience", "Jeunes touchés par les interventions (janvier-août)", 410, "personnes", "2026-08-31", hugo, "Interventions");
  await ach("SEN-02", "deliverable", "Kit « L'ESS en 5 ateliers » diffusé à 26 structures", 26, "structures", "2026-07-03", hugo, "Kit pédagogique");
  await ach("COM-01", "other", "Newsletters envoyées (janvier-août), taux d'ouverture 41 %", 8, "numéros", "2026-08-28", romain, "Newsletter");
  await ach("TES-01", "deliverable", "Chroniques publiées (janvier-septembre)", 7, "chroniques", "2026-09-10", camille, "Rédaction");

  // ─────────────────────────────────────────────────────────────────────────────────────────────
  // Vie statutaire : un projet porté par la direction, tenu par l'assistante (CA, bureaux, AG) — dans l'agenda équipe.
  // ─────────────────────────────────────────────────────────────────────────────────────────────
  const vieProject = await prisma.project.create({ data: { name: "Vie statutaire (CA, bureaux, AG)", analyticCode: "REP-04", poleId: poles[0].id, pilotId: director.id, guarantorId: leadA.id, missionId: missions[0].id, recurring: true, createdAt: dayjs("2024-01-15").toDate() } });
  const vieEd = await prisma.edition.create({ data: { projectId: vieProject.id, year: 2026, status: "in_progress", decisionDate: dayjs("2025-12-11").toDate(), codirDecision: "renew", codirDate: dayjs("2025-12-11").toDate(), boardValidated: true, boardDate: dayjs("2025-12-18").toDate(), stakes: "Faire vivre la gouvernance : cinq conseils d'administration, des bureaux mensuels, une assemblée générale.", axis: "Mission 1 du plan opérationnel", operationalObjectives: "Convocations, logistique, comptes rendus et relevés de décision dans les délais statutaires.", quantitativeObjectives: "5 CA, 8 bureaux, 1 AG ; convocations à J-15 ; PV diffusés sous 15 jours.", sponsorId: director.id, budgetEnvelope: 4000, spent: 900, team: { create: [{ personId: assistant.id }, { personId: director.id }] }, personDays: { create: [{ personId: assistant.id, soldDays: 0, plannedDays: 25 }, { personId: director.id, soldDays: 0, plannedDays: 12 }] }, docLinks: { create: [{ label: "Dossier de référence", url: "\\\\cress\\Partage\\Siege\\Vie statutaire\\2026", codirOnly: false }, { label: "PV et relevés de décision", url: "\\\\cress\\Partage\\Siege\\Vie statutaire\\2026\\PV", codirOnly: true }] } } });
  const vieActions = [["CA du 12 février", "2026-02-12"], ["Bureau de mars", "2026-03-10"], ["CA du 22 avril", "2026-04-22"], ["Assemblée générale", "2026-06-18"], ["CA du 1er octobre", "2026-10-01"], ["Bureau de novembre", "2026-11-05"], ["CA de décembre", "2026-12-15"]] as const;
  for (const [i, [name, day]] of vieActions.entries()) await prisma.action.create({ data: { editionId: vieEd.id, name, ownerId: assistant.id, milestoneDate: dayjs(day).toDate(), state: stateOf(dayjs(day)), order: i, timeTarget: name.startsWith("Assemblée") ? 35 : 7, venue: name.startsWith("Assemblée") ? "Hôtel de Région, Orléans" : "Siège de la CRESS, Orléans", participants: name.startsWith("Assemblée") ? "Adhérents, partenaires institutionnels, salariés" : "Administrateurs, direction, assistante de direction", description: name.startsWith("CA") ? "Convocation à J-15, dossier du CA à J-7, relevé de décision sous 15 jours." : null } });
  editions2026.push({ id: vieEd.id, projectId: vieProject.id, code: "REP-04", year: 2026, poleIdx: 0, pilotId: director.id, actionIds: [], actionOwners: {}, teamIds: [assistant.id, director.id] });

  // Un projet « en devenir » proposé par une chargée de mission (le « fais-moi une fiche projet »), en attente de relecture.
  const propProject = await prisma.project.create({ data: { name: "Catalogue régional de formation à l'ESS", analyticCode: "PROP-01", poleId: poles[2].id, pilotId: elise.id, guarantorId: director.id, missionId: missions[3].id, recurring: false, createdAt: d(-6) } });
  const propEd = await prisma.edition.create({ data: { projectId: propProject.id, year: 2027, status: "proposed", operationalObjectives: "Un organisme de formation partenaire nous sollicite pour un catalogue commun de formations à l'ESS (gouvernance, modèle économique, coopération). La CRESS labelliserait et diffuserait ; les têtes de réseau y gagneraient une offre lisible pour leurs adhérents.\nCe que j'arrête pour le faire : les interventions directes en lycée, reprises par les têtes de réseau avec le kit.", team: { create: [{ personId: elise.id }] }, personDays: { create: [{ personId: elise.id, soldDays: 0, plannedDays: 15 }] } } });
  await prisma.changeLog.create({ data: { editionId: propEd.id, field: "status", before: null, after: `Projet proposé par ${elise.name}`, authorId: elise.id, createdAt: d(-6) } });
  await prisma.fieldRemark.create({ data: { editionId: propEd.id, field: "operationalObjectives", body: "Bonne idée. Avant le CA du 1er octobre : le modèle économique (qui paie la formation ?) et ce que ça change pour le partenaire.", reason: "strategy", authorId: director.id, createdAt: d(-4) } });
  await prisma.notification.createMany({ data: [
    { personId: director.id, senderId: elise.id, kind: "info", title: "Nouveau projet proposé : Catalogue régional de formation à l'ESS", body: `${elise.name} propose « Catalogue régional de formation à l'ESS » pour 2027 (Sensibilisation et communication). La fiche attend votre relecture.`, link: `/edition/${propEd.id}?onglet=fiche`, createdAt: d(-6), readAt: d(-5) },
    { personId: elise.id, senderId: director.id, kind: "info", title: "Remarque sur la fiche Catalogue régional de formation à l'ESS · 2027", body: "Objectifs qualitatifs (stratégie) : le modèle économique avant le CA du 1er octobre.", link: `/edition/${propEd.id}?onglet=fiche`, createdAt: d(-4), readAt: d(-4) },
  ] });

  // ─────────────────────────────────────────────────────────────────────────────────────────────
  // Réglages personnels : Yasmine à part fixe (lettre de mission FSE) ; Hugo sans to-do ni notes (« pourquoi l'embêter ? »).
  // ─────────────────────────────────────────────────────────────────────────────────────────────
  await prisma.person.update({ where: { id: yasmine.id }, data: { fixedShare: true, fixedShareNote: "Lettre de mission FSE : 50 % sur le DLA, 20 % sur la coopération territoriale" } });
  await prisma.person.update({ where: { id: hugo.id }, data: { modules: "split" } });

  // ─────────────────────────────────────────────────────────────────────────────────────────────
  // Listes de tâches et tâches : chacun à sa façon — l'assistante (vie statutaire partagée, demandes du jour privées), une chargée
  // de mission avec sa liste de suivi hebdo visible de son responsable, une liste de projet visible du pôle, une liste d'idées privée.
  // ─────────────────────────────────────────────────────────────────────────────────────────────
  const list = (personId: string, name: string, visibility: string, editionId: string | null, order: number, color: string | null = null) => prisma.taskList.create({ data: { personId, name, visibility, editionId, order, color } });
  const task = async (personId: string, listId: string | null, label: string, due: string | null, editionId?: string | null, done = false, doneAgo = 1, slot?: { day: string; start?: string; end?: string }) => {
    const t = await prisma.task.create({ data: { personId, listId, label, dueDate: due ? dayjs(due).toDate() : null, editionId: editionId ?? null, done, doneAt: done ? d(-doneAgo) : null, createdAt: d(-between(2, 12)) } });
    if (slot) await prisma.workSlot.create({ data: { taskId: t.id, startAt: slot.start ? dayjs(`${slot.day} ${slot.start}`).toDate() : dayjs(slot.day).toDate(), endAt: slot.end ? dayjs(`${slot.day} ${slot.end}`).toDate() : dayjs(slot.day).add(1, "day").toDate(), allDay: !slot.start } });
    return t;
  };
  const dd = (n: number) => today.add(n, "day").format("YYYY-MM-DD");
  const vie = await list(assistant.id, "Vie statutaire", "all", vieEd.id, 0, "ocre");
  const jour = await list(assistant.id, "Demandes du jour", "private", null, 1, "gris");
  await task(assistant.id, vie.id, "Envoyer la convocation du CA du 1er octobre (J-15)", dd(2), vieEd.id, false, 0, { day: dd(1), start: "09:00", end: "10:00" });
  await task(assistant.id, vie.id, "Réserver la salle et le café du CA", dd(3), vieEd.id);
  await task(assistant.id, vie.id, "Relevé de décision du bureau de septembre", dd(-1), vieEd.id, true, 1);
  await task(assistant.id, vie.id, "Devis traiteur pour l'AG 2027 (deux devis)", dd(40), vieEd.id);
  await task(assistant.id, jour.id, "Vérifier les hôtels pour le déplacement à Bruxelles", dd(0), null, false, 0, { day: dd(0), start: "14:00", end: "15:00" });
  await task(assistant.id, jour.id, "Répondre à la direction : salle réservée pour les entretiens", dd(0), null, true, 0);
  await task(assistant.id, jour.id, "Commander les badges du Mois de l'ESS", dd(5), ed("SEN-01").id);
  const suivi = await list(ines.id, "Suivi hebdo avec mon responsable", "pole_lead", ed("OBS-01").id, 0, "bleu");
  await task(ines.id, suivi.id, "Rédiger la note de conjoncture (données URSSAF T2)", dd(9), ed("OBS-01").id, false, 0, { day: dd(2), start: "09:00", end: "12:30" });
  await task(ines.id, suivi.id, "Envoyer les invitations du petit-déjeuner du 14 octobre", dd(7), ed("OBS-01").id);
  await task(ines.id, suivi.id, "Chiffres par département pour le Mois de l'ESS (demande de Sophie)", dd(6), ed("SEN-01").id, false, 0, { day: dd(3), start: "14:00", end: "17:00" });
  await task(ines.id, suivi.id, "Relancer les partenaires pour le jury du Prix", dd(-3), ed("SEN-01").id, true, 2);
  await task(ines.id, null, "Préparer le point hebdo de jeudi", dd(3), null);
  const recette = await list(romain.id, "Recette du nouveau site", "pole", ed("COM-02").id, 0, "vert");
  await task(romain.id, recette.id, "Valider les pages Agenda et Carte TESS", dd(4), ed("COM-02").id, false, 0, { day: dd(1), start: "14:00", end: "17:00" });
  await task(romain.id, recette.id, "Tester le formulaire de contact (RGPD, accusé de réception)", dd(1), ed("COM-02").id);
  await task(romain.id, recette.id, "Vérifier les contrastes RGAA sur les pages projets", dd(-2), ed("COM-02").id, true, 2);
  await task(romain.id, recette.id, "Newsletter d'octobre : annoncer le nouveau site", dd(16), ed("COM-01").id);
  const idees = await list(elise.id, "Idées et veille", "private", null, 0);
  await task(elise.id, idees.id, "Relire la proposition de catalogue avant le CA (remarque de Claire)", dd(8), propEd.id);
  await task(elise.id, idees.id, "Post LinkedIn sur le programme du Mois", dd(2), ed("SEN-01").id, false, 0, { day: dd(2), start: "11:00", end: "12:00" });
  await task(elise.id, null, "Relancer les 12 organisateurs aux dossiers incomplets", dd(1), ed("SEN-01").id);
  await task(thomas.id, null, "Déposer les justificatifs FSE T3 (émargements, lettres de mission)", dd(4), ed("DLA-01").id, false, 0, { day: dd(2), start: "09:00", end: "11:00" });
  await task(thomas.id, null, "Ordre du jour du comité d'appui du 24", dd(-2), ed("DLA-01").id, true, 3);
  const cam = await list(camille.id, "Carte TESS — publication", "pole", ed("TES-04").id, 0);
  await task(camille.id, cam.id, "Déplacer le jalon « Publication » au 15 novembre (décision CODIR)", dd(1), ed("TES-04").id);
  await task(camille.id, cam.id, "Livrer le GeoJSON à Romain pour la recette", dd(-3), ed("TES-04").id, true, 2);
  await task(leadB.id, null, "Préparer la réunion de pôle du 22 (avancement des jalons d'automne)", dd(7), null, false, 0, { day: dd(6), start: "16:00", end: "17:30" });

  // ─────────────────────────────────────────────────────────────────────────────────────────────
  // Notes : réunions de pôle partagées, café du lundi, rendez-vous partenaires, préparation du CA.
  // ─────────────────────────────────────────────────────────────────────────────────────────────
  // Couleur = repère visuel de l'auteur ; partage nominatif = collègues nommés en plus de la visibilité.
  const note = (authorId: string, title: string, context: string, visibility: string, day: string, body: string, editionId: string | null = null, color: string | null = null, shareWith: string[] = []) =>
    prisma.note.create({ data: { authorId, title, context, visibility, date: dayjs(day).toDate(), body, editionId, color, shares: { create: shareWith.map((personId) => ({ personId })) } } });
  await note(leadA.id, "Réunion de pôle du 8 septembre", "pole", "pole", "2026-09-08", "Tour de table des projets de la rentrée.\n\nDécisions :\n- ORESS : note de conjoncture pour le 30, petit-déjeuner égalité le 14 octobre avec le Réseau Femmes.\n- Baromètre égalité : traitement des 214 réponses en septembre-octobre, restitution le 3 décembre à Tours.\n- AIESSE : lettre n°2 en relecture direction cette semaine.\n\nÀ faire : chacun met à jour ses jalons dans l'outil avant lundi.", null, "bleu");
  await note(leadB.id, "Réunion de pôle du 9 septembre", "pole", "pole", "2026-09-09", "Automne chargé : journée du lab (22/10), conférence 3 (8/10), rencontre PTCE (18/11), comité d'appui DLA (24/09).\n\n- Carte TESS : publication reportée avec le site (15/11), à écrire sur la fiche.\n- DLA : justificatifs FSE T3 avant le 19 ; relecture RAF.\n- Lab : traiteur à valider (devis en attente depuis une semaine).\n\nCamille passe à 80 % : la charge de novembre est à revoir avec elle.", null, "bleu");
  await note(elise.id, "Café du lundi 14 septembre", "cafe", "all", today.format("YYYY-MM-DD"), "Points saillants :\n- Hugo : bilan du forum pour le 15, rapport ESS France en retard de deux jours.\n- Thomas : comité d'appui DLA le 24, 5 diagnostics en attente d'orientation.\n- Léa : CA du 1er octobre, convocations mercredi.\n- Élise : 48 événements labellisés, relance des dossiers incomplets.\n- Absences : Camille mercredi après-midi (récup), Inès vendredi (représentation).");
  await note(ines.id, "Point partenaires du 11 septembre (jury du Prix)", "partner", "private", "2026-09-11", "Le Crédit Coopératif confirme sa participation au jury. Demande une convention simplifiée : à voir avec Nadia.\nESS France propose de mutualiser la grille de notation avec les autres régions.", ed("SEN-01").id, "corail", [raf.id]);
  await note(camille.id, "Rendez-vous ADEME du 3 septembre — note d'opportunité", "partner", "all", "2026-09-03", "Sami Kaci (ADEME) : la note réemploi est bien couverte par la convention, sans ligne dédiée. Format attendu : 20 pages + synthèse 4 pages, remise le 15 octobre, présentation au comité régional économie circulaire en décembre.\nIl demande un paragraphe sur les ressourceries en difficulté (lien avec COO-03).", ed("TES-03").id, "vert");
  await note(assistant.id, "Préparation du CA du 1er octobre", "project", "private", "2026-09-10", "Ordre du jour proposé par Claire : plan stratégique 2027-2030 (point d'étape), proposition de catalogue de formation (Élise), budget rectificatif Mois de l'ESS, calendrier des CA 2027.\nÀ prévoir : salle, café, vote électronique testé, dossier à J-7.", vieEd.id, "ocre", [director.id]);
  await note(hugo.id, "Débrief du forum avec le Palais des congrès", "partner", "pole", "2026-06-19", "Retour du Palais des congrès : flux OK, signalétique à renforcer, salle plénière trop grande pour 118.\nPour 2027 : viser une salle de 150, réserver avant décembre.", ed("SEN-03").id);

  // ─────────────────────────────────────────────────────────────────────────────────────────────
  // Demandes internes : celles des entretiens (salle pour la direction, chiffres pour l'Observatoire, retour sur le site) et d'autres.
  // ─────────────────────────────────────────────────────────────────────────────────────────────
  await prisma.request.createMany({ data: [
    { kind: "assistant", title: "Réserver la salle du CA pour les 4 entretiens de recrutement", body: "Mardi 22 matin, 4 entretiens ; le premier à l'extérieur si possible.", requesterId: director.id, assigneeId: assistant.id, dueDate: d(3), status: "open", createdAt: d(-1) },
    { kind: "data", title: "Chiffres de l'emploi ESS par département pour l'ouverture du Mois de l'ESS", body: "Les 6 départements, emploi et établissements, format tableau + 3 phrases clés.", requesterId: leadB.id, assigneeId: ines.id, editionId: ed("SEN-01").id, dueDate: d(6), status: "doing", createdAt: d(-2) },
    { kind: "site", title: "Mettre à jour la page « Nous rejoindre » avec l'offre de chargé·e de mission TE", body: "Le référentiel de poste est validé ; lien vers le PDF sur le serveur.", requesterId: raf.id, poleId: poles[2].id, assigneeId: romain.id, editionId: ed("COM-02").id, dueDate: d(2), status: "doing", createdAt: d(-4) },
    { kind: "com", title: "Visuel pour le petit-déjeuner ORESS d'octobre", body: "Format réseaux sociaux + bandeau mail, thème égalité femmes-hommes.", requesterId: ines.id, poleId: poles[2].id, editionId: ed("OBS-01").id, dueDate: d(12), status: "open", createdAt: d(0) },
    { kind: "work", title: "Relire la note de conjoncture avant envoi", body: "Une relecture de forme, 6 pages, avant le 29.", requesterId: ines.id, assigneeId: manon.id, editionId: ed("OBS-01").id, dueDate: d(14), status: "open", createdAt: d(-1) },
    { kind: "assistant", title: "Devis traiteur pour l'AG 2027", body: "Deux devis comparés, 80 personnes.", requesterId: director.id, assigneeId: assistant.id, status: "done", answer: "Deux devis déposés dans le dossier AG, le moins cher est conforme.", doneAt: d(-2), createdAt: d(-9) },
    { kind: "data", title: "Nombre de SCIC en région pour un journaliste", requesterId: thomas.id, assigneeId: ines.id, status: "done", answer: "43 SCIC au 31/12/2025, envoyé avec la source.", doneAt: d(-6), createdAt: d(-7) },
    { kind: "site", title: "Corriger la date du forum sur la page d'accueil", requesterId: hugo.id, poleId: poles[2].id, assigneeId: romain.id, status: "done", answer: "Corrigé.", doneAt: d(-20), createdAt: d(-21) },
    { kind: "com", title: "Post LinkedIn sur la rencontre PTCE", requesterId: thomas.id, poleId: poles[2].id, dueDate: d(-10), status: "declined", answer: "Trop tôt : on le fait à J-15 de la rencontre, en novembre.", doneAt: d(-12), createdAt: d(-14) },
  ] });
  await prisma.notification.createMany({ data: [
    { personId: assistant.id, senderId: director.id, kind: "info", title: "Demande · Logistique / administratif : Réserver la salle du CA pour les 4 entretiens de recrutement", body: `${director.name} · pour le ${today.add(3, "day").format("D MMM")}`, link: "/demandes", createdAt: d(-1) },
    { personId: manon.id, senderId: ines.id, kind: "info", title: "Demande · Travail à faire : Relire la note de conjoncture avant envoi", body: `${ines.name} · pour le ${today.add(14, "day").format("D MMM")}`, link: "/demandes", createdAt: d(-1) },
    { personId: director.id, senderId: ines.id, kind: "info", title: "Demande · Communication : Visuel pour le petit-déjeuner ORESS d'octobre", body: `${ines.name} · pour le ${today.add(12, "day").format("D MMM")}`, link: "/demandes", createdAt: d(0) },
  ] });

  // Autres notifications récentes : les échéances de la semaine et le bon pour accord d'un devis approuvé.
  await prisma.notification.createMany({ data: [
    { personId: hugo.id, senderId: director.id, kind: "info", title: "Décision CODIR consignée sur Forum régional de l'ESS · 2026", body: "Objectif participants aligné sur l'avenant (120) ; rapport intermédiaire ESS France à remettre cette semaine.", link: `/edition/${ed("SEN-03").id}?onglet=validations`, createdAt: d(-3) },
    { personId: camille.id, senderId: director.id, kind: "info", title: "Décision CODIR consignée sur Carte et ressource TESS · 2026", body: "Publication calée sur la mise en ligne du site (15 novembre) ; le jalon est déplacé sur la fiche.", link: `/edition/${ed("TES-04").id}?onglet=validations`, createdAt: d(-3), readAt: d(-3) },
    { personId: director.id, senderId: leadB.id, kind: "info", title: "Pour information · Devis intervenant conférence 2 approuvé (600 €)", body: `Par ${leadB.name}, niveau 2.`, link: `/edition/${ed("TES-02").id}?onglet=budget`, createdAt: d(-97), readAt: d(-96) },
  ] });

  await prisma.settings.update({ where: { id: 1 }, data: { operatingDaysPerMonth: 1.5 } });

  const org = (name: string) => [...funders, ...partnerOrgs].find((o) => o.name === name)!.id;
  // Contacts et listes (18/09) : quelques personnes extérieures fictives, une liste « Réseau développeurs ESS » à Thomas
  // (partagée à son pôle) avec ses colonnes propres, une liste privée d'invités à Élise.
  const extContacts = await Promise.all([
    { firstName: "Marius", lastName: "Garnier", email: "m.garnier@exemple.fr", phone: "06 12 00 00 01", role: "Chargé de développement", organisationName: "Initiative Loiret", city: "Orléans", postcode: "45000", tags: "réseau,financement" },
    { firstName: "Salomé", lastName: "Petit", email: "s.petit@exemple.fr", role: "Développeuse ESS", organisationId: org("France Active Centre-Val de Loire"), city: "Tours", postcode: "37000", tags: "réseau,accompagnement" },
    { firstName: "Yann", lastName: "Kervella", email: "y.kervella@exemple.fr", role: "Directeur", organisationName: "Coop'Alim Berry", city: "Bourges", postcode: "18000", tags: "réseau,alimentation" },
    { firstName: "Fatou", lastName: "Diallo", email: "f.diallo@exemple.fr", role: "Élue déléguée à l'ESS", organisationId: org("Tours Métropole Val de Loire"), city: "Tours", tags: "élu" },
    { firstName: "Olivier", lastName: "Renaud", email: "o.renaud@exemple.fr", role: "Journaliste", organisationName: "La Nouvelle République", city: "Tours", tags: "presse" },
    { firstName: "Léna", lastName: "Bourgeois", email: "l.bourgeois@exemple.fr", role: "Enseignante-chercheuse", organisationId: org("Université de Tours"), city: "Tours", tags: "recherche,alimentation" },
  ].map((c) => prisma.contact.create({ data: { ...c, createdById: byName("Thomas Guérin").id } })));
  const reseau = await prisma.contactList.create({ data: { ownerId: byName("Thomas Guérin").id, name: "Réseau développeurs ESS", description: "Les développeurs et chargés de mission ESS du territoire, pour les séminaires annuels.", visibility: "pole", color: "vert", editionId: ed("TES-05").id, fields: JSON.stringify([{ key: "charte", label: "Charte signée", type: "bool" }, { key: "seminaire_2025", label: "Séminaire 2025", type: "bool" }, { key: "territoire", label: "Territoire", type: "select", options: ["Indre-et-Loire", "Loiret", "Cher", "Loir-et-Cher", "Indre", "Eure-et-Loir"] }]) } });
  for (const [i, c] of extContacts.slice(0, 4).entries()) await prisma.contactListItem.create({ data: { listId: reseau.id, contactId: c.id, role: i === 3 ? "Élue référente" : "Membre", values: JSON.stringify({ charte: i !== 2, seminaire_2025: i < 2, territoire: ["Loiret", "Indre-et-Loire", "Cher", "Indre-et-Loire"][i] }) } });
  const invites = await prisma.contactList.create({ data: { ownerId: byName("Élise Fontaine").id, name: "Invités · soirée de remise des prix", visibility: "private", color: "corail", editionId: ed("SEN-01").id, fields: JSON.stringify([{ key: "confirme", label: "Confirmé", type: "bool" }, { key: "table", label: "Table", type: "text" }]) } });
  for (const c of [extContacts[3], extContacts[4]]) await prisma.contactListItem.create({ data: { listId: invites.id, contactId: c.id, role: "Invité·e", values: JSON.stringify({ confirme: c === extContacts[3], table: c === extContacts[3] ? "Table d'honneur" : "" }) } });

  // Adhérents (module « adherents », 18/09) : des structures adhérentes de l'annuaire (genre member), leurs référents, des
  // adhésions 2025 réglées et 2026 en cours de campagne (réglées, à régler, une exonérée), deux personnes physiques.
  const year = new Date().getFullYear();
  const memberOrgs = await Promise.all([
    ["Coop'Alim Berry", "member", "Coopératives", 180, "Bourges", "Bastien", "Lefort"],
    ["Initiative Loiret", "member,network", "Réseaux et fédérations", 250, "Orléans", "Camille", "Nguyen"],
    ["Mutuelle Solidaire du Centre", "member", "Mutuelles", 400, "Tours", "Inès", "Barbier"],
    ["Fondation Val Solidaire", "member", "Fondations", 400, "Blois", "Paul", "Lemoine"],
    ["La Ressourcerie du Cher", "member", "Associations", 90, "Vierzon", "Awa", "Sy"],
    ["Scop Bâti Loire", "member", "Coopératives", 180, "Orléans", "Nadège", "Roussel"],
    ["Emploi Solidaire 41", "member", "Associations", 90, "Blois", "Kevin", "Marchal"],
    ["Ateliers du Réemploi", "member", "Entreprises sociales (ESUS)", 150, "Châteauroux", "Sophie", "Dubreuil"],
  ].map(async ([name, kinds, college, amount, city, firstName, lastName]) => {
    const o = await prisma.organisation.create({ data: { name: name as string, kinds: kinds as string, address: city as string } });
    const contact = await prisma.contact.create({ data: { organisationId: o.id, firstName: firstName as string, lastName: lastName as string, email: `${String(firstName).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")[0]}.${String(lastName).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s/g, "")}@exemple.fr`, role: "Référent·e adhésion", primary: true, createdById: byName("Nadia Ferrand").id } });
    return { o, contact, college: college as string, amount: amount as number };
  }));
  for (const [i, m] of memberOrgs.entries()) {
    await prisma.membership.create({ data: { organisationId: m.o.id, contactId: m.contact.id, year: year - 1, college: m.college, amount: m.amount, status: "paid", paidAt: new Date(`${year - 1}-0${(i % 4) + 2}-1${i}`), method: i % 3 === 0 ? "helloasso" : i % 3 === 1 ? "transfer" : "cheque", createdById: byName("Nadia Ferrand").id } });
    const status = i < 4 ? "paid" : i === 4 ? "exempt" : "due";
    await prisma.membership.create({ data: { organisationId: m.o.id, contactId: m.contact.id, year, college: m.college, amount: i === 4 ? 0 : m.amount, status, paidAt: status === "paid" ? new Date(`${year}-0${(i % 3) + 1}-2${i}`) : null, method: status === "paid" ? (i % 2 ? "transfer" : "helloasso") : null, notes: i === 4 ? "Exonérée : partenariat 2026 (décision du CA du 12/01)." : i === 6 ? "Relancée par mail le 3 septembre." : null, createdById: byName("Nadia Ferrand").id } });
  }
  // Deux personnes physiques : Léna (à jour), Olivier (à régler).
  await prisma.membership.create({ data: { contactId: extContacts[5].id, year, college: "Personnes physiques", amount: 30, status: "paid", paidAt: new Date(`${year}-02-03`), method: "helloasso", createdById: byName("Nadia Ferrand").id } });
  await prisma.membership.create({ data: { contactId: extContacts[4].id, year, college: "Personnes physiques", amount: 30, status: "due", createdById: byName("Nadia Ferrand").id } });

  // Trésorerie (module « tresorerie », 18/09) : solde de départ du mois courant, seuil, et les règles d'un budget associatif.
  const ym = `${year}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;
  await prisma.settings.update({ where: { id: 1 }, data: { cashOpeningBalance: 148500, cashOpeningMonth: ym, cashAlertThreshold: 30000 } });
  const rafId = byName("Nadia Ferrand").id;
  for (const r of [
    { label: "Loyer des locaux", direction: "out", category: "Loyer et charges locatives", amount: 2400, period: "monthly" },
    { label: "Fonctionnement courant", direction: "out", category: "Fonctionnement", amount: 3200, period: "monthly", notes: "fournitures, télécoms, déplacements, frais bancaires" },
    { label: "Remboursement du prêt (Banque des Territoires)", direction: "out", category: "Remboursement d'emprunt", amount: 1250, period: "monthly", endMonth: `${year + 1}-06` },
    { label: "Assurances", direction: "out", category: "Impôts et taxes", amount: 3100, period: "annual", startMonth: `${year + 1}-01` },
    { label: "Prestations et formations facturées", direction: "in", category: "Prestations et ventes", amount: 3500, period: "monthly" },
    { label: "Subvention de fonctionnement Région (acompte 2027)", direction: "in", category: "Subvention de fonctionnement", amount: 45000, period: "once", startMonth: `${year + 1}-02` },
    { label: "Subvention de fonctionnement Région (solde 2026)", direction: "in", category: "Subvention de fonctionnement", amount: 38000, period: "once", startMonth: `${year}-${String(new Date().getMonth() + 2 > 12 ? 12 : new Date().getMonth() + 2).padStart(2, "0")}` },
    { label: "FDVA fonctionnement (État)", direction: "in", category: "Subvention de fonctionnement", amount: 12000, period: "quarterly", notes: "quatre versements dans l'année" },
  ]) await prisma.cashRule.create({ data: { startMonth: ym, ...r, createdById: rafId } });
  // Ressources humaines : une ligne par personne (coût mensuel chargé), une alternance qui s'arrête, un poste à pourvoir.
  for (const [name, amount, extra] of [
    ["Claire Vasseur", 4600, {}], ["Nadia Ferrand", 3500, {}], ["Léa Morin", 1600, { notes: "temps partiel 80 %" }], ["Julien Barbot", 3300, {}], ["Sophie Delaunay", 3200, {}],
    ["Thomas Guérin", 2800, {}], ["Camille Aubert", 2700, { notes: "financé à 50 % sur la convention FSE" }], ["Maxime Roussel", 2700, {}], ["Hugo Lemaire", 2600, {}], ["Inès Cabral", 2600, {}],
    ["Élise Fontaine", 2600, {}], ["Romain Tessier", 2500, {}],
  ] as [string, number, { notes?: string; endMonth?: string }][]) {
    const person = people.find((p) => p.name === name);
    await prisma.cashRule.create({ data: { kind: "hr", personId: person?.id ?? null, label: name, direction: "out", category: "Salaires et charges", amount, period: "monthly", startMonth: `${year - 1}-01`, ...extra, createdById: rafId } });
  }
  await prisma.cashRule.create({ data: { kind: "hr", label: "Alternance communication", direction: "out", category: "Salaires et charges", amount: 1100, period: "monthly", startMonth: `${year}-09`, endMonth: `${year + 1}-08`, notes: "contrat d'apprentissage, un an", createdById: rafId } });
  await prisma.cashRule.create({ data: { kind: "hr", label: "Chargé·e de mission transition (poste à pourvoir)", direction: "out", category: "Salaires et charges", amount: 3100, period: "monthly", startMonth: `${year + 1}-03`, notes: "CDI, recrutement en cours — financé sur la convention Région 2027", createdById: rafId } });

  // Matériel et prêts (module « materiel », 18/09) : l'inventaire prêtable, deux prêts en cours (dont un en retard), un rendu.
  const eq = async (name: string, category: string, quantity: number, location: string, extra: { reference?: string; state?: string; value?: number; notes?: string } = {}) => prisma.equipment.create({ data: { name, category, quantity, location, ...extra } });
  const videoproj = await eq("Vidéoprojecteur Epson EB-X49", "Audiovisuel", 2, "Réserve, étagère du haut", { reference: "AV-01", value: 540, notes: "Câble HDMI et télécommande dans la housse." });
  const kakemono = await eq("Kakemono CRESS (roll-up 85 × 200)", "Signalétique", 3, "Réserve, tube à côté de la porte", { reference: "SIG-01" });
  const enceinte = await eq("Enceinte portable + micro HF", "Audiovisuel", 1, "Bureau de l'assistante", { reference: "AV-02", value: 690, notes: "Charger la veille : 6 h d'autonomie." });
  await eq("Ordinateur portable de prêt", "Informatique", 1, "Armoire fermée (clé chez Nadia)", { reference: "INF-03", state: "worn", value: 850, notes: "Session invité, pas de données." });
  await eq("Tables pliantes", "Mobilier", 6, "Sous-sol", { reference: "MOB-01" });
  await eq("Rallonges et multiprises", "Animation", 4, "Réserve, bac bleu");
  await eq("Urne et boîte à idées", "Animation", 1, "Réserve");
  await eq("Appareil photo", "Audiovisuel", 1, "Bureau de la communication", { reference: "AV-03", state: "broken", notes: "Obturateur bloqué : devis de réparation demandé." });
  const nowD = new Date();
  const dOff = (n: number) => new Date(nowD.getFullYear(), nowD.getMonth(), nowD.getDate() + n);
  const forum = ed("SEN-03");
  await prisma.loan.create({ data: { equipmentId: kakemono.id, quantity: 2, personId: byName("Hugo Lemaire").id, editionId: forum.id, outAt: dOff(-3), dueAt: dOff(4), notes: "pour le forum, remise sur place", createdById: byName("Léa Morin").id } });
  await prisma.loan.create({ data: { equipmentId: videoproj.id, quantity: 1, contactId: extContacts[2].id, organisationId: null, outAt: dOff(-20), dueAt: dOff(-6), notes: "assemblée générale de Coop'Alim", createdById: byName("Léa Morin").id } });
  await prisma.loan.create({ data: { equipmentId: enceinte.id, quantity: 1, personId: byName("Inès Cabral").id, editionId: ed("OBS-01").id, outAt: dOff(-40), dueAt: dOff(-35), returnedAt: dOff(-34), returnNote: "RAS", createdById: byName("Léa Morin").id } });

  // Partenaires liés aux éditions (lot E2), en plus du texte libre de la fiche.
  for (const [code, name, role] of [["TES-02", "Université de Tours", "Co-organise le cycle, accueille deux conférences"], ["TES-05", "France Active Centre-Val de Loire", "Intervient sur le financement des coopérations"], ["SEN-03", "Tours Métropole Val de Loire", "Accueille le forum"], ["OBS-01", "Mouvement associatif Centre-Val de Loire", "Partage ses données associatives"], ["SEN-03", "ESS France", "Relaie le forum au niveau national"]] as const) {
    await prisma.editionPartner.create({ data: { editionId: ed(code).id, organisationId: org(name), role } });
  }

  // Appels à projets (lot B, module veille) : ce que la CRESS a repéré chez ses financeurs. Un « nouveau » pas encore regardé,
  // un « on dépose » à échéance proche, un promu en convention (à déposer), un écarté, un au fil de l'eau, un annuel clôturé.
  const fx = (name: string) => funders.find((f) => f.name === name)!.id;
  const promoted = await prisma.convention.create({ data: { funderId: fx("ADEME"), reference: "ADEME-2027", scheme: "AAP Transition écologique · axe économie circulaire", label: "AAP Transition écologique 2027", description: "Économie circulaire : accompagner dix structures de réemploi du territoire sur deux ans.", startYear: 2027, endYear: 2028, status: "drafting", amountRequested: 42000, amountKind: "annual", deadline: today.add(52, "day").toDate(), ownerId: raf.id, helpers: "Un graphiste extérieur pour la mise en forme.", sources: "Règlement de l'appel : https://agirpourlatransition.ademe.fr/exemple\nCahier des charges sur le serveur : \\\\cress\\Partage\\Financements\\ADEME-2027", notes: "Montant indicatif : jusqu'à 50 % des dépenses éligibles.\nAppel : https://agirpourlatransition.ademe.fr/exemple" } });
  await prisma.conventionHelper.createMany({ data: [byName("Thomas Guérin").id, byName("Élise Fontaine").id].map((personId) => ({ conventionId: promoted.id, personId })) });
  await prisma.call.createMany({ data: [
    { funderId: fx("ADEME"), label: "AAP Transition écologique 2027", scheme: "Axe économie circulaire", deadline: today.add(52, "day").toDate(), recurring: true, link: "https://agirpourlatransition.ademe.fr/exemple", teamStatus: "apply", statusById: director.id, statusAt: d(-12), conventionId: promoted.id, description: "Montant indicatif : jusqu'à 50 % des dépenses éligibles", createdAt: d(-30) },
    { funderId: fx("Région"), label: "Appel à manifestation d'intérêt · Tiers-lieux et coopérations", scheme: "AMI 2026", deadline: today.add(18, "day").toDate(), link: "https://www.centre-valdeloire.fr/exemple-ami", teamStatus: "apply", statusById: director.id, statusAt: d(-6), description: "Portage possible avec ESSOR ; voir avec Simon pour la partie observatoire.\nMontant indicatif : 20 000 à 60 000 €", createdAt: d(-20) },
    { funderId: fx("Banque des Territoires"), label: "Soutien aux têtes de réseau ESS · ingénierie", scheme: "Programme Territoires d'ESS", deadline: today.add(9, "day").toDate(), teamStatus: "study", statusById: raf.id, statusAt: d(-4), description: "Sandrine attend les pièces RH ; à trancher lundi.\nMontant indicatif : jusqu'à 30 000 €", createdAt: d(-15) },
    { funderId: fx("État"), label: "Fonds pour le développement de la vie associative (FDVA) · fonctionnement", scheme: "FDVA 2 · 2027", deadline: today.add(95, "day").toDate(), recurring: true, link: "https://www.associations.gouv.fr/fdva", description: "Montant indicatif : 5 000 à 15 000 €", createdAt: d(-2) },
    { funderId: fx("ESS France"), label: "Fonds d'amorçage · Mois de l'ESS, projets territoriaux", deadline: today.add(40, "day").toDate(), recurring: true, description: "Montant indicatif : 3 000 €", createdAt: d(-1) },
    { funderId: fx("Cap'Asso"), label: "Cap'Asso · consolidation d'emploi", scheme: "Dispositif régional", rolling: true, link: "https://www.capasso.fr/exemple", teamStatus: "study", statusById: leadB.id, statusAt: d(-9), description: "Montant indicatif : jusqu'à 45 000 € sur 3 ans", createdAt: d(-40) },
    { funderId: fx("DREETS"), label: "Appel à projets Impact social · expérimentations", scheme: "AAP 2026", deadline: today.add(25, "day").toDate(), teamStatus: "dismissed", statusById: director.id, statusAt: d(-3), description: "Trop loin de nos missions ; orienter Familles Rurales.\nMontant indicatif : 40 000 €", createdAt: d(-10) },
    { funderId: fx("Région"), label: "Appel à projets Économie sociale et solidaire · innovation", scheme: "AAP ESS 2026", deadline: today.subtract(45, "day").toDate(), recurring: true, teamStatus: "dismissed", statusById: raf.id, statusAt: d(-60), description: "Pas cette année (Forum) ; à reconduire pour 2027.\nMontant indicatif : jusqu'à 25 000 €", createdAt: d(-120) },
  ] });

  // Réalisé comptable (lot D) : le grand livre analytique 2026, importé « depuis le logiciel de compta » (source fichier).
  // Charges sur le code du projet, réparties par poste ; frais de déplacement (625) partout où l'équipe se déplace ; produits
  // (7411 subventions) sur le code de la ligne de financement quand un versement est reçu. Un écart voulu avec la saisie RAF
  // sur quelques éditions, un code d'action rapproché à la main, deux codes inconnus à rapprocher dans l'admin.
  const eds2026 = await prisma.edition.findMany({ where: { year: 2026, status: "in_progress" }, include: { project: true, expenses: true, actions: true, fundingLines: { include: { funder: true, payments: true } } } });
  const ledger: { analyticCode: string; accountNumber: string; accountLabel: string; year: number; debit: number; credit: number; detail: { date: string; piece: string; thirdParty: string; label: string; debit: number; credit: number }[] }[] = [];
  const pieceNo = { n: 4100 };
  const push = (code: string, account: string, label: string, pieces: { d: string; tiers: string; lib: string; amt: number; product?: boolean }[]) => {
    const detail = pieces.map((x) => ({ date: x.d, piece: `${x.product ? "VT" : "AC"}-${pieceNo.n++}`, thirdParty: x.tiers, label: x.lib, debit: x.product ? 0 : x.amt, credit: x.product ? x.amt : 0 }));
    ledger.push({ analyticCode: code, accountNumber: account, accountLabel: label, year: 2026, debit: detail.reduce((s, x) => s + x.debit, 0), credit: detail.reduce((s, x) => s + x.credit, 0), detail });
  };
  for (const [i, e] of eds2026.entries()) {
    const code = e.project.analyticCode;
    const spent = e.expenses.reduce((s, x) => s + x.spent, 0) + e.spent;
    if (spent <= 0 && i % 2 === 1) continue; // quelques éditions sans écriture encore
    // La compta colle à la saisie RAF sauf sur trois éditions : une facture de plus en compta, une saisie en avance sur la compta.
    const factor = ["TES-02", "SEN-03"].includes(code) ? 1.12 : code === "COM-02" ? 0.85 : 1;
    const base = Math.max(400, Math.round((spent * factor) / 10) * 10);
    const prest = Math.round(base * 0.55), achats = Math.round(base * 0.2), com = base - prest - achats;
    if (prest > 0) push(code, "6226", "Honoraires", [{ d: "2026-03-18", tiers: e.fundingLines[0]?.funder.name === "FSE" ? "Cabinet Ligne Claire" : "Atelier Graphique du Val", lib: `Prestation ${e.project.name.slice(0, 28)}`, amt: Math.round(prest * 0.6) }, { d: "2026-06-24", tiers: "Intervenant·e", lib: "Animation, intervention", amt: prest - Math.round(prest * 0.6) }]);
    if (achats > 0) push(code, "6064", "Fournitures administratives", [{ d: "2026-02-09", tiers: "Bureau Vallée", lib: "Fournitures", amt: achats }]);
    if (com > 0) push(code, "6231", "Annonces et insertions", [{ d: "2026-05-12", tiers: "La Nouvelle République", lib: "Insertion presse", amt: com }]);
    // Frais de déplacement et missions : là où l'équipe est « souvent en déplacement » (Q26).
    if (i % 3 !== 2) push(code, "6251", "Voyages et déplacements", [{ d: "2026-04-03", tiers: "SNCF", lib: "Train Orléans–Tours", amt: 86 }, { d: "2026-05-21", tiers: "Note de frais", lib: "Déplacements pilote · km", amt: 143.5 }]);
    if (i % 4 === 0) push(code, "6257", "Réceptions", [{ d: "2026-06-11", tiers: "Traiteur Les Saveurs", lib: "Buffet réunion partenaires", amt: 312 }]);
    // Produits : la subvention comptabilisée sur le code de la ligne, égale aux versements reçus (sauf une : la compta a encaissé plus).
    for (const l of e.fundingLines) {
      const received = l.payments.filter((p) => p.receivedAt).reduce((s, p) => s + p.amount, 0);
      if (received > 0 && l.analyticCode) push(l.analyticCode, "7411", "Subventions d'exploitation", [{ d: "2026-04-25", tiers: l.funder.name, lib: `Subvention ${l.funder.name} 2026`, amt: code === "OBS-01" ? received + 2500 : received, product: true }]);
    }
  }
  // Un code d'action posé par la RAF (la soirée de remise du Prix a son propre code chez le comptable) et deux codes inconnus.
  const sen01 = eds2026.find((e) => e.project.analyticCode === "SEN-01");
  const soiree = sen01?.actions.find((a) => a.name === "Soirée de remise");
  if (sen01 && soiree) {
    push("SEN-01-SOIREE", "6234", "Cadeaux, trophées", [{ d: "2026-11-20", tiers: "Trophées du Centre", lib: "Trophées Prix ESS", amt: 640 }, { d: "2026-11-20", tiers: "Traiteur Les Saveurs", lib: "Cocktail de remise", amt: 1180 }]);
    await prisma.analyticTag.create({ data: { code: "SEN-01-SOIREE", targetKind: "action", targetId: soiree.id, note: "Code du comptable pour la soirée de remise." } });
    await prisma.analyticTag.create({ data: { code: "FONC", targetKind: "ignore", note: "Fonctionnement (salaires, loyer, prêt…) : hors éditions ; sert au réel de la trésorerie." } });
  }
  push("FONCT-2026", "6132", "Locations immobilières", [{ d: "2026-01-05", tiers: "SCI Les Halles", lib: "Loyer janvier", amt: 1850 }, { d: "2026-02-05", tiers: "SCI Les Halles", lib: "Loyer février", amt: 1850 }]);
  push("TESS-ETUDE", "6226", "Honoraires", [{ d: "2026-07-02", tiers: "Bureau d'études Mobilis", lib: "Étude mobilité — acompte", amt: 3200 }]);
  // Le fonctionnement des trois derniers mois (code analytique FONC, à ignorer côté éditions) : salaires, loyer, fonctionnement,
  // prêt, subvention de fonctionnement, prestations — le « réel » de la trésorerie et les montants « d'habitude ».
  const fonc = new Map<string, (typeof ledger)[number]>();
  for (let k = 3; k >= 1; k--) {
    const dm = new Date(nowD.getFullYear(), nowD.getMonth() - k, 1);
    const ymk = `${dm.getFullYear()}-${String(dm.getMonth() + 1).padStart(2, "0")}`;
    const yr = dm.getFullYear();
    // Une ligne par compte et par exercice (contrainte d'unicité), les mois dans le détail.
    const line = (account: string, label: string, day: string, tiers: string, lib: string, amt: number, product = false) => {
      const key = `${account}|${yr}`;
      let l = fonc.get(key);
      if (!l) { l = { analyticCode: "FONC", accountNumber: account, accountLabel: label, year: yr, debit: 0, credit: 0, detail: [] }; fonc.set(key, l); ledger.push(l); }
      l.detail.push({ date: `${ymk}-${day}`, piece: `${product ? "VT" : "AC"}-${pieceNo.n++}`, thirdParty: tiers, label: lib, debit: product ? 0 : amt, credit: product ? amt : 0 });
      if (product) l.credit += amt; else l.debit += amt;
    };
    line("641", "Rémunérations du personnel", "28", "Paie", `Salaires ${ymk}`, 24200 + k * 150);
    line("645", "Charges sociales", "28", "URSSAF", `Charges sociales ${ymk}`, 9300 + k * 60);
    line("613", "Locations", "05", "SCI du Val", `Loyer ${ymk}`, 2400);
    line("606", "Fournitures", "12", "Bureau Vallée", "Fournitures et consommables", 640 + k * 45);
    line("626", "Télécommunications", "15", "Orange", "Téléphonie et internet", 380);
    line("625", "Déplacements", "20", "SNCF", "Déplacements équipe", 910 - k * 70);
    line("661", "Charges d'intérêts", "10", "Banque des Territoires", "Échéance prêt", 1250);
    line("706", "Prestations de services", "18", "Formation ESS Loire", "Formation facturée", 3100 + k * 200, true);
    if (k === 2) line("74", "Subventions d'exploitation", "22", "État (FDVA)", "FDVA fonctionnement — versement", 12000, true);
  }
  await prisma.ledgerLine.createMany({ data: ledger.map((l) => ({ source: "file", analyticCode: l.analyticCode, accountNumber: l.accountNumber, accountLabel: l.accountLabel, year: l.year, debit: l.debit, credit: l.credit, detail: JSON.stringify(l.detail), importedAt: d(-4) })) });
  await prisma.ledgerImport.create({ data: { source: "file", year: 2026, fileName: "grand-livre-analytique-2026-08.xlsx", lines: ledger.length, rows: ledger.reduce((s, l) => s + l.detail.length, 0), byId: raf.id, importedAt: d(-4) } });

  // Notifications d'échéance (J-30, J-7, retard) : la passerelle les génère datées du jour où le mail serait parti ;
  // celles de plus de trois jours sont marquées lues, comme des mails déjà ouverts — la cloche ne montre que le frais.
  const { created } = await syncDeadlineNotifications();
  await prisma.notification.updateMany({ where: { kind: DEADLINE_KIND, createdAt: { lt: d(-3) } }, data: { readAt: d(-1) } });
  console.log(`Notifications d'échéance générées : ${created}.`);

  console.log(`Seed terminé : ${people.length} personnes, ${projectDefs.length + 2} projets, ${allEditions.length + 2} éditions.`);
}
