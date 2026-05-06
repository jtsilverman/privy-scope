async function readPrivyKeys() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.id) return { error: "no-active-tab" };

  if (!/^https?:/.test(tab.url || "")) {
    return { error: "unsupported-url", url: tab.url };
  }

  try {
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      world: "MAIN",
      func: () => {
        const out = {};
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && k.startsWith("privy:")) out[k] = localStorage.getItem(k);
        }
        return out;
      },
    });
    return { keys: result || {} };
  } catch (e) {
    return { error: "exec-failed", message: String(e) };
  }
}

function render(state) {
  const status = document.getElementById("status");
  const list = document.getElementById("keys");
  list.innerHTML = "";

  if (state.error === "unsupported-url") {
    status.textContent = `cannot read this page (${state.url || "unknown URL"})`;
    return;
  }
  if (state.error === "no-active-tab") {
    status.textContent = "no active tab";
    return;
  }
  if (state.error === "exec-failed") {
    status.textContent = `read failed: ${state.message || ""}`;
    return;
  }

  const names = Object.keys(state.keys || {});
  if (names.length === 0) {
    status.textContent = "no Privy state on this page.";
    return;
  }

  status.textContent = `found ${names.length} privy:* key${names.length === 1 ? "" : "s"}`;
  for (const name of names) {
    const li = document.createElement("li");
    li.textContent = name;
    list.appendChild(li);
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  render(await readPrivyKeys());
});
