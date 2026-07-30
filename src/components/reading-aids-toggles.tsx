import { Link2, Sparkle } from "lucide-react";
import { Button } from "~/components/ui/button";
import { useMessages } from "~/lib/i18n";

/**
 * Toggles for the two CP-book reading aids (faded lettres muettes, liaison
 * arcs). Mirrors `ReadingFontToggle`: secondary/default variant reflects the
 * pressed state, large rounded, icon + short label. Accessible: real
 * buttons, aria-pressed, keyboard-OK by default.
 *
 * Stateless — the parent owns the preferences (useReadingAids) so every
 * reading surface stays in sync and the choices persist.
 */
export function ReadingAidsToggles({
  showSilent,
  showLiaisons,
  onToggleSilent,
  onToggleLiaisons,
}: {
  showSilent: boolean;
  showLiaisons: boolean;
  onToggleSilent: () => void;
  onToggleLiaisons: () => void;
}) {
  const m = useMessages();
  return (
    <>
      <Button
        aria-pressed={showSilent}
        className="h-14 gap-3 rounded-2xl px-6 text-xl"
        onClick={onToggleSilent}
        size="lg"
        type="button"
        variant={showSilent ? "default" : "secondary"}
      >
        <Sparkle className="size-6" />
        {m.aventure.lecture.lettresMuettes}
      </Button>
      <Button
        aria-pressed={showLiaisons}
        className="h-14 gap-3 rounded-2xl px-6 text-xl"
        onClick={onToggleLiaisons}
        size="lg"
        type="button"
        variant={showLiaisons ? "default" : "secondary"}
      >
        <Link2 className="size-6" />
        {m.aventure.lecture.liaisons}
      </Button>
    </>
  );
}
