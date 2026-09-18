"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getCurrentPerson } from "@/lib/session";
import { canAdmin, canManageMembers } from "@/lib/rights";
import { helloAssoConfig, HelloAssoError, listForms, type HelloAssoForm, type HelloAssoReport } from "@/lib/helloasso";
import { followHelloAssoForm as follow, syncHelloAsso as sync } from "@/lib/helloasso-sync";

type Result<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };
const NOT_CONFIGURED = "HelloAsso n'est pas configuré (HELLOASSO_CLIENT_ID, HELLOASSO_CLIENT_SECRET, HELLOASSO_ORG_SLUG) : le connecteur s'active par la configuration du serveur.";
const fail = (e: unknown): { ok: false; error: string } => ({ ok: false, error: e instanceof HelloAssoError ? e.message : `HelloAsso injoignable : ${e instanceof Error ? e.message : "erreur inconnue"}` });

// Les formulaires du compte, avec les événements déjà suivis (admin).
export async function fetchHelloAssoForms(): Promise<Result<(HelloAssoForm & { listId: string | null })[]>> {
  const me = await getCurrentPerson();
  if (!canAdmin(me)) return { ok: false, error: "Réservé à l'administration." };
  const cfg = helloAssoConfig(); if (!cfg) return { ok: false, error: NOT_CONFIGURED };
  try {
    const [forms, followed] = await Promise.all([listForms(cfg), prisma.contactList.findMany({ where: { source: "helloasso" }, select: { id: true, helloAssoForm: true } })]);
    const by = new Map(followed.map((l) => [l.helloAssoForm, l.id]));
    return { ok: true, data: forms.map((x) => ({ ...x, listId: by.get(x.formSlug) ?? null })) };
  } catch (e) { return fail(e); }
}

export async function followHelloAssoForm(formSlug: string): Promise<Result<{ id: string; report: HelloAssoReport }>> {
  const me = await getCurrentPerson();
  if (!canAdmin(me)) return { ok: false, error: "Réservé à l'administration." };
  const cfg = helloAssoConfig(); if (!cfg) return { ok: false, error: NOT_CONFIGURED };
  try {
    const id = await follow(cfg, formSlug, me.id);
    const report = await sync(cfg, me.id);
    revalidatePath("/", "layout");
    return { ok: true, data: { id, report } };
  } catch (e) { return fail(e); }
}

export async function unfollowHelloAssoForm(listId: string): Promise<Result> {
  const me = await getCurrentPerson();
  if (!canAdmin(me)) return { ok: false, error: "Réservé à l'administration." };
  const l = await prisma.contactList.findUnique({ where: { id: listId } });
  if (!l || l.source !== "helloasso") return { ok: false, error: "Cette liste n'est pas un miroir HelloAsso." };
  await prisma.contactList.delete({ where: { id: listId } });
  revalidatePath("/", "layout");
  return { ok: true };
}

// Synchroniser (admin, ou qui gère les adhésions).
export async function syncHelloAsso(): Promise<Result<HelloAssoReport>> {
  const me = await getCurrentPerson();
  if (!canAdmin(me) && !canManageMembers(me)) return { ok: false, error: "Réservé à l'administration ou à qui gère les adhésions." };
  const cfg = helloAssoConfig(); if (!cfg) return { ok: false, error: NOT_CONFIGURED };
  try {
    const report = await sync(cfg, me.id);
    revalidatePath("/", "layout");
    return { ok: true, data: report };
  } catch (e) { return fail(e); }
}
