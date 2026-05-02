# Matchday

Turn-based football strategy on a 22×11 grid. Two teams of 11 take turns moving, passing, and shooting. Each phase runs on a 3-Action-Point budget and possession flips when the budget runs out (or on a tackle, interception, or blocked shot). The engine is deterministic — no randomness, pure positional tactics. An in-app rulebook is reachable from the setup screen and from the in-game `?` button.

## Layout

```
matchup/
├── engine/        # Pure TypeScript game engine (118 tests)
├── simulation/    # AI strategies + AI vs AI runner
└── web/           # React 19 + Vite + shadcn/ui frontend
old/               # Previous prototype — ignore
docs/              # Idea brief, brand guidelines
```

## Commands

```bash
bun matchup/engine/test.ts        # Run engine tests
bun matchup/simulation/run.ts     # AI vs AI simulation
bun --cwd matchup/web dev         # Start web app
```

Use `bun` — not npm/node/npx.

## Game modes

- **1v1 Local Co-op** — two humans, one screen
- **vs AI** — human plays home, `aggressiveStrategy` plays away

## Docs

- `matchup/engine/README.md` — engine spec (grid, rules, API)
- `CLAUDE.md` — guidance for Claude Code
- `docs/IDEA_BRIEF.md` — design intent
- `docs/BRAND_GUIDELINES.md` — voice and tone
