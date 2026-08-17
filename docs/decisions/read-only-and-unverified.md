# Read-only, and the JWT decode is display-only

Two decisions with one shape: this is a debug surface, and a debug surface that changes the thing it
inspects is worse than no surface.

## Read-only

**Picked:** never write to `localStorage`, never make a network call, never persist anything.

**Reason:** the tool exists to answer "what is this page's Privy state right now". A write would
change the answer. A network call would send someone's session state somewhere. Persistence would
mean the popup could show a state the page no longer has.

**What this constrains:**

- The service worker holds no state between wake-ups. MV3 kills an idle worker, so every event
  re-reads from scratch. That constraint and this decision agree, which is why the worker was never
  written to cache.
- "Copy debug bundle" writes to the clipboard, which is a user action on a user surface, not a
  persistence layer.
- A feature that needs storage needs this decision revisited first, not a `chrome.storage` call
  added quietly.

## The JWT decode skips signature verification

**Picked:** decode the header and payload, report `valid` or `expired` from the `exp` claim alone.

**Rejected:** verifying the signature.

**Reason:** signature verification is an auth concern, not a debug concern. Verifying would mean
fetching Privy's signing keys, which breaks the no-network rule, and a red "invalid signature" on a
debug popup would be read as a bug in the page rather than a limitation of the tool.

**What this constrains:**

- `token.isExpired` compares `exp * 1000` against `Date.now()`. A token with no `exp` claim leaves
  `expiresAt` null and `isExpired` false. Absent is not expired.
- The Token card reports what the token says about itself. It never claims the token is trustworthy.

## Two fields that are declared and never filled

`ParsedPrivyState.user` carries `email` and `linkedAccounts`. The popup renders both. The parser
assigns neither.

`email` is a documented gap: Privy keeps it in the user record on their backend, not in
`localStorage`, so the User card shows an em-dash by design. The root README says so.

`linkedAccounts` has no such note anywhere in the repo. It initializes to `[]` and nothing writes to
it, so the Linked accounts row always renders empty. `parser.test.ts` asserts it stays `[]` on
missing state, which pins the empty case without establishing whether a populated case was ever
intended. Either wire it from `privy:connections` or drop the field.

**What would reopen the read-only rule:** nothing. It is the whole posture of the tool.
