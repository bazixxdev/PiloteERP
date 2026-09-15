import Link from "next/link";
import { PageHeader } from "@/components/common/page-header";
import { Section } from "@/components/common/section";
import { StatusBadge } from "@/components/common/status-badge";
import { prisma } from "@/lib/db";
import { getCurrentPerson, getPeople, getRefs, getSettings } from "@/lib/session";
import { canDecideValidation } from "@/lib/rights";
import { refLabel } from "@/lib/refs";
import { ageDays, canSeeValidation, isForMe, kindLabel, loadRequests, statusOf, wideViewLabel } from "@/lib/requests";
import { loadEditionOpts, loadEditionChoices, loadSuppliers } from "@/lib/tasks";
import { RequestValidationDialog } from "@/app/edition/[id]/request-validation-dialog";
import { REF_DEFAULTS } from "@/lib/refs";
import { dayjs, fmtDate, fmtEuro } from "@/lib/format";
import { cn } from "@/lib/utils";
import { NewRequestDialog } from "./new-request";
import { RequestActions } from "./request-row";
import { DecideButtons } from "@/components/common/decide-buttons";
import { isCodir } from "@/lib/rights";

// Demandes (retour du 14/09) : un seul tableau pour tout ce qu'on demande à quelqu'un — demandes internes et validations —
// côté « à traiter par moi » et côté « mes demandes ». Un achat / devis reste une validation ; il apparaît ici aussi.
type Line = { id: string; family: "request" | "validation"; kind: string; title: string; sub: string; who: string; to: string; due: Date | null; status: { label: string; color: string }; age: number; href: string; open: boolean; actions?: React.ReactNode };

