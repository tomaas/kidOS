/**
 * Shared style tokens. The image style suffix keeps every illustration
 * coherent (soft children's-album watercolour). Palette/font tokens document
 * the calm visual language used across the app and the print booklet.
 */

export const imageStyleSuffix = [
  "Style studio Ghibli.",
  "Pas de texte dans l'image. Pas de visage photoréaliste.",
  "Ambiance calme, rassurante et merveilleuse, adaptée à un enfant de 5 ans.",
].join(" ");

/** Pendant EN (histoires lang === "en") — même contrat, mêmes interdits. */
export const imageStyleSuffixEn = [
  "Studio Ghibli style.",
  "No text in the image. No photorealistic faces.",
  "A calm, reassuring and wonder-filled mood, suited to a 5-year-old child.",
].join(" ");

export const palette = {
  accent: "#A9C9A4",
  background: "#FBF6EC",
  ink: "#5A4636",
  primary: "#D89A5B",
} as const;

export const fonts = {
  rounded: "Quicksand",
} as const;
