# Life Changer

CT's single-user ADHD companion PWA. Read these before answering questions about it.

## Knowledge graph

This project has its own graph at `graphify-out/` (346 nodes, 673 edges, 20 communities),
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

## Standing rules

- Write "CT" or "they" — CT's pronouns are unstated.
- Progression guardrails are binding: attributes and badges never fall, badges count
  cumulative totals and never streaks, rest earns, grinding while depleted earns nothing.
- No shame language and no streaks in any user-facing copy.
- Never create accounts or handle CT's API keys or passwords — Plans 3 and 4 need CT to do
  that part themselves.
- `src/core/**` is pure: no I/O, no clock, no randomness. Tests are colocated.
- Run `npm test` and `npm run typecheck` before calling work done.
