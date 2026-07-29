import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";
import { generateId } from "~/lib/id-generator";
import { saveMedia } from "~/server/providers/media-store";
import type { Lang, TtsProvider } from "~/server/providers/types";

// Free Microsoft Edge neural voices. FR in v1; RU voice wired for later;
// EN (multilang phase 3) : Ana — la voix enfant du catalogue Edge, appariée
// au ton câlin des histoires.
const VOICE: Record<Lang, string> = {
  en: "en-US-AnaNeural",
  fr: "fr-FR-DeniseNeural",
  ru: "ru-RU-SvetlanaNeural",
};

/**
 * Default TTS: msedge-tts (edge-tts Node port). No API key required.
 * Behind TTS_ENABLED — the caller decides whether to invoke this.
 *
 * Synthesizes to BYTES and persists through `saveMedia` — the single media
 * choke-point — exactly like the elevenlabs adapter, so the stored path
 * honors the active backend (local `/data/media/…` OR a Blob `https://…`
 * URL). The previous version wrote the file to disk itself and hand-built the
 * `/data/media/` path, which silently broke audio in Blob mode (ephemeral
 * filesystem, and the `/data/$` route never serves what Blob mode stores).
 */
export const edgeTtsProvider: TtsProvider = {
  async synthesize(text: string, lang: Lang): Promise<string> {
    const tts = new MsEdgeTTS();
    await tts.setMetadata(
      VOICE[lang],
      OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3
    );

    // toStream ends with push(null) on the service's turn.end — async
    // iteration collects the full audio, mirroring the library's own toFile.
    const chunks: Buffer[] = [];
    for await (const chunk of tts.toStream(text)) {
      chunks.push(chunk as Buffer);
    }
    const bytes = new Uint8Array(Buffer.concat(chunks));
    if (bytes.length === 0) {
      // Same failure the library's toFile raised ("No audio data received"):
      // never persist an empty audio file as a playable path.
      throw new Error("Aucune donnée audio reçue de msedge-tts.");
    }

    return saveMedia(`${generateId("audio")}.mp3`, bytes);
  },
};
