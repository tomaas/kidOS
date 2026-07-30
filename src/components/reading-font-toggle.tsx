import { PenLine } from "lucide-react";
import { Button } from "~/components/ui/button";
import { useMessages } from "~/lib/i18n";

/**
 * Toggle for the optional cursive ("lettres attachées") reading mode. Mirrors
 * the other reading-screen actions (Printer / Écouter): secondary variant,
 * large rounded, icon + short label. Accessible: real button, aria-pressed
 * reflects the active mode, keyboard-OK by default.
 *
 * Stateless — the parent owns the preference (useReadingFont) so both reading
 * screens stay in sync and the choice persists.
 */
export function ReadingFontToggle({
  isCursive,
  onToggle,
}: {
  isCursive: boolean;
  onToggle: () => void;
}) {
  const m = useMessages();
  return (
    <Button
      aria-pressed={isCursive}
      className="h-14 gap-3 rounded-2xl px-6 text-xl"
      onClick={onToggle}
      size="lg"
      type="button"
      variant={isCursive ? "default" : "secondary"}
    >
      <PenLine className="size-6" />
      {isCursive
        ? m.aventure.lecture.lettresNormales
        : m.aventure.lecture.lettresAttachees}
    </Button>
  );
}
