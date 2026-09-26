// Les mots de l'instance testée (26/09) : une recette ne doit jamais écrire « année » ou « action » en dur, sinon changer un
// mot du vocabulaire casse la recette. On compose les libellés attendus avec les mêmes fonctions que l'interface.
import { clientFor } from "../config/clients/index";
import type { Word } from "../config/clients/types";
export { cap, le, un, du, de, au, ce, pl, ppe, aucun, tous, tout, nb } from "../lib/vocab";

export const client = clientFor(process.env.TEST_CLIENT ?? "cress");
export const W = { ...client.vocab, org: { one: client.shortName, many: client.shortName, gender: client.orgGender } as Word };

// Variante explicite pour les specs qui tournent sur l'instance TLST (habillage.spec.ts, projet Playwright « tlst ») sans
// dépendre de la variable d'environnement TEST_CLIENT.
const clientTlst = clientFor("tlst");
export const WTlst = { ...clientTlst.vocab, org: { one: clientTlst.shortName, many: clientTlst.shortName, gender: clientTlst.orgGender } as Word };
