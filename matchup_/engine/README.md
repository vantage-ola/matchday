```markdown
# ⚽ Matchup Engine

A deterministic, turn-based tactical football (soccer) engine written in pure TypeScript. Designed to power 1v1 hot-seat multiplayer, tactical puzzles, or AI-simulated matches.

Unlike real-time physics engines, Matchup treats football like a strategy game. The pitch is a 22x11 grid. Players take turns moving, passing, shooting, and tackling within strict, mathematically defined rules.

---

## 📖 How It Works

### The Pitch
The game takes place on a grid:
* **Columns:** 1 to 22 (Home defends Col 1, attacks Col 22).
* **Rows:** `a` to `k` (Top to bottom).
* **Goals:** Span rows `e`, `f`, `g` at Col 1 (Home) and Col 22 (Away).

### Possession & Turns
* **3-Move Rule:** Possession is shared. Each phase allows exactly 3 moves. Either team can use these moves (e.g., Home passes, Away tackles, Home shoots). After 3 moves, if possession hasn't changed hands via a tackle or interception, it automatically flips to the other team.
* **10-Second Ticks:** Every single move drains 10 seconds from the match clock. A full game lasts 60 moves (10 simulated minutes).

### Move Types
The engine automatically classifies your intended move based on context:
1. **Dribble:** Move the ball carrier to an empty cell (Max 2 cells). Cannot go backward.
2. **Pass:** Target a teammate's cell (Max 7 cells). *Backward passes are allowed* to relieve pressure.
3. **Shoot:** Target the goal column when in range (Max 3 cells). Can miss wide or be blocked by nearby defenders.
4. **Off-Ball Run:** Move a player without the ball into an empty space (Max 3 cells). Can move in any direction.
5. **Tackle:** Move a defender onto the opposing ball carrier's cell (Max 2 cells). **Positions swap** (tackler takes the ball spot, carrier is pushed back to where the tackler was), and possession flips immediately.

### Interceptions
When a pass is made, the engine draws an invisible line from the passer to the receiver. If an opposing defender is within `1.2` grid units of this line, the pass is intercepted and possession flips.

---

## ✅ What It Does

* **100% Deterministic:** Given the same starting state and inputs, it produces the exact same results every time.
* **6 Formations:** `4-3-3`, `4-4-2`, `3-5-2`, `5-3-2`, `4-2-3-1`, `3-4-3`.
* **Strict Validation:** Prevents teleporting, backward dribbling, moving through players, and shooting from distance.
* **Built-in Simulation Harness:** Includes an `aggressiveStrategy` AI and a `Simulator` class to run matches to completion and generate structured match reports.
* **Terminal Renderer:** Built-in ASCII pitch renderer for debugging and CLI games.

---

## 🚫 What It Does NOT Do (Yet)

* **Real-time physics:** There are no velocities, momentum, or curved shots. It is strictly grid-based.
* **Player Stats:** Currently, all players are identical except for their role. There is no "Pace" or "Shooting" attribute (yet).
* **Offside Rules:** Not implemented.
* **Simultaneous Movement:** Players act one at a time.

---

## 🎮 Frontend Integration (1v1 Co-op)

To build a frontend (React, Vue, Vanilla JS) for two physical players sharing a screen, you don't need to write any game logic. You only need to build a UI that loops through this state machine:

### The Game Loop

#### 1. Initialize the Game
When the player clicks "Start Match", initialize the engine.
```typescript
import { Engine, getValidMoves } from 'matchup_/engine';

const engine = Engine.init('4-3-3', '4-4-2'); 
let currentState = engine.getState();
```

#### 2. Render the Pitch
Loop through `currentState.players` and `currentState.ball` to render your SVG/Canvas/CSS grid. Color code by `player.team` and highlight `player.hasBall === true`.

#### 3. Handle Player Selection
When a user clicks a player on the pitch:
```typescript
// Ensure they clicked a player on the team that currently has possession
if (clickedPlayer.team !== currentState.possession) return; 

// Ask the engine what this player can do
const validMoves = getValidMoves(currentState, currentState.possession)
  .filter(m => m.playerId === clickedPlayer.id);

// Highlight these cells on your frontend UI
highlightCells(validMoves.map(m => m.to)); 
```

#### 4. Execute the Move
When the user clicks a highlighted valid cell:
```typescript
const result = engine.applyMove(clickedPlayer.id, targetCell);

// result.outcome tells you what happened:
// 'success' -> normal move
// 'tackled' -> show a tackle animation, possession flips
// 'intercepted' -> show interception animation
// 'goal' -> show goal screen/animation!
// 'miss' / 'blocked' -> show failed shot animation

// Update your UI state
currentState = result.newState;
```

#### 5. Handle Goal Kicks / Turnovers
If `result.outcome === 'goal'`, the engine automatically resets all players to their base formation positions and gives the ball to the conceding team. Your frontend just needs to detect this state change and smoothly reset the player positions on screen.

---

## 🧠 API Quick Reference

### `Engine`
The core state machine.
* `new Engine(state?)` / `Engine.init(home, away)`: Create a game instance.
* `engine.getState(): GameState`: Returns a deep-cloned snapshot of the game (safe to store in React state).
* `engine.applyMove(playerId, to): MoveResult`: The single source of truth for executing actions.
* `engine.getBallCarrier(): Player`: Quick helper to find who has the ball.

### `getValidMoves(state, team)`
**This is the most important function for frontend devs.** 
It calculates all legal moves for a team based on the current board state, respecting distances, backward rules, and tackle ranges. You do not need to calculate this yourself.

### `Simulator`
For AI vs AI or background simulations.
* `new Simulator({ homeFormation, awayFormation, verbose: true }).run()`: Plays a full game and returns a `SimulationResult` containing an array of `MatchEvent` objects (goals, tackles, etc.).

---

## 🛠️ Developer Setup

```bash
# Install (if using npm/yarn)
npm install

# Run the test suite (96 tests)
bun run test

# Run a simulated match in your terminal
bun run simulate
```

---

## 🗺️ Roadmap
* [ ] **Player Attributes:** Adding speed, passing accuracy, and tackle success rates.
* [ ] **Stamina/Fatigue:** Moves cost more energy based on distance.
* [ ] **Set Pieces:** Corner kicks and free kicks.
* [ ] **WebSocket Server:** A tiny wrapper to allow `Engine` instances to be hosted and synced for online 1v1 multiplayer.