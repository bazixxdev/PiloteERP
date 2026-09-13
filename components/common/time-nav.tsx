import Link from "next/link";
import { cn } from "@/lib/utils";

// Sous-navigation « Temps » : ma saisie, l'équipe (selon la visibilité), la clôture (RAF, direction).
export function TimeNav({ current, showTeam, showCloture, teamHref }: { current: "me" | "team" | "cloture"; showTeam: boolean; showCloture: boolean; teamHref?: string }) {
  const tab = (key: string, label: string, href: string, testId: string) => (
    <Link key={key} href={href} data-testid={testId} aria-current={current === key ? "page" : undefined} className={cn("-mb-px border-b-2 px-3 py-2 text-sm font-medium", current === key ? "border-coral text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}>{label}</Link>
  );
  return (
    <nav className="mb-4 flex flex-wrap gap-1 border-b" data-testid="time-nav">
      {tab("me", "Ma saisie", "/temps", "time-nav-me")}
      {showTeam && tab("team", "Temps de l'équipe", teamHref ?? "/temps?equipe=1", "time-nav-team")}
      {showCloture && tab("cloture", "Clôture mensuelle", "/cloture", "time-nav-cloture")}
    </nav>
  );
}
