// Le moment de l'année où l'on prépare l'année suivante (spec menu § 6.5, 27/09) : de septembre à décembre, on prépare N+1 ;
// en janvier on finit de préparer l'année qui commence. Une seule règle, lue par le menu, les raccourcis, /seminaire et Vue annuelle.
export function preparedYear(today: Date): number {
  return today.getMonth() === 0 ? today.getFullYear() : today.getFullYear() + 1;
}

export function prepareInSeason(today: Date): boolean {
  const m = today.getMonth();
  return m >= 8 || m === 0;
}
