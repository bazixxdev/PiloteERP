import { cress } from "./cress";
import { tlst } from "./tlst";
import type { Client } from "./types";

export type { Client, Vocab, Word, Theme, FontSpec, Img } from "./types";

// Un client par instance, choisi au build par NEXT_PUBLIC_CLIENT (deploy/instances/<instance>.env → .env serveur). Imports
// statiques : Next embarque le bon fichier côté serveur et navigateur, sans requête. Clé inconnue = échec franc au démarrage.
export const CLIENT_KEYS = ["cress", "tlst"] as const;

export function clientFor(key: string | undefined): Client {
  switch (key ?? "cress") {
    case "cress":
      return cress;
    case "tlst":
      return tlst;
    default:
      throw new Error(`NEXT_PUBLIC_CLIENT="${key}" inconnu : attendu ${CLIENT_KEYS.join(" | ")}`);
  }
}

export const client: Client = clientFor(process.env.NEXT_PUBLIC_CLIENT);
