import Link from "next/link";
import { PageHeader } from "@/components/common/page-header";
import { Section } from "@/components/common/section";
import { StatusBadge } from "@/components/common/status-badge";
import { prisma } from "@/lib/db";
import { getCurrentPerson, getPeople, getRefs, getSettings } from "@/lib/session";
import { canDecideValidation } from "@/lib/rights";
import { refLabel } from "@/lib/refs";
import { ageDays, canSeeValidation, canTreatRequest, kindLabel, loadRequests, statusOf } from "@/lib/requests";
import { loadEditionOpts, loadEditionChoices, loadSuppliers } from "@/lib/tasks";
import { REF_DEFAULTS } from "@/lib/refs";
import { dayjs, fmtDate, fmtEuro } from "@/lib/format";
import { attachmentInclude } from "@/lib/attachments";
import { cn } from "@/lib/utils";
import { NewDemandPanel } from "./new-demand";
import { ReassignControl, RequestActions } from "./request-row";
import { ValidationCard } from "@/components/common/validation-card";
import { DecideButtons } from "@/components/common/decide-buttons";
import { V, cap, le, de, tout } from "@/lib/vocab";


// Demandes (retour du 14/09) : un seul tableau pour tout ce qu'on demande à quelqu'un — demandes internes et validations —
// côté « à traiter par moi » et côté « mes demandes ». Un achat / devis reste une validation ; il apparaît ici aussi.
type Line = { id: string; family: "request" | "validation"; kind: string; title: string; sub: string; who: string; to: string; due: Date | null; status: { label: string; color: string }; age: number; href: string; open: boolean; actions?: React.ReactNode };

