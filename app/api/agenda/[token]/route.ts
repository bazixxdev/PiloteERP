import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { buildIcs, personEvents, teamEvents } from "@/lib/ics";

// Flux iCal : /api/agenda/{jeton}.ics — jeton personnel ou jeton équipe.
export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token: raw } = await params;
  const token = raw.replace(/\.ics$/i, "");
  const base = new URL(req.url).origin;
  const settings = await prisma.settings.findUnique({ where: { id: 1 } });
  let feed: { name: string; events: Awaited<ReturnType<typeof teamEvents>>["events"] } | null = null;
  if (settings?.teamIcsToken && token === settings.teamIcsToken) feed = await teamEvents(base);
  else {
    const p = await prisma.person.findUnique({ where: { icsToken: token } });
    if (p) feed = await personEvents(p.id, base);
  }
  if (!feed) return new NextResponse("Flux introuvable", { status: 404 });
  return new NextResponse(buildIcs(feed.name, feed.events), {
    headers: { "Content-Type": "text/calendar; charset=utf-8", "Content-Disposition": `inline; filename="pilote-agenda.ics"`, "Cache-Control": "no-cache" },
  });
}
