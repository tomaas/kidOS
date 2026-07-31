import type { ProviderConfig } from "~/server/app-config";
import type { TtsProvider } from "~/server/providers/types";
import { edgeTtsProvider } from "./edge";
import { elevenLabsTtsProvider } from "./elevenlabs";

/**
 * The ONE env-switched adapter seam in the providers layer (two live
 * implementations — see the adapter-census note in `types.ts`): resolve the
 * configured TTS adapter. `TTS_PROVIDER=elevenlabs` → ElevenLabs; anything
 * else (incl. unset) → the free edge voices, the default.
 */
export function getTtsProvider(config: ProviderConfig): TtsProvider {
  return config.ttsProvider === "elevenlabs"
    ? elevenLabsTtsProvider(config.elevenLabsApiKey)
    : edgeTtsProvider;
}
