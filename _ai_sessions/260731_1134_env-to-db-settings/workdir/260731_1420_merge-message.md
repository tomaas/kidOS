# Merge message proposé (squash/merge de settings-ui/env-to-db-260731 → settings-ui-integration)

feat: les réglages passent de l'env à la base — page /parents/reglages (v0.6.0.0)

Les clés (Anthropic/Gemini/ElevenLabs), modèles, toggles image/TTS,
résolution, fournisseur de voix et la marque de l'atelier (prénom + 3
overrides) deviennent des réglages en base (`app_settings`), gérés sur la
nouvelle page /parents/reglages (fr/en). L'env devient le « réglage du
déploiement » (fallback) ; la précédence est base > env > défaut du code.

- Service central `src/server/app-config.ts` (choke-point unique, sans
  cache) : UN instantané `getAppConfig()` par opération serveur, propagé
  aux providers en paramètre ; parsing DB invalid-means-fallback ;
  écrivains centraux `setSetting`/`applySettingsPatch` (patch au niveau
  champ, une transaction db.batch) ; import de ~/server/db lazy uniquement.
- Validation de boot INFRA-ONLY : plus aucune clé requise au démarrage
  (DATABASE_URL reste fatal) ; clé absente = statut calme côté parent,
  soft-fail « On réessaie ? » côté enfant, zéro appel réseau.
- Secrets : jamais renvoyés au client ({configured, hint, source}) ;
  quatre opérations — conserver / définir / Effacer (masque explicite,
  ligne "") / Revenir au réglage du déploiement (suppression de ligne).
- Marque runtime : composeBranding pur, loader racine {locale, branding,
  brandingSource} ; renommer l'enfant sans rebuild Docker ; le colophon et
  le titre de repli suivent la langue de l'HISTOIRE ; VITE_* legacy en
  secours (Dockerfile ARG→ENV).
- Nouveau golden `test:settings` (47 assertions) ajouté à la chaîne :
  précédence, quatre opérations secret, frontière server-fn RÉELLE (serveur
  dev éphémère : réponses RPC + page SSR scannées sur le fil — aucun secret
  ne sort), concurrence réelle deux processus, rollback SQL réel dans
  db.batch ; pin test:db ajouté (boot sans clé) ; prompts/schémas
  byte-identiques. Trouvé par le golden de concurrence et corrigé :
  busy_timeout avant journal_mode=WAL dans db/index.ts (un second processus
  bootant pendant une écriture crashait SQLITE_BUSY).
- Docs : README premier-démarrage-sans-clé, .env.example infra-first,
  CLAUDE.md (bullets Settings service + Branding runtime), CHANGELOG
  0.6.0.0, TODOS (retrait du fallback VITE_* plus tard).

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
