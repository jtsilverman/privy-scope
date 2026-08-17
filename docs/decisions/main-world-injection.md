# The read runs in the MAIN world

**Picked:** both surfaces read the page through
`chrome.scripting.executeScript({ target: { tabId }, world: "MAIN" })`.

**Rejected:** a default content script.

**Reason:** a content script runs in an isolated world, sandboxed from the page. It shares the DOM
and not the JavaScript context, and the page's own `localStorage` is on the far side of that
boundary. Reading `privy:*` keys requires the MAIN-world opt-in. There is no way around it and no
cheaper option.

**What this constrains:**

- **An injected function cannot import.** `executeScript` serializes the function and runs it in the
  page, with no access to the extension bundle. The presence check inside `paintBadge` in
  `src/background.ts` therefore duplicates `hasPrivyKeys` from `src/parser.ts`, inlined, with a
  comment naming the original. Changing the `privy:` prefix means changing both.
- **The call rejects on privileged pages.** `chrome://`, `file://`, and the Chrome Web Store all
  refuse injection. `paintBadge` wraps the call in a try and clears the badge in the catch, which
  also covers a tab that closed between the event firing and the call.
- **The URL guard is best-effort.** Without the `tabs` permission, `tab.url` is often undefined. The
  guard skips the round-trip when it does have a non-`http(s)` URL, and otherwise lets
  `executeScript` do the rejecting. Do not tighten the guard by adding `tabs`; the permission budget
  is the point.

**The permission budget.** `activeTab` and `scripting`, nothing else. `activeTab` grants access to
the current tab on user action, which is what a click-to-inspect tool needs.

**What would reopen it:** Chrome exposing page `localStorage` to an isolated world, which would
remove the reason. Nothing on the platform suggests that.
