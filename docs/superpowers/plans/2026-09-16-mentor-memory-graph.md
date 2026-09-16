# Mentor Memory Graph Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the mentor a persistent, queryable graph of memory — app-generated (digests, weekly letters, its own inferences) and imported (CT's local graphify graphs) — retrieved by relevance instead of blanket-included by recency window.

**Architecture:** A new, separately-deployed service (`memory-api/`) runs FalkorDB plus a small authenticated Express API on CT's VPS via Docker Compose, with Caddy terminating TLS. The Next.js app talks to it only through `src/lib/memory/client.ts`. Three existing write sites (evening digest, digest retry, weekly letter) get one new fire-and-forget call each; `assembleMentorContext`'s blanket "last 7 digests, last 4 weekly letters" is replaced by one targeted retrieval call; two new mentor tools (`search_memory`, `remember`) let the model consult and extend memory mid-conversation; a new settings page makes every mentor-written memory visible and deletable.

**Tech Stack:** Express + the `falkordb` npm client + TypeScript (memory-api, its own package.json — not part of the Next.js app's build); the existing Next.js/Vitest/Playwright stack for the app side. Docker Compose + Caddy for VPS deployment.

**Spec:** `docs/superpowers/specs/2026-09-16-mentor-memory-graph-design.md`

## Global Constraints

- FalkorDB is bound to `localhost` on the VPS — never a public port. Only memory-api's HTTP surface (behind Caddy/TLS) and, for graphify pushes, an SSH-tunneled or firewall-allowlisted path reach it.
- memory-api requires `Authorization: Bearer <MEMORY_API_TOKEN>` on every request except a plain `/health` check; a missing/wrong token is a 401 with no error detail.
- Every write path that isn't a direct user action (digest/letter generation) is fire-and-forget: a memory-api failure must never break check-in, digest, or weekly-letter flows, which exist independently of this feature.
- `queryMemory` must degrade gracefully (return `''`) on any memory-api failure — a mentor call must still work with no memory available, never hard-fail because this new service is down.
- v1 has no embeddings, no auto-linking of imported graphify nodes to app nodes, no raw check-in nodes — see the spec's Scope section. Don't add them.
- Run `npm test` and `npm run typecheck` from the repo root before any app-side task is done; run memory-api's own `npm test` (from `memory-api/`) before any memory-api task is done.

---

### Task 1: memory-api scaffold — auth, health check, FalkorDB connection

**Files:**
- Create: `memory-api/package.json`
- Create: `memory-api/tsconfig.json`
- Create: `memory-api/vitest.config.ts`
- Create: `memory-api/.env.example`
- Create: `memory-api/src/falkor.ts`
- Create: `memory-api/src/auth.ts`
- Create: `memory-api/src/index.ts`
- Test: `memory-api/src/auth.test.ts`

**Interfaces:**
- Produces:
  ```ts
  // falkor.ts — a thin interface so tests can inject a fake, same pattern
  // this repo already uses for Supabase (fakeClient).
  export interface GraphClient {
    query(cypher: string, params?: Record<string, unknown>): Promise<{ data: unknown[][] }>;
    roQuery(cypher: string, params?: Record<string, unknown>): Promise<{ data: unknown[][] }>;
  }
  export function connectGraph(): Promise<GraphClient>; // real falkordb client, selectGraph('mentor_memory')

  // auth.ts
  export function requireBearerToken(token: string): (req: Request, res: Response, next: NextFunction) => void;
  ```
  Later tasks in this service import `GraphClient`/`connectGraph` and the auth middleware.

- [ ] **Step 1: Write the failing test**

```ts
// memory-api/src/auth.test.ts
import { describe, expect, it, vi } from 'vitest';
import { requireBearerToken } from './auth';

function fakeReqRes(header?: string) {
  const req = { headers: { authorization: header } } as never;
  const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as never;
  const next = vi.fn();
  return { req, res, next };
}

describe('requireBearerToken', () => {
  it('calls next() when the token matches', () => {
    const middleware = requireBearerToken('secret123');
    const { req, res, next } = fakeReqRes('Bearer secret123');
    middleware(req, res, next);
    expect(next).toHaveBeenCalledOnce();
  });

  it('returns 401 with no detail when the token is missing', () => {
    const middleware = requireBearerToken('secret123');
    const { req, res, next } = fakeReqRes(undefined);
    middleware(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect((res as never as { status: ReturnType<typeof vi.fn> }).status).toHaveBeenCalledWith(401);
  });

  it('returns 401 when the token is wrong', () => {
    const middleware = requireBearerToken('secret123');
    const { req, res, next } = fakeReqRes('Bearer wrong');
    middleware(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect((res as never as { status: ReturnType<typeof vi.fn> }).status).toHaveBeenCalledWith(401);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run (from `memory-api/`): `npx vitest run src/auth.test.ts`
Expected: FAIL — `Cannot find module './auth'`

- [ ] **Step 3: Write the implementation**

```json
// memory-api/package.json
{
  "name": "mentor-memory-api",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "express": "^4.21.2",
    "falkordb": "^6.2.7"
  },
  "devDependencies": {
    "@types/express": "^4.17.21",
    "@types/node": "^24.13.4",
    "tsx": "^4.23.13",
    "typescript": "^6.0.3",
    "vitest": "^5.0.0"
  }
}
```

```json
// memory-api/tsconfig.json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "skipLibCheck": true,
    "outDir": "dist",
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "types": ["node"]
  },
  "include": ["src"]
}
```

```ts
// memory-api/vitest.config.ts
import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { include: ['src/**/*.test.ts'], environment: 'node' } });
```

```bash
# memory-api/.env.example
MEMORY_API_TOKEN=
MEMORY_API_PORT=3001
FALKORDB_HOST=falkordb
FALKORDB_PORT=6379
FALKORDB_PASSWORD=
```

```ts
// memory-api/src/auth.ts
import type { NextFunction, Request, Response } from 'express';

/** Bearer-token auth for every route except /health. A missing or wrong
 * token gets a plain 401 with no detail — never leak whether the header
 * was malformed vs. the token was simply wrong. */
export function requireBearerToken(token: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const header = req.headers.authorization;
    if (header === `Bearer ${token}`) {
      next();
      return;
    }
    res.status(401).json({ error: 'unauthorized' });
  };
}
```

```ts
// memory-api/src/falkor.ts
import { FalkorDB } from 'falkordb';

export interface GraphClient {
  query(cypher: string, params?: Record<string, unknown>): Promise<{ data: unknown[][] }>;
  roQuery(cypher: string, params?: Record<string, unknown>): Promise<{ data: unknown[][] }>;
}

/** Real FalkorDB connection, one graph named 'mentor_memory'. Every route
 * handler receives a `GraphClient` — tests inject a fake instead of this. */
export async function connectGraph(): Promise<GraphClient> {
  const db = await FalkorDB.connect({
    username: 'default',
    password: process.env.FALKORDB_PASSWORD,
    socket: { host: process.env.FALKORDB_HOST ?? 'localhost', port: Number(process.env.FALKORDB_PORT ?? 6379) },
  });
  return db.selectGraph('mentor_memory') as unknown as GraphClient;
}
```

```ts
// memory-api/src/index.ts
import express from 'express';
import { requireBearerToken } from './auth';
import { connectGraph } from './falkor';

