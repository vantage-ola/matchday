# AGENTS.md

Guidance for AI coding agents (Claude Code, Cursor, Aider, Copilot, etc.) working in this repository.

## Project Overview

Matchup is a turn-based football strategy game on a 22×11 grid. Two teams of 11 alternate single actions, chess-style: every successful move ends your turn. The engine uses an injectable RNG (defaults to `Math.random`) for tackle gambles; tests pin RNG for determinism.

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
│   ├── test.ts         # Engine test suite with custom assert runner
│   └── README.md       # Full technical spec
├── simulation/
│   ├── simulate.ts     # AI strategies, getValidMoves(), Simulator class
│   └── run.ts          # CLI runner for auto-play simulations
└── web/                # React 19 + Vite + shadcn/ui frontend
    ├── public/_redirects   # SPA fallback for Netlify / Cloudflare Pages
    └── src/
        ├── main.tsx           # Wraps App in BrowserRouter + ThemeProvider
        ├── App.tsx            # react-router Routes; mirrors engine phase → URL
        ├── lib/
        │   ├── engine.ts      # Engine bridge — re-exports from engine + simulation
        │   └── storage.ts     # localStorage save + IndexedDB history/profile
        ├── hooks/useGame.ts   # Central game state management hook
        └── components/
            ├── NotFoundScreen.tsx   # Branded 404 ("Off the pitch")
            ├── menu/                # MenuScreen (landing)
            ├── setup/               # SetupScreen (mode + formation selection)
            ├── game/                # Pitch, PlayerToken, ScoreBar, MoveResult, GameScreen, FullTimeScreen
            ├── tutorial/            # TutorialScreen
            ├── rulebook/            # RulebookScreen
            ├── history/             # HistoryScreen (clickable rows → replay)
            ├── replay/              # ReplayScreen
            └── profile/             # ProfileScreen
```

## Routing

The web app uses `react-router-dom` v7. `BrowserRouter` wraps `App` in `main.tsx`; `App.tsx` declares all routes and mirrors engine phase changes (`playing`, `fullTime`) into the URL via a `useEffect`.

| Path                | Screen                                                      |
| ------------------- | ----------------------------------------------------------- |
| `/`                 | `MenuScreen`                                                |
| `/play`             | `SetupScreen`                                               |
| `/match`            | `GameScreen` (redirects to `/` if no engine state)          |
| `/fulltime`         | `FullTimeScreen` (redirects to `/` if no engine state)      |
| `/tutorial`         | `TutorialScreen`                                            |
| `/rulebook`         | `RulebookScreen`                                            |
| `/history`          | `HistoryScreen` — rows link to `/replay/:matchId`           |
| `/replay/:matchId`  | `ReplayScreen` — loads via `loadMatchById`; 404 if missing  |
| `/profile`          | `ProfileScreen`                                             |
| `*`                 | `NotFoundScreen` (branded 404)                              |

Engine state lives in memory inside `useGame`, so deep-linking directly to `/match` or `/fulltime` after a reload bounces back to `/` — players resume via "Continue" on the menu, which reads the localStorage save.

`public/_redirects` provides the SPA host fallback (`/*  /index.html  200`) for Netlify and Cloudflare Pages.

## Commands

```bash
bun matchup/engine/test.ts           # Run engine test suite
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
Engine.init(homeFormation?, awayFormation?, rng?) → Engine
engine.applyMove(playerId, gridPosition) → MoveResult
engine.resumeFromHalfTime() → void     // status → 'playing'
engine.getState() → GameState (deep clone, immutable)
```

Each `applyMove` call:
1. Validates move (bounds, occupancy, distance — 1 cell for dribble/run/tackle, up to 10 for pass/shoot).
2. Detects type: dribble / pass / shoot / run / tackle.
3. For passes: geometric interception check only (defender within 1.2 of pass line). No swarm rule, no distance-tiered RNG.
4. For tackles: fixed 80% success at 1 cell. On failure, tackler is pushed back 1 cell, carrier keeps ball, outcome `'tackleFailed'`. The turn still ends.
5. For shots: nearby defenders (distance < 2) → blocked or goal.
6. Possession flips: every successful action ends the actor's turn. Tackles/intercepts/misses/blocks/goals send possession to whichever team now holds the ball; normal dribble/pass/run hands possession to the opponent.
7. Deducts 10 seconds from `timeRemaining`. Goal-reset (if any) runs first; then half-time check fires when crossing 2700s.
8. Returns `MoveResult` with outcome, new state, flags.

### Turn Structure (Chess-Style)
- **One action per turn.** No AP, no phase budget, no skip-phase. Every successful move ends the turn and flips possession.
- Tackle / interception / missed shot / blocked shot / goal kickoff all transfer possession naturally because the ball changes hands.
- A failed tackle (`'tackleFailed'`) keeps the ball with the carrier but still ends the defender's turn — the failed gamble was the action.
- `engine.resumeFromHalfTime()` only flips status back to `'playing'`. Possession is whatever it was when half-time fired.
- RNG is injectable: `Engine.init(home, away, rng)` defaults to `Math.random`. Tests inject `() => 0` (always-fail tackle) / `() => 1` (always-succeed tackle) for determinism.

### Movement Rules
- **Dribble / Run / Tackle**: exactly 1 cell, any direction (forward, sideways, backward).
- **Pass / Shoot**: up to 10 cells, any direction. Backward passes are legal.
- **No cell sharing**: occupied cells block movement.
- **Passing onto an opponent's cell**: invalid.
- **Pass interception**: geometric only — defender within 1.2 of the pass line. No swarm rule.
- **Shooting**: target the opponent's goal column from up to 10 cells; defenders within 2 cells of the strike block.

### Key Types

```typescript
GridPosition { col: number; row: string }     // { col: 9, row: 'f' }
Player { id, name, role, team, position, hasBall }
GameState { players[], ball, ballCarrierId, possession, score, timeRemaining, status, homeFormation, awayFormation, halfTimeTriggered }
MoveResult { valid, outcome, newState, scored?, possessionChange? }

Role: 'gk' | 'def' | 'mid' | 'fwd'
Team: 'home' | 'away'
Outcome: 'success' | 'intercepted' | 'blocked' | 'tackled' | 'tackleFailed' | 'goal' | 'miss'
GameStatus: 'playing' | 'halfTime' | 'fullTime' | 'abandoned'
```

### Formations
Six presets: `4-3-3`, `4-4-2`, `3-5-2`, `5-3-2`, `4-2-3-1`, `3-4-3`. Each defines exact grid positions for 11 home + 11 away players. Player IDs follow pattern: `home_gk`, `home_def1`...`home_def4`, `home_mid1`...etc.

### Time Model
- 5400 seconds total (90 minutes)
- 10 seconds per move
- Half-time fires when `timeRemaining` first crosses **2700s**: status becomes `'halfTime'`, blocking input until `resumeFromHalfTime()`
- A goal scored on the same move that crosses 2700s: goal-reset runs first, then half-time triggers — score counts before the break
- `fullTime` when `timeRemaining` hits 0 (checked before half-time, so a final-second goal doesn't get rerouted into HT)

### Interception Math
Pass interception uses dot-product projection to find closest point on the pass line to each defender. If distance < 1.2 cells → intercepted, possession flips. This is the only failure mode for a pass.

## Design Principles
- **Zero external dependencies** in the engine — pure TypeScript logic
- **Deterministic with injectable RNG** — production uses `Math.random`; tests pin RNG via the `Engine` constructor
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
