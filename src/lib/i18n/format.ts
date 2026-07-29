/**
 * Composition des gabarits à trous du catalogue ({nom} → valeur) — le SEUL
 * mécanisme de composition autorisé : les feuilles du catalogue restent des
 * chaînes (la parité fr↔en et le scan calme marchent sur des strings), et la
 * composition FR est épinglable byte-exact par le golden. Un trou sans valeur
 * fournie disparaît (chaîne vide) — jamais d'exception à l'écran.
 */

export function formatMessage(
  template: string,
  vars: Record<string, string>
): string {
  return template.replace(/\{(\w+)\}/g, (_, nom: string) => vars[nom] ?? "");
}
