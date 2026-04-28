# MatchDay Backend — Game Engine Integration Guide

> This document describes the new spatial 11-a-side game engine (Phase 1). Use this to integrate the frontend.

---

## Overview

The game now uses **11 player caps per side** positioned on a **15×9 grid**. Instead of selecting abstract moves from a list, players draw lines to indicate ball movement and defensive positioning.

### Key Changes from v1 (button-based)

| Old (v1) | New (Phase 1) |
|---|---|
| 2 players (p1, p2) | 11 caps per side (GK, 4 DEF, 3 MID, 3 FWD) |
| Move: `'pass'` / `'shoot'` | Move: `{ fromCapId, toPosition, moveType }` |
| Score: `{ p1: number, p2: number }` | Score: `{ home: number, away: number }` |
| 10×9 grid | 15×9 grid |
| Abstract possession | Real formation + real player names from squad data |

---

## The Pitch

```
col:  0  1  2  3  4  5  6  7  8  9  10 11 12 13 14
      ▲                                       ▲
   home goal (col 0)                  away goal (col 14)
```

- **Home** attacks left → right (goal at col 0)
- **Away** attacks right → left (goal at col 14)
- Ball starts at center (7, 4) with home's center forward

---

## Types

### GameState

```typescript
interface GameState {
  sessionId: string;
  phase: number;           // 1–6
  totalPhases: number;
  turn: number;            // 1–5 per phase
  movesPerPhase: number;
  attackingSide: 'home' | 'away';

  ball: {
    position: { col: number; row: number };
    carrierCapId: string | null;  // e.g. "home_fwd_2"
  };

  formations: {
    home: Formation;
    away: Formation;
  };

  turnStatus: 'waiting_both' | 'waiting_home' | 'waiting_away' | 'resolving';
  score: { home: number; away: number };
  stats: {
    home: { possession: number; tackles: number; shots: number; assists: number };
    away: { possession: number; tackles: number; shots: number; assists: number };
  };
  events: MatchEvent[];
  lastResolution: SpatialResolution | null;
}
```

### Formation

```typescript
interface Formation {
  side: 'home' | 'away';
  shape: string;  // "4-3-3"
  caps: PlayerCap[];
}

interface PlayerCap {
  id: string;           // "home_gk_1", "away_mid_3"
  name: string;         // "Saka", "Rice" — real names if squad data available
  shirtNumber: number;
  role: 'gk' | 'def' | 'mid' | 'fwd';
  side: 'home' | 'away';
  position: { col: number; row: number };
  rating: number;      // 1-99, derived from marketValue
  hasBall: boolean;
}
```

### Attacker Move (ball carrier)

```typescript
interface AttackerMove {
  side: 'attacker';
  fromCapId: string;           // must be the ball carrier
  toPosition: { col: number; row: number };
  moveType: 'pass' | 'through_pass' | 'cross' | 'long_ball' | 'shot' | 'run';
}
```

### Defender Move (when opponent has the ball)

```typescript
interface DefenderMove {
  side: 'defender';
  fromCapId: string;           // which cap to move
  toPosition: { col: number; row: number };
  action: 'press' | 'tackle' | 'intercept' | 'hold_shape' | 'track_back';
}
```

---

## WebSocket Events

### Connect

```
ws://server/matchup?sessionId=<uuid>&token=<jwt>
```

### Server → Client

**`GAME_STATE`**
- Sent on connect and on request
- Payload: `GameState`

**`MOVE_COMMITTED`**
- When you commit a move
- Payload: `{ playerSide: 'home' | 'away', turnStatus: string }`

**`OPPONENT_COMMITTED`**
- When opponent commits (no move revealed)
- Payload: `{}`

**`TURN_RESOLVED`**
- After both commit → resolution complete
- Payload:

```typescript
{
  gameState: GameState,
  resolution: {
    attackerMove: AttackerMove,
    defenderMove: DefenderMove,
    outcome: 'advance' | 'intercept' | 'tackle' | 'goal' | 'save' | 'miss' | 'through' | 'press_won' | 'blocked' | 'wide',
    ballFinalPosition: { col, row },
    interceptionPoint: { col, row } | null,
    movedCaps: { capId: string; fromPosition: { col, row }; toPosition: { col, row } }[],
    possessionChange: boolean,
    goalScored: boolean,
    scorerCapId: string | null,
  }
}
```

**`PHASE_TRANSITION`**
- When phase ends and roles swap
- Payload: `{ newPhase: number, attackingSide: 'home' | 'away', state: GameState }`

**`MATCHUP_COMPLETE`**
- Game over
- Payload: `{ finalState: GameState, result: { homeGoals, awayGoals, homePossession, awayPossession } }`

### Client → Server

**`COMMIT_MOVE`**
- Commit your move for the turn
- Payload: `{ move: GameMove }`

## Move Payload Format

