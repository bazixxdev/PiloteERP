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

// Le corps est du HTML (éditeur riche depuis le 14/09). Les notes plus anciennes sont du texte brut : on les passe en paragraphes.
const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
export function bodyToHtml(body: string): string {
  if (!body.trim()) return "";
  if (/^\s*</.test(body)) return body;
  return body.split(/\n{2,}/).map((para) => `<p>${esc(para).replace(/\n/g, "<br>")}</p>`).join("");
}
export const htmlToText = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/\s+/g, " ").trim();

export type NoteFilter = { q?: string; editionId?: string; context?: string; author?: string };

// Recherche plein texte simple (titre + corps sans balises) et filtres par projet, contexte, auteur. Assez pour des centaines de notes par an.
export function filterNotes(notes: NoteView[], f: NoteFilter): NoteView[] {
  const q = (f.q ?? "").trim().toLowerCase();
  return notes.filter((n) =>
    (!q || `${n.title} ${htmlToText(n.body)}`.toLowerCase().includes(q)) &&
    (!f.editionId || n.edition?.id === f.editionId) &&
    (!f.context || n.context === f.context) &&
    (!f.author || n.author.id === f.author),
  );
}

// Regroupement par mois pour la liste : « Septembre 2026 », « Août 2026 »… Les notes arrivent déjà triées par date décroissante.
export function groupByMonth(notes: NoteView[]): { key: string; label: string; notes: NoteView[] }[] {
  const out: { key: string; label: string; notes: NoteView[] }[] = [];
  for (const n of notes) {
    const key = n.date.slice(0, 7);
    const last = out[out.length - 1];
    if (last && last.key === key) last.notes.push(n);
    else { const l = dayjs(n.date).format("MMMM YYYY"); out.push({ key, label: l.charAt(0).toUpperCase() + l.slice(1), notes: [n] }); }
  }
  return out;
}

export type NoteView = { id: string; title: string; body: string; date: string; context: string; visibility: string; edition: { id: string; name: string; year: number } | null; author: { id: string; name: string }; mine: boolean; updatedAt: string };

const toView = (me: string, n: { id: string; title: string; body: string; date: Date; context: string; visibility: string; updatedAt: Date; author: { id: string; name: string }; edition: { id: string; year: number; project: { name: string } } | null }): NoteView => ({
  id: n.id, title: n.title, body: bodyToHtml(n.body), date: dayjs(n.date).format("YYYY-MM-DD"), context: n.context, visibility: n.visibility, updatedAt: n.updatedAt.toISOString(),
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
