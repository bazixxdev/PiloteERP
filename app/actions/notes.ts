"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getCurrentPerson } from "@/lib/session";
import { dayjs } from "@/lib/format";
import { NOTE_CONTEXTS, NOTE_COLORS } from "@/lib/notes";

type Result<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };

const VIS = ["private", "pole", "all"];
type Patch = { title?: string; body?: string; date?: string; context?: string; editionId?: string | null; visibility?: string; color?: string | null };

function clean(p: Patch, current?: { title: string }) {
  const out: Record<string, unknown> = {};
  if (p.title !== undefined) out.title = p.title.trim() || current?.title || "Sans titre";
  if (p.body !== undefined) out.body = p.body;
  if (p.date !== undefined) { const d = dayjs(p.date, "YYYY-MM-DD", true); if (!d.isValid()) return { error: "Date invalide." }; out.date = d.startOf("day").toDate(); }
  if (p.context !== undefined) { if (!NOTE_CONTEXTS.some((c) => c.value === p.context)) return { error: "Contexte inconnu." }; out.context = p.context; }
  if (p.editionId !== undefined) out.editionId = p.editionId || null;
  if (p.visibility !== undefined) { if (!VIS.includes(p.visibility)) return { error: "Visibilité inconnue." }; out.visibility = p.visibility; }
  if (p.color !== undefined) { if (p.color && !NOTE_COLORS.some((c) => c.value === p.color)) return { error: "Couleur inconnue." }; out.color = p.color || null; }
  return { data: out };
}

// Une note appartient à son auteur : personne d'autre ne l'écrit.
export async function addNote(input: Patch): Promise<Result<{ id: string }>> {
  const me = await getCurrentPerson();
  const c = clean(input);
  if ("error" in c) return { ok: false, error: c.error! };
  const n = await prisma.note.create({ data: { authorId: me.id, title: (input.title ?? "").trim() || "Sans titre", ...c.data } });
  revalidatePath("/", "layout");
  return { ok: true, data: { id: n.id } };
}

export async function updateNote(id: string, patch: Patch): Promise<Result> {
  const me = await getCurrentPerson();
  const n = await prisma.note.findUnique({ where: { id } });
  if (!n || n.authorId !== me.id) return { ok: false, error: "Note introuvable." };
  const c = clean(patch, n);
  if ("error" in c) return { ok: false, error: c.error! };
  await prisma.note.update({ where: { id }, data: c.data });
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function deleteNote(id: string): Promise<Result> {
  const me = await getCurrentPerson();
  const n = await prisma.note.findUnique({ where: { id } });
  if (!n || n.authorId !== me.id) return { ok: false, error: "Note introuvable." };
  await prisma.note.delete({ where: { id } });
  revalidatePath("/", "layout");
  return { ok: true };
}

// Partage nominatif : l'auteur nomme des collègues ; chaque nouvelle personne est prévenue (notification en cloche, pas de mail).
export async function setNoteShares(id: string, personIds: string[]): Promise<Result<{ added: number }>> {
  const me = await getCurrentPerson();
  const n = await prisma.note.findUnique({ where: { id }, include: { shares: true } });
  if (!n || n.authorId !== me.id) return { ok: false, error: "Note introuvable." };
  const wanted = new Set(personIds.filter((p) => p !== me.id));
  const people = await prisma.person.findMany({ where: { id: { in: [...wanted] }, active: true }, select: { id: true } });
  const valid = new Set(people.map((p) => p.id));
  const current = new Set(n.shares.map((s) => s.personId));
  const toAdd = [...valid].filter((p) => !current.has(p));
  const toRemove = [...current].filter((p) => !valid.has(p));
  await prisma.$transaction([
    ...(toRemove.length ? [prisma.noteShare.deleteMany({ where: { noteId: id, personId: { in: toRemove } } })] : []),
    ...toAdd.map((personId) => prisma.noteShare.create({ data: { noteId: id, personId } })),
    ...toAdd.map((personId) => prisma.notification.create({ data: { personId, senderId: me.id, kind: "info", title: `Note partagée : ${n.title || "Sans titre"}`, body: `${me.name} partage cette note avec vous.`, link: `/notes?note=${id}` } })),
  ]);
  revalidatePath("/", "layout");
  return { ok: true, data: { added: toAdd.length } };
}