const PORT = Number(process.env.MEMORY_API_PORT ?? 3001);
const TOKEN = process.env.MEMORY_API_TOKEN;
if (!TOKEN) throw new Error('MEMORY_API_TOKEN must be set');

async function main() {
  const graph = await connectGraph();
  const app = express();
  app.use(express.json());

  app.get('/health', (_req, res) => res.json({ ok: true }));
  app.use(requireBearerToken(TOKEN!));

  // Later tasks add routes here, all receiving the same `graph` connection.
  void graph;

  app.listen(PORT, () => console.log(`memory-api listening on ${PORT}`));
}

main().catch((err) => {
  console.error('memory-api failed to start', err);
  process.exit(1);
});
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd memory-api && npm install && npx vitest run src/auth.test.ts
```
Expected: PASS (3 tests)

- [ ] **Step 5: Typecheck**

Run: `cd memory-api && npm run typecheck`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add memory-api/
git commit -m "feat(memory-api): scaffold — auth middleware, FalkorDB connection, health check"
```

---

### Task 2: `writeMemory` — create a node

**Files:**
- Create: `memory-api/src/writeMemory.ts`
- Modify: `memory-api/src/index.ts` (mount the route)
- Test: `memory-api/src/writeMemory.test.ts`

**Interfaces:**
- Consumes: `GraphClient` (Task 1).
- Produces:
  ```ts
  export type MemoryLabel = 'DailyDigest' | 'WeeklyLetter' | 'MentorMemory';
  export interface WriteMemoryInput {
    label: MemoryLabel;
    properties: Record<string, unknown>; // must include whatever that label needs — see below
  }
  export async function writeMemory(graph: GraphClient, input: WriteMemoryInput): Promise<{ id: string }>;
  ```
  Task 6 (app write hooks) and Task 9 (the `remember` tool) both call the app-side client that wraps a `POST /memory` request handled by this function. Task 7's backfill script also goes through the same `POST /memory` route.

- [ ] **Step 1: Write the failing test**

```ts
// memory-api/src/writeMemory.test.ts
import { describe, expect, it, vi } from 'vitest';
import type { GraphClient } from './falkor';
import { writeMemory } from './writeMemory';

function fakeGraph(): GraphClient & { calls: { cypher: string; params?: Record<string, unknown> }[] } {
  const calls: { cypher: string; params?: Record<string, unknown> }[] = [];
  return {
    calls,
    query: vi.fn(async (cypher, params) => {
      calls.push({ cypher, params });
      return { data: [] };
    }),
    roQuery: vi.fn(async (cypher, params) => {
      calls.push({ cypher, params });
      return { data: [] };
    }),
  };
}

describe('writeMemory', () => {
  it('rejects a label outside the allowlist (Cypher labels cannot be parameterized)', async () => {
    const graph = fakeGraph();
    await expect(writeMemory(graph, { label: 'Robbery; DROP GRAPH' as never, properties: {} })).rejects.toThrow(/unknown label/i);
  });

  it('creates a DailyDigest node with a generated id and source', async () => {
    const graph = fakeGraph();
    const result = await writeMemory(graph, { label: 'DailyDigest', properties: { date: '2026-09-15', text: 'A quiet day.' } });
    expect(result.id).toEqual(expect.any(String));
    expect(graph.calls).toHaveLength(1);
    expect(graph.calls[0]!.cypher).toContain('CREATE (n:DailyDigest');
    expect(graph.calls[0]!.params).toMatchObject({ id: result.id, source: 'app', date: '2026-09-15', text: 'A quiet day.' });
  });

  it('chains a DailyDigest to the previous day if one exists', async () => {
    const graph = fakeGraph();
    graph.roQuery = vi.fn(async () => ({ data: [['prev-id']] })); // simulates finding yesterday's node id
    await writeMemory(graph, { label: 'DailyDigest', properties: { date: '2026-09-15', text: 'Text.' } });
    const linkCall = graph.calls.find((c) => c.cypher.includes('NEXT_DAY'));
    expect(linkCall).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/writeMemory.test.ts`
Expected: FAIL — `Cannot find module './writeMemory'`

- [ ] **Step 3: Write the implementation**

```ts
// memory-api/src/writeMemory.ts
import { randomUUID } from 'node:crypto';
import type { GraphClient } from './falkor';

export type MemoryLabel = 'DailyDigest' | 'WeeklyLetter' | 'MentorMemory';
const LABELS: readonly MemoryLabel[] = ['DailyDigest', 'WeeklyLetter', 'MentorMemory'];

export interface WriteMemoryInput {
  label: MemoryLabel;
  properties: Record<string, unknown>;
}

/** Cypher can't parameterize a label — it's baked into the query string —
 * so every label is checked against a fixed allowlist before it ever
 * reaches a query, closing off Cypher injection through this field. */
function assertKnownLabel(label: string): asserts label is MemoryLabel {
  if (!LABELS.includes(label as MemoryLabel)) throw new Error(`unknown label: ${label}`);
}

/** Chains DailyDigest → DailyDigest and WeeklyLetter → WeeklyLetter nodes
 * by date/weekStart order, for cheap "what happened around then"
 * traversal at query time. MentorMemory nodes aren't chained in v1 — see
 * the spec's scope note on cross-source linking. */
async function linkToPrevious(graph: GraphClient, label: MemoryLabel, id: string, properties: Record<string, unknown>): Promise<void> {
  if (label === 'DailyDigest') {
    const result = await graph.roQuery(
      'MATCH (n:DailyDigest) WHERE n.date < $date RETURN n.id ORDER BY n.date DESC LIMIT 1',
      { date: properties.date },
    );
    const prevId = result.data[0]?.[0];
    if (prevId) await graph.query('MATCH (a:DailyDigest {id: $prevId}), (b:DailyDigest {id: $id}) CREATE (a)-[:NEXT_DAY]->(b)', { prevId, id });
  } else if (label === 'WeeklyLetter') {
    const result = await graph.roQuery(
      'MATCH (n:WeeklyLetter) WHERE n.weekStart < $weekStart RETURN n.id ORDER BY n.weekStart DESC LIMIT 1',
      { weekStart: properties.weekStart },
    );
    const prevId = result.data[0]?.[0];
    if (prevId) await graph.query('MATCH (a:WeeklyLetter {id: $prevId}), (b:WeeklyLetter {id: $id}) CREATE (a)-[:NEXT_WEEK]->(b)', { prevId, id });
  }
}

export async function writeMemory(graph: GraphClient, input: WriteMemoryInput): Promise<{ id: string }> {
  assertKnownLabel(input.label);
  const id = randomUUID();
  const source = input.label === 'MentorMemory' ? 'mentor-inferred' : 'app';
  const params = { id, source, createdAt: new Date().toISOString(), ...input.properties };
  // The label is interpolated (validated above), everything else is a
  // parameter — this is the one place a label is ever baked into a
  // query string in this service.
  await graph.query(`CREATE (n:${input.label} $props)`, { props: params });
  await linkToPrevious(graph, input.label, id, input.properties);
  return { id };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/writeMemory.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Mount the route**

Add to `memory-api/src/index.ts`, replacing the `void graph;` placeholder:

```ts
  app.post('/memory', async (req, res) => {
    try {
      const result = await writeMemory(graph, req.body);
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'bad request' });
    }
  });
