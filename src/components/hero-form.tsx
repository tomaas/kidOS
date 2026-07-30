import { useState } from "react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { useMessages } from "~/lib/i18n";
import type { DbHero } from "~/server/db/schema";

export interface HeroFormValues {
  emoji?: string;
  imageHint: string;
  imagePath?: string;
  label: string;
  promptHint: string;
}

interface HeroFormProps {
  // Undefined = a new hero; a row = editing it.
  initial?: DbHero;
  onCancel: () => void;
  onSubmit: (values: HeroFormValues) => void | Promise<void>;
}

// Match the doudou/place forms' sizing so the parent tools read identically.
const LABEL_CLASS = "text-base";
const FIELD_CLASS = "md:text-base";

/**
 * Add / edit form for a hero (the "qui est le héros ?" choices). Mirrors the
 * doudou form (it shares the image-hint field: the hero appears in the
 * illustration). `label`, `promptHint` + `imageHint` are required (mirrors the
 * server Zod). Emoji + image path are optional; image UPLOAD is out of scope.
 */
export function HeroForm({ initial, onSubmit, onCancel }: HeroFormProps) {
  const m = useMessages();
  const [label, setLabel] = useState(initial?.label ?? "");
  const [emoji, setEmoji] = useState(initial?.emoji ?? "");
  const [imagePath, setImagePath] = useState(initial?.imagePath ?? "");
  const [promptHint, setPromptHint] = useState(initial?.promptHint ?? "");
  const [imageHint, setImageHint] = useState(initial?.imageHint ?? "");
  const [submitting, setSubmitting] = useState(false);

  const canSubmit =
    label.trim().length > 0 &&
    promptHint.trim().length > 0 &&
    imageHint.trim().length > 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || submitting) {
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit({
        emoji: emoji.trim() || undefined,
        imageHint: imageHint.trim(),
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
        <Label className={LABEL_CLASS} htmlFor="hero-label">
          {m.parents.formulaires.prenom}
        </Label>
        <Input
          className={FIELD_CLASS}
          id="hero-label"
          onChange={(e) => setLabel(e.target.value)}
          placeholder={m.parents.formulaires.placeholders.hero.prenom}
          value={label}
        />
      </div>

      <div className="space-y-2">
        <Label className={LABEL_CLASS} htmlFor="hero-emoji">
          {m.parents.formulaires.emoji}
        </Label>
        <Input
          className={`w-24 ${FIELD_CLASS}`}
          id="hero-emoji"
          maxLength={8}
          onChange={(e) => setEmoji(e.target.value)}
          placeholder="🐻"
          value={emoji}
        />
      </div>

      <div className="space-y-2">
        <Label className={LABEL_CLASS} htmlFor="hero-hint">
          {m.parents.formulaires.descriptionHistoire}
        </Label>
        <Textarea
          className={`min-h-24 ${FIELD_CLASS}`}
          id="hero-hint"
          onChange={(e) => setPromptHint(e.target.value)}
          placeholder={
            m.parents.formulaires.placeholders.hero.descriptionHistoire
          }
          value={promptHint}
        />
      </div>

      <div className="space-y-2">
        <Label className={LABEL_CLASS} htmlFor="hero-image-hint">
          {m.parents.formulaires.descriptionIllustration}
        </Label>
        <Textarea
          className={`min-h-24 ${FIELD_CLASS}`}
          id="hero-image-hint"
          onChange={(e) => setImageHint(e.target.value)}
          placeholder={
            m.parents.formulaires.placeholders.hero.descriptionIllustration
          }
          value={imageHint}
        />
      </div>

      <div className="space-y-2">
        <Label className={LABEL_CLASS} htmlFor="hero-image">
          {m.parents.formulaires.cheminImage}
        </Label>
        <Input
          className={FIELD_CLASS}
          id="hero-image"
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
