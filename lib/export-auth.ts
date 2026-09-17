import { prisma } from "./db";
import { auth } from "./auth";

// Les exports s'ouvrent depuis l'outil (session en cours) ou depuis un outil externe (Excel, Power Query) avec le jeton d'API.
export async function exportAllowed(req: Request): Promise<boolean> {
  const jeton = new URL(req.url).searchParams.get("jeton");
  if (jeton) {
    const s = await prisma.settings.findUnique({ where: { id: 1 } });
    return Boolean(s?.apiToken) && jeton === s!.apiToken;
  }
  const session = await auth.api.getSession({ headers: req.headers });
  return Boolean(session?.user);
}
