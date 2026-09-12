"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { COOKIE } from "@/lib/session";

export async function switchPerson(personId: string) {
  const jar = await cookies();
  jar.set(COOKIE, personId, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  revalidatePath("/", "layout");
}
