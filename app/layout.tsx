import type { Metadata } from "next";
import "./globals.css";
import { Sidebar } from "@/components/shell/sidebar";
import { Topbar } from "@/components/shell/topbar";
import { MobileNav } from "@/components/shell/mobile-nav";
import { Toaster } from "@/components/ui/sonner";
import { Shortcuts } from "@/components/shell/shortcuts";
import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/session";
import { computeReminders } from "@/lib/alerts";

export const metadata: Metadata = {
  title: "Pilote · CRESS Centre-Val de Loire",
  description: "Prototype de l'outil de pilotage des projets",
};

export const dynamic = "force-dynamic";

async function counters() {
  const settings = await getSettings();
  const [pending, editions, raf, poles, peopleCount] = await Promise.all([
    prisma.validationRequest.count({ where: { status: "pending" } }),
    prisma.edition.findMany({
      where: { status: { in: ["in_progress", "validated"] } },
      include: { project: { include: { pilot: true } }, actions: true, fundingLines: { include: { funder: true, deliverables: true } }, validations: true, expenses: true },
    }),
    prisma.person.findFirst({ where: { role: "raf" } }),
    prisma.pole.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.person.count({ where: { active: true } }),
  ]);
  const reminders = computeReminders(editions, raf?.name ?? null, settings.reminderDaysBefore.split(",").map(Number), settings.horizonDays);
  return { pending, reminders: reminders.length, poles, peopleCount };
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const c = await counters();
  return (
    <html lang="fr">
      <body className="antialiased">
        <div className="flex h-screen overflow-hidden">
          <Sidebar pendingCount={c.pending} remindersCount={c.reminders} poles={c.poles} peopleCount={c.peopleCount} />
          <div className="flex min-w-0 flex-1 flex-col">
            <Topbar />
            <main className="flex-1 overflow-y-auto pb-20 md:pb-0">{children}</main>
          </div>
        </div>
        <MobileNav />
        <Toaster position="bottom-right" richColors />
        <Shortcuts />
      </body>
    </html>
  );
}
