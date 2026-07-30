import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { useEffect, useState } from "react";
import { CustomPromptStep } from "~/components/custom-prompt-step";
import { DoudouMultiStep } from "~/components/doudou-multi-step";
import { MultiPickStep } from "~/components/multi-pick-step";
import { PickerStep } from "~/components/picker-step";
import { Stepper } from "~/components/stepper";
import { Button } from "~/components/ui/button";
import { WizardControls } from "~/components/wizard-controls";
import { WritingAnimation } from "~/components/writing-animation";
import { characters, defaultCharacter } from "~/config/characters";
import { doudous as configDoudous } from "~/config/doudous";
import { elements as configElements } from "~/config/elements";
import { places as configPlaces } from "~/config/places";
import { pickRandomDoudouIds, toDoudouItems } from "~/lib/doudou-items";
import { pickRandomElementIds, toElementItems } from "~/lib/element-items";
import { pickRandomHeroIds, toHeroItems } from "~/lib/hero-items";
import { useLocale, useMessages } from "~/lib/i18n";
import { toPlaceItems } from "~/lib/place-items";
import { previousStep, type WizardStep } from "~/lib/wizard-steps";
import { listDoudousFn } from "~/server/doudous-functions";
import { startDynamicStoryFn } from "~/server/dynamic-functions";
import { listElementsFn } from "~/server/elements-functions";
import { listHeroesFn } from "~/server/heroes-functions";
import { listPlacesFn } from "~/server/places-functions";

// Calm-tool caps (mirror the server Zod), same as the classic parcours.
const HERO_CAP = 2;
const ELEMENT_CAP = 2;

export const Route = createFileRoute("/_bureau/aventure/")({
  component: AventurePage,
  // Same DB-backed heroes + elements + places + doudous (active lists) with
  // config fallback as the classic parcours, so the two flows stay in sync.
  loader: async () => {
    let heroItems = toHeroItems(legacyHeroConfig());
    let elementItems = toElementItems(configElements);
    let placeItems = toPlaceItems(configPlaces);
    let doudouItems = toDoudouItems(configDoudous);
    try {
      const [dbHeroes, dbElements, dbPlaces, dbDoudous] = await Promise.all([
        listHeroesFn(),
        listElementsFn(),
        listPlacesFn(),
        listDoudousFn(),
      ]);
      if (dbHeroes.length > 0) {
        heroItems = toHeroItems(dbHeroes);
      }
      if (dbElements.length > 0) {
        elementItems = toElementItems(dbElements);
      }
      if (dbPlaces.length > 0) {
        placeItems = toPlaceItems(dbPlaces);
      }
      if (dbDoudous.length > 0) {
        doudouItems = toDoudouItems(dbDoudous);
      }
    } catch {
      // fall through to config fallbacks
    }
    return { doudouItems, elementItems, heroItems, placeItems };
  },
});

// Config heroes mapped to the picker shape, used as the loader fallback.
function legacyHeroConfig() {
  return characters.map((c) => ({ emoji: c.emoji, id: c.id, label: c.name }));
}

type Step =
  | "hero"
  | "place"
  | "element"
  | "doudou"
  | "extra"
  | "writing"
  | "oops";

/** Toggle an id in a capped multi-select (drop oldest at cap). */
function toggleCapped(ids: string[], id: string, cap: number): string[] {
  if (ids.includes(id)) {
    return ids.filter((x) => x !== id);
  }
  const next = [...ids, id];
  return next.length > cap ? next.slice(next.length - cap) : next;
}

// The parcours state (current step + picks + the optional saveur) is kept in
// sessionStorage so it SURVIVES a component remount — a React Fast-Refresh/HMR
// update, an accidental refresh, a StrictMode double-mount, or any re-render
// that would otherwise reset local useState back to step 1 while the child is
// still choosing. Cleared once the story actually starts (or the tab closes).
const STORAGE_KEY = "story-aventure-parcours";

