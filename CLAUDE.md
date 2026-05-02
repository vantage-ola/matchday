# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Matchup is a turn-based football strategy game on a 22×11 grid. Two teams of 11 take turns moving players, passing, and shooting. Possession flips every move. The engine is deterministic — no randomness, pure positional tactics.

Active code lives in `matchup/`. The previous prototype lives in `old/` and should be ignored.

## Structure

```
matchup/
├── engine/
│   ├── index.ts        # Engine class — game loop, move application, interception math
│   ├── types.ts        # All types, constants, grid helpers (GridPosition, Player, GameState)
│   ├── formations.ts   # 6 formation presets, state init, player/ball queries
│   ├── moves.ts        # Move validation (direction, bounds, occupied cells)
│   ├── render.ts       # CLI ASCII pitch renderer + status display
│   ├── test.ts         # 114-test suite with custom assert runner
│   └── README.md       # Full technical spec
├── simulation/
│   ├── simulate.ts     # AI strategies, getValidMoves(), Simulator class
│   └── run.ts          # CLI runner for auto-play simulations
└── web/                # React 19 + Vite + shadcn/ui frontend
    └── src/
        ├── App.tsx             # Phase-based router (setup → playing → fullTime)
        ├── lib/engine.ts       # Engine bridge — re-exports from engine + simulation
        ├── hooks/useGame.ts    # Central game state management hook
        └── components/
            ├── game/           # Pitch, PlayerToken, ScoreBar, MoveResult, GameScreen, FullTimeScreen
            └── setup/          # SetupScreen (mode + formation selection)
```

## Commands

```bash
bun matchup/engine/test.ts           # Run engine test suite (114 tests)
bun matchup/simulation/run.ts        # Run AI vs AI simulation
bun --cwd matchup/web dev            # Start web dev server
bun --cwd matchup/web build          # Production build
```

Use `bun` — not npm/node/npx.

## Game Modes

- **1v1 Local Co-op**: Two humans on one screen, taking turns. Possession indicator shows whose turn it is.
- **vs AI**: Human plays home, AI (`aggressiveStrategy` from simulation) plays away. AI moves animate one-by-one with ~700ms delays.

## Engine Architecture

### Grid
- **22 columns × 11 rows** (rows `a`-`k`, cols `1`-`22`)
- Home goal: col 1, rows e-g. Away goal: col 22, rows e-g
- Home attacks right (→), away attacks left (←)
- Ball starts with home's first forward

### Core Loop
```
Engine.init(homeFormation?, awayFormation?) → Engine
engine.applyMove(playerId, gridPosition) → MoveResult
engine.getState() → GameState (deep clone, immutable)
```

Each `applyMove` call:
1. Validates move (direction, bounds, occupancy, AP budget)
2. Detects type: dribble / pass / shoot / run / tackle
3. For passes: checks interception via point-to-line projection (threshold: 1.2 cells) and the open-receiver rule
4. For shots: checks nearby defenders (distance < 2) → blocked or goal
5. Updates possession + AP (deducts cost, flips to opponent on AP=0 or turnover)
6. Deducts 10 seconds from timeRemaining
7. Returns `MoveResult` with outcome, new state, flags

### Possession System (Action Points)
- Each phase starts with **3 AP**. Costs: pass/run = 1, dribble/shoot = 2.
- AP hits 0 → possession flips, new owner gets fresh 3 AP.
- Tackles, interceptions, blocked shots, missed shots → possession flips with fresh 3 AP.
- Goal → teams reset to formation, conceding team gets ball at their forward with fresh 3 AP.
- `engine.endTurn()` flips possession voluntarily — no clock cost.

### Movement Rules
- **Ball carrier**: forward or sideways only when dribbling/shooting; passes to teammates may go backward.
- **Teammates**: forward, sideways, or backward.
- **No cell sharing**: occupied cells block movement.
- **Passing**: ball carrier to teammate, straight line, max 7 cells.
- **Open receiver**: pass blocked if **2+ defenders** sit within 1 cell of the target.
- **Shooting**: must be within 3 cells of opponent goal.

### Key Types

```typescript
GridPosition { col: number; row: string }     // { col: 9, row: 'f' }
Player { id, name, role, team, position, hasBall }
GameState { players[], ball, ballCarrierId, possession, moveNumber, score, timeRemaining, status, actionPoints }
MoveResult { valid, outcome, newState, scored?, possessionChange? }

Role: 'gk' | 'def' | 'mid' | 'fwd'
Team: 'home' | 'away'
Outcome: 'success' | 'intercepted' | 'blocked' | 'tackled' | 'goal' | 'miss'
GameStatus: 'playing' | 'halfTime' | 'fullTime' | 'abandoned'
```

### Formations
Six presets: `4-3-3`, `4-4-2`, `3-5-2`, `5-3-2`, `4-2-3-1`, `3-4-3`. Each defines exact grid positions for 11 home + 11 away players. Player IDs follow pattern: `home_gk`, `home_def1`...`home_def4`, `home_mid1`...etc.

### Time Model
- 600 seconds total (10 minutes)
- 10 seconds per move → ~60 moves max
- Half-time detection around the midpoint
- `fullTime` when timeRemaining hits 0

### Interception Math
Pass interception uses dot-product projection to find closest point on the pass line to each defender. If distance < 1.2 cells → intercepted, possession flips.

## Design Principles
- **Zero external dependencies** — pure TypeScript logic
- **Deterministic** — no randomness in current implementation
- **Immutable returns** — `getState()` deep clones, `applyMove()` returns new state
- **Validation first** — `validateMove()` checks legality before any state mutation

## Brand & Voice

- Product name is **Matchup** — capital M, lowercase u
- Tagline: "Play the match. Own the result."
- Voice: confident, minimal. Like someone who knows football and doesn't need to prove it
- Target audience: Nigerian football fan, 18-30, mobile-first
- Currency: Naira (N) — currently fake/in-app

## Documentation

- `matchup/engine/README.md` — Full technical spec (grid, rules, data structures, API)
- `docs/IDEA_BRIEF.md` — Game design intent and competitive distinction
- `docs/BRAND_GUIDELINES.md` — Brand pillars, voice and tone
