import { permanentRedirect } from "next/navigation";

// « Mes actions » remplace « Ma délégation » (26/09, fin de la délégation comme objet à part) : l'adresse reste ouverte,
// pour ne pas casser un lien ou un favori, mais redirige (308, permanent) vers /mes-actions avec les mêmes paramètres
// (personne, annee, periode — inchangés). La table Delegation et lib/delegation.ts restent (expand), rien ne les lit plus
// depuis l'interface ; app/delegation/export/route.ts n'est pas touché ici (au contract, avec le reste).
export default async function DelegationPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) if (typeof v === "string") qs.set(k, v);
  const query = qs.toString();
  permanentRedirect(`/mes-actions${query ? `?${query}` : ""}`);
}
