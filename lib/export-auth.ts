import { cookies } from "next/headers";
import { prisma } from "./db";
import { COOKIE } from "./session";

// Les exports s'ouvrent depuis l'outil (personne courante) ou depuis un outil externe (Excel, Power Query) avec le jeton d'API.
export async function exportAllowed(req: Request): Promise<boolean> {
  const jeton = new URL(req.url).searchParams.get("jeton");
  if (jeton) {
    const s = await prisma.settings.findUnique({ where: { id: 1 } });
    return Boolean(s?.apiToken) && jeton === s!.apiToken;
  }
  const jar = await cookies();
  return Boolean(jar.get(COOKIE)?.value);
}
