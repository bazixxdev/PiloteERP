import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentPersonOrNull } from "@/lib/session";
import { canReadList, contactName, listToCsv, loadContactList } from "@/lib/contacts";

// Export d'une liste de contacts en CSV (?liste=), ou l'annuaire en JSON léger pour le sélecteur d'ajout (?annuaire=1).
// Réservé aux personnes connectées ; une liste s'exporte si on peut la lire.
export async function GET(req: Request) {
  const me = await getCurrentPersonOrNull();
  if (!me) return new NextResponse("Connexion requise", { status: 401 });
  const url = new URL(req.url);
  if (url.searchParams.get("annuaire")) {
    const rows = await prisma.contact.findMany({ where: { leftAt: null }, include: { organisation: { select: { name: true } } }, orderBy: [{ lastName: "asc" }, { firstName: "asc" }] });
    return NextResponse.json(rows.map((c) => ({ id: c.id, organisationId: c.organisationId, label: `${contactName(c)}${c.organisation?.name ?? c.organisationName ? ` · ${c.organisation?.name ?? c.organisationName}` : ""}${c.email ? ` · ${c.email}` : ""}` })));
  }
  const id = url.searchParams.get("liste");
  const list = id ? await loadContactList(id) : null;
  if (!list || !canReadList(me, list)) return new NextResponse("Liste introuvable", { status: 404 });
  const name = list.name.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase() || "liste";
  return new NextResponse(listToCsv(list), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="contacts-${name}.csv"` } });
}
