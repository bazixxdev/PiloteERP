import { NextRequest, NextResponse } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

// Garde d'entrée (lot F) : sans cookie de session, on va à la page de connexion. Vérification optimiste (présence du cookie) ;
// la vraie vérification et les droits se font côté serveur, page par page (getCurrentPerson, lib/rights.ts).
// Publics : la connexion et la réinitialisation, l'API d'auth, les flux agenda (jeton dans l'adresse), les exports avec jeton d'API,
// et le favicon du client (lot I, app/icon.tsx : l'adresse /icon n'a pas d'extension, le matcher ne l'exclut pas).
const PUBLIC = ["/connexion", "/mot-de-passe-oublie", "/reinitialiser", "/api/auth", "/api/agenda", "/icon"];

export function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;
  if (PUBLIC.some((p) => pathname === p || pathname.startsWith(p + "/") || pathname.startsWith(p + "."))) return NextResponse.next();
  if (pathname.endsWith("/export") && searchParams.get("jeton")) return NextResponse.next();
  if (!getSessionCookie(request, { cookiePrefix: "pilote" })) {
    // Les adresses lues par un programme (exports, pièces, API) répondent 401 plutôt qu'une page de connexion.
    if (pathname.startsWith("/api/") || pathname.endsWith("/export")) return NextResponse.json({ error: "Connexion requise" }, { status: 401 });
    // Redirection **relative** (26/09) : Next écoute en loopback (--hostname 127.0.0.1, SEC-22) et `nextUrl` porte alors
    // l'hôte interne (https://localhost:3002) ; une adresse absolue envoyait le navigateur sur localhost. Relative, elle ne
    // dépend d'aucun en-tête Host (rien à falsifier) et garde le sous-chemin de l'instance.
    const suite = pathname !== "/" ? `?suite=${encodeURIComponent(pathname + (request.nextUrl.search || ""))}` : "";
    return new NextResponse(null, { status: 307, headers: { Location: `${request.nextUrl.basePath}/connexion${suite}` } });
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|ico|webp|json|txt|woff|woff2|css|js|map)$).*)"],
};
