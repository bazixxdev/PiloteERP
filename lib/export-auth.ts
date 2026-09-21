import { prisma } from "./db";
import { auth } from "./auth";
import type { PermissionKey } from "./permissions";
import { parsePermissions } from "./permissions";

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

// Les exports de documents internes ne disposent pas d'un accès externe par jeton :
// ils exigent une session Better Auth rattachée à une personne encore active.
export async function sessionExportAllowed(req: Request): Promise<boolean> {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user) return false;
  const person = await prisma.person.findUnique({ where: { userId: session.user.id }, select: { active: true } });
  return person?.active === true;
}

// Exports globaux : un jeton API valide conserve le parcours externe existant ; un jeton présenté mais faux répond 401,
// même avec une session ouverte (la crédence présentée est celle qui compte). Une session interne doit aussi porter
// la permission métier de l'export, sinon 403. Renvoie null quand l'export est autorisé.
export async function exportDenial(req: Request, permission: PermissionKey): Promise<{ status: 401 | 403; message: string } | null> {
  const jeton = new URL(req.url).searchParams.get("jeton");
  if (jeton) return (await exportAllowed(req)) ? null : { status: 401, message: "Jeton d'API requis" };
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user) return { status: 401, message: "Jeton d'API requis" };
  const person = await prisma.person.findUnique({ where: { userId: session.user.id }, select: { active: true, role: true } });
  if (!person?.active) return { status: 403, message: "Export non autorisé" };
  const role = await prisma.role.findUnique({ where: { code: person.role }, select: { permissions: true } });
  return parsePermissions(role?.permissions).includes(permission) ? null : { status: 403, message: "Export non autorisé" };
}
