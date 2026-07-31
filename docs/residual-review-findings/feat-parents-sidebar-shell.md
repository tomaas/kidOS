# Residual Review Findings — feat/parents-sidebar-shell

Source: ce-code-review run 20260731-212526-95b8c6a5 (mode:agent, base dc911b3), cross-model adversarial pass via codex (requested gpt-5.6-luna at xhigh; served model/effort unverified on this route; independence verified). All four actionable findings were applied in `fix(review)` (09cd778); nothing was deferred to a tracker.

## Settled-decision conflict (report-only by design)

- P2 — `src/components/ui/sidebar.tsx:108` — **Sidebar cookie persistence is write-only: state never restored on reload** (correctness + cross-model codex, confidence 100). The `sidebar_state` cookie is written on every toggle but nothing reads it back; a parent's collapsed preference is lost on reload. Conflicts with session-settled KTD6 in `docs/plans/2026-07-31-001-feat-parents-sidebar-shell-plan.md` (stock cookie persistence kept, no server-side cookie read, first-paint default accepted), so the behavior change stays unapplied. If persistence is ever wanted: read the request cookie in the parents route loader and pass `defaultOpen`, or drop the cookie write and its biome-ignore.

## Residual risks (informational)

- Mobile-sheet focus-return rests on Base UI Dialog defaults verified in package source, not runtime-tested.
- Vendored `sidebar.tsx` was spot-checked, not byte-diffed against the live registry output.
- Vendored files carry masked hardcoded English (`Toggle Sidebar`, the hidden close button) that surfaces only if `SidebarRail` is ever wired up.
- Print neutralization keys on literal `data-slot` strings; a slot rename would break printing with no golden failing.
- The "8 re-parented children" golden count is hardcoded, decoupled from `SECTIONS_PARENTS.length`.

## Testing gaps (informational)

- The advertised cmd/ctrl+B fold shortcut has no golden or listed smoke scenario.
- The sidebar footer contract (back-to-desktop + ⌘K hint) is prose-only, unpinned.
- No coverage of the cmd/ctrl+B listener vs focused inputs on /parents/reglages.
