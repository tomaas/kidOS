# Look, I Can Read! 📖

A tiny web app that invents calm, illustrated, read-aloud mini-stories in
**French** where **your child is the hero**. Built as a quiet parent-and-child
reading tool for beginning readers (fin CP / début CE1, ~6–7 years old) — not
a game. No score, no timer, no rewards.

Since v0.4 the home page is a small calm desktop — "the child's own
computer", three icons and real windows (see [How it works for the
child](#how-it-works-for-the-child)). Behind the icons: the stories, a quiet
**"Poser des calculs"** workshop — column arithmetic the same calm way, with
the level always chosen by the parent, never by an algorithm — and the
library of kept stories.

The printed A5 booklet that comes out of the printer is often the real magic
moment.

> The app is bilingual — **French or English**, a parent setting at
> /parents: the desktop shell, the sums mini-app AND the generated stories
> follow it (each story keeps the language it was created in). The reading
> aids (silent letters, liaisons) are specific to French phonics and only
> appear on French stories. Docs are in English so anyone can set it up.

## Features

- **Choose-your-own-adventure stories**: the child picks a hero, a place, a
  surprise element (and optionally a comfort toy — a "doudou"), then steers the
  story beat by beat. A hidden story arc keeps the whole thing coherent, and
  the story gently winds down at the end.
- **Calm by design**: soft theme, slow animations, no stakes, no pressure. A
  strict content guard-rail keeps every beat gentle (no scary or sad terms,
  hero always named, no cliffhanger questions).
- **Reading aids** for French beginning readers: faded silent letters
  ("lettres muettes") and liaison arcs, CP-textbook style — toggleable.
- **Optional cursive mode** using a French school cursive font (see
  `public/fonts/README.md` — the font is not bundled for license reasons).
- **Illustrations** (optional): consistent characters page-to-page via
  reference images, powered by Gemini image models.
- **Read-aloud** (optional): free Edge TTS French voices, or ElevenLabs.
- **Print**: one click → a clean A5 booklet, no headers, no tech noise.
- **Library**: every kept story is saved and re-readable.
- **"Poser des calculs" workshop** (`/calcul`): the child first takes a tray
  from a small shelf — one tray per operation family the parent has prepared
  (additions, subtractions, multiplications), each with its own little
  scene — quietly rotated from one day to the next, never under the child's
  eyes — and never a level number. Then a short series of column operations the
  child writes freely on a soft numpad (tap a key, or drag the digit straight
  onto a cell), then compares with the solved version — nothing is
  marked, nothing is scored. Word problems can feature the family's hero and
  doudou ("Arsène range 24 marrons…") — template-based, no AI call, works
  even offline once the page is open.
- **Parent-chosen level**: at `/parents/calcul` the adult decides which
  operation families are on the shelf and picks each family's own palier
  (7 steps in all, from carry-free additions to column multiplications),
  plus the series size — the app never evaluates the child and never
  auto-advances.
- **Printable operation sheets**: A5 sheets of posed operations to complete
  in pencil, in the same format as the story booklets — one sheet per
  operation family, matching that family's palier.

## Make it yours

Two files to personalize (plus in-app management at `/parents`):

- `src/config/app.ts` — the app's display name and booklet footer. Prefer
  setting `VITE_CHILD_NAME=Léa` (see `.env.example`) to derive both without
  touching the code; `VITE_APP_NAME` / `VITE_APP_DESCRIPTION` /
  `VITE_STORY_LABEL` override the full strings. `VITE_CHILD_NAME` also names
  the desktop's user: the session-screen portrait is the hero whose name
  matches it (case-, accent- and d'-elision-tolerant) — no match, or no
  configured name, falls back to a soft star and the app name.
- `src/config/characters.ts` — the heroes: replace the sample kids with your
  child, siblings, friends. The default hero is pre-selected in the wizard.
  Places, surprise elements and doudous have the same kind of config files
  (`src/config/*.ts`) and can also be edited in the app at `/parents`.

## Getting started

Requirements: [Bun](https://bun.sh), an [Anthropic API
key](https://console.anthropic.com/), and a free [Turso](https://turso.tech)
database (the app is cloud-DB only; network required, no offline mode).

### 1. Create the Turso database (once)

With the Turso CLI (`brew install tursodatabase/tap/turso`, then
`turso auth login`):

```
turso db create my-stories          # create the db
turso db show --url my-stories      # print the URL  (libsql://…turso.io)
turso db tokens create my-stories   # create an access token
```

### 2. Fill `.env.local`

Copy `.env.example` to `.env.local` and paste the values:

```
ANTHROPIC_API_KEY=your-anthropic-key
DATABASE_URL=libsql://<your-db>.turso.io
TURSO_AUTH_TOKEN=your-turso-token
```

Images and voice are **disabled** by default — the app works great text-only
(only the 3 values above are required).

### 3. Install + prepare the database

```
bun install
bun run db:migrate   # creates the tables in Turso
```

### 4. Run

```
bun run dev
```

Then open **http://localhost:3009**.

For a "clean" run (no dev console):

```
bun run build
bun run start
```

## Settings (`.env.local`)

| Setting | What it does |
| --- | --- |
| `ANTHROPIC_API_KEY` | **Required.** The key that writes the stories. |
| `DATABASE_URL` | **Required.** The Turso URL (`libsql://…turso.io`). |
| `TURSO_AUTH_TOKEN` | **Required.** The Turso access token. |
| `STORY_MODEL` | The model used (fine as-is). |
| `IMAGE_ENABLED` | `true` to add illustrations (otherwise a soft color block). |
| `GEMINI_API_KEY` | The Google key, needed IF images are enabled. |
| `TTS_ENABLED` | `true` to show the "Listen" button. |
| `TTS_PROVIDER` | `edge` (free, French voices) or `elevenlabs` (premium). |
| `ELEVENLABS_API_KEY` | The key, needed IF you pick `elevenlabs`. |

Restart `bun run dev` after changing a setting.

## Deploying (Docker)

The repo ships a `Dockerfile` (multi-stage: Bun build → `node:22-slim`
runtime) and a `compose.yml`. On the deploy machine:

1. Create `.env.production` at the repo root with the runtime settings
   (same names as the table above: `ANTHROPIC_API_KEY`, `DATABASE_URL`,
   `TURSO_AUTH_TOKEN`, plus any optional image/TTS settings).
2. The `VITE_*` branding vars are baked in at **build time**. `compose.yml`
   forwards `VITE_CHILD_NAME` from a root `.env` file (Docker Compose reads
   it for `${...}` substitution); the three full-string overrides
   (`VITE_APP_NAME`, `VITE_APP_DESCRIPTION`, `VITE_STORY_LABEL`) currently
   need a `compose.override.yml` or explicit build args.
3. Run the migrations once from the checkout (`bun run db:migrate`), then:

```
bun run deploy   # = docker compose up -d --build
```

The app listens on **127.0.0.1:3009** (loopback only, on purpose) and
generated images/audio persist in the `app-data` volume. To customize the
setup for your machine, drop a `compose.override.yml` next to `compose.yml`
(gitignored) — Compose merges it automatically.

Production notes:

- **There is no authentication.** Anyone who can reach the port can generate
  stories, and each story costs real API money. Exposing the app beyond
  localhost (reverse proxy, VPN, LAN) is your deliberate choice — keep it
  private.
- Build from a working tree that contains `public/fonts/cursive.woff` if you
  use the cursive mode — the font is gitignored (license) and won't be in a
  fresh clone.
- On ephemeral filesystems (no volume), set `BLOB_READ_WRITE_TOKEN`
  (Vercel Blob) instead so generated media persists.

## How it works for the child

The app IS a small, calm computer — "the child's desktop". Opening it is a
ritual: the portrait screen (their name, their hero's face, one click — never
a password, never a failure state), then a desktop with three icons
(Stories, Sums, My library). A single click selects an icon (the label
highlights, like a real desktop); a real double-click opens it — the native
one, so the gesture transfers to the family computer (Enter works too).
Each app opens in ONE real window:
a title bar you can drag (the bar can never leave the screen), a big soft
close cross. No taskbar, no clock, no notifications, no sounds, no
multi-window — the frame itself teaches pointing, clicking, double-clicking,
dragging and closing. A discreet "Ranger le bureau" (tidy the desk) closes
the session back to the portrait; until the desk is tidied, the session
stays open on the device — reopening the app later lands straight on the
desktop, like a computer left on. The parent pages stay outside this grammar
(`/parents`, by URL only).

Inside the Stories window:

1. **Invent a story** → pick hero(es), a place, a surprise element (or hit
   "random 🎲").
2. The story writes itself (gentle animation, no progress bar).
3. Each beat ends with two big choices — the child steers the adventure.
4. At the end: **listen**, **print** (A5 booklet), or **invent another one**.
5. Every kept story lives in **My library**.

> **Printing a real booklet:** the "Print" button opens the print dialog. On
> macOS, pick "Save as PDF" (or your printer's booklet option) — the A5 layout
> is ready; the print dialog handles booklet pagination.

The **operations workshop** works the same quiet way: the child takes a tray
from a small shelf (one per operation family the parent has prepared), a
short series of posed operations begins; the child writes the digits,
compares with the solved version when ready, and the tray goes back on the
shelf at the end of the series. A series left mid-way resumes exactly where
it was — each tray remembers its own (kept on the device).

## Installing "their computer" (operator checklist)

The desktop is designed to be launched full screen from the child's own
account on the family machine. Everything below is a one-time operator
action — decide it BEFORE the evening you ship it, not during.

1. **The 5-minute launcher test FIRST (decision D21-A).** From the child's
   account, try:

   ```
   chromium --app=http://localhost:3009 --start-fullscreen
   ```

   plus a `.desktop` entry (icon + name) so it looks like their program. If
   this delivers "their computer" full screen with zero browser chrome, you
   are DONE — the PWA/manifest slice is deliberately not built unless this
   test shows it adds something the launcher doesn't.
2. **The child's user account** (this is half the product): on the server
   machine itself, `http://localhost:3009` works directly. From another
   machine, plain `http://<lan-ip>:3009` is fine for the launcher — once
   you've exposed the port beyond the default loopback-only binding (that's
   what the private `compose.override.yml` is for); only a PWA install would
   require a secure context (localhost or an https overlay).
3. **Browser**: Chromium/Chrome. VERIFY `--start-fullscreen` on the real
   machine — without it the OS title bar stays visible above our window
   (a system close button, often red). No kiosk mode: it would contradict
   learning a real computer and complicate printing.
4. **Autostart**: the Docker container must start with the server machine
   (compose restart policy) — otherwise "their computer" greets them with a
   browser error at wake-up.
5. **Printer** reachable from the child's account (story booklets and A5
   operation sheets print from inside the windows).
6. **Recovery path**: if the app doesn't answer (network, container), the
   child sees a browser error page — out of our hands. The family protocol
   ("go get a parent") IS the recovery path; naming it here is enough.
7. **Watch their first mouse session** without helping: how their hand
   clicks, double-clicks (do they manage? at what pace?), drags. Target
   sizes should copy their hands, not our idea of their hands. The
   double-click delay stays the system's — never a custom threshold. If the
   double-click turns out to be out of reach, the "Open" fallback button
   (removed 2026-07-22) comes back in one commit.

## Technical notes

- **Stack**: TanStack Start (React 19, file-based routes), Tailwind CSS v4,
  Drizzle ORM on Turso (libSQL), Vercel AI SDK (`generateObject` + Zod) with
  Anthropic for text, Gemini for images, Edge/ElevenLabs for TTS.
- **All keys and model calls live in server functions** — nothing sensitive
  ever reaches the browser.
- **Generated media** goes to local disk under `data/` (gitignored, a volume
  in Docker), served by a dedicated route — or to Vercel Blob when
  `BLOB_READ_WRITE_TOKEN` is set (for ephemeral filesystems).
- **Story safety**: a per-beat Zod schema plus validators — safety (hero
  named, narration never ends on a question, forbidden scary/sad and
  stakes-language scan) is fatal, structure (length/readability) is not —
  with up to 3 corrective retries, then a safe-text salvage; a soft "shall we
  try again?" failure otherwise.
- **The operations module** (`src/lib/operations`) is pure and deterministic:
  a seeded generator (an interrupted series regenerates identically), shared
  screen/print geometry, a descriptive palier ladder, and template word
  problems — no LLM involved. The parent's choices live in the
  `math_skills` table — one row per activated operation family, carrying
  that family's palier (and mirrored on-device so the workshop shrugs off a
  network hiccup).
- **Tests**: `bun run test` runs golden assertion scripts (prompt identity,
  coherence validators, media store, media data route, reading aids, posed
  operations, the desktop layer's pure modules, and public-URL integrity of
  the route relocation) — plain Bun, no test runner needed.

## License

[MIT](LICENSE). The optional cursive font is **not** included (personal /
educational license) — see `public/fonts/README.md`.
