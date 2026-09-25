// Instance TLST (lot I) : le squelette (une équipe, cinq personnes, missions, codes de temps) et, sauf --skeleton, une petite démo
// à vider avant la reprise des vraies données depuis erp-tlst. Tout est fictif.
import { PrismaClient } from "@prisma/client";
import { dayjs } from "../../lib/format";
import { createPerson, type Common } from "./common";

export async function seedTlst(prisma: PrismaClient, c: Common, { skeleton }: { skeleton: boolean }) {
  const today = dayjs().startOf("day");
  const year = today.year();
  const d = (n: number) => today.add(n, "day").toDate();

  const equipe = await prisma.pole.create({ data: { name: "Équipe" } });
  // Raisons d'être = les trois axes du tiers-lieu tels qu'erp-tlst les référençait (seule chose que sa base contenait, 18/09).
  const missions = await Promise.all(["Compétences", "Alimentation", "Lieu partagé"].map((name, i) => prisma.mission.create({ data: { name, order: i } })));
  const timeCodes = await Promise.all([
    { code: "FONCT", label: "Fonctionnement (réunions, vie du lieu)", kind: "operating" },
    { code: "GEST", label: "Gestion administrative et financière", kind: "operating" },
    { code: "NT", label: "Non travaillé (congés, absences)", kind: "non_worked" },
  ].map((t, i) => prisma.timeCode.create({ data: { ...t, order: i } })));

  const defs = [
    { name: "Anne Lefort", role: "director", rhythm: "option_a", days: 200, jobTitle: "Coordinatrice", arrivedAt: "2022-09-01" },
    { name: "Bruno Maillard", role: "raf", rhythm: "part_time", days: 160, jobTitle: "Trésorier", arrivedAt: "2023-01-09" },
    { name: "Chloé Renaud", role: "pilot", rhythm: "option_a", days: 200, jobTitle: "Responsable jardin et cantine", arrivedAt: "2023-03-01" },
    { name: "David Ott", role: "pilot", rhythm: "option_a", days: 200, jobTitle: "Responsable ateliers", arrivedAt: "2024-02-05" },
    { name: "Emma Sicard", role: "assistant", rhythm: "part_time", days: 160, jobTitle: "Assistante", arrivedAt: "2025-09-01" },
  ];
  const people = [];
  for (const [i, p] of defs.entries()) people.push(await createPerson(prisma, c, { ...p, poleId: equipe.id, order: i }));
  const [coord, treso, chloe, david, emma] = people;
  await prisma.pole.update({ where: { id: equipe.id }, data: { leadId: coord.id } });
  for (const p of people) await prisma.personTimeCode.createMany({ data: timeCodes.map((t) => ({ personId: p.id, timeCodeId: t.id })) });
  console.log(`Squelette TLST : ${people.length} personnes.`);
  if (skeleton) return;

  // ── Démo ──
  const region = await prisma.organisation.create({ data: { name: "Région Centre-Val de Loire", kinds: "funder,authority" } });
  const fondation = await prisma.organisation.create({ data: { name: "Fondation Terre Solidaire", kinds: "funder" } });
  const mairie = await prisma.organisation.create({ data: { name: "Ville de Loches", kinds: "authority,partner" } });

  const projets = [
    { name: "Jardin partagé", code: "JAR-01", pilot: chloe, mission: 1, envelope: 8000, steps: ["Semis de printemps", "Chantier participatif", "Fête des récoltes"] },
    { name: "Cantine solidaire", code: "CAN-01", pilot: chloe, mission: 1, envelope: 15000, steps: ["Ouverture de saison", "Repas de quartier", "Bilan de l'année"] },
    { name: "Ateliers réparation", code: "REP-01", pilot: david, mission: 0, envelope: 4000, steps: ["Atelier vélo", "Atelier électroménager", "Atelier couture"] },
  ];
  const editions = [];
  for (const [i, p] of projets.entries()) {
    const project = await prisma.project.create({ data: { name: p.name, analyticCode: p.code, poleId: equipe.id, pilotId: p.pilot.id, guarantorId: coord.id, missionId: missions[p.mission].id } });
    const edition = await prisma.edition.create({ data: { projectId: project.id, year, status: "in_progress", budgetEnvelope: p.envelope, directExpenseEnvelope: p.envelope, stakes: `Ce que ${p.name.toLowerCase()} apporte au lieu et au territoire.`, calendar: "Toute l'année, temps forts au printemps et à l'automne.", decisionDate: dayjs(`${year}-01-20`).toDate() } });
    editions.push(edition);
    await prisma.editionTeam.create({ data: { editionId: edition.id, personId: p.pilot.id } });
    for (const [j, s] of p.steps.entries()) await prisma.action.create({ data: { editionId: edition.id, name: s, ownerId: p.pilot.id, milestoneDate: d(-60 + j * 60 + i * 7), state: j === 0 ? "done" : j === 1 ? "doing" : "todo", order: j, isPublic: j === 2 } });
    const line = await prisma.fundingLine.create({ data: { editionId: edition.id, funderId: i === 2 ? fondation.id : region.id, scheme: i === 2 ? "Appel à projets réemploi" : "Soutien aux tiers-lieux", status: "contracted", amountRequested: p.envelope * 0.6, amountGranted: p.envelope * 0.5, analyticCode: `${p.code}-FIN`, submittedAt: dayjs(`${year - 1}-11-15`).toDate(), answeredAt: dayjs(`${year}-01-30`).toDate(), contractedAt: dayjs(`${year}-02-15`).toDate() } });
    await prisma.payment.create({ data: { fundingLineId: line.id, label: "Acompte", amount: p.envelope * 0.3, expectedAt: dayjs(`${year}-03-31`).toDate(), receivedAt: dayjs(`${year}-04-08`).toDate() } });
    await prisma.payment.create({ data: { fundingLineId: line.id, label: "Solde sur bilan", amount: p.envelope * 0.2, expectedAt: dayjs(`${year + 1}-01-31`).toDate() } });
  }

  // Budget prévisionnel (25/09) : un prévu en brouillon sur le premier projet, pour que la section ne soit pas vide en démo.
  await prisma.budgetLine.createMany({ data: [
    { editionId: editions[0].id, categoryId: "bcat_personnel", label: "Animation du projet", amount: 12000 },
    { editionId: editions[0].id, categoryId: "bcat_achats", label: "Matériel et semences", amount: 1500 },
    { editionId: editions[0].id, categoryId: "bcat_indirects", label: "Frais de structure (15 % du personnel)", amount: 1800 },
  ] });

  await prisma.call.create({ data: { funderId: fondation.id, label: `Appel à projets alimentation durable ${year + 1}`, scheme: "Alimentation et précarité", deadline: d(45), recurring: true, amountHint: "jusqu'à 20 000 €", teamStatus: "study", statusById: coord.id, statusAt: d(-3), link: "https://exemple.org/aap" } });

  const structures = ["AMAP du Val", "Coop'Loches", "Recyclerie Sud Touraine", "Épicerie Le Panier", "Ferme des Ormeaux", "Collectif Vélo"];
  const orgs = await Promise.all(structures.map((name) => prisma.organisation.create({ data: { name, kinds: "member" } })));
  const persons = [["Marie", "Girard"], ["Paul", "Roux"], ["Inès", "Bernard"], ["Léo", "Fabre"]];
  const contacts = await Promise.all(persons.map(([firstName, lastName], i) => prisma.contact.create({ data: { firstName, lastName, email: `${firstName.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")}.${lastName.toLowerCase()}@exemple.fr`, tags: i % 2 ? "bénévole" : "" } })));
  await prisma.contact.create({ data: { organisationId: mairie.id, firstName: "Sophie", lastName: "Marin", email: "s.marin@exemple.fr", primary: true } });
  await prisma.contact.create({ data: { organisationId: region.id, firstName: "Karim", lastName: "Haddad", email: "k.haddad@exemple.fr", primary: true } });
  for (const [i, o] of orgs.entries()) await prisma.membership.create({ data: { organisationId: o.id, year, college: "Structures", amount: 50, status: i < 4 ? "paid" : "due", paidAt: i < 4 ? dayjs(`${year}-02-1${i}`).toDate() : null, method: i < 4 ? "transfer" : null, createdById: treso.id } });
  for (const [i, ct] of contacts.entries()) await prisma.membership.create({ data: { contactId: ct.id, year, college: "Personnes physiques", amount: 15, status: i < 3 ? "paid" : "due", paidAt: i < 3 ? dayjs(`${year}-03-0${i + 1}`).toDate() : null, method: i < 3 ? "helloasso" : null, createdById: treso.id } });
  const liste = await prisma.contactList.create({ data: { ownerId: emma.id, name: "Bénévoles du jardin", visibility: "all", color: "vert", editionId: editions[0].id, fields: JSON.stringify([{ key: "dispo", label: "Disponible le samedi", type: "bool" }]) } });
  for (const ct of contacts.slice(0, 3)) await prisma.contactListItem.create({ data: { listId: liste.id, contactId: ct.id, role: "Bénévole", values: JSON.stringify({ dispo: true }) } });

  const ym = today.format("YYYY-MM");
  await prisma.settings.update({ where: { id: 1 }, data: { cashOpeningBalance: 22000, cashOpeningMonth: ym, cashAlertThreshold: 5000 } });
  for (const r of [
    { label: "Loyer du lieu", direction: "out", category: "Loyer", amount: 900, period: "monthly" },
    { label: "Salaires et charges", direction: "out", category: "Salaires et charges", amount: 7800, period: "monthly", kind: "hr" },
    { label: "Assurance", direction: "out", category: "Fonctionnement", amount: 1200, period: "annual" },
    { label: "Subvention de fonctionnement Ville", direction: "in", category: "Subventions", amount: 6000, period: "annual" },
  ]) await prisma.cashRule.create({ data: { startMonth: ym, ...r, createdById: treso.id } });

  const eq = (name: string, category: string, quantity: number, location: string) => prisma.equipment.create({ data: { name, category, quantity, location } });
  const [, , , barnum] = await Promise.all([eq("Broyeur de végétaux", "Jardin", 1, "Cabane du jardin"), eq("Motoculteur", "Jardin", 1, "Cabane du jardin"), eq("Sono portable", "Événementiel", 1, "Bureau"), eq("Barnum 3 × 3", "Événementiel", 2, "Grange"), eq("Vaisselle 50 couverts", "Cuisine", 1, "Cantine")]);
  await prisma.loan.create({ data: { equipmentId: barnum.id, quantity: 1, contactId: contacts[0].id, editionId: editions[0].id, outAt: d(-5), dueAt: d(3), createdById: emma.id } });
  console.log(`Démo TLST : ${projets.length} projets, ${orgs.length + contacts.length} adhérents.`);
}
