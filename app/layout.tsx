import type { Metadata } from "next";
import "./globals.css";
import { Sidebar } from "@/components/shell/sidebar";
import { Topbar } from "@/components/shell/topbar";
import { MobileNav } from "@/components/shell/mobile-nav";
import { Toaster } from "@/components/ui/sonner";
import { Shortcuts } from "@/components/shell/shortcuts";
import { prisma } from "@/lib/db";
import { getCurrentPerson, getPeople, getSettings } from "@/lib/session";
import { syncDeadlineNotifications } from "@/lib/deadline-notifications";
import { canDecideValidation, canSeeTimeOf } from "@/lib/rights";
import { instanceHas } from "@/lib/modules";
import { navTreeFor } from "@/lib/navigation";
import { Suspense } from "react";

export const metadata: Metadata = {
  title: "Pilote · CRESS Centre-Val de Loire",
  description: "Prototype de l'outil de pilotage des projets",
};

export const dynamic = "force-dynamic";

// Compteurs de la barre latérale : seulement ce qui appelle une action de la personne courante (validations qu'elle peut décider,
// échéances qui la nomment), jamais un total collectif qu'un contributeur prendrait pour sa liste de tâches.
// La passerelle échéances → notifications tourne ici, à chaque chargement : c'est le cron quotidien du prototype.
async function counters() {
  const me = await getCurrentPerson();
  const [pending, { reminders }, requests, people, settings] = await Promise.all([
    prisma.validationRequest.findMany({ where: { status: "pending" }, select: { requesterId: true, requiredLevel: true, edition: { select: { project: { select: { pilotId: true, poleId: true, secondaryPoles: { select: { poleId: true } } } } } } } }),
    syncDeadlineNotifications(),
    prisma.request.findMany({ where: { status: { in: ["open", "doing"] } }, select: { assigneeId: true, poleId: true } }),
    getPeople(),
    getSettings(),
  ]);
  const modules = me.modules.split(",").map((x) => x.trim()).filter(Boolean);
  const requestsForMe = requests.filter((r) => (r.assigneeId ? r.assigneeId === me.id : r.poleId ? me.poleId === r.poleId || me.role === "director" : false)).length;
  const badges = {
    // Demandes et validations fusionnées (15/09) : un seul badge = ce que j'ai à traiter, des deux côtés.
    requests: requestsForMe + pending.filter((v) => canDecideValidation(me, v)).length,
    reminders: reminders.filter((r) => r.whoIds.includes(me.id)).length,
  };
  return {
    role: me.role,
    modules,
    tree: navTreeFor({
      role: me.role,
      modules,
      veille: instanceHas(settings, "veille"),
      showTeam: people.some((p) => p.id !== me.id && canSeeTimeOf(me, p, settings.timeVisibility)),
      badges,
    }),
  };
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const c = await counters();
  return (
    <html lang="fr">
      <body className="antialiased">
        <div className="flex h-screen overflow-hidden">
          {/* useSearchParams (entrée active selon ?vue=, ?section=…) exige une frontière Suspense dans un layout. */}
          <Suspense fallback={<aside className="hidden h-screen w-[60px] shrink-0 border-r bg-sidebar md:block lg:w-[244px]" />}>
            <Sidebar tree={c.tree} />
          </Suspense>
          <div className="flex min-w-0 flex-1 flex-col">
            <Topbar />
            <main className="flex-1 overflow-y-auto pb-20 md:pb-0">{children}</main>
          </div>
        </div>
        <MobileNav modules={c.modules} />
        <Toaster position="bottom-right" richColors />
        <Shortcuts role={c.role} />
      </body>
    </html>
  );
}
