import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { Home } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { formatMessage, useMessages } from "~/lib/i18n";
import type {
  AppSettingsStatus,
  SecretStatus,
  SettingKey,
} from "~/server/app-config";
import {
  getAppSettingsStatusFn,
  saveAppSettingsFn,
} from "~/server/settings-functions";

export const Route = createFileRoute("/parents/reglages")({
  component: ParentsReglagesPage,
  loader: () => getAppSettingsStatusFn(),
});

/** Une opération du patch — le miroir client du SettingPatchOp serveur
 * (types importés en type-only : aucun code serveur dans le bundle). */
type Operation =
  | { key: SettingKey; op: "set"; value: string }
  | { key: SettingKey; op: "delete" };

type EtatEnregistrement =
  | "repos"
  | "enregistrement"
  | "enregistre"
  | "impossible";

/**
 * Page parent (URL-only, jamais liée depuis le flux enfant) : les réglages
 * de l'atelier — clés, modèles, images, voix — posés en base (app_settings),
 * avec l'env du déploiement en secours. Chaque section enregistre un PATCH
 * de ses seuls champs modifiés (une transaction serveur) : deux onglets sur
 * des sections différentes ne s'écrasent jamais.
 *
 * Contrainte calme : page parent, états neutres (« non configurée » n'est
 * jamais une urgence), aucun rouge, aucune validation harcelante. Les
 * SECRETS ne redescendent jamais : le serveur ne renvoie que
 * {configured, hint}. Quatre opérations par clé : conserver (champ vide au
 * moment d'enregistrer) / définir / Effacer (masque explicite) / Revenir au
 * réglage du déploiement.
 */
function ParentsReglagesPage() {
  const m = useMessages();
  const status = Route.useLoaderData();

  return (
    <div className="mx-auto w-full max-w-3xl space-y-8">
      <div>
        <Button
          className="gap-2 text-lg text-muted-foreground"
          nativeButton={false}
          render={<Link to="/" />}
          variant="ghost"
        >
          <Home className="size-5" />
          {m.commun.accueil}
        </Button>
      </div>

      <div className="space-y-2">
        <h1 className="font-bold text-3xl">{m.parents.reglages.titre}</h1>
        <p className="text-muted-foreground">{m.parents.reglages.intro}</p>
      </div>

      <SectionHistoires status={status} />
      <SectionImages status={status} />
      <SectionVoix status={status} />
    </div>
  );
}

/** Enregistrement partagé : envoie le patch, invalide le loader (l'onglet
 * qui enregistre voit l'état frais ; un AUTRE onglet converge à son prochain
 * rechargement — la frontière de cohérence documentée). */
function useEnregistrement() {
  const router = useRouter();
  const [etat, setEtat] = useState<EtatEnregistrement>("repos");

  async function enregistrer(operations: Operation[]): Promise<boolean> {
    if (operations.length === 0) {
      return true;
    }
    setEtat("enregistrement");
    const result = await saveAppSettingsFn({ data: { operations } });
    if (result.success) {
      setEtat("enregistre");
      await router.invalidate();
      return true;
    }
    setEtat("impossible");
    return false;
  }

  return { enregistrer, etat };
}

function MessageEtat({ etat }: { etat: EtatEnregistrement }) {
  const m = useMessages();
  if (etat === "enregistre") {
    return (
      <p className="text-muted-foreground text-sm">
        {m.parents.reglages.enregistre}
      </p>
    );
  }
  if (etat === "impossible") {
    return (
      <p className="text-muted-foreground text-sm">
        {m.parents.enregistrementImpossible}
      </p>
    );
  }
  return null;
}

function BadgeDefaut() {
  const m = useMessages();
  return (
    <span className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground text-xs">
      {m.parents.reglages.badgeDefaut}
    </span>
  );
}

function LigneChamp({
  badge,
  children,
  label,
}: {
  badge: boolean;
  children: ReactNode;
  label: string;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium text-sm">{label}</span>
        {badge ? <BadgeDefaut /> : null}
      </div>
      {children}
    </div>
  );
}

/**
 * Un champ SECRET : jamais la valeur — seulement « une clé est en place
 * (…xyz) » ou « aucune clé ». L'input sert uniquement à POSER une nouvelle
 * clé (vide = conserver) ; Effacer = masque explicite (la clé du
 * déploiement ne s'applique plus) ; Revenir = supprimer la ligne (la valeur
 * du déploiement reprend), proposé seulement quand une ligne existe.
 */
