import { NextRequest, NextResponse } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

// Garde d'entrée (lot F) : sans cookie de session, on va à la page de connexion. Vérification optimiste (présence du cookie) ;
// la vraie vérification et les droits se font côté serveur, page par page (getCurrentPerson, lib/rights.ts).
// Publics : la connexion et la réinitialisation, l'API d'auth, les flux agenda (jeton dans l'adresse), les exports avec jeton d'API.
const PUBLIC = ["/connexion", "/mot-de-passe-oublie", "/reinitialiser", "/api/auth", "/api/agenda"];

export function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;
  if (PUBLIC.some((p) => pathname === p || pathname.startsWith(p + "/") || pathname.startsWith(p + "."))) return NextResponse.next();
  if (pathname.endsWith("/export") && searchParams.get("jeton")) return NextResponse.next();
  if (!getSessionCookie(request, { cookiePrefix: "pilote" })) {
    // Les adresses lues par un programme (exports, pièces, API) répondent 401 plutôt qu'une page de connexion.
    if (pathname.startsWith("/api/") || pathname.endsWith("/export")) return NextResponse.json({ error: "Connexion requise" }, { status: 401 });
    const login = request.nextUrl.clone();
    login.pathname = "/connexion";
    login.search = pathname !== "/" ? `?suite=${encodeURIComponent(pathname + (request.nextUrl.search || ""))}` : "";
    return NextResponse.redirect(login);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|ico|webp|json|txt|woff|woff2|css|js|map)$).*)"],
};
