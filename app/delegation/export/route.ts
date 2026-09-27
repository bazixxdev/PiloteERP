import { NextResponse } from "next/server";
import { sessionExportAllowed } from "@/lib/export-auth";

// « Mes actions » remplace « Ma délégation » (26/09) : cet export ne sert plus les textes de délégation (expectations,
// limits, controls) — redirection (308, permanent) vers /mes-actions, comme app/delegation/page.tsx, avec les mêmes
// paramètres. La garde (session active) reste, pour ne jamais rendre la redirection à un visiteur anonyme : sur une
// adresse en /export sans cookie de session, le middleware répond déjà 401 avant d'atteindre ce code (middleware.ts).
// lib/delegation-db.ts, la table Delegation et les droits delegation.* ne sont pas touchés (expand : rien de supprimé),
// mais plus rien ici ne les lit.
export async function GET(req: Request) {
  if (!(await sessionExportAllowed(req))) return NextResponse.json({ error: "Connexion requise" }, { status: 401 });
  const { search } = new URL(req.url);
  return NextResponse.redirect(new URL(`/mes-actions${search}`, req.url), 308);
}