interface ParcoursState {
  customPrompt?: string;
  // Multi-select + optional — an empty array means the child brought no doudou.
  doudouIds: string[];
  elementIds: string[];
  // Heroes + elements are MULTI-select. Heroes are required (≥1, default hero).
  heroIds: string[];
  placeId?: string;
  step: Step;
}

/** Lift a possibly-legacy single id into a capped array (codex #8). Accepts the
 * new array, else a legacy single string, else the fallback. Clamps to cap. */
function liftToArray(
  arr: unknown,
  single: unknown,
  fallback: string[],
  cap: number
): string[] {
  let ids: string[] = fallback;
  if (Array.isArray(arr)) {
    ids = arr.filter((x): x is string => typeof x === "string");
  } else if (typeof single === "string") {
    ids = [single];
  }
  return ids.length > cap ? ids.slice(0, cap) : ids;
}

function readParcours(defaultHeroIds: string[]): ParcoursState {
  const fallback: ParcoursState = {
    doudouIds: [],
    elementIds: [],
    heroIds: defaultHeroIds,
    step: "hero",
  };
  if (typeof window === "undefined") {
    return fallback;
  }
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return fallback;
    }
    // Widened to tolerate LEGACY single-pick shapes (`heroId`/`elementId`/
    // `doudouId` strings) that may survive in sessionStorage from before the
    // multi-select change — lift each into a capped array (codex #8).
    const parsed = JSON.parse(raw) as Partial<ParcoursState> & {
      heroId?: string;
      elementId?: string;
      doudouId?: string;
    };
    // Never restore into a transient state (writing/oops) — resume the picker.
    const step =
      parsed.step === "place" ||
      parsed.step === "element" ||
      parsed.step === "doudou" ||
      parsed.step === "extra"
        ? parsed.step
        : "hero";
    const heroIds = liftToArray(
      parsed.heroIds,
      parsed.heroId,
      defaultHeroIds,
      HERO_CAP
    );
    const elementIds = liftToArray(
      parsed.elementIds,
      parsed.elementId,
      [],
      ELEMENT_CAP
    );
    // Doudou: prefer the array; else a legacy single; else none (no cap).
    let doudouIds: string[] = [];
    if (Array.isArray(parsed.doudouIds)) {
      doudouIds = parsed.doudouIds.filter(
        (x): x is string => typeof x === "string"
      );
    } else if (parsed.doudouId) {
      doudouIds = [parsed.doudouId];
    }
    return {
      customPrompt: parsed.customPrompt,
      doudouIds,
      elementIds,
      heroIds,
      placeId: parsed.placeId,
      step,
    };
  } catch {
    return fallback;
  }
}

function writeParcours(state: ParcoursState): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // sessionStorage unavailable (private mode etc.) — non-fatal, state is
    // simply not persisted across a remount.
  }
}

function clearParcours(): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

/**
 * The dynamic-story parcours: hero(s) → place → element(s) → (doudou facultatif)
 * → (saveur facultative), exactly like the classic one (default hero pre-selected,
 * heroes + elements multi-select cap 2). After the saveur step it starts a
 * dynamic story and hands off to the player route. Calm and linear, with the
 * same soft waiting state and gentle retry on failure.
 */
