# Code and test conventions

One answer per question. A reviewer can reject a change from this file alone.

## The parser stays pure

`src/parser.ts` imports nothing, touches no Chrome API, and performs no I/O. It takes a plain
`Record<string, string>` and returns a plain object. That is what makes it testable in Vitest with no
browser and no mock.

Never import `chrome` into `parser.ts`. A change that needs a Chrome API belongs in `popup.tsx` or
`background.ts`, which call the parser rather than extend it.

## Every decode path is total

The parser never throws. A malformed input yields a null field.

| Input | Result |
|---|---|
| `privy:connections` is not valid JSON | `wallet.address` stays null |
| `privy:connections` is an empty array or has no string `address` | `wallet.address` stays null |
| `privy:token` has fewer than two dot-separated segments | `header` and `payload` are null |
| A base64url segment has an illegal pad length | That segment decodes to null |
| No `privy:*` key at all | Every field is null or empty, `rawKeys` is `[]` |

A new field follows the same shape: try, catch, leave null. The popup renders a null as an em-dash
through the `dash` helper, so a null is a designed state rather than a bug.

## Where a test goes

`src/parser.test.ts`, beside the code. Vitest, run with `npm test`. There is no separate test tree
and no `vitest.config.ts`; the tests inherit `vite.config.ts`.

Only the parser has tests, because only the parser is pure. `popup.tsx` and `background.ts` need a
real Chrome to exercise, so they are verified by loading the extension. See
`docs/runbooks/build-and-load.md`.

The ten existing cases cover full state, an expired token, a JSON-stringified token, missing state, a
wallet lift, malformed connections, an empty connections array, and three `hasPrivyKeys` edges
including the one where `privy:` appears as a substring rather than a prefix. A new parser branch
adds a case in the same shape.

## Two Chrome constraints a change must respect

**Listener registration is synchronous and top-level.** Chrome only wakes an MV3 service worker for
events whose listeners were registered at module load. Moving a
`chrome.tabs.onActivated.addListener` call inside an async function silently stops the badge from
updating. Async work goes inside the handler.

**An injected function cannot import.** `chrome.scripting.executeScript({ world: "MAIN", func })`
serializes `func` and runs it in the page. It has no access to the extension bundle. The presence
check in `background.ts` therefore duplicates `hasPrivyKeys` from `parser.ts`, with a comment saying
so. Changing the key prefix means changing both.

## The background filename is load-bearing

`manifest.json` names the service worker `background.js`. `vite.config.ts` special-cases that chunk
in `entryFileNames` so it emits unhashed. Removing the special case produces
`assets/background-<hash>.js` and the extension fails to load.

## Permissions stay minimal

`activeTab` and `scripting`. Adding a permission is a scope change, not an implementation detail;
the root README's Scope section is the contract. `background.ts` is written to work without the
`tabs` permission, which is why its URL guard is best-effort.

## The repo has two names

The GitHub repository is `jtsilverman/privy-scope`, and `git remote -v` points there. The local
checkout is `~/Documents/projects/privy-devtools`, and `package.json` still declares
`git+https://github.com/jtsilverman/privy-devtools.git`.

The rename happened on GitHub and the manifest was never updated. GitHub redirects the old URL, so
nothing is broken today and the drift stays invisible until the redirect lapses. The extension's
display name in `manifest.json` is "Privy DevTools", which is a product name and unaffected.

Point `package.json`'s `repository.url` at `privy-scope` when this file is next touched.

## Git

Commit subjects are plain imperative sentences: `Add badge service worker, lift wallet from
privy:connections`. No conventional-commit prefix.

Branch per task, Jake merges the PR. Never commit to main. Stage with `git add <file>`.

## What never lands in the repo

`.gitignore` covers `.DS_Store`, `node_modules/`, `dist/`, `.env`, `.env.local`, and `*.log`.

`.playwright-mcp/` sits untracked and is only half covered. The `*.log` pattern ignores the
`console-*.log` file inside it, and nothing matches the `page-*.yml` file or the directory entry, so
`git status` shows `?? .playwright-mcp/`. Add the directory to `.gitignore` before it gets staged by
accident.
