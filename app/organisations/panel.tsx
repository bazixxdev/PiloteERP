import Link from "next/link";
import { AutoField } from "@/components/inline/auto-field";
import { FunderContacts } from "@/components/funders/contacts";
import { prisma } from "@/lib/db";
import { fmtDate, fmtEuro } from "@/lib/format";
import { kindsOf } from "@/lib/organisations";
import { KindToggles } from "./controls";
import { LeftContacts } from "./left-contacts";
import { MembershipList } from "@/components/members/membership-list";
import { getCurrentPerson, getSettings } from "@/lib/session";
import { instanceHas } from "@/lib/modules";
import { canManageMembers } from "@/lib/rights";

// Fiche d'une organisation (lot E2), en panneau sur l'annuaire : identité, genres, contacts, et tout ce qui la cite dans l'outil.
export async function OrganisationPanelBody({ id, rw }: { id: string; rw: boolean }) {
  const o = await prisma.organisation.findUnique({
    where: { id },
    include: {
      contacts: { orderBy: [{ leftAt: "asc" }, { createdAt: "asc" }] },
      conventions: { select: { id: true, reference: true, label: true, startYear: true, endYear: true, amountNotified: true }, orderBy: [{ endYear: "desc" }] },
      lines: { where: { edition: { status: { not: "closed" } } }, select: { id: true, amountGranted: true, amountRequested: true, edition: { select: { id: true, year: true, project: { select: { name: true } } } } }, orderBy: [{ edition: { year: "desc" } }] },
      validations: { select: { id: true, label: true, amount: true, status: true, createdAt: true, edition: { select: { id: true, project: { select: { name: true } } } } }, orderBy: { createdAt: "desc" }, take: 8 },
      editions: { include: { edition: { select: { id: true, year: true, project: { select: { name: true } } } } }, orderBy: { createdAt: "desc" } },
      calls: { where: { active: true }, select: { id: true, label: true, teamStatus: true } },
      memberships: { orderBy: { year: "desc" } },
    },
  });
  const [me, settings] = await Promise.all([getCurrentPerson(), getSettings()]);
  const membersOn = instanceHas(settings, "adherents");
  if (!o) return <p className="text-sm text-muted-foreground">Organisation introuvable.</p>;
  const kinds = kindsOf(o);
  const F = ({ field, label, type = "text", value }: { field: string; label: string; type?: "text" | "textarea"; value: unknown }) => (
    <label className="grid gap-0.5">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
      <AutoField model="organisation" id={o.id} field={field} type={type} value={value as string | null} readOnly={!rw} label={label} testId={`org-${field}`} />
    </label>
  );
  const live = o.contacts.filter((c) => !c.leftAt);
  const left = o.contacts.filter((c) => c.leftAt);
  return (
    <div className="grid gap-5" data-testid="organisation-panel-body">
      <section className="grid gap-2">
        <h3 className="text-xs font-semibold">Identité</h3>
        <F field="name" label="Nom" value={o.name} />
        <div className="grid grid-cols-2 gap-2"><F field="siret" label="SIRET" value={o.siret} /><F field="website" label="Site web" value={o.website} /></div>
        <F field="address" label="Adresse" value={o.address} />
        <div className="grid grid-cols-2 gap-2"><F field="email" label="E-mail générique" value={o.email} /><F field="phone" label="Téléphone" value={o.phone} /></div>
        <F field="notes" label="Notes" type="textarea" value={o.notes} />
        <label className="flex items-center gap-2 text-xs text-muted-foreground"><AutoField model="organisation" id={o.id} field="active" type="bool" value={o.active} readOnly={!rw} label="Active" testId="org-active" /> Active (une organisation inactive ne se propose plus, ses dossiers restent)</label>
      </section>
      <section className="grid gap-2">
        <h3 className="text-xs font-semibold">Genres</h3>
        <KindToggles id={o.id} kinds={kinds} readOnly={!rw} />
      </section>
      <section className="grid gap-2">
        <h3 className="text-xs font-semibold">Contacts <span className="text-[10px] font-normal text-muted-foreground">· le minimum utile, tenu par la RAF ; un contact parti se détache, il ne s&apos;efface pas</span></h3>
        <FunderContacts funderId={o.id} contacts={live} readOnly={!rw} />
        <LeftContacts contacts={[...live.map((c) => ({ id: c.id, name: [c.firstName, c.lastName].filter(Boolean).join(" "), leftAt: null })), ...left.map((c) => ({ id: c.id, name: [c.firstName, c.lastName].filter(Boolean).join(" "), leftAt: fmtDate(c.leftAt!) }))]} readOnly={!rw} />
      </section>
      {membersOn && (kinds.includes("member") || canManageMembers(me)) && (
        <section className="grid gap-2" data-testid="organisation-memberships">
          <h3 className="text-xs font-semibold">Adhésions <span className="text-[10px] font-normal text-muted-foreground">· une ligne par année ; le détail sur la page Adhérents</span></h3>
          <MembershipList memberships={o.memberships} rw={canManageMembers(me)} organisationId={o.id} />
        </section>
      )}
      <section className="grid gap-2" data-testid="organisation-dossiers">
        <h3 className="text-xs font-semibold">Dans l&apos;outil</h3>
        <ul className="grid gap-1 text-xs">
          {kinds.includes("funder") && <li>Financeur : <b className="font-medium">{o.conventions.length}</b> convention{o.conventions.length > 1 ? "s" : ""}, <b className="font-medium">{o.lines.length}</b> ligne{o.lines.length > 1 ? "s" : ""} de financement en cours{o.calls.length > 0 && <>, {o.calls.length} appel{o.calls.length > 1 ? "s" : ""} à projets</>} — <Link href={`/financeurs/${o.id}`} className="text-primary underline-offset-2 hover:underline">fiche financeur</Link></li>}
          {o.lines.slice(0, 6).map((l) => <li key={l.id} className="text-muted-foreground">· <Link href={`/edition/${l.edition.id}?onglet=financements`} className="hover:underline">{l.edition.project.name} · {l.edition.year}</Link> — {l.amountGranted != null ? fmtEuro(l.amountGranted) : l.amountRequested != null ? `${fmtEuro(l.amountRequested)} demandés` : "à déposer"}</li>)}
          {kinds.includes("supplier") && <li>Fournisseur : <b className="font-medium">{o.validations.length}</b> devis / facture{o.validations.length > 1 ? "s" : ""}{o.validations.slice(0, 4).map((v) => <span key={v.id} className="text-muted-foreground"> · <Link href={`/edition/${v.edition.id}?onglet=budget`} className="hover:underline">{v.label}</Link>{v.amount ? ` (${fmtEuro(v.amount)})` : ""}</span>)}</li>}
          <li>Partenaire de <b className="font-medium">{o.editions.length}</b> édition{o.editions.length > 1 ? "s" : ""}{o.editions.map((p) => <span key={p.editionId} className="text-muted-foreground"> · <Link href={`/edition/${p.editionId}?onglet=fiche`} className="hover:underline">{p.edition.project.name} {p.edition.year}</Link>{p.role ? ` (${p.role})` : ""}</span>)}</li>
        </ul>
      </section>
    </div>
  );
}
