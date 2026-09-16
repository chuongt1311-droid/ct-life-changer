# Mentor Memory Graph — Design

**Status:** approved (brainstormed 2026-09-16).

## Problem

The mentor forgets across sessions (only the last 7 digests and last 4
weekly letters ever reach it — anything older is gone), can't draw on
anything CT knows about themself outside this app (notes, other projects,
the portfolio's own structure — the things CT already keeps as graphify
knowledge graphs locally), and has no record of its own past reasoning to
check against, so it can repeat or quietly contradict advice it already
gave. Fixing this by widening the blanket "last N" windows further would
only make every call more expensive without actually solving "forgets
things that matter" — the real gap is that today's context assembly
includes everything within a fixed recent window and nothing outside it,
rather than including what's actually relevant to the conversation at
hand, however old or however far outside this app it lives.

## Scope

**In scope:**
- A graph database (FalkorDB) hosted on CT's existing VPS, holding both
  app-generated memory (digests, weekly letters, mentor-inferred facts)
  and imported knowledge from CT's local graphify graphs (personal
  notes/journal, other project codebases, the portfolio-wide graph).
- A small authenticated API on the VPS in front of FalkorDB — the only
  thing the deployed app (Vercel, which can't reach a private VPS network)
  ever talks to.
- Two new mentor tools, `search_memory` and `remember`, using the same
  Tool Runner infrastructure sub-project C already shipped.
- Retrieval that replaces `assembleMentorContext`'s blanket "last 7
  digests, last 4 weekly letters" with a targeted top-K graph query
  relevant to the current conversation.
- A CT-visible list of mentor-written memories, with delete.
- A one-time backfill of existing digests/weekly letters into the graph,
  and an ongoing hook so every new one is pushed automatically.
- Using graphify's own existing `--falkordb-push` flag as the import path
  for CT's local graphs — no new import tooling needed for that half.

**Out of scope (v1):**
- Auto-linking imported graphify nodes to app-generated nodes (e.g.
  connecting a journal entry to a related digest). Fuzzy, error-prone
  work; both sides coexist in one graph and can be traversed separately
  until it's clear what cross-linking would actually be useful.
- Embeddings / vector similarity search. A real graph DB with
  keyword-match-then-traverse retrieval covers "what's relevant to this
  conversation" well enough for a coaching mentor, and needs no new paid
  API — a genuine win for cost, not just simpler infra.
- Pushing raw check-ins into the graph as their own nodes — digests
  already summarize them; a future extension if digests turn out to lose
  something check-ins had.
- Automatic, always-on graphify sync. CT runs `graphify ... --falkordb-push`
  locally whenever they want to refresh imported knowledge — matching the
  "manual import command" they chose over an always-on watcher, which
  would need its own persistent process.
- Anthropic API cost optimization as its own workstream — this design
  reduces mentor call token usage as a side effect (targeted retrieval
  replaces blanket inclusion), but a dedicated cost-optimize pass is
  planned as separate, follow-on work once this ships.

## Architecture

Two new containers on the VPS, run via Docker Compose:

- **FalkorDB** — bound to `localhost` only, never a public port. Holds
  the entire graph: app-generated nodes and imported graphify nodes
  together, not separate stores.
- **memory-api** — a small Node/TypeScript HTTP service (matching this
  project's stack), the *only* thing exposed to the internet. TLS via
  Caddy (automatic Let's Encrypt certs) in front of it. Exactly two
  authenticated operations: query and write-memory — never the raw
  FalkorDB/Redis protocol, keeping the internet-facing surface small and
  purpose-built rather than a general database endpoint.

Auth is a single bearer token (`MEMORY_API_TOKEN`), generated once,
stored as a Vercel env var on the app side and a `.env` value on the VPS
side. The app's own client for this lives at `src/lib/memory/client.ts`,
used everywhere memory is read or written — nothing else in the app talks
to the VPS directly.

CT needs a domain or subdomain (e.g. `memory.<yourdomain>`) pointed at the
VPS's IP for Caddy to issue a certificate against; this is the one
external prerequisite this design assumes CT already has or can add
cheaply (a subdomain costs nothing beyond DNS you likely already control).

```
Vercel (Next.js app) --HTTPS + bearer token--> Caddy --> memory-api --> FalkorDB (localhost-only)
                                                              ^
                                                              |
                                              CT's laptop: graphify --falkordb-push
                                                     (direct, same auth boundary
                                                      as any other DB client —
                                                      see Security)
```

## Data model

One unified FalkorDB graph. Every node carries a `source` property so
queries and the memory-list UI can distinguish provenance:

| Node label | `source` | Written by | Contains |
|---|---|---|---|
| `DailyDigest` | `app` | The existing digest-generation hook (evening check-in + cron retry) | date, digest text |
| `WeeklyLetter` | `app` | The existing weekly-review hook | week start, letter text, metrics |
| `MentorMemory` | `mentor-inferred` | The `remember` tool | text, the date/conversation it came from, a confidence note the model itself writes |
| *(whatever graphify's own node types are)* | `graphify:<graph-name>` | `graphify ... --falkordb-push` (CT, local) | graphify's own EXTRACTED/INFERRED/AMBIGUOUS-tagged content, unmodified |

Edges: app-generated nodes get a simple `NEXT_DAY`/`NEXT_WEEK` chain
(cheap, useful for "what happened around then" traversal) plus whatever
graphify itself already encodes for its own imported nodes. No new
cross-source edges in v1, per the scope note above.

## Write paths

**App-generated content** — three call sites already exist and each gets
one new line calling `src/lib/memory/client.ts`'s `writeMemory(...)`,
fire-and-forget (a memory-graph write failing should never break the
check-in/digest/letter flow it's attached to — logged, not thrown):

- `src/app/checkin/evening/actions.ts` (first digest write)
- `src/lib/cron/tick.ts` (digest retry, and the weekly-review call already there)
- `src/lib/mentor/runWeeklyReview.ts` (weekly letter write)

**Backfill** — a one-time script, `scripts/backfill-memory-graph.ts`,
reads every existing `digests` and `weekly_letters` row from Supabase and
pushes them through the same `writeMemory` path, so history CT already
has doesn't start at zero.

**Graphify imports** — CT runs, from their own machine, whenever they
want to refresh a graph:
```bash
graphify <path> --falkordb-push falkordb://memory.<yourdomain>:<port>
```
This is graphify's own existing feature — no code in this repo needs to
change for that half of the import story. The FalkorDB port this points
at is reachable only with the same credential FalkorDB itself is
configured to require (see Security) — CT's own machine is a trusted
client the same way the memory-api service is, just used interactively
instead of over HTTP.

**Mentor-written memories** — the `remember` tool, invoked by the model
mid-conversation, calls `writeMemory` with `source: 'mentor-inferred'`.
Written immediately (CT chose autonomy over a confirm-first gate for
this), but every one stays visible and deletable afterward — see
"CT-visible memory list" below.

## Read path — retrieval

`assembleMentorContext` (`src/lib/mentor/assembleContext.ts`) currently
always includes the last 4 weekly letters and last 7 digests verbatim.
That blanket inclusion is replaced with one call to
`src/lib/memory/client.ts`'s `queryMemory(question: string): Promise<string>`,
built from CT's current message (and, for non-chat routes like briefing,
a synthesized query like "today's briefing"). The memory-api's query
handler:

1. Finds nodes whose text loosely matches terms in the question (a
   simple case-insensitive substring/keyword match over node text
   properties — no embeddings, per scope).
2. Walks 1–2 hops out from each match (via `NEXT_DAY`/`NEXT_WEEK` and
   whatever graphify edges exist) to pull in nearby context.
3. Returns the matched subgraph as compact text, capped at a token
   budget (~1500 tokens) so retrieval itself never becomes the new
   blanket-inclusion problem.

`profile`, today's plan/blocks/checkins, and recent same-day chat history
stay exactly as they are today — those are inherently current and small;
only the "what happened before today" slice moves from blanket-window to
targeted retrieval.

## Mentor tools

Two additions to `src/lib/mentor/tools.ts`'s `buildMentorTools`, alongside
the three sub-project C already shipped:

- **`search_memory`**: `{ query: string }` → calls `queryMemory`, returns
  the matched subgraph text to the model. Read-only, no side effects —
  the model can call this as often as it wants mid-conversation.
- **`remember`**: `{ text: string, confidence: 'low' | 'medium' | 'high' }`
  → calls `writeMemory` with `source: 'mentor-inferred'`. The model
  states its own confidence so a shaky inference reads differently from a
  CT-confirmed fact when it's later retrieved or reviewed.

## CT-visible memory list

A new settings page (`/settings/memory`) lists every `MentorMemory` node
(via a new read-only `listMentorMemories` call on the memory-api), newest
first, each with its confidence and a Delete button (`deleteMemory` on
the API, removing that one node). This is the safeguard for "let it write
memories too": nothing the mentor infers about CT is invisible or
permanent without CT ever seeing it.

## Security

- FalkorDB bound to `localhost` inside the VPS; only memory-api and (for
  graphify pushes) an SSH-tunneled or firewall-allowlisted port reach it
  directly — never a bare public Redis port.
- memory-api requires `Authorization: Bearer <MEMORY_API_TOKEN>` on every
  request; requests without it get a plain 401, no error detail.
- Caddy terminates TLS automatically via Let's Encrypt; memory-api itself
  only ever listens on localhost behind it.
- `MEMORY_API_TOKEN` is a generated random value (not a password CT
  chooses), stored as a Vercel environment variable and a VPS `.env`
  file — never in this repo.

## Testing

- `src/lib/memory/client.ts`: unit tests against a fake HTTP layer (same
  `vi.fn()`-mocking convention already used for the Anthropic client in
  `chat.test.ts`), covering auth header presence, timeout/error handling
  (a memory-api outage must degrade to "no memory available," never break
  a mentor call), and the write-paths' fire-and-forget behavior.
- `search_memory`/`remember` tool tests: same pattern as the existing
  three tools in `tools.test.ts`, using a fake `queryMemory`/`writeMemory`.
- memory-api itself: this is new infrastructure outside the Next.js app's
  own test suite — its own unit tests (query matching, hop-traversal,
  token-budget capping) live alongside its code, run independently.
- E2E: extend `mentor-tool-use.spec.ts`'s pattern — seed a `MentorMemory`
  node via the deployed memory-api directly (bypassing the LLM, matching
  how that spec already seeds `mentor_proposals` directly), then confirm
  it shows up on `/settings/memory` and can be deleted.

## Self-review

1. **Spec coverage:** cross-session memory (retrieval replaces blanket
   windows), external knowledge (graphify import path), self-consistency
   (mentor can `search_memory` its own past `MentorMemory`/digest/letter
   nodes before answering) — all three gaps from the brainstorm are
   addressed.
2. **Placeholder scan:** none.
3. **Consistency:** `writeMemory`/`queryMemory` are the only two
   operations named throughout — tool descriptions, write-path call
   sites, and the settings page all route through the same two client
   functions, not parallel ad-hoc calls.
4. **Ambiguity check:** "fire-and-forget" for app-generated writes is
   made explicit (a memory-api outage must never break check-in/digest/
   letter flows, which have nothing to do with this feature) — the
   alternative (blocking on the write) would make an unrelated feature's
   uptime depend on a brand-new service's uptime, which is backwards.
