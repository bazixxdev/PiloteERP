"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getCurrentPerson } from "@/lib/session";
import { canAdmin } from "@/lib/rights";

type Result<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };

async function guard(): Promise<string | null> {
  const me = await getCurrentPerson();
  return canAdmin(me.role) ? null : "Réservé à l'administration (direction, RAF).";
}

export async function createPerson(name: string): Promise<Result> {
  const d = await guard(); if (d) return { ok: false, error: d };
  const count = await prisma.person.count();
  await prisma.person.create({ data: { name: name.trim() || "Nouvelle personne", role: "contributor", workRhythm: "option_a", order: count } });
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function createPole(name: string): Promise<Result> {
  const d = await guard(); if (d) return { ok: false, error: d };
  await prisma.pole.create({ data: { name: name.trim() || "Nouveau pôle" } });
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function createProject(input: { name: string; analyticCode: string; poleId: string; pilotId: string; missionId: string; year: number }): Promise<Result<{ editionId: string }>> {
  const d = await guard(); if (d) return { ok: false, error: d };
  const pole = await prisma.pole.findUnique({ where: { id: input.poleId } });
  const p = await prisma.project.create({
    data: { name: input.name.trim() || "Nouveau projet", analyticCode: input.analyticCode.trim() || "À définir", poleId: input.poleId, pilotId: input.pilotId, guarantorId: pole?.leadId ?? null, missionId: input.missionId },
  });
  const e = await prisma.edition.create({ data: { projectId: p.id, year: input.year, status: "proposed", team: { create: [{ personId: input.pilotId }] }, personDays: { create: [{ personId: input.pilotId, soldDays: 0 }] } } });
  revalidatePath("/", "layout");
  return { ok: true, data: { editionId: e.id } };
}

export async function createEdition(projectId: string, year: number): Promise<Result<{ editionId: string }>> {
  const d = await guard(); if (d) return { ok: false, error: d };
  const exists = await prisma.edition.findUnique({ where: { projectId_year: { projectId, year } } });
  if (exists) return { ok: false, error: `L'édition ${year} existe déjà.` };
  const p = await prisma.project.findUnique({ where: { id: projectId } });
  if (!p) return { ok: false, error: "Projet introuvable" };
  const e = await prisma.edition.create({ data: { projectId, year, status: "proposed", team: { create: [{ personId: p.pilotId }] }, personDays: { create: [{ personId: p.pilotId, soldDays: 0 }] } } });
  revalidatePath("/", "layout");
  return { ok: true, data: { editionId: e.id } };
}

export async function createRef(kind: "funder" | "mission" | "timeCode", name: string): Promise<Result> {
  const d = await guard(); if (d) return { ok: false, error: d };
  const n = name.trim();
  if (!n) return { ok: false, error: "Nom vide" };
  if (kind === "funder") await prisma.funder.create({ data: { name: n } });
  if (kind === "mission") await prisma.mission.create({ data: { name: n, order: await prisma.mission.count() } });
  if (kind === "timeCode") await prisma.timeCode.create({ data: { code: n.toUpperCase().replace(/[^A-Z0-9]+/g, "_").slice(0, 12), label: n, kind: "operating", order: await prisma.timeCode.count() } });
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function createRefValue(family: string, label: string): Promise<Result> {
  const d = await guard(); if (d) return { ok: false, error: d };
  const code = label.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
  if (!code) return { ok: false, error: "Libellé vide" };
  const count = await prisma.refValue.count({ where: { family } });
  await prisma.refValue.upsert({ where: { family_code: { family, code } }, create: { family, code, label: label.trim(), order: count }, update: { label: label.trim() } });
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function togglePersonTimeCode(personId: string, timeCodeId: string, on: boolean): Promise<Result> {
  const d = await guard(); if (d) return { ok: false, error: d };
  if (on) await prisma.personTimeCode.upsert({ where: { personId_timeCodeId: { personId, timeCodeId } }, create: { personId, timeCodeId }, update: {} });
  else await prisma.personTimeCode.deleteMany({ where: { personId, timeCodeId } });
  revalidatePath("/", "layout");
  return { ok: true };
}

// Import CSV simple (création seulement, séparateur ; ou ,). Colonnes attendues dans la première ligne.
function parseCsv(text: string): Record<string, string>[] {
  const lines = text.replace(/\r/g, "").split("\n").filter((l) => l.trim());
  if (lines.length < 2) return [];
  const sep = lines[0].includes(";") ? ";" : ",";
  const split = (l: string) => {
    const out: string[] = []; let cur = ""; let q = false;
    for (const ch of l) {
      if (ch === '"') q = !q;
      else if (ch === sep && !q) { out.push(cur); cur = ""; }
      else cur += ch;
    }
    out.push(cur);
    return out.map((s) => s.trim());
  };
  const headers = split(lines[0]).map((h) => h.toLowerCase());
  return lines.slice(1).map((l) => Object.fromEntries(split(l).map((v, i) => [headers[i] ?? `col${i}`, v])));
}

export async function importCsv(table: "personnes" | "financeurs" | "projets", text: string): Promise<Result<{ created: number; skipped: string[] }>> {
  const d = await guard(); if (d) return { ok: false, error: d };
  const rows = parseCsv(text);
  if (rows.length === 0) return { ok: false, error: "Fichier vide ou sans ligne de données." };
  let created = 0; const skipped: string[] = [];
  if (table === "financeurs") {
    for (const r of rows) {
      const name = r.nom ?? r.name; if (!name) { skipped.push("(sans nom)"); continue; }
      const ex = await prisma.funder.findUnique({ where: { name } });
      if (ex) { skipped.push(name); continue; }
      await prisma.funder.create({ data: { name } }); created++;
    }
  } else if (table === "personnes") {
    const poles = await prisma.pole.findMany();
    for (const r of rows) {
      const name = r.nom ?? r.name; if (!name) { skipped.push("(sans nom)"); continue; }
      if (await prisma.person.findFirst({ where: { name } })) { skipped.push(name); continue; }
      const pole = poles.find((p) => p.name.toLowerCase() === (r.pole ?? r.pôle ?? "").toLowerCase());
      await prisma.person.create({ data: { name, role: r.role || r.rôle || "contributor", workRhythm: r.rythme || r.workrhythm || "option_a", availableDays: Number(r.jours || r.availabledays) || 200, poleId: pole?.id ?? null } });
      created++;
    }
  } else {
    const [poles, people, missions] = await Promise.all([prisma.pole.findMany(), prisma.person.findMany(), prisma.mission.findMany()]);
    for (const r of rows) {
      const name = r.nom ?? r.name; if (!name) { skipped.push("(sans nom)"); continue; }
      if (await prisma.project.findFirst({ where: { name } })) { skipped.push(name); continue; }
      const pole = poles.find((p) => p.name.toLowerCase() === (r.pole ?? r.pôle ?? "").toLowerCase()) ?? poles[0];
      const pilot = people.find((p) => p.name.toLowerCase() === (r.pilote ?? r.pilot ?? "").toLowerCase()) ?? people.find((p) => p.role === "director");
      const mission = missions.find((m) => m.name.toLowerCase() === (r.mission ?? "").toLowerCase()) ?? missions[0];
      if (!pole || !pilot || !mission) { skipped.push(name); continue; }
      await prisma.project.create({ data: { name, analyticCode: r.code || r.analyticcode || "À définir", poleId: pole.id, pilotId: pilot.id, guarantorId: pole.leadId, missionId: mission.id } });
      created++;
    }
  }
  revalidatePath("/", "layout");
  return { ok: true, data: { created, skipped } };
}

// Rythmes de travail : création d'un rythme, et période d'effet pour une personne (le rythme peut changer).
export async function createRhythm(label: string): Promise<Result> {
  const d = await guard(); if (d) return { ok: false, error: d };
  const code = label.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 24);
  if (!code) return { ok: false, error: "Libellé vide" };
  await prisma.rhythm.create({ data: { code, label: label.trim(), hoursEven: "7,7,7,7,7,0,0", hoursOdd: "7,7,7,7,7,0,0", order: await prisma.rhythm.count() } });
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function addRhythmPeriod(personId: string, rhythmId: string, from: string): Promise<Result> {
  const d = await guard(); if (d) return { ok: false, error: d };
  const start = new Date(from);
  if (Number.isNaN(start.getTime())) return { ok: false, error: "Date de début invalide" };
  // La période précédente encore ouverte se ferme la veille.
  const open = await prisma.personRhythmPeriod.findFirst({ where: { personId, to: null }, orderBy: { from: "desc" } });
  if (open && open.from < start) await prisma.personRhythmPeriod.update({ where: { id: open.id }, data: { to: new Date(start.getTime() - 86400000) } });
  await prisma.personRhythmPeriod.create({ data: { personId, rhythmId, from: start } });
  const r = await prisma.rhythm.findUnique({ where: { id: rhythmId } });
  if (r) await prisma.person.update({ where: { id: personId }, data: { workRhythm: r.code } });
  revalidatePath("/", "layout");
  return { ok: true };
}
