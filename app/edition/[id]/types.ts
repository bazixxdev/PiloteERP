import type { EditionFull } from "@/lib/queries";
import type { CurrentPerson } from "@/lib/session";
import type { RefMap } from "@/lib/refs";
import type { Settings, Funder } from "@prisma/client";

export type TabCtx = {
  e: EditionFull;
  me: CurrentPerson;
  refs: RefMap;
  settings: Settings;
  people: Awaited<ReturnType<typeof import("@/lib/session").getPeople>>;
  funders: Funder[];
  isPilot: boolean;
  isTeam: boolean;
};