function ChampSecret({
  label,
  onChange,
  onEffacer,
  onRevenir,
  secret,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  onEffacer: () => void;
  onRevenir: () => void;
  secret: SecretStatus;
  value: string;
}) {
  const m = useMessages();
  const etatCle = secret.configured
    ? secret.hint
      ? formatMessage(m.parents.reglages.cleEnPlace, { indice: secret.hint })
      : m.parents.reglages.cleEnPlaceSansIndice
    : m.parents.reglages.cleNonConfiguree;

  return (
    <LigneChamp badge={secret.source === "default"} label={label}>
      <p className="text-muted-foreground text-sm">{etatCle}</p>
      <Input
        autoComplete="off"
        onChange={(event) => onChange(event.target.value)}
        placeholder={m.parents.reglages.garderCle}
        type="password"
        value={value}
      />
      <div className="flex flex-wrap gap-2">
        {secret.configured ? (
          <Button
            aria-label={formatMessage(m.parents.reglages.ariaEffacer, {
              champ: label,
            })}
            onClick={onEffacer}
            size="sm"
            variant="outline"
          >
            {m.parents.reglages.effacer}
          </Button>
        ) : null}
        {secret.source === "db" ? (
          <Button
            aria-label={formatMessage(m.parents.reglages.ariaRevenirDefaut, {
              champ: label,
            })}
            onClick={onRevenir}
            size="sm"
            variant="outline"
          >
            {m.parents.reglages.revenirDefaut}
          </Button>
        ) : null}
      </div>
    </LigneChamp>
  );
}

/** Le choix binaire calme (Activées/Désactivées…) — deux boutons, comme le
 * choix de langue de l'espace parent. */
function ChoixBinaire({
  label,
  labelActive,
  labelInactive,
  onChange,
  source,
  value,
}: {
  label: string;
  labelActive: string;
  labelInactive: string;
  onChange: (value: boolean) => void;
  source: "db" | "default";
  value: boolean;
}) {
  return (
    <LigneChamp badge={source === "default"} label={label}>
      <div className="flex gap-2">
        <Button
          onClick={() => onChange(true)}
          size="sm"
          variant={value ? "default" : "outline"}
        >
          {labelActive}
        </Button>
        <Button
          onClick={() => onChange(false)}
          size="sm"
          variant={value ? "outline" : "default"}
        >
          {labelInactive}
        </Button>
      </div>
    </LigneChamp>
  );
}

/** Un choix parmi quelques valeurs fermées (résolution, fournisseur). */
function ChoixEnum<T extends string>({
  label,
  onChange,
  options,
  source,
  value,
}: {
  label: string;
  onChange: (value: T) => void;
  options: readonly { id: T; label: string }[];
  source: "db" | "default";
  value: T;
}) {
  return (
    <LigneChamp badge={source === "default"} label={label}>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <Button
            key={option.id}
            onClick={() => onChange(option.id)}
            size="sm"
            variant={option.id === value ? "default" : "outline"}
          >
            {option.label}
          </Button>
        ))}
      </div>
    </LigneChamp>
  );
}

