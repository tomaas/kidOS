# Runtime QA — real-browser pass over the refactored surfaces (2026-07-23 19:42)

## Exec summary

**ALL SECTIONS A–F PASS.** The behavior-preserving refactor holds at runtime:
desktop grammar, window drag/clamp/commit/re-center, the full serie-session
lifecycle (start, per-family persistence, mid-série resume with digit intact,
reposer, end-of-série 🌿 purge), the legacy `calcul:serie` bridge, /data/$
media read-back, and the calm constraint. **Zero anomalies attributable to the
branch.** Two environment findings (not bugs): dev checkout has an empty
`data/media/` while sharing the prod Turso DB, so prod-generated illustrations
404 in dev until the file exists locally; and the t3-code preview tooling was
half-broken (snapshot/click/press unusable), so the pass was driven via
`preview_evaluate` with synthetic DOM/pointer events — functional coverage is
complete but there are **no PNG screenshots** as evidence, and drag fidelity
is synthetic-pointer-event level, not trusted-input level.

Setup note: port 3009 was held by the **production** Docker stack
(`look-i-can-read-ts`, loopback). It was left untouched; the dev server ran on
port 3010 (`bun run vite --port 3010 --host`) against the branch working tree,
and was stopped at the end (prod still answers 200).

## Tooling degradation (blocker-adjacent, disclosed)

- `preview_snapshot`: fails on every call ("Preview snapshot failed"), all tabs.
- `preview_click`: times out after 15s AND permanently wedges the tab (all
  subsequent calls on that tab time out). Two tabs lost this way.
- `preview_press`: returns a malformed MCP result and does not deliver the key.
- `preview_wait_for`: malformed MCP result (non-fatal, tab survives).
- `preview_open`, `preview_status`, `preview_navigate`, `preview_evaluate`:
  work reliably.
- Consequence: every interaction was performed via `preview_evaluate`
  (`el.click()`, synthetic `dblclick`/`keydown`/`PointerEvent` sequences).
  These exercise the real React/dnd-kit handlers (dnd-kit does not check
  `isTrusted`) but are not OS-level trusted input. Evidence below is DOM/state
  readouts instead of screenshots.

## A. Desktop — PASS

- Fresh profile → portrait ritual (🦊 / Arsène / Entrer), `bureau:session`
  absent. Clicking Entrer writes `{"ouverte":true,"v":1}` and reveals the
  desktop: exactly 3 icons (Histoires, Calculs, Bibliothèque) + the "Ranger le
  bureau" ritual button. Nothing else.
- Single click on Calculs: URL stays `/`, icon gets selection visuals only
  (`scale-[1.04] ring-4 ring-accent-foreground/25`). No open. ✓
- Double-click on Calculs → `/calcul` opens in the window. ✓
- Enter on a focused icon (synthetic keydown) → `/bibliotheque` opens. ✓
- No "Ouvrir" fallback button anywhere. ✓
- Bonus: "Ranger le bureau" removes `bureau:session` and returns the portrait.
- Bonus: with the session closed, direct navigation to `/calcul` renders the
  gate as an optimistic overlay (`fixed inset-0 z-50`, covers the content —
  verified via `elementFromPoint`), matching the two-place gate contract.

## B. Window frame — PASS (incl. the reclampCommitted surface)

Viewport 1280×800; window 1088×680 at (96,60) = 85vw/85vh, CSS-centered
(`style` attribute null).

- Drag by title bar (+300,+200 requested, synthetic pointer events on the
  `.cursor-grab` activator, moves dispatched on `document`):
  - MID-drag: `transform: matrix(1,0,0,1,250,200)` — transform exists only in
    flight. ✓
  - After release: inline `left: 192px; top: 260px`, `transform: none` —
    committed in left/top, **no lingering transform**. ✓
  - x clamped 396→192 = `viewport.width − fenetre.width`, exactly
    `clampFenetrePosition`'s bound. ✓
- Extreme drag (−800,+1200): committed at `(0, 744)`; 744+56 = 800 → the title
  bar is exactly fully visible at the bottom edge. Title bar can never leave
  the viewport. ✓
- Close (X → Link to `/`) then reopen via dblclick: window back at (96,60)
  with `style=null` → re-centered by CSS, no persisted position. ✓
- Note: content DID move mid-drag (rect left 346 during flight) — the drag is
  real, not just cosmetic.

## C. /calcul serie-session lifecycle — PASS (the refactor's core)

- Shelf: exactly 3 trays (all 3 families activated in `math_skills`), phrases
  "Arsène ramasse des feuilles +" / "Arsène en donne à Zaichik −" / "Arsène
  remplit des sacs ×". No palier/level visible, no greyed tray, aria-labels
  "Prendre le plateau des …". (The DOM has a second zero-width tray set — a
  responsive <sm layout, not a duplicate window.) `calcul:settings` cache
  written. ✓