```

Add the import: `import { writeMemory } from './writeMemory';`

- [ ] **Step 6: Typecheck and full memory-api test suite**

Run: `cd memory-api && npm run typecheck && npm test`
Expected: both pass

- [ ] **Step 7: Commit**

```bash
git add memory-api/
git commit -m "feat(memory-api): POST /memory — write a node, chained to its predecessor by date"
```

---

### Task 3: `queryMemory` — keyword match, traverse, token-budget cap

**Files:**
- Create: `memory-api/src/queryMemory.ts`
- Modify: `memory-api/src/index.ts` (mount the route)
- Test: `memory-api/src/queryMemory.test.ts`

**Interfaces:**
- Consumes: `GraphClient` (Task 1).
- Produces:
  ```ts
  export async function queryMemory(graph: GraphClient, question: string, maxChars?: number): Promise<string>;
  ```
  Task 6's app-side `queryMemory` client function calls `POST /memory/query { question }`, handled by this function.

- [ ] **Step 1: Write the failing test**

```ts
// memory-api/src/queryMemory.test.ts
import { describe, expect, it, vi } from 'vitest';
import type { GraphClient } from './falkor';
import { queryMemory } from './queryMemory';

function fakeGraph(matchRows: unknown[][], neighborRows: unknown[][] = []): GraphClient {
  return {
    query: vi.fn(async () => ({ data: [] })),
    roQuery: vi.fn(async (cypher: string) => {
      if (cypher.includes('CONTAINS')) return { data: matchRows };
      return { data: neighborRows };
    }),
  };
}