export default async function DemandesPage({ searchParams }: { searchParams: Promise<{ vue?: string }> }) {
  const { vue } = await searchParams;
  const [me, people, refs, settings] = await Promise.all([getCurrentPerson(), getPeople(), getRefs(), getSettings()]);
  const [editionChoices, suppliers] = await Promise.all([loadEditionChoices(me, settings), loadSuppliers()]);
  const [requests, validations, poles, editions] = await Promise.all([
    loadRequests(me),
    prisma.validationRequest.findMany({ include: { requester: true, decider: true, edition: { include: { project: { include: { secondaryPoles: true } } } } }, orderBy: [{ status: "desc" }, { createdAt: "asc" }] }).then((vs) => vs.filter((v) => canSeeValidation(me, v))),
    prisma.pole.findMany({ orderBy: { name: "asc" } }),
    loadEditionOpts(me, settings),
  ]);
  const peopleOpts = people.map((p) => ({ id: p.id, name: p.name }));
  const canTreat = (r: (typeof requests)[number]) => isForMe(me, r) || me.role === "director" || (Boolean(r.poleId) && me.role === "pole_lead" && me.poleId === r.poleId);

  const lines: Line[] = [
    ...requests.map((r): Line => ({
      id: r.id, family: "request", kind: kindLabel(r.kind), title: r.title, sub: [r.body, r.edition ? `${r.edition.project.name} · ${r.edition.year}` : null].filter(Boolean).join(" · "),
      who: r.requester.name, to: r.assignee?.name ?? (r.pole ? `pôle ${r.pole.name}` : "—"), due: r.dueDate, status: statusOf(r.status), age: ageDays(r.createdAt), href: "/demandes", open: r.status === "open" || r.status === "doing",
      actions: <RequestActions id={r.id} status={r.status} canTreat={canTreat(r)} canWithdraw={r.requesterId === me.id} people={peopleOpts} assigneeId={r.assigneeId} hasTask={r.tasks.some((t) => t.personId === me.id)} />,
    })),
    ...validations.map((v): Line => ({
      id: v.id, family: "validation", kind: refLabel(refs, "validation_kind", v.kind), title: `${v.label}${v.amount != null ? ` · ${fmtEuro(v.amount)}` : ""}`, sub: `${v.edition.project.name} · ${v.edition.year}`,
      who: v.requester.name, to: ["", "pilote", "responsable de pôle", "direction"][v.requiredLevel] ?? "—", due: dayjs(v.createdAt).add(v.targetDelayDays, "day").toDate(), status: { label: refLabel(refs, "validation_status", v.status), color: v.status === "pending" ? "warning" : v.status === "approved" ? "mint" : "muted" }, age: ageDays(v.createdAt), href: `/edition/${v.editionId}?onglet=apercu`, open: v.status === "pending",
      // Fusion demandes / validations (retour du 15/09) : on décide ici, en place ; la file par niveau reste dans /validations.
      actions: v.status === "pending" && canDecideValidation(me, v) ? <div className="mt-1.5" data-testid={`decide-${v.id}`}><DecideButtons id={v.id} /></div> : v.status === "approved" && (v.kind === "quote" || v.kind === "expense") ? <Link href={`/validations/${v.id}/bon-pour-accord`} className="mt-1 inline-block text-xs text-primary hover:underline">Bon pour accord →</Link> : undefined,
    })),
  ];
  const forMe = lines.filter((l) => l.open && (l.family === "request" ? canTreat(requests.find((r) => r.id === l.id)!) : canDecideValidation(me, validations.find((v) => v.id === l.id)!)));
  const mine = lines.filter((l) => (l.family === "request" ? requests.find((r) => r.id === l.id)!.requesterId === me.id : validations.find((v) => v.id === l.id)!.requesterId === me.id));
  const all = lines;
  const wide = wideViewLabel(me.role);
  const view = vue === "mes" ? "mes" : vue === "toutes" && wide ? "toutes" : "moi";
  const shown = view === "mes" ? mine : view === "toutes" ? all : forMe;
  const openShown = shown.filter((l) => l.open).sort((a, b) => (a.due?.getTime() ?? 9e15) - (b.due?.getTime() ?? 9e15));
  const closedShown = shown.filter((l) => !l.open).slice(0, 15);

  const Row = ({ l }: { l: Line }) => {
    const late = l.open && l.due && dayjs(l.due).isBefore(dayjs(), "day");
    return (
      <div className={cn("grid gap-2 border-b px-4 py-3 last:border-b-0 sm:grid-cols-[150px_1fr_150px_110px_100px]", late && "bg-[#fff8f0]")} data-testid={`${l.family}-line-${l.id}`}>
        <div className="min-w-0"><div className="text-[10px] font-semibold uppercase tracking-[.5px] text-muted-foreground">{l.family === "validation" ? "Validation" : "Demande"}</div><StatusBadge label={l.kind} color={l.family === "validation" ? "primary" : "info"} dot={false} className="max-w-full whitespace-normal" /></div>
        <div className="min-w-0">
          <div className="text-sm font-medium"><Link href={l.href} className="hover:underline">{l.title}</Link></div>
          {l.sub && <div className="truncate text-[11px] text-muted-foreground">{l.sub}</div>}
          <div className="text-[10px] text-muted-foreground">par {l.who} · il y a {l.age === 0 ? "moins d'un jour" : `${l.age} j`}</div>
          {l.actions}
        </div>
        <div className="text-xs text-muted-foreground">→ {l.to}</div>
        <div className={cn("text-xs", late ? "font-semibold text-danger" : "text-muted-foreground")}>{l.due ? `pour le ${fmtDate(l.due, "D MMM")}` : "—"}</div>
        <div><StatusBadge label={l.status.label} color={l.status.color} /></div>
      </div>
    );
  };

  return (
    <div className="p-4 md:p-6">
      <PageHeader title="Demandes et validations" subtitle={<>{forMe.length} à traiter par moi · {mine.filter((l) => l.open).length} de mes demandes en cours. Ce qu'on demande à quelqu'un — site, chiffres, logistique, travail à faire — et les validations, décidées ici.{isCodir(me.role) && <> <Link href="/validations" className="text-primary hover:underline">File complète des validations par niveau →</Link></>}</>} actions={<>
        <RequestValidationDialog editions={editionChoices} suppliers={suppliers} kinds={REF_DEFAULTS.validation_kind.map((k) => ({ value: k.code, label: refLabel(refs, "validation_kind", k.code) }))} afterHref="/demandes?vue=mes" triggerLabel="Nouvelle validation" />
        <NewRequestDialog people={peopleOpts.filter((p) => p.id !== me.id)} poles={poles.map((p) => ({ id: p.id, name: p.name }))} editions={editions} />
      </>} />
      <div className="mb-3 flex flex-wrap gap-1">
        {[["moi", `À traiter par moi (${forMe.length})`], ["mes", `Mes demandes (${mine.filter((l) => l.open).length})`], ...(wide ? [["toutes", `${wide} (${all.filter((l) => l.open).length})`]] : [])].map(([k, label]) => (
          <Link key={k} href={`/demandes?vue=${k}`} className={cn("rounded-full border px-3 py-1 text-sm", view === k ? "border-primary bg-primary text-white" : "bg-card hover:bg-muted")} data-testid={`requests-view-${k}`}>{label}</Link>
        ))}
      </div>
      <Section title={view === "moi" ? "À traiter par moi" : view === "mes" ? "Mes demandes" : `En cours · ${wide}`} description={view === "toutes" ? "Ce que vous pouvez suivre au-delà de vos propres demandes : vos projets, votre pôle, ou toute la CRESS selon votre rôle." : "Demandes internes et validations dans le même tableau, les plus urgentes en premier."} className="mb-4" testId="requests-open">
        {openShown.length === 0 ? <p className="px-1 text-sm text-muted-foreground">{view === "moi" ? "Rien à traiter. Les demandes qui vous sont adressées, ou adressées à votre pôle, arriveront ici." : "Rien en cours."}</p> : <div className="-mx-4 -mb-4 rounded-b-2xl">{openShown.map((l) => <Row key={l.id} l={l} />)}</div>}
      </Section>
      {closedShown.length > 0 && (
        <Section title="Terminées récemment" testId="requests-closed"><div className="-mx-4 -mb-4">{closedShown.map((l) => <Row key={l.id} l={l} />)}</div></Section>
      )}
    </div>
  );
}
