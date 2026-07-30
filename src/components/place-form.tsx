import { useState } from "react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { useMessages } from "~/lib/i18n";
import type { DbPlace } from "~/server/db/schema";

export interface PlaceFormValues {
  emoji?: string;
  imagePath?: string;
  label: string;
  promptHint: string;
}

interface PlaceFormProps {
  // Undefined = a new place; a row = editing it.
  initial?: DbPlace;
  onCancel: () => void;
  onSubmit: (values: PlaceFormValues) => void | Promise<void>;
}

// Nudge the shared UI defaults (14px on desktop) up one step so the parent tool
// reads as part of the app: text-base labels + md:text-base fields.
const LABEL_CLASS = "text-base";
const FIELD_CLASS = "md:text-base";

/**
 * Add / edit form for a place. Plain, utilitarian, calm. `label` + `promptHint`
 * are required (mirrors the server Zod). Emoji + image path are optional; image
 * UPLOAD is out of scope (a manual path string only).
 */
export function PlaceForm({ initial, onSubmit, onCancel }: PlaceFormProps) {
  const m = useMessages();
  const [label, setLabel] = useState(initial?.label ?? "");
  const [emoji, setEmoji] = useState(initial?.emoji ?? "");
  const [imagePath, setImagePath] = useState(initial?.imagePath ?? "");
  const [promptHint, setPromptHint] = useState(initial?.promptHint ?? "");
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = label.trim().length > 0 && promptHint.trim().length > 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || submitting) {
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit({
        emoji: emoji.trim() || undefined,
        imagePath: imagePath.trim() || undefined,
        label: label.trim(),
        promptHint: promptHint.trim(),
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      className="space-y-4 rounded-2xl border bg-card p-5"
      onSubmit={handleSubmit}
    >
      <div className="space-y-2">
        <Label className={LABEL_CLASS} htmlFor="place-label">
          {m.parents.formulaires.nom}
        </Label>
        <Input
          className={FIELD_CLASS}
          id="place-label"
          onChange={(e) => setLabel(e.target.value)}
          placeholder={m.parents.formulaires.placeholders.lieu.nom}
          value={label}
        />
      </div>

      <div className="space-y-2">
        <Label className={LABEL_CLASS} htmlFor="place-emoji">
          {m.parents.formulaires.emoji}
        </Label>
        <Input
          className={`w-24 ${FIELD_CLASS}`}
          id="place-emoji"
          maxLength={8}
          onChange={(e) => setEmoji(e.target.value)}
          placeholder="🌻"
          value={emoji}
        />
      </div>

      <div className="space-y-2">
        <Label className={LABEL_CLASS} htmlFor="place-hint">
          {m.parents.formulaires.descriptionHistoire}
        </Label>
        <Textarea
          className={`min-h-24 ${FIELD_CLASS}`}
          id="place-hint"
          onChange={(e) => setPromptHint(e.target.value)}
          placeholder={
            m.parents.formulaires.placeholders.lieu.descriptionHistoire
          }
          value={promptHint}
        />
      </div>

      <div className="space-y-2">
        <Label className={LABEL_CLASS} htmlFor="place-image">
          {m.parents.formulaires.cheminImage}
        </Label>
        <Input
          className={FIELD_CLASS}
          id="place-image"
          onChange={(e) => setImagePath(e.target.value)}
          placeholder={m.parents.formulaires.placeholders.vide}
          value={imagePath}
        />
      </div>

      <div className="flex gap-2 pt-2">
        <Button disabled={!canSubmit || submitting} type="submit">
          {initial
            ? m.parents.formulaires.enregistrer
            : m.parents.formulaires.ajouter}
        </Button>
        <Button onClick={onCancel} type="button" variant="ghost">
          {m.parents.formulaires.annuler}
        </Button>
      </div>
    </form>
  );
}