describe('queryMemory', () => {
  it('returns an empty string when nothing matches', async () => {
    const graph = fakeGraph([]);
    const text = await queryMemory(graph, 'anything at all');
    expect(text).toBe('');
  });

  it('returns matched node text', async () => {
    const graph = fakeGraph([['DailyDigest', 'id1', 'You skipped deep work again on Tuesday.']]);
    const text = await queryMemory(graph, 'deep work');
    expect(text).toContain('You skipped deep work again on Tuesday.');
  });

  it('caps total output at maxChars', async () => {
    const longText = 'x'.repeat(5000);
    const graph = fakeGraph([['DailyDigest', 'id1', longText], ['DailyDigest', 'id2', longText]]);
    const text = await queryMemory(graph, 'x', 100);
    expect(text.length).toBeLessThanOrEqual(120); // small allowance for formatting
  });

  it('ignores stopwords and very short terms when building the keyword list', async () => {
    const graph = fakeGraph([]);
    await queryMemory(graph, 'the a of it');
    // No real keywords survive filtering, so no CONTAINS query should even run.
    expect((graph.roQuery as ReturnType<typeof vi.fn>).mock.calls.length).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/queryMemory.test.ts`
Expected: FAIL — `Cannot find module './queryMemory'`

- [ ] **Step 3: Write the implementation**

```ts
// memory-api/src/queryMemory.ts
import type { GraphClient } from './falkor';

const STOPWORDS = new Set(['the', 'a', 'an', 'of', 'it', 'is', 'to', 'and', 'in', 'on', 'for', 'my', 'me', 'i', 'you', 'do', 'does', 'can', 'what']);

function keywordsFor(question: string): string[] {
  return [...new Set(
    question
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length > 2 && !STOPWORDS.has(w)),
  )];
}

interface MatchedNode {
  label: string;
  id: string;
  text: string;
}

/** Keyword-match-then-traverse retrieval, no embeddings (spec's v1 scope).
 * A cheap ~4-chars-per-token estimate keeps the returned text within
 * `maxChars` (default ~6000 chars ≈ 1500 tokens) so retrieval itself
 * never becomes the new blanket-inclusion problem it's replacing. */
export async function queryMemory(graph: GraphClient, question: string, maxChars = 6000): Promise<string> {
  const keywords = keywordsFor(question);
  if (keywords.length === 0) return '';

  const matchResult = await graph.roQuery(
    'MATCH (n) WHERE ANY(kw IN $keywords WHERE toLower(n.text) CONTAINS kw) RETURN labels(n)[0], n.id, n.text LIMIT 20',
    { keywords },
  );
  const matched: MatchedNode[] = matchResult.data.map((row) => ({ label: row[0] as string, id: row[1] as string, text: row[2] as string }));
  if (matched.length === 0) return '';

  const ids = matched.map((m) => m.id);
  const neighborResult = await graph.roQuery(
    'MATCH (n)-[]-(m) WHERE n.id IN $ids AND NOT m.id IN $ids RETURN labels(m)[0], m.id, m.text LIMIT 20',
    { ids },
  );
  const neighbors: MatchedNode[] = neighborResult.data.map((row) => ({ label: row[0] as string, id: row[1] as string, text: row[2] as string }));

  const seen = new Set<string>();
  const all = [...matched, ...neighbors].filter((n) => {
    if (seen.has(n.id)) return false;
    seen.add(n.id);
    return true;
  });

  const lines: string[] = [];
  let used = 0;
  for (const n of all) {
    const line = `[${n.label}] ${n.text}`;
    if (used + line.length > maxChars) break;
    lines.push(line);
    used += line.length;
  }
  return lines.join('\n\n');
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/queryMemory.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Mount the route**

Add to `memory-api/src/index.ts`:

```ts
  app.post('/memory/query', async (req, res) => {
    const { question, maxChars } = req.body as { question?: string; maxChars?: number };
    if (!question) return res.status(400).json({ error: 'question is required' });
    const text = await queryMemory(graph, question, maxChars);
    res.json({ text });
  });
```

Add the import: `import { queryMemory } from './queryMemory';`

- [ ] **Step 6: Typecheck and full memory-api test suite**

Run: `cd memory-api && npm run typecheck && npm test`
Expected: both pass

- [ ] **Step 7: Commit**

```bash
git add memory-api/
git commit -m "feat(memory-api): POST /memory/query — keyword match, one-hop traversal, char-budget cap"
```

---

### Task 4: List and delete mentor-written memories

**Files:**
- Create: `memory-api/src/mentorMemories.ts`
- Modify: `memory-api/src/index.ts` (mount both routes)
- Test: `memory-api/src/mentorMemories.test.ts`

**Interfaces:**
- Consumes: `GraphClient` (Task 1).
- Produces:
  ```ts
  export interface MentorMemoryRow { id: string; text: string; confidence: string; createdAt: string }
  export async function listMentorMemories(graph: GraphClient): Promise<MentorMemoryRow[]>;
  export async function deleteMemory(graph: GraphClient, id: string): Promise<void>;
  ```
  Task 10's `/settings/memory` page calls the app-side client wrapping `GET /memory/mentor` and `DELETE /memory/:id`, handled by these functions.

- [ ] **Step 1: Write the failing test**

```ts
// memory-api/src/mentorMemories.test.ts
import { describe, expect, it, vi } from 'vitest';
import type { GraphClient } from './falkor';
import { listMentorMemories, deleteMemory } from './mentorMemories';

describe('listMentorMemories', () => {
  it('maps rows into MentorMemoryRow objects, newest first', async () => {
    const graph: GraphClient = {
      query: vi.fn(),
      roQuery: vi.fn(async () => ({ data: [['id1', 'CT prefers mornings', 'high', '2026-09-16T00:00:00.000Z']] })),
    };
    const rows = await listMentorMemories(graph);
    expect(rows).toEqual([{ id: 'id1', text: 'CT prefers mornings', confidence: 'high', createdAt: '2026-09-16T00:00:00.000Z' }]);
  });
});

describe('deleteMemory', () => {
  it('detaches and deletes the node by id', async () => {
    const calls: { cypher: string; params?: Record<string, unknown> }[] = [];
    const graph: GraphClient = {
      query: vi.fn(async (cypher, params) => {
        calls.push({ cypher, params });
        return { data: [] };
      }),
      roQuery: vi.fn(),
    };
    await deleteMemory(graph, 'id1');
    expect(calls[0]!.cypher).toContain('DETACH DELETE');
    expect(calls[0]!.params).toEqual({ id: 'id1' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/mentorMemories.test.ts`
Expected: FAIL — `Cannot find module './mentorMemories'`

- [ ] **Step 3: Write the implementation**

```ts
// memory-api/src/mentorMemories.ts
import type { GraphClient } from './falkor';

export interface MentorMemoryRow {
  id: string;
  text: string;
  confidence: string;
  createdAt: string;
}

export async function listMentorMemories(graph: GraphClient): Promise<MentorMemoryRow[]> {
  const result = await graph.roQuery('MATCH (n:MentorMemory) RETURN n.id, n.text, n.confidence, n.createdAt ORDER BY n.createdAt DESC');
  return result.data.map((row) => ({ id: row[0] as string, text: row[1] as string, confidence: row[2] as string, createdAt: row[3] as string }));
}

export async function deleteMemory(graph: GraphClient, id: string): Promise<void> {
  await graph.query('MATCH (n {id: $id}) DETACH DELETE n', { id });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/mentorMemories.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Mount the routes**

Add to `memory-api/src/index.ts`:

```ts
  app.get('/memory/mentor', async (_req, res) => {
    res.json({ memories: await listMentorMemories(graph) });
  });

  app.delete('/memory/:id', async (req, res) => {
    await deleteMemory(graph, req.params.id);
    res.json({ ok: true });
  });
```

Add the import: `import { listMentorMemories, deleteMemory } from './mentorMemories';`

- [ ] **Step 6: Typecheck and full memory-api test suite**

Run: `cd memory-api && npm run typecheck && npm test`
Expected: both pass (9 tests total across the service so far)

- [ ] **Step 7: Commit**

```bash
git add memory-api/
git commit -m "feat(memory-api): list and delete mentor-written memories"
```

---

### Task 5: Docker Compose, Caddy, and a deploy doc

**Files:**
- Create: `memory-api/Dockerfile`
- Create: `memory-api/docker-compose.yml`
- Create: `memory-api/Caddyfile`
- Create: `memory-api/DEPLOY.md`

**Interfaces:**
- Consumes: Tasks 1–4's completed service.
- Produces: a deployable stack. No code interfaces — this task is infrastructure and its own documentation.

- [ ] **Step 1: Write the Dockerfile**

```dockerfile
# memory-api/Dockerfile
FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install
COPY . .
RUN npm run build

FROM node:22-slim
WORKDIR /app
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY package.json ./
EXPOSE 3001
CMD ["node", "dist/index.js"]
```

- [ ] **Step 2: Write docker-compose.yml**

```yaml
# memory-api/docker-compose.yml
services:
  falkordb:
    image: falkordb/falkordb:latest
    restart: unless-stopped
    environment:
      - REDIS_ARGS=--requirepass ${FALKORDB_PASSWORD} --appendonly yes
    volumes:
      - falkordb-data:/data
    # No `ports:` — reachable only from other containers on this compose
    # network, never from the host's public interface.

  memory-api:
    build: .
    restart: unless-stopped
    depends_on:
      - falkordb
    environment:
      - MEMORY_API_TOKEN=${MEMORY_API_TOKEN}
      - MEMORY_API_PORT=3001
      - FALKORDB_HOST=falkordb
      - FALKORDB_PORT=6379
      - FALKORDB_PASSWORD=${FALKORDB_PASSWORD}
    expose:
      - '3001'

  caddy:
    image: caddy:2
    restart: unless-stopped
    depends_on:
      - memory-api
    ports:
      - '80:80'
      - '443:443'
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile
      - caddy-data:/data

volumes:
  falkordb-data:
  caddy-data:
```

- [ ] **Step 3: Write the Caddyfile**

```
# memory-api/Caddyfile — replace with your actual subdomain
memory.yourdomain.com {
  reverse_proxy memory-api:3001
}
```

- [ ] **Step 4: Write the deploy doc**

```markdown
# memory-api/DEPLOY.md

## Prerequisites
- A subdomain (e.g. `memory.yourdomain.com`) with an A record pointing at
  the VPS's IP — Caddy needs this to issue a Let's Encrypt certificate.
- Docker and Docker Compose installed on the VPS.

## First deploy

1. Copy this directory to the VPS (e.g. `git clone` the whole repo there,
   or `rsync` just `memory-api/`).
2. Edit `Caddyfile`, replacing `memory.yourdomain.com` with your real subdomain.
3. Create `memory-api/.env` (never committed) from `.env.example`:
   - `MEMORY_API_TOKEN`: generate with `openssl rand -hex 32`.
   - `FALKORDB_PASSWORD`: generate the same way.
4. `cd memory-api && docker compose up -d --build`
5. Confirm it's up: `curl https://memory.yourdomain.com/health` → `{"ok":true}`

## Add the same two values to Vercel

Settings → Environment Variables on the Next.js app project:
- `MEMORY_API_URL=https://memory.yourdomain.com`
- `MEMORY_API_TOKEN=<the same value from step 3>`

## Updating

```bash
cd memory-api && git pull && docker compose up -d --build
```

## Importing a graphify graph

From your own machine, once FalkorDB's port is reachable (via an SSH
tunnel — `ssh -L 6379:localhost:6379 <vps>` — since it's never exposed
publicly):

```bash
graphify <path> --falkordb-push falkordb://:<FALKORDB_PASSWORD>@localhost:6379
```
```

- [ ] **Step 5: Commit**

```bash
git add memory-api/Dockerfile memory-api/docker-compose.yml memory-api/Caddyfile memory-api/DEPLOY.md
git commit -m "feat(memory-api): Docker Compose deployment (FalkorDB + API + Caddy)"
```

---

### Task 6: App-side memory client

**Files:**
- Create: `src/lib/memory/client.ts`
- Test: `src/lib/memory/client.test.ts`
- Modify: `.env.example` (append `MEMORY_API_URL=` and `MEMORY_API_TOKEN=`)

**Interfaces:**
- Produces:
  ```ts
  export async function writeMemory(label: 'DailyDigest' | 'WeeklyLetter' | 'MentorMemory', properties: Record<string, unknown>): Promise<void>;
  export async function queryMemory(question: string): Promise<string>;
  export interface MentorMemoryRow { id: string; text: string; confidence: string; createdAt: string }
  export async function listMentorMemories(): Promise<MentorMemoryRow[]>;
  export async function deleteMemory(id: string): Promise<void>;
  ```
  Task 7's write hooks, Task 8's retrieval, Task 9's tools, and Task 10's settings page all import from this one file — nothing else in the app talks to memory-api directly.

- [ ] **Step 1: Write the failing tests**

```ts
// src/lib/memory/client.test.ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import { writeMemory, queryMemory, listMentorMemories, deleteMemory } from './client';

const originalEnv = { ...process.env };
afterEach(() => {
  process.env = { ...originalEnv };
  vi.restoreAllMocks();
});

describe('writeMemory', () => {
  it('POSTs with the bearer token and does not throw when memory-api is unreachable', async () => {
    process.env.MEMORY_API_URL = 'https://memory.example.com';
    process.env.MEMORY_API_TOKEN = 'tok';
    const fetchMock = vi.fn().mockRejectedValue(new Error('network down'));
    vi.stubGlobal('fetch', fetchMock);
    await expect(writeMemory('DailyDigest', { date: '2026-09-16', text: 'hi' })).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledWith(
      'https://memory.example.com/memory',
      expect.objectContaining({ method: 'POST', headers: expect.objectContaining({ Authorization: 'Bearer tok' }) }),
    );
  });

  it('does nothing (no throw, no fetch) when MEMORY_API_URL is not configured', async () => {
    delete process.env.MEMORY_API_URL;
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await writeMemory('DailyDigest', { date: '2026-09-16', text: 'hi' });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('queryMemory', () => {
  it('returns the retrieved text on success', async () => {
    process.env.MEMORY_API_URL = 'https://memory.example.com';
    process.env.MEMORY_API_TOKEN = 'tok';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ text: 'relevant stuff' }) }));
    const text = await queryMemory('how am I doing');
    expect(text).toBe('relevant stuff');
  });

  it('returns "" (never throws) when memory-api errors', async () => {
    process.env.MEMORY_API_URL = 'https://memory.example.com';
    process.env.MEMORY_API_TOKEN = 'tok';
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('down')));
    const text = await queryMemory('how am I doing');
    expect(text).toBe('');
  });

  it('returns "" when not configured', async () => {
    delete process.env.MEMORY_API_URL;
    const text = await queryMemory('how am I doing');
    expect(text).toBe('');
  });
});

