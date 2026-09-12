import type { Metadata } from "next";
import "./globals.css";
import { Sidebar } from "@/components/shell/sidebar";
import { Topbar } from "@/components/shell/topbar";
import { Toaster } from "@/components/ui/sonner";
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
  const [pending, editions, raf] = await Promise.all([
    prisma.validationRequest.count({ where: { status: "pending" } }),
    prisma.edition.findMany({
      where: { status: { in: ["in_progress", "validated"] } },
      include: { project: { include: { pilot: true } }, actions: true, fundingLines: { include: { funder: true, deliverables: true } }, validations: true },
    }),
    prisma.person.findFirst({ where: { role: "raf" } }),
  ]);
  const reminders = computeReminders(editions, raf?.name ?? null, settings.reminderDaysBefore.split(",").map(Number), settings.horizonDays);
  return { pending, reminders: reminders.length };
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const c = await counters();
  return (
    <html lang="fr">
      <body className="antialiased">
        <div className="flex h-screen overflow-hidden">
          <Sidebar pendingCount={c.pending} remindersCount={c.reminders} />
          <div className="flex min-w-0 flex-1 flex-col">
            <Topbar />
            <main className="flex-1 overflow-y-auto">{children}</main>
          </div>
        </div>
        <Toaster position="bottom-right" richColors />
      </body>
    </html>
  );
}
