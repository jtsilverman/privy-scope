import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parsePrivyState } from "./parser";

function makeJwt(
  header: Record<string, unknown>,
  payload: Record<string, unknown>,
): string {
  const enc = (obj: object): string =>
    Buffer.from(JSON.stringify(obj)).toString("base64url");
  return `${enc(header)}.${enc(payload)}.dummy-signature`;
}

const PINNED_NOW = new Date("2026-05-06T12:00:00Z");
const PINNED_NOW_SEC = Math.floor(PINNED_NOW.getTime() / 1000);
const APP_ID = "cmordjr26008u0cl5hnlzcqk6";
const DID = "did:privy:cmorjbben001x0cl5abcdef123";

describe("parsePrivyState", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(PINNED_NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("parses a full Privy localStorage state with a valid token", () => {
    const validToken = makeJwt(
      { alg: "ES256", typ: "JWT" },
      {
        sub: DID,
        iss: "privy.io",
        aud: APP_ID,
        iat: PINNED_NOW_SEC,
        exp: PINNED_NOW_SEC + 3600,
      },
    );

    const ls: Record<string, string> = {
      "privy:caid": "some-anonymous-id",
      [`privy:${APP_ID}:recent-login-method`]: "email",
      "privy:connections": "[]",
      "privy:pat": "pat-value",
      "privy:refresh_token": "opaque-refresh",
      [`privy:sent:${APP_ID}:4632895106030933`]: "1",
      "privy:token": validToken,
    };

    const out = parsePrivyState(ls);

    expect(out.user.did).toBe(DID);
    expect(out.token.raw).toBe(validToken);
    expect(out.token.header).toMatchObject({ alg: "ES256", typ: "JWT" });
    expect(out.token.payload).toMatchObject({
      sub: DID,
      iss: "privy.io",
      aud: APP_ID,
    });
    expect(out.token.expiresAt).toBe(PINNED_NOW_SEC + 3600);
    expect(out.token.isExpired).toBe(false);
    expect(out.rawKeys).toEqual([
      "privy:caid",
      `privy:${APP_ID}:recent-login-method`,
      "privy:connections",
      "privy:pat",
      "privy:refresh_token",
      `privy:sent:${APP_ID}:4632895106030933`,
      "privy:token",
    ]);
  });

  it("flags an expired token", () => {
    const expiredToken = makeJwt(
      { alg: "ES256", typ: "JWT" },
      {
        sub: DID,
        iat: PINNED_NOW_SEC - 7200,
        exp: PINNED_NOW_SEC - 3600,
      },
    );

    const ls: Record<string, string> = { "privy:token": expiredToken };

    const out = parsePrivyState(ls);

    expect(out.token.expiresAt).toBe(PINNED_NOW_SEC - 3600);
    expect(out.token.isExpired).toBe(true);
    expect(out.user.did).toBe(DID);
  });

  it("unwraps a JSON-stringified token (Privy's localStorage shape)", () => {
    const validToken = makeJwt(
      { alg: "ES256", typ: "JWT", kid: "some-kid" },
      {
        sub: DID,
        iss: "privy.io",
        aud: APP_ID,
        iat: PINNED_NOW_SEC,
        exp: PINNED_NOW_SEC + 3600,
      },
    );

    const ls: Record<string, string> = {
      "privy:token": JSON.stringify(validToken),
    };

    const out = parsePrivyState(ls);

    expect(out.token.header).toMatchObject({ alg: "ES256", typ: "JWT" });
    expect(out.token.raw).toBe(validToken);
    expect(out.token.expiresAt).toBe(PINNED_NOW_SEC + 3600);
    expect(out.user.did).toBe(DID);
  });

  it("handles missing Privy state", () => {
    const out = parsePrivyState({});

    expect(out.user.did).toBeNull();
    expect(out.user.email).toBeNull();
    expect(out.user.linkedAccounts).toEqual([]);
    expect(out.wallet.address).toBeNull();
    expect(out.token.raw).toBeNull();
    expect(out.token.header).toBeNull();
    expect(out.token.payload).toBeNull();
    expect(out.token.expiresAt).toBeNull();
    expect(out.token.isExpired).toBe(false);
    expect(out.rawKeys).toEqual([]);
  });
});
