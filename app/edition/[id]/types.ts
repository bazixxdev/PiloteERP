import type { EditionFull } from "@/lib/queries";
import type { CurrentPerson } from "@/lib/session";
import type { RefMap } from "@/lib/refs";
import type { Settings, Funder, Convention } from "@prisma/client";

export type TabCtx = {
  e: EditionFull;
  me: CurrentPerson;
  refs: RefMap;
  settings: Settings;
  people: Awaited<ReturnType<typeof import("@/lib/session").getPeople>>;
  funders: Funder[];
  conventions: (Convention & { lines: { id: string; amountGranted: number | null; amountRequested: number | null; editionId: string }[] })[];
  isPilot: boolean;
  isTeam: boolean;
};
