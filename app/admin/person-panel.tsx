import Link from "next/link";
import { AutoField } from "@/components/inline/auto-field";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/db";
import { fmtDate } from "@/lib/format";
import { loadResponsibilities, responsibilityCount } from "@/lib/people";
import { refLabel, type RefMap } from "@/lib/refs";
import { cn } from "@/lib/utils";
import { V, cap, de, pl } from "@/lib/vocab";

// Fiche d'une personne (lot E1), en panneau sur Admin › Personnes (?personne=<id>) : identité, poste, dates, compte, ce qu'elle
// porte. Chaque champ s'enregistre seul (AutoField) ; la désactivation et les réattributions passent par « Préparer un départ ».
export async function PersonPanelBody({ id, refs, rw, poles, rhythms }: { id: string; refs: RefMap; rw: boolean; poles: { id: string; name: string }[]; rhythms: { code: string; label: string }[] }) {
  const p = await prisma.person.findUnique({ where: { id }, include: { pole: true, user: { select: { lastLoginAt: true } }, rhythmPeriods: { include: { rhythm: true }, orderBy: { from: "desc" }, take: 1 } } });
  if (!p) return <p className="text-sm text-muted-foreground">Personne introuvable.</p>;
  const r = await loadResponsibilities(id);
  const total = responsibilityCount(r);
  const F = ({ field, type = "text", label, value, options, testId }: { field: string; type?: "text" | "date" | "textarea" | "select"; label: string; value: unknown; options?: { value: string; label: string }[]; testId?: string }) => (
    <label className="grid gap-0.5">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
      <AutoField model="person" id={p.id} field={field} type={type} value={value as string | number | boolean | null} options={options} readOnly={!rw} label={label} testId={testId ?? `person-${field}`} />
    </label>
  );
  const rhythm = p.rhythmPeriods[0]?.rhythm.label.split(" · ")[0] ?? rhythms.find((x) => x.code === p.workRhythm)?.label ?? "Référence non configurée";
  return (
    <div className="grid gap-5" data-testid="person-panel">
      <section className="grid gap-2">
        <h3 className="text-xs font-semibold text-foreground">Identité</h3>
        <div className="grid grid-cols-2 gap-2">
          <F field="firstName" label="Prénom" value={p.firstName} />
          <F field="lastName" label="Nom" value={p.lastName} />
        </div>
        <F field="jobTitle" label="Fonction" value={p.jobTitle} />
        <div className="grid grid-cols-2 gap-2">
          <F field="email" label="E-mail (identifiant)" value={p.email} />
          <F field="phone" label="Téléphone" value={p.phone} />
        </div>
      </section>
      <section className="grid gap-2">
        <h3 className="text-xs font-semibold text-foreground">Poste</h3>
        <div className="grid grid-cols-2 gap-2">
          <F field="role" type="select" label="Rôle" value={p.role} options={Object.values(refs.role ?? {}).map((x) => ({ value: x.code, label: x.label }))} />
          <F field="poleId" type="select" label={cap(V.pole)} value={p.poleId} options={poles.map((x) => ({ value: x.id, label: x.name }))} />
        </div>
        <p className="text-xs text-muted-foreground">Rythme : <b className="font-medium text-foreground">{rhythm}</b> · {p.availableDays} jours disponibles par an{p.fixedShare ? " · part fixe" : ""} — se règlent dans le tableau.</p>
      </section>
      <section className="grid gap-2">
        <h3 className="text-xs font-semibold text-foreground">Présence</h3>
        <div className="grid grid-cols-2 gap-2">
          <F field="arrivedAt" type="date" label="Arrivée" value={p.arrivedAt} />
          <F field="leftAt" type="date" label="Départ" value={p.leftAt} />
        </div>
        <F field="note" type="textarea" label="Note" value={p.note} />
        <p className="text-xs text-muted-foreground">
          {p.active ? <span className="font-medium text-mint">Active</span> : <span className="font-medium text-danger">Désactivée</span>}
          {" · "}compte de connexion : {p.userId ? <>actif{p.user?.lastLoginAt ? `, dernière connexion le ${fmtDate(p.user.lastLoginAt)}` : ", jamais connecté·e"}</> : "aucun"} — <Link href="/admin?section=comptes" className="underline underline-offset-2">Comptes</Link>
        </p>
      </section>
      <section className="grid gap-2" data-testid="person-responsibilities">
        <h3 className="text-xs font-semibold text-foreground">Ce que {p.firstName || p.name} porte <span className={cn("ml-1 rounded-sm px-1.5 text-[10px] font-bold", total ? "bg-warning-soft text-warning-foreground" : "bg-muted text-muted-foreground")}>{total}</span></h3>
        <ul className="grid gap-1 text-xs">
          <li>Projets pilotés : <b className="font-medium">{r.piloted.length}</b>{r.piloted.length > 0 && <span className="text-muted-foreground"> · {r.piloted.map((x) => x.name).join(", ")}</span>}</li>
          <li>Garant de projet : <b className="font-medium">{r.guaranteed.length}</b>{r.guaranteed.length > 0 && <span className="text-muted-foreground"> · {r.guaranteed.map((x) => x.name).join(", ")}</span>}</li>
          {r.ledPoles.length > 0 && <li>{`Responsable ${de(V.pole)} : `}<span className="text-muted-foreground">{r.ledPoles.map((x) => x.name).join(", ")}</span></li>}
          {r.sponsored.length > 0 && <li>{`Sponsor d'${pl(V.edition)} : `}<b className="font-medium">{r.sponsored.length}</b></li>}
          <li>{`${cap(pl(V.action))} à faire : `}<b className="font-medium">{r.actions.length}</b> · demandes ouvertes : <b className="font-medium">{r.requests.length}</b> · tâches : <b className="font-medium">{r.tasks}</b>{` · équipes d'${pl(V.edition)} en cours : `}<b className="font-medium">{r.teams.length}</b></li>
        </ul>
        {rw && p.active && (
          <div className="pt-1">
            <Button asChild size="sm" variant="outline" data-testid="person-departure-open"><Link href={`/admin/depart/${p.id}`}>Préparer un départ</Link></Button>
            <span className="ml-2 text-[11px] text-muted-foreground">réattribuer ce qu&apos;elle porte, dater, désactiver — sans rien effacer</span>
          </div>
        )}
      </section>
    </div>
  );
}

export function personPanelTitle(p: { name: string; jobTitle: string | null; role: string; pole: { name: string } | null }, refs: RefMap) {
  return { title: p.name, description: [p.jobTitle, refLabel(refs, "role", p.role), p.pole?.name ?? "transversal"].filter(Boolean).join(" · ") };
}
