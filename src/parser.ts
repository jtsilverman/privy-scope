export interface ParsedPrivyState {
  user: {
    did: string | null;
    email: string | null;
    linkedAccounts: string[];
  };
  wallet: {
    address: string | null;
  };
  token: {
    raw: string | null;
    header: Record<string, unknown> | null;
    payload: Record<string, unknown> | null;
    expiresAt: number | null;
    isExpired: boolean;
  };
  rawKeys: string[];
}

function decodeBase64UrlJson(part: string): Record<string, unknown> | null {
  try {
    let b64 = part.replace(/-/g, "+").replace(/_/g, "/");
    const pad = b64.length % 4;
    if (pad === 2) b64 += "==";
    else if (pad === 3) b64 += "=";
    else if (pad !== 0) return null;
    const json = atob(b64);
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function decodeJwt(token: string): {
  header: Record<string, unknown> | null;
  payload: Record<string, unknown> | null;
} {
  const parts = token.split(".");
  if (parts.length < 2) return { header: null, payload: null };
  return {
    header: decodeBase64UrlJson(parts[0]),
    payload: decodeBase64UrlJson(parts[1]),
  };
}

export function parsePrivyState(
  localStorage: Record<string, string>,
): ParsedPrivyState {
  const rawKeys = Object.keys(localStorage)
    .filter((k) => k.startsWith("privy:"))
    .sort();

  const out: ParsedPrivyState = {
    user: { did: null, email: null, linkedAccounts: [] },
    wallet: { address: null },
    token: {
      raw: null,
      header: null,
      payload: null,
      expiresAt: null,
      isExpired: false,
    },
    rawKeys,
  };

  const tokenRaw = localStorage["privy:token"];
  if (tokenRaw) {
    let tokenStr = tokenRaw;
    try {
      const unwrapped: unknown = JSON.parse(tokenRaw);
      if (typeof unwrapped === "string") tokenStr = unwrapped;
    } catch {
      // tokenRaw is not JSON-encoded; use as-is
    }
    const { header, payload } = decodeJwt(tokenStr);
    out.token.raw = tokenStr;
    out.token.header = header;
    out.token.payload = payload;
    if (payload && typeof payload.exp === "number") {
      out.token.expiresAt = payload.exp;
      out.token.isExpired = payload.exp * 1000 < Date.now();
    }
    if (payload && typeof payload.sub === "string") {
      out.user.did = payload.sub;
    }
  }
  return out;
}
