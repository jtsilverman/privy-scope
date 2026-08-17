# docs/

The four kinds of doc a session reads to learn privy-devtools's current shape: architecture,
conventions, runbooks, decisions.

The root `README.md` is the user-facing page: what the extension shows, how to install it unpacked,
what it will not do. These docs are for someone changing the code. They link to the README rather
than repeating it.

| File | Question it answers |
|---|---|
| `architecture/two-surfaces.md` | The popup and the badge, the MAIN-world seam, what the build emits |
| `conventions/code-and-tests.md` | Where a test goes, why the parser stays pure, the two Chrome constraints a change must respect |
| `runbooks/build-and-load.md` | Build, load unpacked, test, reload after a change, debug the worker |
| `decisions/main-world-injection.md` | Why the read runs in the MAIN world and not a content script |
| `decisions/read-only-and-unverified.md` | Why the extension never writes, and why the JWT decode skips signature verification |

`docs/hero.png` is the screenshot the root README embeds.
