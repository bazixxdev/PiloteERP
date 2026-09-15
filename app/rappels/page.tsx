import { redirect } from "next/navigation";

// Ancienne adresse du radar des échéances (renommé le 15/09) : on garde le lien vivant.
export default async function RappelsRedirect({ searchParams }: { searchParams: Promise<{ perimetre?: string }> }) {
  const { perimetre } = await searchParams;
  redirect(perimetre ? `/echeances?perimetre=${perimetre}` : "/echeances");
}
