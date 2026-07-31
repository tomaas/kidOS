import { generateId } from "~/lib/id-generator";
import { saveMedia } from "~/server/providers/media-store";
import type { Lang, TtsProvider } from "~/server/providers/types";

// A warm multilingual ElevenLabs voice (Rachel). Multilingual model covers FR.
const VOICE_ID = "21m00Tcm4TlvDq8ikWAM";
const MODEL_ID = "eleven_multilingual_v2";

/**
 * Premium alternative TTS via the ElevenLabs REST API. Raw fetch — no SDK
 * needed for a single endpoint. Behind TTS_ENABLED + TTS_PROVIDER=elevenlabs.
 */
export function elevenLabsTtsProvider(apiKey: string): TtsProvider {
  return {
    async synthesize(text: string, _lang: Lang): Promise<string> {
      if (!apiKey) {
        // Clé absente (ni ligne DB ni env) : aucun appel réseau — l'audio
        // reste simplement indisponible, jamais une erreur enfant.
        throw new Error("Clé ElevenLabs non configurée.");
      }

      const res = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`,
        {
          body: JSON.stringify({ model_id: MODEL_ID, text }),
          headers: {
            accept: "audio/mpeg",
            "content-type": "application/json",
            "xi-api-key": apiKey,
          },
          method: "POST",
        }
      );

      if (!res.ok) {
        throw new Error(`ElevenLabs a renvoyé une erreur (${res.status}).`);
      }

      const bytes = new Uint8Array(await res.arrayBuffer());
      return saveMedia(`${generateId("audio")}.mp3`, bytes);
    },
  };
}
