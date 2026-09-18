"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getCurrentPerson } from "@/lib/session";
import { canAdmin } from "@/lib/rights";
import { brevoConfig, BrevoError, listLists, type BrevoList, type SyncReport } from "@/lib/brevo";
import { followBrevoList as follow, pushListToBrevo as push, syncBrevo as sync, type PushReport } from "@/lib/brevo-sync";

type Result<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };

const NOT_CONFIGURED = "Brevo n'est pas configuré (BREVO_API_KEY absente) : le connecteur s'active par la configuration du serveur.";
const fail = (e: unknown): { ok: false; error: string } => ({ ok: false, error: e instanceof BrevoError ? e.message : `Brevo injoignable : ${e instanceof Error ? e.message : "erreur inconnue"}` });

// Les listes du compte Brevo, avec celles déjà suivies ici (admin).
export async function fetchBrevoLists(): Promise<Result<(BrevoList & { listId: string | null })[]>> {
  const me = await getCurrentPerson();
  if (!canAdmin(me)) return { ok: false, error: "Réservé à l'administration." };
  const cfg = brevoConfig(); if (!cfg) return { ok: false, error: NOT_CONFIGURED };
  try {
    const [remote, followed] = await Promise.all([listLists(cfg), prisma.contactList.findMany({ where: { source: "brevo" }, select: { id: true, brevoListId: true } })]);
    const byBrevo = new Map(followed.map((l) => [l.brevoListId, l.id]));
    return { ok: true, data: remote.map((l) => ({ ...l, listId: byBrevo.get(l.id) ?? null })) };
  } catch (e) { return fail(e); }
}

// Suivre une liste Brevo : le miroir est créé puis rempli tout de suite (synchronisation complète, idempotente).
export async function followBrevoList(brevoListId: number): Promise<Result<{ id: string; report: SyncReport }>> {
  const me = await getCurrentPerson();
  if (!canAdmin(me)) return { ok: false, error: "Réservé à l'administration." };
  const cfg = brevoConfig(); if (!cfg) return { ok: false, error: NOT_CONFIGURED };
  try {
    const id = await follow(cfg, brevoListId, me.id);
    const report = await sync(cfg, me.id);
    revalidatePath("/", "layout");
    return { ok: true, data: { id, report } };
  } catch (e) { return fail(e); }
}

// Ne plus suivre : le miroir disparaît, les contacts restent dans l'annuaire (avec leur identifiant Brevo).
export async function unfollowBrevoList(listId: string): Promise<Result> {
  const me = await getCurrentPerson();
  if (!canAdmin(me)) return { ok: false, error: "Réservé à l'administration." };
  const l = await prisma.contactList.findUnique({ where: { id: listId } });
  if (!l || l.source !== "brevo") return { ok: false, error: "Cette liste n'est pas un miroir Brevo." };
  await prisma.contactList.delete({ where: { id: listId } });
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function syncBrevo(): Promise<Result<SyncReport>> {
  const me = await getCurrentPerson();
  if (!canAdmin(me)) return { ok: false, error: "Réservé à l'administration." };
  const cfg = brevoConfig(); if (!cfg) return { ok: false, error: NOT_CONFIGURED };
  try {
    const report = await sync(cfg, me.id);
    revalidatePath("/", "layout");
    return { ok: true, data: report };
  } catch (e) { return fail(e); }
}

// Envoyer une liste vers Brevo : son auteur ou l'administration.
export async function pushListToBrevo(listId: string): Promise<Result<PushReport>> {
  const me = await getCurrentPerson();
  const cfg = brevoConfig(); if (!cfg) return { ok: false, error: NOT_CONFIGURED };
  const l = await prisma.contactList.findUnique({ where: { id: listId } });
  if (!l) return { ok: false, error: "Liste introuvable." };
  if (l.ownerId !== me.id && !canAdmin(me)) return { ok: false, error: "Seul l'auteur de la liste l'envoie vers Brevo." };
  try {
    const report = await push(cfg, listId);
    revalidatePath("/", "layout");
    return { ok: true, data: report };
  } catch (e) { return fail(e); }
}
