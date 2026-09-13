// Sous-chemin de déploiement (convention outilcli : /outilcli/cress/pilote). Vide en local.
// Les <Link> et router.push de Next le gèrent seuls ; les <a href>, les URL absolues (flux iCal, Excel) et redirect() doivent passer par ici.
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export function withBase(path: string): string {
  if (!path.startsWith("/")) return path;
  return `${BASE_PATH}${path}`;
}
