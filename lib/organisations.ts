import { prisma } from "./db";
import { V, un, au } from "@/lib/vocab";

// Organisations (lot E2) : un annuaire, des genres cumulables. Les lectures par genre passent par ici pour que « les
// financeurs » ou « les fournisseurs » restent une seule question dans tout l'outil.
export const ORGANISATION_KINDS = [
  { key: "funder", label: "Financeur", plural: "Financeurs", hint: "Subventionne : lignes de financement, conventions, appels à projets." },
  { key: "supplier", label: "Fournisseur", plural: "Fournisseurs", hint: "Devis, factures, bons pour accord." },
  { key: "partner", label: "Partenaire", plural: "Partenaires", hint: `Co-porte ou contribue à ${un(V.projet)}.` },
  { key: "network", label: "Réseau", plural: "Réseaux", hint: "Tête de réseau, fédération, membre ou adhérent." },
  { key: "authority", label: "Collectivité", plural: "Collectivités", hint: "Commune, intercommunalité, département, région, État — quand elle ne finance pas." },
  { key: "member", label: "Adhérent", plural: "Adhérents", hint: `Adhère ${au(V.org)} : au moins une adhésion enregistrée (module Adhérents).` },
] as const;

export type OrganisationKind = (typeof ORGANISATION_KINDS)[number]["key"];

export const kindsOf = (o: { kinds: string }): OrganisationKind[] => o.kinds.split(",").map((k) => k.trim()).filter((k): k is OrganisationKind => ORGANISATION_KINDS.some((x) => x.key === k));
export const hasKind = (o: { kinds: string }, k: OrganisationKind) => kindsOf(o).includes(k);
export const kindLabel = (k: string) => ORGANISATION_KINDS.find((x) => x.key === k)?.label ?? k;
// Toujours dans l'ordre du catalogue : l'affichage ne dépend pas de l'ordre des clics.
export const serializeKinds = (keys: readonly string[]) => ORGANISATION_KINDS.map((x) => x.key).filter((k) => keys.includes(k)).join(",");

// Contient un genre (colonne csv) : « funder » ne doit pas attraper « cofunder » demain — on encadre par les virgules.
export const kindFilter = (k: OrganisationKind) => ({ OR: [{ kinds: k }, { kinds: { startsWith: `${k},` } }, { kinds: { endsWith: `,${k}` } }, { kinds: { contains: `,${k},` } }] });

export const listFunders = () => prisma.organisation.findMany({ where: { active: true, ...kindFilter("funder") }, orderBy: { name: "asc" } });
export const listSuppliers = () => prisma.organisation.findMany({ where: { active: true, ...kindFilter("supplier") }, select: { id: true, name: true, email: true }, orderBy: { name: "asc" } });

// Trouver ou créer une organisation par son nom (même nom, majuscules et espaces près = même organisation), en ajoutant le genre.
export async function findOrCreateOrganisation(name: string, kind: OrganisationKind, extra: { email?: string | null } = {}) {
  const n = name.trim();
  const existing = (await prisma.organisation.findMany({ where: { name: { equals: n, mode: "insensitive" } } }))[0];
  if (existing) {
    if (!hasKind(existing, kind)) return prisma.organisation.update({ where: { id: existing.id }, data: { kinds: serializeKinds([...kindsOf(existing), kind]), email: existing.email ?? extra.email ?? null } });
    return existing;
  }
  return prisma.organisation.create({ data: { name: n, kinds: kind, email: extra.email ?? null } });
}
