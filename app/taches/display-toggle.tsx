"use client";

import Link from "next/link";
import { LayoutList, Columns3 } from "lucide-react";
import { cn } from "@/lib/utils";

// Liste ou kanban (redesign du 18/09) : un commutateur à deux positions, dans l'adresse (?affichage=kanban).
export function DisplayToggle({ current, base = "/taches" }: { current: "liste" | "kanban"; base?: string }) {
  const item = (key: "liste" | "kanban", label: string, Icon: typeof LayoutList) => (
    <Link key={key} href={key === "kanban" ? `${base}${base.includes("?") ? "&" : "?"}affichage=kanban` : base} aria-current={current === key ? "page" : undefined} className={cn("inline-flex h-8 items-center gap-1.5 px-2.5 text-xs font-medium", current === key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")} data-testid={`tasks-display-${key}`}><Icon className="size-3.5" aria-hidden />{label}</Link>
  );
  return <div className="inline-flex overflow-hidden rounded-md border bg-card" role="group" aria-label="Affichage">{item("liste", "Liste", LayoutList)}{item("kanban", "Kanban", Columns3)}</div>;
}