```typescript
// Example: Attacking — pass from ball carrier to a teammate
{
  move: {
    side: 'attacker',
    fromCapId: 'home_fwd_2',
    toPosition: { col: 8, row: 4 },
    action: 'pass'
  }
}

// Example: Attacking — shoot toward goal
{
  move: {
    side: 'attacker',
    fromCapId: 'home_fwd_2',
    toPosition: { col: 14, row: 4 },
    action: 'shoot'
  }
}

// Example: Defending — press the ball carrier
{
  move: {
    side: 'defender',
    fromCapId: 'away_mid_1',
    toPosition: { col: 10, row: 4 },
    action: 'press'
  }
}
```

**`GET_GAME_STATE`**
- Request current state
- Payload: `{}`

**`PING`**
- Heartbeat
- Payload: `{}`

---

## HTTP API

### `GET /api/sessions/:id`

Returns session + game state.

```typescript
{
  session: {
    id: string;
    fixtureId: string;
    player1Id: string;
    player2Id: string;
    player1Side: 'home' | 'away';
    player2Side: 'home' | 'away';
    stakePerPlayer: number;
    pot: number;
    gameMode: 'matchup_only' | 'real_match';
    status: string;
    homeTeam: string;
    awayTeam: string;
    homeTeamColors: { primary: string; secondary: string; text: string };
    awayTeamColors: { primary: string; secondary: string; text: string };
  },
  gameState: GameState,
  playerSide: 'home' | 'away'  // which side the authenticated user is playing
}
```

---

## Frontend Implementation Guide

### Step 1: Render the Pitch

1. Draw a 15×9 grid (CSS grid or SVG)
2. Render all 22 caps as circles/icons on the grid
3. Highlight the ball carrier (e.g., a different color or animation)
4. Draw goal areas at col 0 and col 14

### Step 2: Handle Input

**Attacker (you have the ball):**
1. Tap on the ball carrier to select
2. Draw a line to another player (pass), into space (run), toward goal (shoot), or through defender (through_pass)
3. `moveType` is determined by:
   - To another cap in front = `pass`
   - Through a defensive gap toward striker = `through_pass`
   - Cross into box from wide position = `cross` (if starting wide and targeting box)
   - Long distance (>8 cols) into space = `long_ball`
   - Toward opponent goal + close = `shot`
   - To empty space in front = `run`

**Defender (opponent has the ball):**
1. Tap on any defender
2. Draw line toward ball/wrongdoer = `press` / `tackle`
3. Draw to passing lane = `intercept`
4. Draw backward/stay back = `hold_shape`
5. Sprint back to defensive position = `track_back`

### Step 3: Animate Resolution

When `TURN_RESOLVED` arrives:
1. Draw both player's lines on the pitch
2. Animate the ball along the attacker's line
3. If intercepted, show interception point
4. If goal, show goal celebration
5. Update cap positions based on `movedCaps`
6. Update ball position
7. Update score/turn counter

### Step 4: Formation Display

Show 11 caps per side. Get names from `formations.home.caps` / `formations.away.caps`. Display cap name and shirt number above each cap.

### Step 5: Game Flow

```
1. Wait for turn → ball with attacking side
2. Attacker draws line → commits AttackerMove
3. Defender draws line → commits DefenderMove
4. Both commit → TURN_RESOLVED received
5. Animate result
6. If possession change → roles flip, defender becomes attacker
7. Repeat until phase ends (turn > movesPerPhase)
8. Phase ends → PHASE_TRANSITION
9. Repeat until phase > totalPhases
10. MATCHUP_COMPLETE → show final stats
```

---

## Squad Data

When a session is created, the backend attempts to fetch real squad data from the football API. If available, caps get:
- Real names (e.g., "B. Saka", "D. Rice")
- Shirt numbers from the lineup
- Rating (1-99) derived from market value

If unavailable, caps use generic names (`GK 1`, `DEF 1`, `MID 1`, etc.) with default ratings.

## Player Ratings

Player ratings (1-99) affect move resolution:
- Higher rating = bonus to success probability
- Rating derived from marketValue: `rating = min(99, floor(marketValue / 1_000_000))`
- Example: €80M player = rating 80

Ratings are included in each `PlayerCap` object.

---

## Socket Errors

| Error | Meaning |
|---|---|
| `Invalid move format` | Missing `fromCapId` or `toPosition` |
| `Not the ball carrier` | Only the ball carrier can initiate attacks |
| `Session not found` | Invalid session ID |
| `Session is not active` | Game already ended |
| `Not authorized` | You're not a player in this session |
| `Already committed a move this turn` | You've already moved |
| `Turn is already being resolved` | Wait for current resolution |

---

## Testing

To test locally:

```bash
cd backend
bun run dev
```

Then connect via WebSocket at `ws://localhost:3001/matchup?sessionId=<session-id>&token=<jwt>`.

---

## Migration Notes for Existing Code

- Old `Move` type removed — all moves are `GameMove`
- Old `Resolution` type replaced by `SpatialResolution`
- `GameState.players.p1/p2` replaced by `GameState.formations.home/away`
- `state.attackingPlayer` ('p1'/'p2') replaced by `state.attackingSide` ('home'/'away')
- Score uses 'home'/'away' keys instead of 'p1'/'p2'
- Match events use `side` instead of `player`

The API routes handle the backward mapping for the database internally.