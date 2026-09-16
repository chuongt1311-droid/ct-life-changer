# Life Changer

CT's single-user ADHD companion PWA. Read these before answering questions about it.

## Knowledge graph

This project has its own graph at `graphify-out/` (1169 nodes, 3260 edges, 72 communities),
built from the source **and** the spec, plans, PRODUCT.md and DESIGN.md — so it answers
design and product questions, not only code ones.

- Ask it first: `graphify query "<question>"` from this directory. Also
  `graphify path "<A>" "<B>"` for how two things relate, and
  `graphify explain "<concept>"` for one concept.
- It is scoped to this project. The portfolio-wide graph at `D:\CT's Portfolio\graphify-out`
  is code-only and much larger; prefer this one for anything Life Changer.
- Read `graphify-out/GRAPH_REPORT.md` only for a broad architecture sweep.
- After changing code, run `graphify update .` from here. After changing the spec, plans,
  PRODUCT.md or DESIGN.md, run `/graphify . --update` so the docs are re-read semantically —
  `graphify update` is AST-only and will not see them.

## The documents that decide things

| File | What it settles |
|---|---|
| `docs/superpowers/specs/2026-09-11-daily-loop-design.md` | The spec. §8b is the MyCareer progression rules. |
| `docs/superpowers/plans/2026-09-11-daily-loop-00-roadmap.md` | Six plans, what each delivers, what CT must do. |
| `PRODUCT.md` | Product truth, principles, and the career-mode guardrails. |
| `DESIGN.md` | The Performance Department design system, recorded from the built prototype. |

## Sub-projects beyond the original roadmap

The 6-plan roadmap above is done and deployed (**https://ct-life-changer.vercel.app**).
Further work since then follows the same brainstorm → spec → plan → implementation cycle,
each getting its own dated spec/plan under `docs/superpowers/`:

- **Shipped:** flexible schedule editing on Today (2026-09-15 spec/plan), future-date
  editing via `/plan-ahead` (2026-09-15), mentor tool use — `read_schedule`,
  `propose_schedule_edit`, `propose_template_edit` via the Anthropic Beta Tool Runner
  (`src/lib/mentor/tools.ts`), every proposal previewed and inert until CT confirms.
- **Spec + plan written, not yet built:** a persistent mentor memory graph — FalkorDB
  on CT's VPS, imported from CT's local graphify graphs, replacing the old blanket
  digest/weekly-letter context window with targeted retrieval. See
  `docs/superpowers/specs/2026-09-16-mentor-memory-graph-design.md` and its plan. This
  will add a new `memory-api/` subdirectory — a **separately deployed** Node/Express
  service (Docker Compose on the VPS), not part of the Next.js app's own Vercel build;
  don't expect its files to show up in a normal `npm test`/`npm run typecheck` from the
  repo root once it exists (its own `vitest.config.ts` only globs its own `src/`).

## Standing rules

- Write "CT" or "they" — CT's pronouns are unstated.
- Progression guardrails are binding: attributes and badges never fall, badges count
  cumulative totals and never streaks, rest earns, grinding while depleted earns nothing.
- No shame language and no streaks in any user-facing copy.
- Never create accounts or handle CT's API keys or passwords — Plans 3 and 4 need CT to do
  that part themselves.
- `src/core/**` is pure: no I/O, no clock, no randomness. Tests are colocated.
- Run `npm test` and `npm run typecheck` before calling work done.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