function AventurePage() {
  // La langue de l'HISTOIRE = la locale UI au moment de la création (figée
  // ensuite sur la ligne stories.lang) — le parent qui met l'atelier en
  // anglais obtient des histoires en anglais, sans étape wizard en plus.
  const locale = useLocale();
  const m = useMessages();
  const navigate = useNavigate();
  const { heroItems, elementItems, placeItems, doudouItems } =
    Route.useLoaderData();
  // The pre-selected hero must be one the PICKER shows (first DB hero, loader
  // order). The config `defaultCharacter` is only the pre-seed fallback: on an
  // established db whose heroes don't match the sample config, a config id
  // here would ride along INVISIBLY into the story (the creation path resolves
  // unknown ids against the config as a last resort).
  const defaultHeroIds = [heroItems[0]?.id ?? defaultCharacter.id];
  // Start from the SSR-safe default so the server and the client's first paint
  // agree (no hydration mismatch). The in-progress parcours is restored from
  // sessionStorage in an effect AFTER hydration — this is what survives a
  // remount (HMR/refresh/StrictMode) without resetting to step 1.
  const [step, setStep] = useState<Step>("hero");
  const [heroIds, setHeroIds] = useState<string[]>(defaultHeroIds);
  const [placeId, setPlaceId] = useState<string | undefined>(undefined);
  const [elementIds, setElementIds] = useState<string[]>([]);
  // The doudou step is MULTI-select + OPTIONAL — empty array = no doudou.
  const [doudouIds, setDoudouIds] = useState<string[]>([]);

  // Toggle helpers that ALSO persist, so a remount mid-step keeps the rings lit.
  function toggleHero(id: string) {
    const next = toggleCapped(heroIds, id, HERO_CAP);
    setHeroIds(next);
    writeParcours({
      doudouIds,
      elementIds,
      heroIds: next,
      placeId,
      step: "hero",
    });
  }
  function setHeroesPersisted(next: string[]) {
    setHeroIds(next);
    writeParcours({
      doudouIds,
      elementIds,
      heroIds: next,
      placeId,
      step: "hero",
    });
  }
  function toggleElement(id: string) {
    const next = toggleCapped(elementIds, id, ELEMENT_CAP);
    setElementIds(next);
    writeParcours({
      doudouIds,
      elementIds: next,
      heroIds,
      placeId,
      step: "element",
    });
  }
  function setElementsPersisted(next: string[]) {
    setElementIds(next);
    writeParcours({
      doudouIds,
      elementIds: next,
      heroIds,
      placeId,
      step: "element",
    });
  }
  function setDoudousPersisted(next: string[]) {
    setDoudouIds(next);
    writeParcours({
      doudouIds: next,
      elementIds,
      heroIds,
      placeId,
      step: "doudou",
    });
  }
  function toggleDoudou(id: string) {
    setDoudousPersisted(
      doudouIds.includes(id)
        ? doudouIds.filter((d) => d !== id)
        : [...doudouIds, id]
    );
  }

  // Restore the in-progress parcours once, after hydration. Restored hero ids
  // are sanitized against the CURRENT picker items — a stale draft (heroes
  // edited at /parents meanwhile, or an old config id) must never smuggle an
  // invisible hero into the story.
  useEffect(() => {
    const saved = readParcours(defaultHeroIds);
    if (saved.step !== "hero") {
      const validHeroIds = saved.heroIds.filter((id) =>
        heroItems.some((h) => h.id === id)
      );
      setStep(saved.step);
      setHeroIds(validHeroIds.length > 0 ? validHeroIds : defaultHeroIds);
      setPlaceId(saved.placeId);
      setElementIds(saved.elementIds);
      setDoudouIds(saved.doudouIds);
    }
  }, []);

  // Advance a step while persisting the picks, so a remount mid-parcours
  // resumes exactly where the child was.
  function goToPlace() {
    setStep("place");
    writeParcours({ doudouIds, elementIds, heroIds, placeId, step: "place" });
  }
  function goToElement(pickedPlaceId: string) {
    setPlaceId(pickedPlaceId);
    setStep("element");
    writeParcours({
      doudouIds,
      elementIds,
      heroIds,
      placeId: pickedPlaceId,
      step: "element",
    });
  }
  function goToDoudou() {
    setStep("doudou");
    writeParcours({ doudouIds, elementIds, heroIds, placeId, step: "doudou" });
  }
  // The doudou step advances to the saveur step, with or without doudous.
  function goToExtra(nextDoudouIds: string[]) {
    setDoudouIds(nextDoudouIds);
    setStep("extra");
    writeParcours({
      doudouIds: nextDoudouIds,
      elementIds,
      heroIds,
      placeId,
      step: "extra",
    });
  }

  // Wizard navigation (jump / back / restart). Each PERSISTS the parcours so a
  // back-nav survives a refresh too — keeping ALL picks, only the step changes.
  // The Stepper only calls onJump with a reachable step.
  function goToStep(target: WizardStep) {
    setStep(target);
    writeParcours({ doudouIds, elementIds, heroIds, placeId, step: target });
  }
  function back() {
    if (step === "writing" || step === "oops") {
      return;
    }
    const prev = previousStep(step);
    if (prev) {
      goToStep(prev);
    }
  }
  function restart() {
    const freshHeroes = defaultHeroIds;
    setHeroIds(freshHeroes);
    setPlaceId(undefined);
    setElementIds([]);
    setDoudouIds([]);
    setStep("hero");
    // Wipe the persisted parcours so a later remount also starts clean.
    clearParcours();
  }

  async function start(customPrompt: string) {
    setStep("writing");
    // The picks are locked in now — don't restore the parcours on a later mount.
    clearParcours();
    try {
      const result = await startDynamicStoryFn({
        data: {
          customPrompt: customPrompt.trim() || undefined,
          doudouIds,
          elementIds: elementIds.length > 0 ? elementIds : [elementItems[0].id],
          heroIds,
          lang: locale,
          placeId: placeId ?? placeItems[0].id,
        },
      });
      if (result.success) {
        navigate({ params: { id: result.storyId }, to: "/aventure/$id" });
        return;
      }
    } catch {
      // A rejected server fn must still land on the gentle retry, never hang
      // on the waiting feather.
    }
    setStep("oops");
  }

  if (step === "writing") {
    return <WritingAnimation />;
  }

  if (step === "oops") {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-8 text-center">
        <p aria-hidden="true" className="text-6xl">
          🌧️
        </p>
        <p className="font-semibold text-3xl">{m.aventure.onReessaie}</p>
        <Button
          className="h-14 rounded-2xl px-8 text-xl"
          onClick={() => setStep("extra")}
          size="lg"
          type="button"
        >
          {m.aventure.oui}
        </Button>
      </div>
    );
  }

  return (
    // The picker steps stay calm and centered: cap their width inside the wider
    // shell so the choices don't stretch across the whole page.
    <div className="mx-auto w-full max-w-3xl space-y-8">
      <div className="no-print">
        <Button
          className="gap-2 text-lg text-muted-foreground"
          nativeButton={false}
          render={<Link to="/" />}
          variant="ghost"
        >
          <ArrowLeft className="size-5" />
          {m.commun.accueil}
        </Button>
      </div>

      <Stepper
        current={step}
        onJump={goToStep}
        progress={{ elementIds, heroIds, placeId }}
      />
      <WizardControls
        onBack={step === "hero" ? undefined : back}
        onRestart={restart}
      />

      {step === "hero" ? (
        <MultiPickStep
          items={heroItems}
          minOne
          onContinue={goToPlace}
          onRandom={() => setHeroesPersisted(pickRandomHeroIds(heroItems))}
          onToggle={toggleHero}
          selectedIds={heroIds}
          title={m.aventure.titreHero}
        />
      ) : null}

      {step === "place" ? (
        <PickerStep
          items={placeItems}
          onPick={goToElement}
          selectedId={placeId}
          title={m.aventure.titreLieu}
        />
      ) : null}

      {step === "element" ? (
        <MultiPickStep
          items={elementItems}
          minOne
          onContinue={goToDoudou}
          onRandom={() =>
            setElementsPersisted(pickRandomElementIds(elementItems))
          }
          onToggle={toggleElement}
          selectedIds={elementIds}
          title={m.aventure.titreElement}
        />
      ) : null}

      {step === "doudou" ? (
        <DoudouMultiStep
          items={doudouItems}
          onContinue={() => goToExtra(doudouIds)}
          onRandom={() => setDoudousPersisted(pickRandomDoudouIds(doudouItems))}
          onSkip={() => goToExtra([])}
          onToggle={toggleDoudou}
          selectedIds={doudouIds}
        />
      ) : null}

      {step === "extra" ? <CustomPromptStep onContinue={start} /> : null}
    </div>
  );
}
