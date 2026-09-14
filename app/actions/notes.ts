"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getCurrentPerson } from "@/lib/session";
import { dayjs } from "@/lib/format";
import { NOTE_CONTEXTS } from "@/lib/notes";

type Result<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };

const VIS = ["private", "pole", "all"];
type Patch = { title?: string; body?: string; date?: string; context?: string; editionId?: string | null; visibility?: string };

function clean(p: Patch, current?: { title: string }) {
  const out: Record<string, unknown> = {};
  if (p.title !== undefined) out.title = p.title.trim() || current?.title || "Sans titre";
  if (p.body !== undefined) out.body = p.body;
  if (p.date !== undefined) { const d = dayjs(p.date, "YYYY-MM-DD", true); if (!d.isValid()) return { error: "Date invalide." }; out.date = d.startOf("day").toDate(); }
  if (p.context !== undefined) { if (!NOTE_CONTEXTS.some((c) => c.value === p.context)) return { error: "Contexte inconnu." }; out.context = p.context; }
  if (p.editionId !== undefined) out.editionId = p.editionId || null;
  if (p.visibility !== undefined) { if (!VIS.includes(p.visibility)) return { error: "Visibilité inconnue." }; out.visibility = p.visibility; }
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
