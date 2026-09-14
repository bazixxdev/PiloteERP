import { prisma } from "./db";
import { dayjs } from "./format";
import { canReadShared } from "./modules";

export const NOTE_CONTEXTS = [
  { value: "project", label: "Réunion de projet" },
  { value: "team", label: "Réunion d'équipe" },
  { value: "pole", label: "Réunion de pôle" },
  { value: "cafe", label: "Café du lundi" },
  { value: "partner", label: "Rendez-vous partenaire" },
  { value: "other", label: "Note libre" },
] as const;

export type NoteView = { id: string; title: string; body: string; date: string; context: string; visibility: string; edition: { id: string; name: string; year: number } | null; author: { id: string; name: string }; mine: boolean; updatedAt: string };

const toView = (me: string, n: { id: string; title: string; body: string; date: Date; context: string; visibility: string; updatedAt: Date; author: { id: string; name: string }; edition: { id: string; year: number; project: { name: string } } | null }): NoteView => ({
  id: n.id, title: n.title, body: n.body, date: dayjs(n.date).format("YYYY-MM-DD"), context: n.context, visibility: n.visibility, updatedAt: n.updatedAt.toISOString(),
  edition: n.edition ? { id: n.edition.id, name: n.edition.project.name, year: n.edition.year } : null, author: { id: n.author.id, name: n.author.name }, mine: n.author.id === me,
});

const include = { author: true, edition: { include: { project: true } } };

// Mes notes, puis celles que d'autres partagent avec moi ; par date décroissante.
export async function loadNotes(me: { id: string; role: string; poleId: string | null }, opts?: { editionId?: string }): Promise<NoteView[]> {
  const rows = await prisma.note.findMany({
    where: { ...(opts?.editionId ? { editionId: opts.editionId } : {}), OR: [{ authorId: me.id }, { visibility: { not: "private" } }] },
    include, orderBy: [{ date: "desc" }, { updatedAt: "desc" }],
  });
  return rows.filter((n) => n.authorId === me.id || canReadShared(me, n.author, n.visibility)).map((n) => toView(me.id, n));
}

export async function loadNote(me: { id: string; role: string; poleId: string | null }, id: string): Promise<NoteView | null> {
  const n = await prisma.note.findUnique({ where: { id }, include });
  if (!n || (n.authorId !== me.id && !canReadShared(me, n.author, n.visibility))) return null;
  return toView(me.id, n);
}
