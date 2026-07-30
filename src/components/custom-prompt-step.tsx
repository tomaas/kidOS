import { Sparkles } from "lucide-react";
import { useState } from "react";
import { Button } from "~/components/ui/button";
import { Textarea } from "~/components/ui/textarea";
import { useMessages } from "~/lib/i18n";

interface CustomPromptStepProps {
  // Called with the (possibly empty) free text when the child continues.
  onContinue: (customPrompt: string) => void;
}

// Cap the input client-side too (the server caps at 500). Generous enough for a
// sentence or two of "saveur", never an essay.
const MAX_LENGTH = 500;

/**
 * The final, OPTIONAL parcours step: "Tu veux ajouter quelque chose ?". One
 * thing per screen, zero pressure — a quiet "passer" generates with nothing,
 * "C'est parti" generates with whatever was typed. No counter, no validation
 * gate; it's pure invitation, skippable in one tap.
 */
export function CustomPromptStep({ onContinue }: CustomPromptStepProps) {
  const m = useMessages();
  const [text, setText] = useState("");

  return (
    <div className="space-y-8">
      <h1 className="text-center font-bold text-4xl leading-tight">
        {m.aventure.questionSaveur}
      </h1>
      <p className="text-center text-muted-foreground text-xl">
        {m.aventure.facultatifParenthese}
      </p>

      <Textarea
        className="min-h-32 rounded-3xl border-2 p-5 text-2xl leading-relaxed md:text-2xl"
        maxLength={MAX_LENGTH}
        onChange={(e) => setText(e.target.value)}
        placeholder={m.aventure.placeholderSaveur}
        value={text}
      />

      <div className="flex flex-col items-center gap-4 pt-2">
        <Button
          className="h-16 gap-2 rounded-2xl px-10 text-xl"
          onClick={() => onContinue(text)}
          size="lg"
          type="button"
        >
          <Sparkles className="size-5" />
          {m.aventure.cestParti}
        </Button>
        <Button
          className="h-14 rounded-2xl px-8 text-lg text-muted-foreground"
          onClick={() => onContinue("")}
          type="button"
          variant="ghost"
        >
          {m.aventure.passer}
        </Button>
      </div>
    </div>
  );
}
