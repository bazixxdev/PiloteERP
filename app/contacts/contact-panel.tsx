import { Fragment } from "react";
import Link from "next/link";
import { AutoField } from "@/components/inline/auto-field";
import { fmtDate } from "@/lib/format";
import { baseListFor, BREVO_STATUS, brevoAttributesOf, tagsOf } from "@/lib/contacts";
import { kindsOf } from "@/lib/organisations";
import { ContactOrganisationPicker, DeleteContactButton } from "./panel-controls";
import { MembershipList, type MembershipView } from "@/components/members/membership-list";

type C = {
  id: string; firstName: string | null; lastName: string; role: string | null; email: string | null; phone: string | null; address: string | null; postcode: string | null; city: string | null; tags: string; notes: string | null; leftAt: Date | null; organisationName: string | null; createdById: string | null; createdAt: Date; brevoContactId: string | null; brevoStatus: string | null; brevoAttributes: string; brevoSyncedAt: Date | null;
  organisation: { id: string; name: string; kinds: string } | null;
  listItems: { role: string | null; list: { id: string; name: string } }[];
  lines: { id: string; edition: { id: string; year: number; project: { name: string } } }[];
  conventions: { id: string; reference: string }[];
  memberships: MembershipView[];
};

// Fiche d'un contact, en panneau sur l'annuaire (?contact=) : identité, structure, coordonnées, mots-clés, et où il apparaît.
export function ContactPanelBody({ contact: c, organisations, meId, members }: { contact: C; organisations: { id: string; name: string }[]; meId: string; members?: { on: boolean; rw: boolean } }) {
  const F = ({ field, label, type = "text", value, placeholder }: { field: string; label: string; type?: "text" | "textarea"; value: string | null; placeholder?: string }) => (
    <label className="grid gap-0.5"><span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</span><AutoField model="contact" id={c.id} field={field} type={type} value={value} label={label} placeholder={placeholder} testId={`contact-${field}`} /></label>
  );
  return (
    <div className="grid gap-5" data-testid="contact-panel-body">
      <section className="grid gap-2">
        <h3 className="text-xs font-semibold">Identité</h3>
        <div className="grid grid-cols-2 gap-2"><F field="firstName" label="Prénom" value={c.firstName} /><F field="lastName" label="Nom" value={c.lastName} /></div>
        <F field="role" label="Fonction" value={c.role} />
        <div className="grid gap-0.5"><span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Structure</span><ContactOrganisationPicker contactId={c.id} organisationId={c.organisation?.id ?? null} organisations={organisations} /></div>
        {!c.organisation && <F field="organisationName" label="Structure (en texte)" value={c.organisationName} placeholder="si elle n'est pas dans l'annuaire" />}
      </section>
      <section className="grid gap-2">
        <h3 className="text-xs font-semibold">Coordonnées</h3>
        <div className="grid grid-cols-2 gap-2"><F field="email" label="E-mail" value={c.email} /><F field="phone" label="Téléphone" value={c.phone} /></div>
        <F field="address" label="Adresse" value={c.address} />
        <div className="grid grid-cols-[1fr_2fr] gap-2"><F field="postcode" label="Code postal" value={c.postcode} /><F field="city" label="Ville" value={c.city} /></div>
      </section>
      <section className="grid gap-2">
        <h3 className="text-xs font-semibold">Mots-clés et notes</h3>
        <F field="tags" label="Mots-clés (séparés par des virgules)" value={c.tags} placeholder="réseau, élu, alimentation…" />
        {tagsOf(c).length > 0 && <div className="flex flex-wrap gap-1">{tagsOf(c).map((t) => <Link key={t} href={`/contacts?tag=${encodeURIComponent(t)}`} className="rounded-sm bg-muted px-1.5 text-[10px] text-muted-foreground hover:bg-info-soft hover:text-primary">{t}</Link>)}</div>}
        <F field="notes" label="Notes" type="textarea" value={c.notes} />
      </section>
      <section className="grid gap-1 text-xs" data-testid="contact-where">
        <h3 className="text-xs font-semibold">Où il ou elle apparaît</h3>
        {c.organisation && !c.leftAt && kindsOf(c.organisation).length > 0 && <div>Listes de base : {kindsOf(c.organisation).map((k) => baseListFor(k)).filter(Boolean).map((b) => <span key={b!.id}> · <Link href={`/contacts?liste=${b!.id}`} className="text-primary hover:underline">{b!.name}</Link></span>)}</div>}
        <div>Listes : {c.listItems.length === 0 ? <span className="text-muted-foreground">aucune</span> : c.listItems.map((i) => <span key={i.list.id}> · <Link href={`/contacts?liste=${i.list.id}`} className="text-primary hover:underline">{i.list.name}</Link>{i.role ? ` (${i.role})` : ""}</span>)}</div>
        {c.lines.length > 0 && <div>Contact du dossier : {c.lines.map((l) => <span key={l.id}> · <Link href={`/edition/${l.edition.id}?onglet=financements`} className="text-primary hover:underline">{l.edition.project.name} {l.edition.year}</Link></span>)}</div>}
        {c.conventions.length > 0 && <div>Conventions : {c.conventions.map((v) => <span key={v.id}> · <Link href={`/conventions/${v.id}`} className="text-primary hover:underline">{v.reference}</Link></span>)}</div>}
        <div className="text-muted-foreground">Créé le {fmtDate(c.createdAt)}{c.leftAt ? ` · parti·e le ${fmtDate(c.leftAt)}` : ""}</div>
      </section>
      {members?.on && (c.memberships.length > 0 || (members.rw && !c.organisation)) && (
        <section className="grid gap-1 text-xs" data-testid="contact-memberships">
          <h3 className="text-xs font-semibold">Adhésions <span className="text-[10px] font-normal text-muted-foreground">· à titre personnel</span></h3>
          <MembershipList memberships={c.memberships} rw={members.rw} contactId={c.id} />
        </section>
      )}
      {c.brevoContactId && (
        <section className="grid gap-1 text-xs" data-testid="contact-brevo">
          <h3 className="text-xs font-semibold">Brevo</h3>
          <div><span className={c.brevoStatus === "active" ? "text-mint" : "rounded-sm bg-warning-soft px-1 text-warning"} title={BREVO_STATUS[c.brevoStatus ?? "active"]?.hint} data-testid="contact-brevo-status" data-value={c.brevoStatus}>{BREVO_STATUS[c.brevoStatus ?? "active"]?.label}</span> <span className="text-muted-foreground">· contact #{c.brevoContactId}{c.brevoSyncedAt ? ` · vu le ${fmtDate(c.brevoSyncedAt)}` : ""}</span></div>
          {Object.keys(brevoAttributesOf(c)).length > 0 && <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-[11px]" data-testid="contact-brevo-attributes">{Object.entries(brevoAttributesOf(c)).map(([k, v]) => <Fragment key={k}><dt className="font-mono text-muted-foreground">{k}</dt><dd>{v}</dd></Fragment>)}</dl>}
          {c.brevoStatus === "unsubscribed" && <p className="text-muted-foreground">{BREVO_STATUS.unsubscribed.hint}</p>}
        </section>
      )}
      <DeleteContactButton id={c.id} own={c.createdById === meId} cited={c.lines.length + c.conventions.length > 0} brevo={c.brevoStatus === "active"} />
    </div>
  );
}
