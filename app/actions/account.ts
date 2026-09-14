"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getCurrentPerson } from "@/lib/session";
import { MODULES } from "@/lib/modules";

type Result = { ok: true } | { ok: false; error: string };

// Modules activés : un réglage de la personne, pas de l'admin. Un module coupé ne perd rien : les données restent.
export async function setModule(key: string, on: boolean): Promise<Result> {
  const me = await getCurrentPerson();
  if (!MODULES.some((m) => m.key === key)) return { ok: false, error: "Module inconnu." };
  const set = new Set(me.modules.split(",").map((x) => x.trim()).filter(Boolean));
  if (on) set.add(key); else set.delete(key);
  await prisma.person.update({ where: { id: me.id }, data: { modules: [...set].join(",") } });
  revalidatePath("/", "layout");
  return { ok: true };
}
