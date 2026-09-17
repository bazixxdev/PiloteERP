// Sous-chemin de déploiement (convention outilcli : /outilcli/cress/pilote). Vide en local.
// Les <Link>, router.push et redirect() de Next le gèrent seuls (le doubler = 404) ; les <a href>, <img src> et les URL absolues
// (flux iCal, Excel, liens des courriers) doivent passer par ici.
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export function withBase(path: string): string {
  if (!path.startsWith("/")) return path;
  return `${BASE_PATH}${path}`;
}
