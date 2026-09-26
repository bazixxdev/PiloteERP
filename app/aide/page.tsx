import Link from "next/link";
import { PageHeader } from "@/components/common/page-header";
import { getCurrentPerson, getSettings } from "@/lib/session";
import { instanceHas } from "@/lib/modules";
import { lexique } from "@/lib/lexique";
import { V, cap, le, pl } from "@/lib/vocab";

// Guide de l'outil (26/09, demande de Gaël : « une notice vraiment claire », dans l'aide) : le schéma de ce qui s'emboîte,
// puis chaque mot par chapitre, avec l'endroit où on le trouve. Les termes d'un module éteint sur l'instance sont masqués.
export default async function AidePage() {
  const [, settings] = await Promise.all([getCurrentPerson(), getSettings()]);
  const chapters = lexique()
    .map((c) => ({ ...c, entries: c.entries.filter((x) => !x.module || instanceHas(settings, x.module)) }))
    .filter((c) => c.entries.length > 0);

  return (
    <div className="p-4 md:p-6" data-testid="lexique">
      <PageHeader title="Guide de l'outil" subtitle={`Comment les choses s'emboîtent, et ce que chaque mot veut dire chez ${le(V.org)}.`} />

      <div className="grid gap-5 lg:grid-cols-[1fr_220px]">
        <div className="grid min-w-0 content-start gap-5">
          <section className="rounded-2xl border bg-card p-5" aria-labelledby="aide-schema">
            <h2 id="aide-schema" className="text-[15px] font-bold">{`L'essentiel : ${V.projet.one}, ${V.edition.one}, ${V.action.one}`}</h2>
            <p className="mt-1 max-w-[70ch] text-sm text-muted-foreground">{`Un ${V.projet.one} dure plusieurs années et a une page par an, ${le(V.edition)} : c'est là qu'on travaille. On y découpe l'année en ${pl(V.action)}, et ${pl(V.action)} en tâches.`}</p>

            <div className="mt-4 grid gap-3 rounded-xl border-2 border-primary/60 p-3" data-testid="aide-schema">
              <div className="flex flex-wrap items-baseline gap-2"><b className="text-xs font-bold uppercase tracking-wide text-primary">{V.projet.one}</b><span className="text-xs text-muted-foreground">ce qui dure · nom, code analytique, {V.pole.one}, {V.pilote.one}, garant, raison d&apos;être</span></div>
              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,2.2fr)]">
                <div className="grid content-start gap-1 rounded-lg border border-dashed bg-muted/40 p-3 opacity-80">
                  <b className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{`${V.edition.one} 2025`}</b>
                  <span className="text-xs text-muted-foreground">bilan fait, lisible</span>
                </div>
                <div className="grid gap-2 rounded-lg border bg-background p-3">
                  <div className="flex flex-wrap items-baseline gap-2"><b className="text-xs font-bold uppercase tracking-wide text-primary">{`${V.edition.one} 2026`}</b><span className="text-xs text-muted-foreground">en cours · on ouvre en cliquant sur l&apos;année</span></div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Box title="Fiche" text="objectifs, public, calendrier, bilan" />
                    <Box title={cap(pl(V.action))} text={`datées, un responsable chacune → tâches`} />
                    <Box title="Budget" text="enveloppe, devis, factures, reste" money />
                    <Box title="Financements" text="lignes : qui paie, combien, versements, livrables" money />
                    <Box title="Équipe et temps" text="jours prévus, heures saisies" />
                    <Box title="Documents" text="fichiers, liens NAS, Teams" />
                  </div>
                </div>
              </div>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              <Aside title="Organisations" text="financeurs, partenaires, fournisseurs, adhérents : un seul annuaire" />
              <Aside title="Dossiers de financement" text={`une demande à un financeur, parfois sur plusieurs années ou plusieurs ${pl(V.projet)} : se répartit en lignes de financement`} />
              <Aside title="Contacts" text="les personnes extérieures, avec ou sans organisation" />
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">{`Encadré vert : ce qui appartient au ${V.projet.one}. En dessous : ce qui vit à part et s'y relie.`}</p>
          </section>

          {chapters.map((c) => (
            <section key={c.id} id={c.id} className="scroll-mt-20 rounded-2xl border bg-card p-5" data-testid={`aide-${c.id}`}>
              <h2 className="text-[15px] font-bold">{c.title}</h2>
              <p className="mt-0.5 max-w-[70ch] text-xs text-muted-foreground">{c.intro}</p>
              <dl className="mt-3 grid text-sm">
                {c.entries.map((x) => (
                  <div key={x.term} className="grid gap-x-4 gap-y-0.5 border-t py-2.5 first:border-t-0 sm:grid-cols-[180px_1fr]">
                    <dt className="font-semibold text-foreground">{x.term}</dt>
                    <dd className="grid max-w-[75ch] gap-1">
                      <span>{x.def}</span>
                      {x.where && <span className="text-xs text-muted-foreground"><span className="font-semibold">Où :</span> {x.where}</span>}
                      {x.example && <span className="text-xs text-muted-foreground"><span className="font-semibold">Ex. :</span> {x.example}</span>}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>

        <nav aria-label="Sommaire du guide" className="hidden lg:block">
          <div className="sticky top-4 grid gap-1 text-[13px]">
            <span className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Sommaire</span>
            {chapters.map((c) => <Link key={c.id} href={`#${c.id}`} className="rounded-md px-2 py-1 text-foreground hover:bg-muted hover:text-primary">{c.title}</Link>)}
          </div>
        </nav>
      </div>
    </div>
  );
}

function Box({ title, text, money }: { title: string; text: string; money?: boolean }) {
  return (
    <div className={money ? "grid gap-0.5 rounded-md bg-sand p-2" : "grid gap-0.5 rounded-md border bg-card p-2"}>
      <b className="text-xs font-bold">{title}</b>
      <span className="text-xs text-muted-foreground">{text}</span>
    </div>
  );
}

function Aside({ title, text }: { title: string; text: string }) {
  return (
    <div className="grid gap-0.5 rounded-lg border border-dashed border-coral/70 p-2.5">
      <b className="text-xs font-bold">{title}</b>
      <span className="text-xs text-muted-foreground">{text}</span>
    </div>
  );
}
