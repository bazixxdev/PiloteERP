import { auth } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";
import { BASE_PATH } from "@/lib/base-path";

// Point d'entrée better-auth (connexion, déconnexion, session, réinitialisation).
// Next retire le `basePath` de `request.url` dans les routes ; better-auth, lui, attend le chemin complet de son adresse publique
// (`/outilcli/cress/pilote/api/auth/...` sur le serveur). On le remet avant de lui passer la requête.
const handler = toNextJsHandler(auth);

async function withBasePath(req: Request): Promise<Request> {
  if (!BASE_PATH) return req;
  const url = new URL(req.url);
  if (url.pathname.startsWith(BASE_PATH + "/")) return req;
  url.pathname = BASE_PATH + url.pathname;
  const body = req.method === "GET" || req.method === "HEAD" ? undefined : await req.arrayBuffer();
  return new Request(url, { method: req.method, headers: req.headers, body });
}

export async function GET(req: Request) { return handler.GET(await withBasePath(req)); }
export async function POST(req: Request) { return handler.POST(await withBasePath(req)); }
