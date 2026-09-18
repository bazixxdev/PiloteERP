"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { hashPassword } from "better-auth/crypto";
import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { getCurrentPerson } from "@/lib/session";
import { canAdmin } from "@/lib/rights";
import { BASE_PATH } from "@/lib/base-path";
import { V } from "@/lib/vocab";

type Result<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };

async function guard(): Promise<string | null> {
  const me = await getCurrentPerson();
  return canAdmin(me) ? null : `Réservé à l'administration (${V.direction.one}, ${V.raf.one}).`;
}

const normEmail = (e: string) => e.trim().toLowerCase();

// Adresse publique de l'outil (pour les liens dans les courriers), depuis la requête en cours.
async function appOrigin(): Promise<string> {
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "http";
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3001";
  return `${proto}://${host}${BASE_PATH}`;
}

// Créer le compte d'une personne : un User avec un mot de passe aléatoire (inconnu de tous), puis un lien de réinitialisation
// déposé dans la boîte d'envoi — la personne choisit son mot de passe elle-même. Idempotent : un compte existant n'est pas recréé.
export async function createAccount(personId: string): Promise<Result<{ linkId: string }>> {
  const d = await guard(); if (d) return { ok: false, error: d };
  const p = await prisma.person.findUnique({ where: { id: personId }, include: { user: true } });
  if (!p) return { ok: false, error: "Personne introuvable" };
  if (!p.email) return { ok: false, error: "Renseignez d'abord son adresse e-mail." };
  if (!p.active) return { ok: false, error: "Cette personne est désactivée : réactivez-la d'abord." };
  const email = normEmail(p.email);
  if (!p.user) {
    if (await prisma.user.findUnique({ where: { email } })) return { ok: false, error: "Un compte existe déjà avec cette adresse (rattaché à une autre personne ?)." };
    // Compte « credential » : better-auth exige accountId = id du User (pas l'e-mail), d'où la création en deux temps.
    await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({ data: { name: p.name, email, emailVerified: true } });
      await tx.account.create({ data: { userId: user.id, accountId: user.id, providerId: "credential", password: await hashPassword(randomBytes(24).toString("hex")) } });
      await tx.person.update({ where: { id: p.id }, data: { userId: user.id, email } });
    });
  }
  const link = await prepareResetLink(email, "invitation");
  revalidatePath("/admin");
  return { ok: true, data: { linkId: link } };
}

// Lien de réinitialisation (mot de passe oublié, compte créé) : demandé à better-auth, qui dépose le courrier dans la boîte.
async function prepareResetLink(email: string, kind: "invitation" | "password_reset"): Promise<string> {
  const origin = await appOrigin();
  await auth.api.requestPasswordReset({ body: { email, redirectTo: `${origin}/reinitialiser` } });
  const mail = await prisma.mailOutbox.findFirst({ where: { to: email, kind: "password_reset", handedAt: null }, orderBy: { createdAt: "desc" } });
  if (mail && kind === "invitation") await prisma.mailOutbox.update({ where: { id: mail.id }, data: { kind: "invitation", subject: `Votre accès à Pilote`, body: mail.body.replace("Pour choisir un nouveau mot de passe", "Votre compte est créé. Pour choisir votre mot de passe") } });
  return mail?.id ?? "";
}

export async function sendResetLink(personId: string): Promise<Result<{ linkId: string }>> {
  const d = await guard(); if (d) return { ok: false, error: d };
  const p = await prisma.person.findUnique({ where: { id: personId }, include: { user: true } });
  if (!p?.user) return { ok: false, error: "Cette personne n'a pas de compte." };
  const link = await prepareResetLink(p.user.email, "password_reset");
  revalidatePath("/admin");
  return { ok: true, data: { linkId: link } };
}

// Déconnecter partout : toutes les sessions du compte sont révoquées (départ, poste perdu, doute).
export async function revokeAllSessions(personId: string): Promise<Result<{ count: number }>> {
  const d = await guard(); if (d) return { ok: false, error: d };
  const p = await prisma.person.findUnique({ where: { id: personId } });
  if (!p?.userId) return { ok: false, error: "Cette personne n'a pas de compte." };
  const r = await prisma.session.deleteMany({ where: { userId: p.userId } });
  revalidatePath("/admin");
  return { ok: true, data: { count: r.count } };
}

// Courrier remis à la main (copié, transmis) : sort de la liste « à remettre ».
export async function markMailHanded(id: string): Promise<Result> {
  const d = await guard(); if (d) return { ok: false, error: d };
  await prisma.mailOutbox.update({ where: { id }, data: { handedAt: new Date() } });
  revalidatePath("/admin");
  return { ok: true };
}

// Changer son propre mot de passe (Mon compte) : l'ancien est vérifié par better-auth ; les autres sessions du compte sont
// fermées, la session courante est conservée (better-auth la remplacerait sinon, et l'action serveur se rejouerait déconnectée).
export async function changeMyPassword(current: string, next: string): Promise<Result> {
  const h = await headers();
  const session = await auth.api.getSession({ headers: h });
  if (!session) return { ok: false, error: "Connexion requise." };
  if (next.length < 10) return { ok: false, error: "Dix caractères au moins." };
  try {
    await auth.api.changePassword({ headers: h, body: { currentPassword: current, newPassword: next, revokeOtherSessions: false } });
  } catch {
    return { ok: false, error: "Mot de passe actuel incorrect." };
  }
  await prisma.session.deleteMany({ where: { userId: session.user.id, NOT: { token: session.session.token } } });
  return { ok: true };
}
