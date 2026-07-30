import { useState } from "react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { useMessages } from "~/lib/i18n";
import type { DbElement } from "~/server/db/schema";

export interface ElementFormValues {
  emoji?: string;
  imagePath?: string;
  label: string;
  promptHint: string;
}

interface ElementFormProps {
  // Undefined = a new element; a row = editing it.
  initial?: DbElement;
  onCancel: () => void;
  onSubmit: (values: ElementFormValues) => void | Promise<void>;
}

// Match the place form's sizing so the parent tools read identically.
const LABEL_CLASS = "text-base";
const FIELD_CLASS = "md:text-base";

/**
 * Add / edit form for an element (the "et avec quoi ?" surprise-element
 * choices). Mirrors the place form (no image-hint — elements never drive the
 * illustration). `label` + `promptHint` are required (mirrors the server Zod).
 * Emoji + image path are optional; image UPLOAD is out of scope.
 */
export function ElementForm({ initial, onSubmit, onCancel }: ElementFormProps) {
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
        <Label className={LABEL_CLASS} htmlFor="element-label">
          {m.parents.formulaires.nom}
        </Label>
        <Input
          className={FIELD_CLASS}
          id="element-label"
          onChange={(e) => setLabel(e.target.value)}
          placeholder={m.parents.formulaires.placeholders.element.nom}
          value={label}
        />
      </div>

      <div className="space-y-2">
        <Label className={LABEL_CLASS} htmlFor="element-emoji">
          {m.parents.formulaires.emoji}
        </Label>
        <Input
          className={`w-24 ${FIELD_CLASS}`}
          id="element-emoji"
          maxLength={8}
          onChange={(e) => setEmoji(e.target.value)}
          placeholder="🗝️"
          value={emoji}
        />
      </div>

      <div className="space-y-2">
        <Label className={LABEL_CLASS} htmlFor="element-hint">
          {m.parents.formulaires.descriptionHistoire}
        </Label>
        <Textarea
          className={`min-h-24 ${FIELD_CLASS}`}
          id="element-hint"
          onChange={(e) => setPromptHint(e.target.value)}
          placeholder={
            m.parents.formulaires.placeholders.element.descriptionHistoire
          }
          value={promptHint}
        />
      </div>

      <div className="space-y-2">
        <Label className={LABEL_CLASS} htmlFor="element-image">
          {m.parents.formulaires.cheminImage}
        </Label>
        <Input
          className={FIELD_CLASS}
          id="element-image"
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
