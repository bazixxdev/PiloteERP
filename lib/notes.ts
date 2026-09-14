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

export type NoteFilter = { q?: string; editionId?: string; context?: string; author?: string; color?: string; archived?: boolean };

// Recherche plein texte simple (titre + corps sans balises) et filtres par projet, contexte, auteur. Assez pour des centaines de notes par an.
export function filterNotes(notes: NoteView[], f: NoteFilter): NoteView[] {
  const q = (f.q ?? "").trim().toLowerCase();
  return notes.filter((n) =>
    n.archived === Boolean(f.archived) &&
    (!q || `${n.title} ${htmlToText(n.body)}`.toLowerCase().includes(q)) &&
    (!f.editionId || n.edition?.id === f.editionId) &&
    (!f.context || n.context === f.context) &&
    (!f.author || n.author.id === f.author) &&
    (!f.color || n.color === f.color),
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

// Couleurs de repérage (retour du 14/09 : « de la couleur, ça aide à ranger et c'est moins triste ») ; palette de la charte, jamais du rouge d'alerte.
export const NOTE_COLORS = [
  { value: "bleu", label: "Bleu", hex: "#004d6d", soft: "#e6f0f5" },
  { value: "vert", label: "Vert", hex: "#226552", soft: "#e5f1eb" },
  { value: "ocre", label: "Ocre", hex: "#8c601b", soft: "#faf0d8" },
  { value: "corail", label: "Corail", hex: "#ea5427", soft: "#fdeae3" },
  { value: "violet", label: "Violet", hex: "#5b4b8a", soft: "#ece8f5" },
  { value: "gris", label: "Gris", hex: "#5e6c72", soft: "#efefea" },
] as const;
export const noteColor = (v: string | null | undefined) => NOTE_COLORS.find((c) => c.value === v) ?? null;

export type NoteView = { id: string; title: string; body: string; date: string; context: string; visibility: string; color: string | null; archived: boolean; edition: { id: string; name: string; year: number } | null; author: { id: string; name: string }; mine: boolean; sharedWith: { id: string; name: string }[]; sharedWithMe: boolean; updatedAt: string };

type Row = { id: string; title: string; body: string; date: Date; context: string; visibility: string; color: string | null; archivedAt: Date | null; updatedAt: Date; authorId: string; author: { id: string; name: string; poleId: string | null }; edition: { id: string; year: number; project: { name: string } } | null; shares: { person: { id: string; name: string } }[] };

const toView = (me: string, n: Row): NoteView => ({
  id: n.id, title: n.title, body: bodyToHtml(n.body), date: dayjs(n.date).format("YYYY-MM-DD"), context: n.context, visibility: n.visibility, color: n.color, archived: Boolean(n.archivedAt), updatedAt: n.updatedAt.toISOString(),
  edition: n.edition ? { id: n.edition.id, name: n.edition.project.name, year: n.edition.year } : null, author: { id: n.author.id, name: n.author.name }, mine: n.author.id === me,
  sharedWith: n.shares.map((s) => s.person), sharedWithMe: n.shares.some((s) => s.person.id === me),
});

const include = { author: true, edition: { include: { project: true } }, shares: { include: { person: { select: { id: true, name: true } } }, orderBy: { createdAt: "asc" as const } } };

// Qui lit une note : son auteur, les personnes nommées, puis selon la visibilité (pôle, toute la CRESS).
export const canReadNote = (me: { id: string; role: string; poleId: string | null }, n: Row) => n.authorId === me.id || n.shares.some((s) => s.person.id === me.id) || canReadShared(me, n.author, n.visibility);

// Mes notes, puis celles que d'autres partagent avec moi ; par date décroissante.
export async function loadNotes(me: { id: string; role: string; poleId: string | null }, opts?: { editionId?: string }): Promise<NoteView[]> {
  const rows = await prisma.note.findMany({
    where: { ...(opts?.editionId ? { editionId: opts.editionId } : {}), OR: [{ authorId: me.id }, { visibility: { not: "private" } }, { shares: { some: { personId: me.id } } }] },
    include, orderBy: [{ date: "desc" }, { updatedAt: "desc" }],
  });
  return rows.filter((n) => canReadNote(me, n)).map((n) => toView(me.id, n));
}

export async function loadNote(me: { id: string; role: string; poleId: string | null }, id: string): Promise<NoteView | null> {
  const n = await prisma.note.findUnique({ where: { id }, include });
  if (!n || !canReadNote(me, n)) return null;
  return toView(me.id, n);
}