describe('listMentorMemories / deleteMemory', () => {
  it('lists memories', async () => {
    process.env.MEMORY_API_URL = 'https://memory.example.com';
    process.env.MEMORY_API_TOKEN = 'tok';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ memories: [{ id: '1', text: 'x', confidence: 'high', createdAt: 'now' }] }) }));
    const rows = await listMentorMemories();
    expect(rows).toEqual([{ id: '1', text: 'x', confidence: 'high', createdAt: 'now' }]);
  });

  it('deletes by id', async () => {
    process.env.MEMORY_API_URL = 'https://memory.example.com';
    process.env.MEMORY_API_TOKEN = 'tok';
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
    vi.stubGlobal('fetch', fetchMock);
    await deleteMemory('1');
    expect(fetchMock).toHaveBeenCalledWith('https://memory.example.com/memory/1', expect.objectContaining({ method: 'DELETE' }));
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/memory/client.test.ts`
Expected: FAIL — `Cannot find module './client'`

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/memory/client.ts

/** Every function here degrades to a safe no-op/empty-result when
 * MEMORY_API_URL isn't configured or the service is unreachable — this
 * feature must never be a hard dependency for anything else in the app.
 * `writeMemory` and `queryMemory` in particular are meant to be called
 * fire-and-forget from existing digest/letter/check-in flows that have
 * nothing to do with this feature and must keep working if it's down. */

function configured(): { url: string; token: string } | null {
  const url = process.env.MEMORY_API_URL;
  const token = process.env.MEMORY_API_TOKEN;
  if (!url || !token) return null;
  return { url, token };
}

export async function writeMemory(label: 'DailyDigest' | 'WeeklyLetter' | 'MentorMemory', properties: Record<string, unknown>): Promise<void> {
  const cfg = configured();
  if (!cfg) return;
  try {
    await fetch(`${cfg.url}/memory`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.token}` },
      body: JSON.stringify({ label, properties }),
    });
  } catch {
    // Fire-and-forget: a memory-api outage must never break the caller.
  }
}

export async function queryMemory(question: string): Promise<string> {
  const cfg = configured();
  if (!cfg) return '';
  try {
    const res = await fetch(`${cfg.url}/memory/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.token}` },
      body: JSON.stringify({ question }),
    });
    if (!res.ok) return '';
    const data = (await res.json()) as { text: string };
    return data.text;
  } catch {
    return '';
  }
}

export interface MentorMemoryRow {
  id: string;
  text: string;
  confidence: string;
  createdAt: string;
}

export async function listMentorMemories(): Promise<MentorMemoryRow[]> {
  const cfg = configured();
  if (!cfg) return [];
  try {
    const res = await fetch(`${cfg.url}/memory/mentor`, { headers: { Authorization: `Bearer ${cfg.token}` } });
    if (!res.ok) return [];
    const data = (await res.json()) as { memories: MentorMemoryRow[] };
    return data.memories;
  } catch {
    return [];
  }
}

