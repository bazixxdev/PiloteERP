// Une seule règle pour « au moins une autre personne dont je vois le temps » (spec menu § 6.6, 27/09), lue par le layout
// (barre latérale : Temps de l'équipe) et par /cloture (onglet Temps de l'équipe).
import { canSeeTimeOf } from "./rights";

export function seesSomeoneElse(
  me: Parameters<typeof canSeeTimeOf>[0],
  people: (Parameters<typeof canSeeTimeOf>[1] & { tracksTime: boolean })[],
  visibility: string,
): boolean {
  return people.some((p) => p.id !== me.id && p.tracksTime && canSeeTimeOf(me, p, visibility));
}
