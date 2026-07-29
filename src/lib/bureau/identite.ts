/**
 * Identité du bureau (ceo-review T4-A) : l'utilisateur du bureau est le
 * PRÉNOM CONFIGURÉ (childName, exporté par src/config/app.ts), et son
 * portrait est le héros dont le nom correspond — jamais « le premier héros
 * de la table ». Module PUR, golden-testé.
 */

/**
 * Comparaison insensible à la casse ET à l'élision : « d'Arsène » (la forme
 * dérivée du branding) et « Arsène » désignent le même enfant ; « L'atelier »
 * garde son article hors de la comparaison.
 */
const ELISION_PREFIX = /^[dl]['’]/i;

function normalise(name: string): string {
  return (
    name
      // NFC d'abord : un label collé en forme décomposée (NFD, fréquent
      // depuis un nom de fichier macOS) doit reconnaître le prénom accentué
      // configuré — sinon le portrait tombe en silence sur l'emoji.
      .normalize("NFC")
      .trim()
      .replace(ELISION_PREFIX, "")
      // "fr" reste correct pour la locale UI "en" aussi : fr et en n'ont
      // aucun mapping de casse divergent (le piège, c'est le i turc) — et le
      // strip d'élision est simplement sans effet sur un label anglais.
      .toLocaleLowerCase("fr")
  );
}

export function matchesChildName(label: string, childName: string): boolean {
  const child = normalise(childName);
  if (child.length === 0) {
    return false;
  }
  return normalise(label) === child;
}