function CarteSection({
  children,
  description,
  emoji,
  titre,
}: {
  children: ReactNode;
  description: string;
  emoji: string;
  titre: string;
}) {
  return (
    <section className="space-y-5 rounded-2xl border bg-card p-5">
      <div className="flex items-start gap-4">
        <span aria-hidden="true" className="text-4xl leading-none">
          {emoji}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold text-xl">{titre}</h2>
          <p className="text-muted-foreground text-sm">{description}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

/* ── Sections ────────────────────────────────────────────────────────────── */

function SectionHistoires({ status }: { status: AppSettingsStatus }) {
  const m = useMessages();
  const t = m.parents.reglages.sections.histoires;
  const { enregistrer, etat } = useEnregistrement();
  const [nouvelleCle, setNouvelleCle] = useState("");
  const [modele, setModele] = useState(status.provider.storyModel.value);

  async function onEnregistrer() {
    const operations: Operation[] = [];
    if (nouvelleCle.trim() !== "") {
      operations.push({
        key: "text:anthropic-api-key",
        op: "set",
        value: nouvelleCle.trim(),
      });
    }
    if (modele !== status.provider.storyModel.value) {
      operations.push({ key: "text:story-model", op: "set", value: modele });
    }
    if (await enregistrer(operations)) {
      setNouvelleCle("");
    }
  }

  return (
    <CarteSection description={t.description} emoji="📖" titre={t.titre}>
      <ChampSecret
        label={t.cle}
        onChange={setNouvelleCle}
        onEffacer={() =>
          enregistrer([{ key: "text:anthropic-api-key", op: "set", value: "" }])
        }
        onRevenir={() =>
          enregistrer([{ key: "text:anthropic-api-key", op: "delete" }])
        }
        secret={status.provider.anthropicApiKey}
        value={nouvelleCle}
      />
      <LigneChamp
        badge={status.provider.storyModel.source === "default"}
        label={t.modele}
      >
        <Input
          onChange={(event) => setModele(event.target.value)}
          value={modele}
        />
        <p className="text-muted-foreground text-xs">
          {m.parents.reglages.champVide}
        </p>
      </LigneChamp>
      <div className="flex items-center gap-3">
        <Button disabled={etat === "enregistrement"} onClick={onEnregistrer}>
          {m.parents.reglages.enregistrer}
        </Button>
        <MessageEtat etat={etat} />
      </div>
    </CarteSection>
  );
}

function SectionImages({ status }: { status: AppSettingsStatus }) {
  const m = useMessages();
  const t = m.parents.reglages.sections.images;
  const { enregistrer, etat } = useEnregistrement();
  const [active, setActive] = useState(status.provider.imageEnabled.value);
  const [nouvelleCle, setNouvelleCle] = useState("");
  const [modele, setModele] = useState(status.provider.imageModel.value);
  const [resolution, setResolution] = useState(
    status.provider.imageResolution.value
  );

  async function onEnregistrer() {
    const operations: Operation[] = [];
    if (active !== status.provider.imageEnabled.value) {
      operations.push({
        key: "image:enabled",
        op: "set",
        value: String(active),
      });
    }
    if (nouvelleCle.trim() !== "") {
      operations.push({
        key: "image:gemini-api-key",
        op: "set",
        value: nouvelleCle.trim(),
      });
    }
    if (modele !== status.provider.imageModel.value) {
      operations.push({ key: "image:model", op: "set", value: modele });
    }
    if (resolution !== status.provider.imageResolution.value) {
      operations.push({
        key: "image:resolution",
        op: "set",
        value: resolution,
      });
    }
    if (await enregistrer(operations)) {
      setNouvelleCle("");
    }
  }

  return (
    <CarteSection description={t.description} emoji="🎨" titre={t.titre}>
      <ChoixBinaire
        label={t.etat}
        labelActive={t.activees}
        labelInactive={t.desactivees}
        onChange={setActive}
        source={status.provider.imageEnabled.source}
        value={active}
      />
      <ChampSecret
        label={t.cle}
        onChange={setNouvelleCle}
        onEffacer={() =>
          enregistrer([{ key: "image:gemini-api-key", op: "set", value: "" }])
        }
        onRevenir={() =>
          enregistrer([{ key: "image:gemini-api-key", op: "delete" }])
        }
        secret={status.provider.geminiApiKey}
        value={nouvelleCle}
      />
      <LigneChamp
        badge={status.provider.imageModel.source === "default"}
        label={t.modele}
      >
        <Input
          onChange={(event) => setModele(event.target.value)}
          value={modele}
        />
        <p className="text-muted-foreground text-xs">
          {m.parents.reglages.champVide}
        </p>
      </LigneChamp>
      <ChoixEnum
        label={t.resolution}
        onChange={setResolution}
        options={[
          { id: "512", label: "512" },
          { id: "1K", label: "1K" },
          { id: "2K", label: "2K" },
          { id: "4K", label: "4K" },
        ]}
        source={status.provider.imageResolution.source}
        value={resolution}
      />
      <div className="flex items-center gap-3">
        <Button disabled={etat === "enregistrement"} onClick={onEnregistrer}>
          {m.parents.reglages.enregistrer}
        </Button>
        <MessageEtat etat={etat} />
      </div>
    </CarteSection>
  );
}

function SectionVoix({ status }: { status: AppSettingsStatus }) {
  const m = useMessages();
  const t = m.parents.reglages.sections.voix;
  const { enregistrer, etat } = useEnregistrement();
  const [active, setActive] = useState(status.provider.ttsEnabled.value);
  const [fournisseur, setFournisseur] = useState(
    status.provider.ttsProvider.value
  );
  const [nouvelleCle, setNouvelleCle] = useState("");

  async function onEnregistrer() {
    const operations: Operation[] = [];
    if (active !== status.provider.ttsEnabled.value) {
      operations.push({ key: "tts:enabled", op: "set", value: String(active) });
    }
    if (fournisseur !== status.provider.ttsProvider.value) {
      operations.push({ key: "tts:provider", op: "set", value: fournisseur });
    }
    if (nouvelleCle.trim() !== "") {
      operations.push({
        key: "tts:elevenlabs-api-key",
        op: "set",
        value: nouvelleCle.trim(),
      });
    }
    if (await enregistrer(operations)) {
      setNouvelleCle("");
    }
  }

  return (
    <CarteSection description={t.description} emoji="🔊" titre={t.titre}>
      <ChoixBinaire
        label={t.etat}
        labelActive={t.activee}
        labelInactive={t.desactivee}
        onChange={setActive}
        source={status.provider.ttsEnabled.source}
        value={active}
      />
      <ChoixEnum
        label={t.fournisseur}
        onChange={setFournisseur}
        options={[
          { id: "edge", label: "Edge" },
          { id: "elevenlabs", label: "ElevenLabs" },
        ]}
        source={status.provider.ttsProvider.source}
        value={fournisseur}
      />
      {fournisseur === "elevenlabs" ? (
        <ChampSecret
          label={t.cle}
          onChange={setNouvelleCle}
          onEffacer={() =>
            enregistrer([
              { key: "tts:elevenlabs-api-key", op: "set", value: "" },
            ])
          }
          onRevenir={() =>
            enregistrer([{ key: "tts:elevenlabs-api-key", op: "delete" }])
          }
          secret={status.provider.elevenLabsApiKey}
          value={nouvelleCle}
        />
      ) : null}
      <div className="flex items-center gap-3">
        <Button disabled={etat === "enregistrement"} onClick={onEnregistrer}>
          {m.parents.reglages.enregistrer}
        </Button>
        <MessageEtat etat={etat} />
      </div>
    </CarteSection>
  );
}
