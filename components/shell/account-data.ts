import { cache } from "react";
import { getCurrentPerson, getPeople, getRefs, getSessionUser } from "@/lib/session";
import { codirRole, getRoleMap } from "@/lib/roles";
import { canAdmin } from "@/lib/rights";
import { refLabel } from "@/lib/refs";
import { DEMO_MODE } from "@/lib/auth";

// Données du menu utilisateur (bas de la barre latérale, et barre haute sur mobile) : une seule lecture par requête.
export const getAccountProps = cache(async () => {
  const [current, people, refs, sessionUser, roles] = await Promise.all([getCurrentPerson(), getPeople(), getRefs(), getSessionUser(), getRoleMap()]);
  const map = (p: { id: string; name: string; role: string; pole: { name: string } | null }) => ({ id: p.id, name: p.name, role: p.role, roleLabel: refLabel(refs, "role", p.role), poleName: p.pole?.name ?? null, codir: codirRole(roles, p.role) });
  return { people: people.map(map), current: map(current), canAdmin: canAdmin(current), demo: DEMO_MODE, account: sessionUser?.name ?? null };
});
export type AccountProps = Awaited<ReturnType<typeof getAccountProps>>;