export default async function DemandesPage({ searchParams }: { searchParams: Promise<{ vue?: string }> }) {
  const { vue } = await searchParams;
  const [me, people, refs, settings] = await Promise.all([getCurrentPerson(), getPeople(), getRefs(), getSettings()]);
  const [editionChoices, suppliers] = await Promise.all([loadEditionChoices(me, settings), loadSuppliers()]);
  const [requests, validations, poles, editions] = await Promise.all([
    loadRequests(me),
    prisma.validationRequest.findMany({ include: { requester: true, decider: true, action: true, attachments: { include: attachmentInclude, orderBy: { createdAt: "desc" } }, edition: { include: { project: { include: { pole: true, secondaryPoles: true } }, team: true } } }, orderBy: [{ status: "desc" }, { createdAt: "asc" }] }).then((vs) => vs.filter((v) => canSeeValidation(me, v))),
    prisma.pole.findMany({ orderBy: { name: "asc" } }),
    loadEditionOpts(me, settings),
  ]);
  const peopleOpts = people.map((p) => ({ id: p.id, name: p.name }));
  const canTreat = (r: (typeof requests)[number]) => canTreatRequest(me, r);

  const lines: Line[] = [
    ...requests.map((r): Line => ({
      id: r.id, family: "request", kind: kindLabel(r.kind), title: r.title, sub: [r.body, r.edition ? `${r.edition.project.name} · ${r.edition.year}` : null].filter(Boolean).join(" · "),
      who: r.requester.name, to: r.assignee?.name ?? (r.pole ? `${V.pole.one} ${r.pole.name}` : "—"), due: r.dueDate, status: statusOf(r.status), age: ageDays(r.createdAt), href: "/demandes", open: r.status === "open" || r.status === "doing",
      actions: <RequestActions id={r.id} status={r.status} canTreat={canTreat(r)} canWithdraw={r.requesterId === me.id} people={peopleOpts} assigneeId={r.assigneeId} hasTask={r.tasks.some((t) => t.personId === me.id)} />,
    })),
    ...validations.map((v): Line => ({
      id: v.id, family: "validation", kind: refLabel(refs, "validation_kind", v.kind), title: `${v.label}${v.amount != null ? ` · ${fmtEuro(v.amount)}` : ""}`, sub: `${v.edition.project.name} · ${v.edition.year}`,
      who: v.requester.name, to: ["", "pilote", `responsable ${de(V.pole)}`, "direction"][v.requiredLevel] ?? "—", due: dayjs(v.createdAt).add(v.targetDelayDays, "day").toDate(), status: { label: refLabel(refs, "validation_status", v.status), color: v.status === "pending" ? "warning" : v.status === "approved" ? "mint" : "muted" }, age: ageDays(v.createdAt), href: `/edition/${v.editionId}?onglet=apercu`, open: v.status === "pending",
      // Fusion demandes / validations (retour du 15/09) : on décide ici, en place ; la file par niveau reste dans /validations.
      actions: v.status === "pending" && canDecideValidation(me, v) ? <div className="mt-1.5" data-testid={`decide-${v.id}`}><DecideButtons id={v.id} /></div> : v.status === "approved" && (v.kind === "quote" || v.kind === "expense") ? <Link href={`/validations/${v.id}/bon-pour-accord`} className="mt-1 inline-block text-xs text-primary hover:underline">Bon pour accord →</Link> : undefined,
    })),
  ];
  // « Qu'on me fait » = à traiter par moi (demandes adressées à moi ou à mon pôle, validations de mon niveau) ; « Que j'ai
  // faites » = mes demandes ; « Toute la CRESS » : la direction seulement, pour réaiguiller (retour de Gaël, 18/09).
  const forMe = lines.filter((l) => l.open && (l.family === "request" ? canTreat(requests.find((r) => r.id === l.id)!) : canDecideValidation(me, validations.find((v) => v.id === l.id)!)));
  const doneForMe = lines.filter((l) => !l.open && (l.family === "request" ? canTreat(requests.find((r) => r.id === l.id)!) : validations.find((v) => v.id === l.id)!.deciderId === me.id));
  const mine = lines.filter((l) => (l.family === "request" ? requests.find((r) => r.id === l.id)!.requesterId === me.id : validations.find((v) => v.id === l.id)!.requesterId === me.id));
  const all = lines;
  const wide = me.role === "director" ? `${cap(tout(V.org))}` : null;
  const view = vue === "mes" ? "mes" : vue === "toutes" && wide ? "toutes" : "moi";
  const shown = view === "mes" ? mine : view === "toutes" ? all : [...forMe, ...doneForMe];
  const openShown = shown.filter((l) => l.open).sort((a, b) => (a.due?.getTime() ?? 9e15) - (b.due?.getTime() ?? 9e15));
  const closedShown = shown.filter((l) => !l.open).slice(0, 15);
  const validationById = new Map(validations.map((v) => [v.id, v]));

  const Row = ({ l }: { l: Line }) => {
    if (l.family === "validation" && view !== "toutes") {
      const v = validationById.get(l.id)!;
      return <div className="border-b px-4 py-3 last:border-b-0"><ValidationCard v={v} refs={refs} canDecide={l.open && canDecideValidation(me, v)} showEdition index={l.open ? forMe.filter((x) => x.family === "validation").findIndex((x) => x.id === l.id) : undefined} attachments={v.attachments} /></div>;
    }
    const late = l.open && l.due && dayjs(l.due).isBefore(dayjs(), "day");
    return (
      <div className={cn("grid gap-2 border-b px-4 py-3 last:border-b-0 sm:grid-cols-[150px_1fr_150px_110px_100px]", late && "bg-[#fff8f0]")} data-testid={`${l.family}-line-${l.id}`}>
        <div className="min-w-0"><div className="text-[10px] font-semibold uppercase tracking-[.5px] text-muted-foreground">{l.family === "validation" ? "Validation" : "Demande"}</div><StatusBadge label={l.kind} color={l.family === "validation" ? "primary" : "info"} dot={false} className="max-w-full whitespace-normal" /></div>
        <div className="min-w-0">
          <div className="text-sm font-medium"><Link href={l.href} className="hover:underline">{l.title}</Link></div>
          {l.sub && <div className="truncate text-[11px] text-muted-foreground">{l.sub}</div>}
          <div className="text-[10px] text-muted-foreground">par {l.who} · il y a {l.age === 0 ? "moins d'un jour" : `${l.age} j`}</div>
        </div>
        <div className="text-xs text-muted-foreground">→ {l.to}</div>
        <div className={cn("text-xs", late ? "font-semibold text-danger" : "text-muted-foreground")}>{l.due ? `pour le ${fmtDate(l.due, "D MMM")}` : "—"}</div>
        <div><StatusBadge label={l.status.label} color={l.status.color} /></div>
        {/* Les actions prennent toute la largeur sous le titre : dans la colonne du titre, elles s'empilaient à 1024 px. */}
        {view === "toutes"
          ? (l.family === "request" && l.open && <div className="min-w-0 sm:col-span-4 sm:col-start-2"><ReassignControl id={l.id} assigneeId={requests.find((r) => r.id === l.id)!.assigneeId} people={peopleOpts} /></div>)
          : l.actions && <div className="min-w-0 sm:col-span-4 sm:col-start-2">{l.actions}</div>}
      </div>
    );
  };

  return (
    <div className="p-4 md:p-6">
      <PageHeader title="Mes demandes" subtitle={<>{forMe.length} qu&apos;on me fait, à traiter · {mine.filter((l) => l.open).length} que j&apos;ai faites, en cours · demandes internes et validations au même endroit.</>} actions={
        <NewDemandPanel people={peopleOpts.filter((p) => p.id !== me.id)} poles={poles.map((p) => ({ id: p.id, name: p.name }))} editions={editions} validation={{ editions: editionChoices, suppliers, kinds: REF_DEFAULTS.validation_kind.map((k) => ({ value: k.code, label: refLabel(refs, "validation_kind", k.code) })), afterHref: "/demandes?vue=mes" }} />
      } />
      <div className="subnav mb-3 flex flex-wrap gap-1">
        {[["moi", `Qu'on me fait (${forMe.length})`], ["mes", `Que j'ai faites (${mine.filter((l) => l.open).length})`], ...(wide ? [["toutes", `${wide} (${all.filter((l) => l.open).length})`]] : [])].map(([k, label]) => (
          <Link key={k} href={`/demandes?vue=${k}`} className={cn("inline-flex items-center gap-1 rounded-full border px-3 py-1 text-sm", view === k ? "border-primary bg-primary text-white" : "bg-card hover:bg-muted")} data-testid={`requests-view-${k}`}>{label}</Link>
        ))}
      </div>
      <Section title={view === "moi" ? "Qu'on me fait · en cours" : view === "mes" ? "Que j'ai faites · en cours" : `${cap(tout(V.org))} · en cours`} description={view === "toutes" ? `Pour ${le(V.direction)} : toutes les demandes en cours. Une seule action ici — réaiguiller (changer à qui on demande) ; la personne à l'origine est prévenue.` : view === "moi" ? `Les demandes qui vous sont adressées (ou à votre ${V.pole.one}), et les validations de votre niveau. Prendre, faire, décliner, confier ; approuver ou refuser.` : "Ce que vous avez demandé, validations comprises ; retirez une demande si elle n'a plus lieu d'être."} testId="for-me">
        {openShown.length === 0 ? <p className="px-1 text-sm text-muted-foreground" data-testid="requests-open">{view === "moi" ? `Rien à traiter — rien à valider pour vous. Les demandes qui vous sont adressées, ou adressées à votre ${V.pole.one}, arriveront ici.` : "Rien en cours."}</p> : <div className="-mx-4 -mb-4 rounded-b-2xl" data-testid="requests-open">{openShown.map((l) => <Row key={l.id} l={l} />)}</div>}
      </Section>
      {closedShown.length > 0 && (
        <Section title="Terminées récemment" testId="requests-closed"><div className="-mx-4 -mb-4">{closedShown.map((l) => <Row key={l.id} l={l} />)}</div></Section>
      )}
    </div>
  );
}
