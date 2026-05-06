import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { type ParsedPrivyState, parsePrivyState } from "./parser";

type FetchState =
  | { status: "loading" }
  | { status: "no-tab" }
  | { status: "unsupported-url"; url: string | undefined }
  | { status: "exec-failed"; message: string }
  | { status: "ok"; parsed: ParsedPrivyState };

async function fetchPrivyState(): Promise<FetchState> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || tab.id === undefined) return { status: "no-tab" };
  if (!/^https?:/.test(tab.url || "")) {
    return { status: "unsupported-url", url: tab.url };
  }
  try {
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      world: "MAIN",
      func: () => {
        const out: Record<string, string> = {};
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && k.startsWith("privy:")) {
            const v = localStorage.getItem(k);
            if (v !== null) out[k] = v;
          }
        }
        return out;
      },
    });
    return {
      status: "ok",
      parsed: parsePrivyState((result as Record<string, string>) || {}),
    };
  } catch (e) {
    return { status: "exec-failed", message: String(e) };
  }
}

function formatTime(secs: number): string {
  const d = new Date(secs * 1000);
  return d.toISOString().replace("T", " ").replace(/\.\d{3}Z$/, "Z");
}

function Card(props: { title: string; children: React.ReactNode }) {
  return (
    <section className="card">
      <h2>{props.title}</h2>
      {props.children}
    </section>
  );
}

function Row(props: { label: string; value: React.ReactNode }) {
  return (
    <div className="row">
      <span className="label">{props.label}</span>
      <span className="value">{props.value}</span>
    </div>
  );
}

function dash(v: string | null | undefined): React.ReactNode {
  return v ? v : <em className="dim">—</em>;
}

function Popup() {
  const [state, setState] = useState<FetchState>({ status: "loading" });
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetchPrivyState().then(setState);
  }, []);

  if (state.status === "loading") {
    return <p className="message">Loading…</p>;
  }
  if (state.status === "no-tab") {
    return <p className="message">no active tab</p>;
  }
  if (state.status === "unsupported-url") {
    return (
      <p className="message">
        cannot read this page ({state.url || "unknown URL"})
      </p>
    );
  }
  if (state.status === "exec-failed") {
    return <p className="message">read failed: {state.message}</p>;
  }

  const { parsed } = state;

  if (parsed.rawKeys.length === 0) {
    return <p className="message">no Privy state on this page.</p>;
  }

  const onCopy = async () => {
    const bundle = JSON.stringify(parsed, null, 2);
    try {
      await navigator.clipboard.writeText(bundle);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard might be denied; ignore silently for now
    }
  };

  const tokenStatus = !parsed.token.raw
    ? "absent"
    : parsed.token.isExpired
      ? "expired"
      : "valid";

  return (
    <main>
      <header className="header">
        <h1>Privy DevTools</h1>
        <button className="copy" onClick={onCopy}>
          {copied ? "Copied" : "Copy debug bundle"}
        </button>
      </header>

      <Card title="User">
        <Row label="DID" value={dash(parsed.user.did)} />
        <Row label="Email" value={dash(parsed.user.email)} />
        <Row
          label="Linked accounts"
          value={
            parsed.user.linkedAccounts.length
              ? parsed.user.linkedAccounts.join(", ")
              : dash(null)
          }
        />
      </Card>

      <Card title="Wallet">
        <Row label="Address" value={dash(parsed.wallet.address)} />
      </Card>

      <Card title="Token">
        <Row label="Status" value={tokenStatus} />
        <Row
          label="alg"
          value={dash(
            parsed.token.header
              ? String(parsed.token.header.alg ?? "")
              : null,
          )}
        />
        <Row
          label="Expires"
          value={
            parsed.token.expiresAt !== null
              ? formatTime(parsed.token.expiresAt)
              : dash(null)
          }
        />
      </Card>

      <Card title={`Raw keys (${parsed.rawKeys.length})`}>
        <ul className="keys">
          {parsed.rawKeys.map((k) => (
            <li key={k}>{k}</li>
          ))}
        </ul>
      </Card>
    </main>
  );
}

const el = document.getElementById("root");
if (el) createRoot(el).render(<Popup />);