export async function deleteMemory(id: string): Promise<void> {
  const cfg = configured();
  if (!cfg) return;
  try {
    await fetch(`${cfg.url}/memory/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${cfg.token}` } });
  } catch {
    // A failed delete leaves the memory visible for CT to try again — no
    // silent data loss either way, and the settings page re-fetches after.
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/memory/client.test.ts`
Expected: PASS (7 tests)

- [ ] **Step 5: Add the env var placeholders**

Append to `.env.example`:
```
MEMORY_API_URL=
MEMORY_API_TOKEN=
```

- [ ] **Step 6: Full unit suite and typecheck**

Run: `npm test && npm run typecheck`
Expected: both pass

- [ ] **Step 7: Commit**

```bash
git add src/lib/memory/client.ts src/lib/memory/client.test.ts .env.example
git commit -m "feat(memory): app-side client — degrades to no-op when unconfigured or unreachable"
```

---

### Task 7: Write hooks at the three existing digest/letter sites

**Files:**
- Modify: `src/app/checkin/evening/actions.ts`
- Modify: `src/lib/cron/tick.ts`
- Modify: `src/lib/mentor/runWeeklyReview.ts`

**Interfaces:**
- Consumes: `writeMemory` (Task 6).

- [ ] **Step 1: Add the hook after the first digest write**

In `src/app/checkin/evening/actions.ts`, add the import:
```ts
import { writeMemory } from '@/lib/memory/client';
```
Then change:
```ts
  await repos.digests.upsert({
    date: planDate,
    owner_id: user.id,
    text: review.fallback ? null : review.digest,
    attempts: 1,
  });
```
to:
```ts
  await repos.digests.upsert({
    date: planDate,
    owner_id: user.id,
    text: review.fallback ? null : review.digest,
    attempts: 1,
  });
  if (!review.fallback) void writeMemory('DailyDigest', { date: planDate, text: review.digest });
```
`void` because this is fire-and-forget per the Global Constraints — never
`await` it where that would block or fail the check-in flow.

- [ ] **Step 2: Add the hook after the digest retry write**

In `src/lib/cron/tick.ts`, add the same import, then change:
```ts
    await repos.digests.upsert({ date: planDate, owner_id: ownerId, text: review.fallback ? null : review.digest, attempts: digestRow.attempts + 1 });
```
to:
```ts
    await repos.digests.upsert({ date: planDate, owner_id: ownerId, text: review.fallback ? null : review.digest, attempts: digestRow.attempts + 1 });
    if (!review.fallback) void writeMemory('DailyDigest', { date: planDate, text: review.digest });
```

- [ ] **Step 3: Add the hook after the weekly letter write**

In `src/lib/mentor/runWeeklyReview.ts`, add the same import, then change:
```ts
  const metrics = await getWeeklyMetrics(client, weekStart);
  await repos.weeklyLetters.upsert({
    week_start: weekStart,
    owner_id: params.ownerId,
    letter: result.letter,
    metrics: metrics as unknown as Record<string, unknown>,
    changes: result.changes as unknown as Record<string, unknown>,
    profile_version_id: newVersion.id,
  });
```
to:
```ts
  const metrics = await getWeeklyMetrics(client, weekStart);
  await repos.weeklyLetters.upsert({
    week_start: weekStart,
    owner_id: params.ownerId,
    letter: result.letter,
    metrics: metrics as unknown as Record<string, unknown>,
    changes: result.changes as unknown as Record<string, unknown>,
    profile_version_id: newVersion.id,
  });
  void writeMemory('WeeklyLetter', { weekStart, text: result.letter });
```

- [ ] **Step 4: Full unit suite, typecheck, and the existing e2e specs these flows already have**

```bash
npm test && npm run typecheck
npx playwright test e2e/evening-checkin.spec.ts
```
Expected: all pass — these are additive fire-and-forget calls; no
existing behavior changes, and `writeMemory` itself no-ops when
`MEMORY_API_URL` isn't set (true in the local/test environment, so these
specs never actually reach a real memory-api).

- [ ] **Step 5: Commit**

```bash
git add src/app/checkin/evening/actions.ts src/lib/cron/tick.ts src/lib/mentor/runWeeklyReview.ts
git commit -m "feat(memory): push every digest and weekly letter into the memory graph as it's created"
```

---

### Task 8: Replace blanket digest/letter windows with retrieved memory

**Files:**
- Modify: `src/core/mentor/context.ts`
- Modify: `src/lib/mentor/assembleContext.ts`
- Modify: `src/core/mentor/context.test.ts`
- Modify: `src/lib/mentor/assembleContext.test.ts`

**Interfaces:**
- Consumes: `queryMemory` (Task 6).
- Produces: `MentorContextInput` gains `retrievedMemory: string`, loses `weeklyLetters`/`digests`. This is a breaking change to a type every mentor route already constructs — grep for every call site before editing (see Step 1).

**Note on prompt caching:** `buildMentorContext` already marks the old
history block as an ephemeral cache breakpoint (`cache_control`), reused
across same-day mentor calls that shared the same blanket digest/letter
window. Because `retrievedMemory` now varies per question, that specific
cache reuse is lost — traded for a much smaller per-call block. This is
a real, known trade-off, not an oversight; it's exactly what the planned
follow-on cost-optimize pass should measure and revisit, not something to
solve here.

- [ ] **Step 1: Find every place `MentorContextInput` is constructed or read**

```bash
grep -rln "weeklyLetters\|MentorContextInput" src/ --include="*.ts" | grep -v test
```

Confirm the only real construction site is `assembleMentorContext`
(`src/lib/mentor/assembleContext.ts`) and the only consumer is
`buildMentorContext` (`src/core/mentor/context.ts`) — if anything else
shows up, read it before proceeding; this plan assumes exactly these two.

- [ ] **Step 2: Write the failing test for `context.ts`**

Replace the `renderHistory`-related assertions in
`src/core/mentor/context.test.ts` — find the existing test(s) asserting
on `weeklyLetters`/`digests` rendering (read the file first; do not
guess its current test names) and replace them with:

```ts
it('renders retrievedMemory as its own cached block', () => {
  const input: MentorContextInput = {
    systemPrompt: 'sys',
    profile: emptyProfile(),
    retrievedMemory: 'You skipped deep work three days running last week.',
    today: { date: '2026-09-16', state: 'ready', flags: [], adjustments: [], overridden: false, blocks: [], checkins: [] },
    request: 'hi',
  };
  const ctx = buildMentorContext(input);
  const historyBlock = (ctx.messages[0]!.content as { text: string }[]).find((b) => b.text.includes('<memory>'));
  expect(historyBlock?.text).toContain('You skipped deep work three days running last week.');
  expect(historyBlock?.cache_control).toEqual({ type: 'ephemeral' });
});

it('renders a placeholder when no memory was retrieved', () => {
  const input: MentorContextInput = {
    systemPrompt: 'sys',
    profile: emptyProfile(),
    retrievedMemory: '',
    today: { date: '2026-09-16', state: 'ready', flags: [], adjustments: [], overridden: false, blocks: [], checkins: [] },
    request: 'hi',
  };
  const ctx = buildMentorContext(input);
  const historyBlock = (ctx.messages[0]!.content as { text: string }[]).find((b) => b.text.includes('<memory>'));
  expect(historyBlock?.text).toContain('(nothing retrieved)');
});
```

Import `emptyProfile` from `@/core/mentor/profile` if the test file
doesn't already; check the existing imports first.

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run src/core/mentor/context.test.ts`
Expected: FAIL — `retrievedMemory` doesn't exist on `MentorContextInput` yet, and `renderHistory` still expects `weeklyLetters`/`digests`

- [ ] **Step 4: Update `context.ts`**

```ts
// src/core/mentor/context.ts — replace the weeklyLetters/digests fields and renderHistory
export interface MentorContextInput {
  systemPrompt: string;
  profile: Profile;
  /** Compact text from the memory graph, relevant to `request` — replaces
   * the old blanket "last 7 digests, last 4 weekly letters" window. Empty
   * string when nothing matched or the memory service is unreachable. */
  retrievedMemory: string;
  today: {
    date: string;
    state: GuardState;
    flags: Flag[];
    adjustments: Adjustment[];
    overridden: boolean;
    blocks: Block[];
    checkins: CheckinRecord[];
  };
  request: string;
  chatHistory?: { role: 'user' | 'assistant'; content: string }[];
}
```

Replace `renderHistory` with:

```ts
function renderMemory(input: MentorContextInput): string {
  return ['<memory>', input.retrievedMemory || '(nothing retrieved)', '</memory>'].join('\n');
}
```

In `buildMentorContext`, replace the call `renderHistory(input)` with
`renderMemory(input)` (same position — first cached text block in the
first user message).

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/core/mentor/context.test.ts`
Expected: PASS

- [ ] **Step 6: Write the failing test for `assembleContext.ts`**

In `src/lib/mentor/assembleContext.test.ts`, find the existing
assertions on `input.weeklyLetters`/`input.digests` (read the file
first) and replace with one asserting `retrievedMemory` comes from
`queryMemory`:

```ts
it('fills today.retrievedMemory from queryMemory', async () => {
  vi.mock('@/lib/memory/client', () => ({ queryMemory: vi.fn().mockResolvedValue('retrieved text') }));
  const client = fakeClient({ /* whatever this test file's existing seed already is */ });
  const input = await assembleMentorContext(client, { systemPrompt: 'sys', date: '2026-09-16', request: 'hi' });
  expect(input.retrievedMemory).toBe('retrieved text');
});
```

- [ ] **Step 7: Run the test to verify it fails**

Run: `npx vitest run src/lib/mentor/assembleContext.test.ts`
Expected: FAIL — `retrievedMemory` not produced yet

- [ ] **Step 8: Update `assembleContext.ts`**

Remove the `weeklyLetterRows`/`digestRows` fetches and the corresponding
fields from the returned object; add:

```ts
import { queryMemory } from '@/lib/memory/client';
// ...
const retrievedMemory = await queryMemory(params.request);
// ...
return {
  systemPrompt: params.systemPrompt,
  profile,
  retrievedMemory,
  today: { /* unchanged */ },
  request: params.request,
  chatHistory: params.chatHistory,
};
```

Remove `repos.weeklyLetters.list()` and `repos.digests.list()` from the
`Promise.all(...)` this function already runs, along with the now-unused
`weeklyLetterRows`/`digestRows` variables.

- [ ] **Step 9: Run the test to verify it passes, then the full unit suite and typecheck**

```bash
npx vitest run src/lib/mentor/assembleContext.test.ts
npm test && npm run typecheck
```
Expected: all pass

- [ ] **Step 10: Commit**

```bash
git add src/core/mentor/context.ts src/core/mentor/context.test.ts src/lib/mentor/assembleContext.ts src/lib/mentor/assembleContext.test.ts
git commit -m "feat(mentor): replace blanket digest/letter windows with targeted memory retrieval"
```

---

### Task 9: `search_memory` and `remember` mentor tools

**Files:**
- Modify: `src/lib/mentor/tools.ts`
- Modify: `src/lib/mentor/tools.test.ts`

**Interfaces:**
- Consumes: `queryMemory`, `writeMemory` (Task 6).
- Produces: `buildMentorTools` now returns 5 tools, not 3.

- [ ] **Step 1: Write the failing tests**

Append to `src/lib/mentor/tools.test.ts`:

```ts
it('search_memory returns the retrieved text', async () => {
  vi.doMock('@/lib/memory/client', () => ({ queryMemory: vi.fn().mockResolvedValue('past pattern found'), writeMemory: vi.fn() }));
  const client = fakeClient({ settings: [settingsRow] });
  const { tools } = buildMentorTools({ client, ownerId: 'ct', messageId: 'm1', todayDate: '2026-09-15', now: new Date('2026-09-15T12:00:00Z') });
  const searchMemory = tools.find((t) => t.name === 'search_memory')!;
  const result = await searchMemory.run(searchMemory.parse({ query: 'deep work' }));
  expect(result).toContain('past pattern found');
});

it('remember writes a MentorMemory with the given confidence', async () => {
  const writeMemoryMock = vi.fn();
  vi.doMock('@/lib/memory/client', () => ({ queryMemory: vi.fn(), writeMemory: writeMemoryMock }));
  const client = fakeClient({ settings: [settingsRow] });
  const { tools } = buildMentorTools({ client, ownerId: 'ct', messageId: 'm1', todayDate: '2026-09-15', now: new Date('2026-09-15T12:00:00Z') });
  const remember = tools.find((t) => t.name === 'remember')!;
  await remember.run(remember.parse({ text: 'CT prefers mornings for deep work', confidence: 'medium' }));
  expect(writeMemoryMock).toHaveBeenCalledWith('MentorMemory', expect.objectContaining({ text: 'CT prefers mornings for deep work', confidence: 'medium' }));
});
```

Note: these use `vi.doMock` (not the file-top `vi.mock`, which hoists and
would affect every test in the file) since only these two tests need
`@/lib/memory/client` mocked — the other existing tests in this file
don't touch memory at all.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/mentor/tools.test.ts`
Expected: FAIL — no tool named `search_memory`/`remember` yet

- [ ] **Step 3: Add the two tools**

In `src/lib/mentor/tools.ts`, add the import
`import { queryMemory, writeMemory } from '@/lib/memory/client';` and,
inside `buildMentorTools`, define:

```ts
  const searchMemory: BetaRunnableTool<{ query: string }> = {
    name: 'search_memory',
    description: "Search CT's memory graph — past digests, weekly letters, your own past inferences, and anything CT has imported from their own notes or other projects. Use this before answering something that might already have a documented pattern or past decision behind it.",
    input_schema: {
      type: 'object',
      properties: { query: { type: 'string', description: 'What to search for, in plain language' } },
      required: ['query'],
    },
    parse: (input) => input as { query: string },
    run: async ({ query }) => {
      const text = await queryMemory(query);
      return text || 'Nothing found in memory for that.';
    },
  };

  const remember: BetaRunnableTool<{ text: string; confidence: 'low' | 'medium' | 'high' }> = {
    name: 'remember',
    description: "Save a fact you've inferred about CT to memory, so future conversations don't need to be re-told it. State your own confidence honestly — CT can see and delete anything you save here.",
    input_schema: {
      type: 'object',
      properties: {
        text: { type: 'string' },
        confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
      },
      required: ['text', 'confidence'],
    },
    parse: (input) => input as { text: string; confidence: 'low' | 'medium' | 'high' },
    run: async ({ text, confidence }) => {
      await writeMemory('MentorMemory', { text, confidence, conversationDate: params.todayDate });
      return 'Saved.';
    },
  };
```

Add both to the returned `tools` array:
`return { tools: [readSchedule, proposeScheduleEdit, proposeTemplateEdit, searchMemory, remember], proposals };`

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/mentor/tools.test.ts`
Expected: PASS (6 tests, up from 4)

- [ ] **Step 5: Full unit suite and typecheck**

Run: `npm test && npm run typecheck`
Expected: both pass

- [ ] **Step 6: Commit**

```bash
git add src/lib/mentor/tools.ts src/lib/mentor/tools.test.ts
git commit -m "feat(mentor): search_memory and remember tools"
```

---

### Task 10: `/settings/memory` — view and delete mentor-written memories

**Files:**
- Create: `src/app/settings/memory/page.tsx`
- Create: `src/app/settings/memory/actions.ts`
- Create: `src/app/settings/memory/MemoryList.tsx`
- Modify: `src/app/settings/page.tsx` (add a link to the new page)

**Interfaces:**
- Consumes: `listMentorMemories`, `deleteMemory` (Task 6).

- [ ] **Step 1: Write the server action**

```ts
// src/app/settings/memory/actions.ts
'use server';

import { createServerSupabase } from '@/lib/supabase/server';
import { deleteMemory } from '@/lib/memory/client';

export async function deleteMentorMemoryAction(id: string): Promise<void> {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not signed in');
  await deleteMemory(id);
}
```

- [ ] **Step 2: Write the list component**

```tsx
// src/app/settings/memory/MemoryList.tsx
'use client';

import { useState } from 'react';
import type { MentorMemoryRow } from '@/lib/memory/client';
import { deleteMentorMemoryAction } from './actions';

export function MemoryList({ initial }: { initial: MentorMemoryRow[] }) {
  const [memories, setMemories] = useState(initial);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function remove(id: string) {
    setBusyId(id);
    await deleteMentorMemoryAction(id);
    setMemories((list) => list.filter((m) => m.id !== id));
    setBusyId(null);
  }

  if (memories.length === 0) return <p className="empty">The mentor hasn&apos;t saved anything about you yet.</p>;

  return (
    <ul className="sessions plain">
      {memories.map((m) => (
        <li key={m.id} data-rank="next">
          <span className="what">
            {m.text}
            <small>{m.confidence} confidence · {new Date(m.createdAt).toLocaleDateString()}</small>
          </span>
          <button className="btn btn-quiet" onClick={() => remove(m.id)} disabled={busyId === m.id}>
            {busyId === m.id ? 'Removing…' : 'Delete'}
          </button>
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 3: Write the page**

```tsx
// src/app/settings/memory/page.tsx
import { createServerSupabase } from '@/lib/supabase/server';
import { isOwner } from '@/lib/auth/isOwner';
import { listMentorMemories } from '@/lib/memory/client';
import { Placard } from '@/components/ui/Placard';
import { MemoryList } from './MemoryList';

export default async function MentorMemoryPage() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isOwner(user.email)) {
    return (
      <main className="shell" data-phase="day">
        <p className="note">Not signed in.</p>
      </main>
    );
  }

  const memories = await listMentorMemories();

  return (
    <main className="shell" data-phase="day">
      <header className="dept-head">
        <p className="placard phase-label">
          <span className="dot" /> Mentor memory
        </p>
      </header>
      <Placard>What the mentor has saved about you</Placard>
      <MemoryList initial={memories} />
    </main>
  );
}
```

- [ ] **Step 4: Link to it from the main settings page**

In `src/app/settings/page.tsx`, add a link inside the existing
`<div className="stepback">` block, alongside `<ExportLinks />`:

```tsx
        <Placard>Mentor memory</Placard>
        <Link className="btn btn-quiet" href="/settings/memory">
          View what the mentor has saved about you
        </Link>
```

Add the import `import Link from 'next/link';` if it isn't already
imported in this file (check first — it likely isn't, since this page
has no other links yet).

- [ ] **Step 5: Typecheck and full unit suite**

Run: `npm run typecheck && npm test`
Expected: both pass

- [ ] **Step 6: Commit**

```bash
git add src/app/settings/memory/ src/app/settings/page.tsx
git commit -m "feat(settings): view and delete mentor-written memories"
```

---

### Task 11: Backfill existing digests and weekly letters

**Files:**
- Create: `scripts/backfill-memory-graph.ts`

**Interfaces:**
- Consumes: `writeMemory` (Task 6, `src/lib/memory/client.ts`).

- [ ] **Step 1: Write the script**

```ts
// scripts/backfill-memory-graph.ts
//
// One-time: pushes every existing digest and weekly letter into the
// memory graph, so history that predates this feature isn't starting
// from zero. Run once after memory-api is deployed and MEMORY_API_URL/
// MEMORY_API_TOKEN are set (production .env.local, or .env.test.local
// against the test project):
//   npx tsx scripts/backfill-memory-graph.ts
import { config } from 'dotenv';
config({ path: process.env.BACKFILL_ENV_FILE ?? '.env.local' });

import { createAdminSupabase } from '@/lib/supabase/admin';
import { repositories } from '@/lib/db/repositories';
import type { RepositoryClient } from '@/lib/db/repository';
import { writeMemory } from '@/lib/memory/client';

async function main() {
  if (!process.env.MEMORY_API_URL) throw new Error('MEMORY_API_URL must be set before backfilling.');

  const admin = createAdminSupabase();
  const client = admin as unknown as RepositoryClient;
  const repos = repositories(client);

  const digests = (await repos.digests.list()).filter((d) => d.text !== null);
  for (const d of digests) {
    await writeMemory('DailyDigest', { date: d.date, text: d.text });
    console.log(`digest ${d.date} pushed`);
  }

  const letters = await repos.weeklyLetters.list();
  for (const l of letters) {
    await writeMemory('WeeklyLetter', { weekStart: l.week_start, text: l.letter });
    console.log(`weekly letter ${l.week_start} pushed`);
  }

  console.log(`Backfilled ${digests.length} digests and ${letters.length} weekly letters.`);
}

main().then(() => process.exit(0)).catch((err) => {
  console.error('backfill failed', err);
  process.exit(1);
});
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add scripts/backfill-memory-graph.ts
git commit -m "feat(memory): one-time backfill script for existing digests and weekly letters"
```

(This script is run manually, once, after deployment — not part of any
automated test suite. Running it against the test project first, with
`BACKFILL_ENV_FILE=.env.test.local npx tsx scripts/backfill-memory-graph.ts`,
is the natural way to prove it end-to-end before touching production.)

---

### Task 12: End-to-end proof

**Files:**
- Create: `e2e/mentor-memory.spec.ts`

**Interfaces:**
- Consumes: the full app-side feature (Tasks 6–10). Requires a real,
  deployed memory-api the test project's `.env.test.local` points at
  (`MEMORY_API_URL`/`MEMORY_API_TOKEN`) — this spec is the one place in
  this plan that needs the actual VPS service running, not just app-side
  code.

- [ ] **Step 1: Write the test**

```ts
// e2e/mentor-memory.spec.ts
import { test, expect } from '@playwright/test';

test('a mentor-written memory shows up on the settings page and can be deleted', async ({ page, request }) => {
  // Seed a memory directly through the real memory-api, the same way
  // mentor-tool-use.spec.ts seeds mentor_proposals directly — this spec
  // proves the settings-page round trip, not the LLM's decision to call
  // `remember` in the first place (already unit-tested in tools.test.ts).
  const apiUrl = process.env.MEMORY_API_URL!;
  const token = process.env.MEMORY_API_TOKEN!;
  const uniqueText = `Test memory ${Date.now()}`;
  await request.post(`${apiUrl}/memory`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { label: 'MentorMemory', properties: { text: uniqueText, confidence: 'medium', conversationDate: '2026-09-16' } },
  });

  await page.goto('/settings/memory');
  const row = page.locator('li', { hasText: uniqueText });
  await expect(row).toBeVisible();

  await row.getByRole('button', { name: 'Delete' }).click();
  await expect(row).not.toBeVisible({ timeout: 10_000 });
});
```

- [ ] **Step 2: Run it**

Run: `npx playwright test e2e/mentor-memory.spec.ts`
Expected: PASS (once `MEMORY_API_URL`/`MEMORY_API_TOKEN` for the test
project's memory-api deployment are in `.env.test.local` — this spec is
skipped-by-necessity, not by choice, until that deployment exists;
running the whole suite before then will show this one failing with a
clear "fetch failed" rather than something confusing)

- [ ] **Step 3: Run the full e2e suite to confirm no regressions**

Run: `npx playwright test`
Expected: all specs pass, including this new one once memory-api is live

- [ ] **Step 4: Commit**

```bash
git add e2e/mentor-memory.spec.ts
git commit -m "test(e2e): prove a mentor-written memory round-trips through settings"
```
