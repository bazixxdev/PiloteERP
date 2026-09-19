import Link from "next/link";
import { BookUser, Building2, Send, Ticket } from "lucide-react";
import { DossiersHeader } from "@/components/common/dossiers-nav";
import { UrlPanel } from "@/components/common/url-panel";
import { visibilityIcon } from "@/components/common/visibility-icon";
import { prisma } from "@/lib/db";
import { getCurrentPerson, getSettings } from "@/lib/session";
import { VISIBILITIES } from "@/lib/modules";
import { noteColor } from "@/lib/notes";
import { loadEditionOpts } from "@/lib/tasks";
import { canReadList, contactName, loadContactList, loadContactLists, loadContacts, tagsOf } from "@/lib/contacts";
import { cn } from "@/lib/utils";
import { brevoConfig } from "@/lib/brevo";
import { canAdmin, canManageMembers } from "@/lib/rights";
import { instanceHas } from "@/lib/modules";
import { NewContactListDialog, NewContactDialog } from "./controls";
import { DirectoryTable } from "./directory-table";
import { ContactPanelBody } from "./contact-panel";
import { ContactListView } from "./list-view";

// Contacts et listes (18/09) : à gauche l'annuaire et les listes (miennes, partagées avec moi) ; à droite l'annuaire — ou une
// liste, avec ses colonnes propres, son import et son export. Chaque pilote tenait son Excel de contacts : le voilà ici.
export default async function ContactsPage({ searchParams }: { searchParams: Promise<{ liste?: string; contact?: string; q?: string; tag?: string }> }) {
  const sp = await searchParams;
  const [me, settings] = await Promise.all([getCurrentPerson(), getSettings()]);
  const [{ mine, shared, brevo, helloasso, base }, editions, organisations] = await Promise.all([loadContactLists(me), loadEditionOpts(me, settings), prisma.organisation.findMany({ where: { active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } })]);
  const list = sp.liste ? await loadContactList(sp.liste) : null;
  if (sp.liste && (!list || !canReadList(me, list))) return <div className="p-6 text-sm text-muted-foreground">Liste introuvable, ou non partagée avec vous.</div>;
  const contacts = list ? [] : await loadContacts();
  const openContact = sp.contact ? await prisma.contact.findUnique({ where: { id: sp.contact }, include: { organisation: { select: { id: true, name: true, kinds: true } }, memberships: { where: { organisationId: null }, orderBy: { year: "desc" } }, listItems: { include: { list: { select: { id: true, name: true, ownerId: true, visibility: true, owner: { select: { id: true, poleId: true } } } } } }, lines: { select: { id: true, edition: { select: { id: true, year: true, project: { select: { name: true } } } } } }, conventions: { select: { id: true, reference: true } } } }) : null;
  const navClass = (active: boolean) => cn("flex items-center gap-2 rounded-md px-3 py-1.5 text-xs hover:bg-muted", active && "bg-info-soft font-semibold text-primary");
  const Count = ({ n }: { n: number }) => n > 0 ? <span className="ml-auto rounded-sm bg-muted px-1.5 text-[10px] text-muted-foreground">{n}</span> : null;
  const listLink = (l: (typeof mine)[number], owner?: string) => {
    const c = noteColor(l.color);
    const Icon = visibilityIcon(l.visibility);
    return (
      <Link key={l.id} href={`/contacts?liste=${l.id}`} className={navClass(list?.id === l.id)} aria-current={list?.id === l.id ? "page" : undefined} data-testid={`contact-list-${l.id}`} data-name={l.name}>
        <span className="size-2.5 shrink-0 rounded-full" style={{ background: c?.hex ?? "var(--border)" }} aria-hidden />
        <span className="min-w-0 flex-1"><span className="block truncate">{l.name}</span>{owner ? <span className="block truncate text-[10px] font-normal text-muted-foreground">{owner}</span> : l.visibility !== "private" && <span className="inline-flex items-center gap-1 text-[10px] font-normal text-muted-foreground"><Icon className="size-2.5" aria-hidden />{VISIBILITIES.find((v) => v.value === l.visibility)?.label}</span>}</span>
        <Count n={l._count.items} />
      </Link>
    );
  };
  const closeHref = list ? `/contacts?liste=${list.id}` : `/contacts${sp.q || sp.tag ? `?${new URLSearchParams({ ...(sp.q ? { q: sp.q } : {}), ...(sp.tag ? { tag: sp.tag } : {}) }).toString()}` : ""}`;
  return (
    <div className="p-4 md:p-6">
      <DossiersHeader current="contacts" summary={list ? `${list.items.length} contact${list.items.length > 1 ? "s" : ""} dans « ${list.name} »` : `${contacts.length} contact${contacts.length > 1 ? "s" : ""} · ${mine.length} liste${mine.length > 1 ? "s" : ""} à vous`} actions={<><NewContactDialog organisations={organisations} /><NewContactListDialog editions={editions} /></>} />
      <div className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
        <div className="grid min-w-0 content-start gap-3 lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto">
          <nav className="rounded-md border bg-card p-1.5" aria-label="Vues" data-testid="contacts-views">
            <Link href="/contacts" className={navClass(!list)} aria-current={!list ? "page" : undefined} data-testid="contacts-view-all"><BookUser className="size-3.5 text-muted-foreground" />Tous les contacts</Link>
          </nav>
          <nav className="rounded-md border bg-card p-1.5" aria-label="Listes de base" data-testid="base-contact-lists">
            <div className="flex items-center gap-1 px-3 py-1.5 text-[10px] font-semibold text-muted-foreground"><Building2 className="size-3" aria-hidden />Listes de base</div>
            {base.map((b) => (
              <Link key={b.id} href={`/contacts?liste=${b.id}`} className={navClass(list?.id === b.id)} aria-current={list?.id === b.id ? "page" : undefined} data-testid={`contact-list-${b.id.slice(5)}`} data-name={b.name}>
                <span className="min-w-0 flex-1 truncate">{b.name}</span><Count n={b.count} />
              </Link>
            ))}
          </nav>
          <nav className="rounded-md border bg-card p-1.5" aria-label="Mes listes" data-testid="contact-lists">
            <div className="px-3 py-1.5 text-[10px] font-semibold text-muted-foreground">Mes listes · {mine.length}</div>
            {mine.map((l) => listLink(l))}
            {mine.length === 0 && <p className="px-3 pb-1 text-[11px] text-muted-foreground">Aucune liste encore : invités d&apos;un événement, membres d&apos;un réseau…</p>}
            <NewContactListDialog editions={editions} compact />
          </nav>
          {shared.length > 0 && (
            <nav className="rounded-md border bg-card p-1.5" aria-label="Partagées avec moi" data-testid="shared-contact-lists">
              <div className="px-3 py-1.5 text-[10px] font-semibold text-muted-foreground">Partagées avec moi · {shared.length}</div>
              {shared.map((l) => listLink(l, l.owner.name))}
            </nav>
          )}
          {helloasso.length > 0 && (
            <nav className="rounded-md border bg-card p-1.5" aria-label="Listes HelloAsso" data-testid="helloasso-contact-lists">
              <div className="flex items-center gap-1 px-3 py-1.5 text-[10px] font-semibold text-muted-foreground"><Ticket className="size-3" aria-hidden />Depuis HelloAsso · {helloasso.length}</div>
              {helloasso.map((l) => listLink(l, l.description ?? undefined))}
            </nav>
          )}
          {brevo.length > 0 && (
            <nav className="rounded-md border bg-card p-1.5" aria-label="Listes Brevo" data-testid="brevo-contact-lists">
              <div className="flex items-center gap-1 px-3 py-1.5 text-[10px] font-semibold text-muted-foreground"><Send className="size-3" aria-hidden />Depuis Brevo · {brevo.length}</div>
              {brevo.map((l) => listLink(l, l.description ?? undefined))}
            </nav>
          )}
        </div>

        <div className="min-w-0" data-testid="contacts-main" data-view={list ? "liste" : "annuaire"} data-name={list?.name}>
          {list ? (
            <ContactListView key={list.id} list={list} meId={me.id} canEdit={list.source !== "base" && (list.ownerId === me.id || ((list.source === "brevo" || list.source === "helloasso") && canAdmin(me)))} isAdmin={canAdmin(me)} brevoConfigured={Boolean(brevoConfig())} editions={editions} organisations={organisations} myLists={mine.map((l) => ({ id: l.id, name: l.name }))} />
          ) : (
            <DirectoryTable
              rows={contacts.map((c) => ({ id: c.id, name: contactName(c), firstName: c.firstName, lastName: c.lastName, email: c.email, phone: c.phone, role: c.role, organisationId: c.organisation?.id ?? null, organisation: c.organisation?.name ?? c.organisationName ?? null, city: c.city, postcode: c.postcode, tags: tagsOf(c), brevoStatus: c.brevoStatus, leftAt: Boolean(c.leftAt), lists: c._count.listItems }))}
              myLists={mine.map((l) => ({ id: l.id, name: l.name }))} organisations={organisations} isAdmin={canAdmin(me)} brevoConfigured={Boolean(brevoConfig())}
              initialQ={sp.q} initialTag={sp.tag}
            />
          )}
        </div>
      </div>
      {openContact && (
        <UrlPanel title={contactName(openContact)} description={[openContact.role, openContact.organisation?.name ?? openContact.organisationName].filter(Boolean).join(" · ") || "Contact"} closeHref={closeHref} testId="contact-panel">
          <ContactPanelBody contact={{ ...openContact, listItems: openContact.listItems.filter((i) => canReadList(me, i.list)) }} organisations={organisations} meId={me.id} members={{ on: instanceHas(settings, "adherents"), rw: canManageMembers(me) }} />
        </UrlPanel>
      )}
    </div>
  );
}
