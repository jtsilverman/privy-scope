# Build and load

## Set up and build

```
npm install
npm run build         # emits dist/
```

Load `dist/`, not the repo root. The root has no `background.js` and no bundled popup script.

## Load the extension

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked** and select the `dist/` folder.
4. Pin the extension to the toolbar, so the badge stays visible.

## Reload after a change

```
npm run build
```

Then, at `chrome://extensions`, click the reload arrow on the Privy DevTools card. Chrome does not
watch `dist/`, so a rebuild alone changes nothing in the running browser.

Reloading the extension resets the service worker. The badge repaints on the next tab activation or
page load, not immediately.

`npm run dev` starts a Vite dev server. It is useful for iterating on popup markup in a normal tab,
and it cannot exercise anything that calls `chrome.*`. Real verification is always the loaded build.

## Run the checks

```
npm test              # Vitest, the parser suite
npm run test:watch
npm run typecheck     # tsc --noEmit
```

Both are offline and need no browser.

## Verify the two surfaces by hand

The parser has tests; the two Chrome surfaces do not. Drive them.

**Popup.** Open a site with an active Privy session and click the extension.

1. The User card shows a DID. Email shows an em-dash, by design.
2. The Wallet card shows an address when the session has an embedded wallet.
3. The Token card shows the alg, the expiry, and a valid-or-expired status.
4. The Raw keys card lists every `privy:*` key, sorted.
5. **Copy debug bundle** writes the parsed state to the clipboard as JSON.

**Badge.** Watch the toolbar icon.

| Do this | Expect |
|---|---|
| Switch to a tab with Privy state | The badge turns green |
| Switch to a tab without it | The badge clears |
| Open `chrome://extensions` or a `file://` URL | The badge clears. `executeScript` rejects on privileged pages and the catch clears it |
| Reload a Privy page | The badge repaints on `status === "complete"` |

## Debug the service worker

At `chrome://extensions`, the Privy DevTools card has a **service worker** link. Click it to open a
DevTools window on the worker.

The worker is killed when idle, so an open console goes quiet between events. That is normal. Switch
tabs to wake it.

If the badge never paints:

| Check | How |
|---|---|
| The worker is registered | The card shows a **service worker** link. No link means the manifest's `background.service_worker` path is wrong |
| `dist/background.js` exists and is unhashed | `ls dist/background.js`. A hashed name means the `entryFileNames` special case in `vite.config.ts` was lost |
| The listeners registered | They must be at module top level. Chrome does not wake a worker for a listener added inside an async function |
| The page really has Privy state | In the page's own console, `Object.keys(localStorage).filter(k => k.startsWith("privy:"))` |

## Publishing

Not set up. The root README's Non-goals section lists a Chrome Web Store publish as out of scope,
along with a DevTools panel, live SDK event listening, network filtering, and a Firefox port.
