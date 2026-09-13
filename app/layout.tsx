import type { Metadata } from "next";
import "./globals.css";
import { Sidebar } from "@/components/shell/sidebar";
import { Topbar } from "@/components/shell/topbar";
import { MobileNav } from "@/components/shell/mobile-nav";
import { Toaster } from "@/components/ui/sonner";
import { Shortcuts } from "@/components/shell/shortcuts";
import { prisma } from "@/lib/db";
import { getCurrentPerson, getSettings } from "@/lib/session";
import { computeReminders } from "@/lib/alerts";
import { canDecideValidation } from "@/lib/rights";

export const metadata: Metadata = {
  title: "Pilote · CRESS Centre-Val de Loire",
  description: "Prototype de l'outil de pilotage des projets",
};

export const dynamic = "force-dynamic";

// Compteurs de la barre latérale : seulement ce qui appelle une action de la personne courante (validations qu'elle peut décider,
// rappels qui la concernent), jamais un total collectif qu'un contributeur prendrait pour sa liste de tâches.
async function counters() {
  const [settings, me] = await Promise.all([getSettings(), getCurrentPerson()]);
  const [pending, editions, raf] = await Promise.all([
    prisma.validationRequest.findMany({ where: { status: "pending" }, select: { requesterId: true, requiredLevel: true, edition: { select: { project: { select: { pilotId: true, poleId: true, secondaryPoles: { select: { poleId: true } } } } } } } }),
    prisma.edition.findMany({
      where: { status: { in: ["in_progress", "validated"] } },
      include: { project: { include: { pilot: true } }, actions: true, fundingLines: { include: { funder: true, deliverables: true } }, validations: true, expenses: true },
    }),
    prisma.person.findFirst({ where: { role: "raf" } }),
  ]);
  const reminders = computeReminders(editions, raf?.name ?? null, settings.reminderDaysBefore.split(",").map(Number), settings.horizonDays);
  return {
    pending: pending.filter((v) => canDecideValidation(me, v)).length,
    reminders: reminders.filter((r) => r.who.includes(me.name)).length,
    role: me.role,
  };
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const c = await counters();
  return (
    <html lang="fr">
      <body className="antialiased">
        <div className="flex h-screen overflow-hidden">
          <Sidebar pendingCount={c.pending} remindersCount={c.reminders} role={c.role} />
          <div className="flex min-w-0 flex-1 flex-col">
            <Topbar />
            <main className="flex-1 overflow-y-auto pb-20 md:pb-0">{children}</main>
          </div>
        </div>
        <MobileNav />
        <Toaster position="bottom-right" richColors />
        <Shortcuts role={c.role} />
      </body>
    </html>
  );
}
