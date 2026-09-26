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
    // Hôte public (26/09) : Next écoute en loopback (--hostname 127.0.0.1, SEC-22) et `nextUrl` porte alors l'hôte interne
    // (https://localhost:3002) ; le navigateur partait sur localhost. Next exige une adresse absolue : on la construit sur
    // l'hôte que Nginx transmet (il ne relaie que ses server_name) et sur le protocole d'origine.
    const login = request.nextUrl.clone();
    const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
    const proto = request.headers.get("x-forwarded-proto");
    if (host) { const [hostname, port] = host.split(":"); login.hostname = hostname; login.port = port ?? ""; }
    if (proto === "https" || proto === "http") login.protocol = `${proto}:`;
    login.pathname = "/connexion";
    login.search = pathname !== "/" ? `?suite=${encodeURIComponent(pathname + (request.nextUrl.search || ""))}` : "";
    return NextResponse.redirect(login);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|ico|webp|json|txt|woff|woff2|css|js|map)$).*)"],
};