- Take addition tray → série starts immediately; `calcul:serie:addition`
  written at take: palier `add-retenue`, seed 269293105, fingerprint
  `addition:58:55|addition:61:72|addition:29:45`, 3 ops. Énoncé "Arsène pose
  58 pommes, Zaichik en pose 55 à côté." ✓
- Numpad tap path: select units cell → tap 3 → cell shows "3" AND
  localStorage `perOp[0].entries.result === [null,null,"3"]` (every stroke
  persisted). ✓
- **Reload mid-série** → lands on the shelf; addition tray aria becomes
  "Prendre le plateau des additions — série en cours" (full resumable
  predicate, not key-existence). Re-take → SAME operation 58+55, digit "3"
  intact in the units cell. Fingerprint/seed unchanged → identical
  regeneration verified end-to-end. ✓
- "Reposer le plateau" (the only back arrow, exists only in-série) → shelf;
  série still saved with the digit. ✓
- Full série completed (113 / 133 / 74): each op ends in a self-comparison
  (written row shown beside the solved row — no verdict, no red), "Plateau
  suivant" between ops, last op offers "Ranger l'atelier" → **🌿 "L'atelier
  est rangé."** transition → auto-return to the shelf; per-family key purged
  (null). ✓
- No error, no alert, no red state visible at any point. ✓

## D. Legacy bridge — PASS (faithful shape, derived from code)

Legacy shape derived from `bridgeLegacySerie` (src/lib/operations/settings.ts:
requires `palierId` string + `perOp` array; `famille` derived from
`familleOfPalier`): I took the REAL captured per-family state (index 0, digit
"3", seed 269293105) and removed its `famille` field — exactly what a
pre-shelf row was.

- Cleared all `calcul:serie:*` keys, planted the legacy value under
  `calcul:serie`, reloaded `/calcul`.
- Result: `calcul:serie` **gone**, `calcul:serie:addition` **present** with
  `famille:"addition"` added and the digit preserved; shelf shows "— série en
  cours"; no visible error. One-shot migration confirmed in a real browser. ✓

## E. /bibliotheque + /data/$ media — PASS (with an environment finding)

- Opens in its window (via Enter on the icon); ~20 stories listed. Story
  `story_hxArIsZ1Qpdin0XL` ("Les pétales du mont Fuji") renders its 3
  paragraphs, 2 choice buttons, and the reading-aids toggles (Lettres muettes
  / Liaisons / Lettres attachées) inside the "Histoires" window. ✓
- **Environment finding (not a branch bug)**: the illustration
  `/data/media/img_8Aq6GFeyzwRF2XZ9.jpg` 404'd in dev — the file lives in the
  prod Docker volume (prod serves it 200, 1 175 735 bytes) while the dev
  checkout's `data/media/` was empty; both envs share the same Turso DB. The
  route 404s a missing file cleanly (calm fallback, no broken-image error
  shown prominently). After `docker cp`-ing the file into dev `data/media/`,
  dev serves it **200 image/jpeg, byte-identical size**, and the story page
  renders it at 1200×896. `/data/$` read-back exercised positively. ✓
- Live escape probes: `/data/media/../../.env` → **403**; percent-encoded
  variant → **404**. Never serves outside the media dir. ✓
- TTS audio: **N/A** — `TTS_ENABLED` defaults false and is unset in both
  envs; the prod volume contains only 2 images, zero audio files; no story has
  a listen control. Nothing generated (no LLM/TTS/image calls made). ✓

## F. Calm scan — PASS

Regex scan (`score|minuteur|chrono|timer|bravo|gagné|perdu|récompense|niveau|
débloqu|progrès|progression|%|quiz|évaluation|erreur|faux|félicitations`)
over the rendered text of every visited screen: portrait, desktop, shelf,
série, comparison, 🌿 end screen, bibliothèque, story page → **zero hits**.
All wording observed is calm and stake-free ("J'ai fini, je compare",
"Plateau suivant", "Ranger l'atelier", "L'atelier est rangé.", "Reposer le
plateau", "Ranger le bureau"). ✓

## Residue / cleanup

- Dev server on 3010 stopped (connection refused); prod on 3009 untouched
  (still 200).
- `data/media/img_8Aq6GFeyzwRF2XZ9.jpg` copied into the dev checkout
  (gitignored dir) — left in place; it makes dev render prod stories'
  illustrations. Remove if unwanted.
- Browser localStorage left with session closed and no série keys (clean
  child state).
- No git commands were run; working tree untouched except this report and the
  gitignored media file.
