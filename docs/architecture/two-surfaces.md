# Two surfaces

Say it in one sentence: one pure parser reads a page's `privy:*` localStorage, and two Chrome
surfaces render it, a popup on click and a badge on tab events.

Manifest V3 Chrome extension. TypeScript, React 19, built by Vite 8. Tested with Vitest. Two
runtime dependencies, `react` and `react-dom`; everything else is a devDependency. No CI workflow.

## The parts

| File | Owns |
|---|---|
| `src/parser.ts` | `parsePrivyState(localStorage)` and `hasPrivyKeys(localStorage)`. Pure, no Chrome APIs, no I/O |
| `src/popup.tsx` | The React popup. Four cards plus a copy-debug-bundle button |
| `src/background.ts` | The MV3 service worker that paints the toolbar badge |
| `popup.html`, `popup.css` | The popup shell |
| `manifest.json` | MV3 manifest. `activeTab` and `scripting`, nothing else |
| `src/parser.test.ts` | Ten Vitest cases against the parser |

## How a read happens

Both surfaces reach the page the same way:
`chrome.scripting.executeScript({ target: { tabId }, world: "MAIN" })`.

Default content-script injection runs in an isolated world, sandboxed from the page. Reading the
page's own `localStorage` needs the MAIN-world opt-in. See
`docs/decisions/main-world-injection.md`.

The popup injects a read of the whole `privy:*` set and hands it to `parsePrivyState`. The worker
injects a one-line presence check and only needs a boolean.

## What the parser produces

`ParsedPrivyState` has four groups: `user`, `wallet`, `token`, `rawKeys`.

| Field | Source |
|---|---|
| `user.did` | The `sub` claim of the decoded `privy:token` payload |
| `wallet.address` | The first entry in `privy:connections` carrying a non-empty string `address` |
| `token.raw`, `.header`, `.payload` | `privy:token`, base64url-decoded. `privy:token` is often a JSON-stringified string, so the parser unwraps one layer before splitting on `.` |
| `token.expiresAt`, `.isExpired` | The `exp` claim, compared against `Date.now()` |
| `rawKeys` | Every key starting with `privy:`, sorted |

Every decode path is total. A malformed `privy:connections`, a token with fewer than two segments,
a bad base64 pad, or absent state all yield nulls rather than a throw.

`user.email` and `user.linkedAccounts` are declared in `ParsedPrivyState`, rendered by the popup, and
never populated by the parser. Email is a deliberate gap: Privy keeps it in the user record on their
backend, not in `localStorage`, so the User card shows an em-dash placeholder. `linkedAccounts` has
no such note anywhere; it initializes to `[]` and nothing assigns it. `parser.test.ts` asserts both
stay empty on missing state.

## The badge worker

`src/background.ts` registers two listeners at module top level, synchronously.
`chrome.tabs.onActivated` fires on a tab switch; `chrome.tabs.onUpdated` fires on
`changeInfo.status === "complete"`. Chrome only wakes a worker for events whose listeners were
registered at the top level, so the registrations cannot move inside an async function.

The worker holds no state. MV3 kills a service worker when idle, so every wake-up re-reads from
scratch.

Two guards keep it quiet. A best-effort URL check skips the `executeScript` round-trip when the tab
URL is known and not `http(s)`. Without the `tabs` permission that URL is often undefined, so the
call falls through and `executeScript` rejects on `chrome://`, `file://`, and the Web Store. Both
paths clear the badge. A tab that closed between the event firing and the call takes the same catch.

The presence check inside `paintBadge` duplicates `hasPrivyKeys` on purpose. The injected function
runs in the MAIN world and cannot import from the extension bundle, so the logic is inlined with a
comment naming the original. Changing one means changing both.

## The build

`vite build` emits into `dist/`:

| Output | Why |
|---|---|
| `dist/popup.html` and `dist/assets/popup-<hash>.js` | The popup, hashed as normal |
| `dist/background.js` | Unhashed. `manifest.json` references the service worker by name, so the filename must be stable. `vite.config.ts` special-cases the `background` chunk in `entryFileNames` |
| `dist/manifest.json` | Copied by `vite-plugin-static-copy` |

`base: "./"` makes the emitted paths relative, which is what an extension needs. Load `dist/`, never
the repo root.
