// MV3 service worker. Wakes on tab events, paints the toolbar badge green
// when the active tab has any privy:* localStorage key, clears it otherwise.
// Top-level listener registrations must be synchronous at module load —
// Chrome only wakes the worker for events whose listeners were registered
// at the top level. Async work happens inside the handlers.

const BADGE_GREEN = "#22c55e";
const BADGE_TEXT = " ";

async function paintBadge(
  tabId: number,
  knownTab?: chrome.tabs.Tab,
): Promise<void> {
  // Best-effort URL guard: if we have it and it's clearly not http(s), skip
  // the executeScript round-trip. Without "tabs" permission, knownTab.url is
  // undefined — fall through and let executeScript reject privileged pages.
  if (knownTab?.url && !/^https?:/.test(knownTab.url)) {
    await clearBadge(tabId);
    return;
  }
  try {
    const [injection] = await chrome.scripting.executeScript({
      target: { tabId },
      world: "MAIN",
      // Inlined check — mirrors hasPrivyKeys() in src/parser.ts. The injected
      // func runs in MAIN world and cannot import.
      func: () => {
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && k.startsWith("privy:")) return true;
        }
        return false;
      },
    });
    if (injection?.result) {
      await chrome.action.setBadgeBackgroundColor({
        tabId,
        color: BADGE_GREEN,
      });
      await chrome.action.setBadgeText({ tabId, text: BADGE_TEXT });
    } else {
      await clearBadge(tabId);
    }
  } catch {
    // executeScript rejects on chrome://, file://, the Web Store, etc.
    // and on tabs that closed between event fire and call.
    await clearBadge(tabId);
  }
}

async function clearBadge(tabId: number): Promise<void> {
  try {
    await chrome.action.setBadgeText({ tabId, text: "" });
  } catch {
    // tab may have closed; ignore
  }
}

chrome.tabs.onActivated.addListener(({ tabId }) => {
  void paintBadge(tabId);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete") {
    void paintBadge(tabId, tab);
  }
});
