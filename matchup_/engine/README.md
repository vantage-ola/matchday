# Matchup Engine — Technical Specification

## 1. Grid & Pitch

```
22 columns × 11 rows (a-k)

        HOME attacks → → → → → → →          AWAY
        ══════════════════════════════════
 A   ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  │  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·
 B   ·  · HD ·  ·  ·  ·  ·  ·  ·  │  ·  ·  ·  ·  ·  ·  ·  · AD ·  ·
 C   ·  ·  ·  ·  · HM ·  ·  ·  ·  │  ·  ·  ·  ·  · AM ·  ·  ·  ·  ·
 D   ·  · HD ·  ·  ·  ·  · HF* ·  │  ·  · AF ·  ·  ·  ·  · AD ·  ·
 E ▓▓▓▓ ·  ·  ·  · HM ·  ·  ·  ·  │  ·  ·  ·  ·  · AM ·  ·  ·  · ▓▓▓▓
 F ▓HGK ·  ·  ·  ·  ·  ·  · HF ·  │  ·  · AF ·  ·  ·  ·  ·  ·  · AGK▓
 G ▓▓▓▓ ·  ·  ·  ·  ·  ·  ·  ·  ·  │  ·  ·  ·  ·  ·  ·  ·  ·  ·  · ▓▓▓▓
 H   ·  · HD ·  ·  ·  ·  · HF ·  │  ·  · AF ·  ·  ·  ·  · AD ·  ·
 I   ·  ·  ·  ·  · HM ·  ·  ·  ·  │  ·  ·  ·  ·  · AM ·  ·  ·  ·  ·
 J   ·  · HD ·  ·  ·  ·  ·  ·  ·  │  ·  ·  ·  ·  ·  ·  ·  · AD ·  ·
 K   ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  │  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·
        ══════════════════════════════════

Column 1:   HOME GOAL (rows e, f, g)
Column 11:  Midfield line
Column 22:  AWAY GOAL (rows e, f, g)

Rows a-k: a (top) to k (bottom)
- Goals span rows e, f, g (3 rows)
- Ball starts at f11: row f, col 11 (center)
- HGK = Home Goalkeeper, HD = Home Defender, HM = Home Mid, HF = Home Forward
- * = has ball
```
22 columns × 11 rows (a-k)

     a  b  c  d  e  f  g  h  i  j  k
  1  .  .  .  .  █  █  █  .  .  .  .  ← GOAL (home, e1-g1)
  2  .  .  .  .  .  .  .  .  .  .  .
  3  .  .  .  .  .  .  .  .  .  .  .
  4  .  .  .  .  .  .  .  .  .  .  .
  5  .  .  .  .  .  .  ●  .  .  .  .  ← ball starts at f11
  6  .  .  .  .  .  .  .  .  .  .  .
  7  .  .  .  .  .  .  .  .  .  .  .
  8  .  .  .  .  .  .  .  .  .  .  .
  9  .  .  .  .  .  .  .  .  .  .  .
 10  .  .  .  .  .  █  █  █  .  .  .  .  ← GOAL (away, e22-g22)
 11  .  .  .  .  .  .  .  .  .  .  .

Column 1:   HOME GOAL (rows e, f, g) ← defends here
Column 11:  Home's attacking third / front line
Column 12:  Away's attacking third / front line
Column 22:   AWAY GOAL (rows e, f, g) ← defends here

Rows a-k: a (top) to k (bottom)
- Goals span rows e, f, g (3 rows = 9 feet, like real goal)
- Ball starts at f11: row f, col 11 (center, front line)

Row letters: a (top) to k (bottom)
- Goals span rows e, f, g (3 rows tall)
```

## 2. Players

- 11 players per team (GK + 10 outfield)
- Each player occupies exactly one grid cell
- Player IDs: `home_gk`, `home_def1`...`home_def4`, `home_mid1`...`home_mid4`, `home_fwd1`...`home_fwd2`
- Same for away: `away_gk`, `away_def1`, etc.

### Default Formations (4-3-3)

**Home (columns 1-11, facing right →):**
```
col 1:  home_gk (in goal)
col 3:  home_def1, home_def2, home_def3, home_def4
col 6:  home_mid1, home_mid2, home_mid3
col 9:  home_fwd1, home_fwd2
```

**Away (columns 12-22, facing left ←):**
```
col 22: away_gk (in goal)
col 20: away_def1, away_def2, away_def3, away_def4
col 17: away_mid1, away_mid2, away_mid3
col 14: away_fwd1, away_fwd2
```

### Ball Starting Position

Ball starts at `f11` (row f, col 11) — the center-forward position of the home team.

---

## 3. Movement Rules

### 3.1 Direction of Play

- **Home** always attacks toward **column 22** (right)
- **Away** always attacks toward **column 1** (left)

### 3.2 Ball Carrier Rules

The player **holding the ball** (`hasBall: true`) can:

1. **Move forward** — advance toward opponent's goal
   - Home: column +n (n > 0)
   - Away: column -n (n > 0)

2. **Move sideways** — same column, different row (a↔b↔c...)

3. **Pass** — transfer ball to another player
   - Target must be in front or same column
   - Target cannot be behind the ball carrier
   - Pass travels in a straight line (no curve)

4. **Shoot** — attempt on goal
   - Must be in shooting range (within 3 columns of goal)
   - Shot targets the goal area (rows e-f-g at opponent's goal line)

### 3.3 Non-Ball Carrier Rules (Teammates)

Can move to:
- Any position in same column
- Any position in column ahead (relative to their team's attack direction)
- Any position in column behind ONLY IF they're moving to support a pass

### 3.4 Defender Rules

Defenders (opponent without ball) can:

1. **Move forward** — toward the ball (pressing)
2. **Move sideways** — track the attacker
3. **Move backward** — fall back to defensive shape (NOT toward own goal — they're already facing the ball)

**All players face forward** — they can only see/intercept passes that come through their forward-facing cone.

### 3.5 Movement Constraints

```
BLOCKED MOVES:
- Ball carrier cannot move backward (behind their current column)
- Defenders cannot move past the ball (cannot go behind ball carrier)
- Cannot occupy a cell already taken by teammate OR opponent
- Cannot move outside 1-22 (columns) or a-k (rows)

NOTE: All occupied cells block movement. You cannot "dribble through" a defender —
you must pass around them or move to an empty space. This is realistic football:
attackers need to maneuver around defenders, not through them.
```

---

## 4. The Play Structure (3 Moves Each)

Each "play" consists of:

### Phase 1: Attack Team's Turn (up to 3 moves)

The team with possession gets **3 moves**. They can:

1. **Move ball carrier** — forward or sideways
2. **Pass** — to teammate in front/same column
3. **Move teammate** — reposition for next pass

The attack ends when:
- They score a goal
- They run out of 3 moves
- They lose the ball (interception/tackle)

### Phase 2: Defense Team's Turn (up to 3 moves)

The team without possession gets **3 moves** to contest. They can:

1. **Press** — move toward the ball carrier
2. **Mark** — cover potential pass targets
3. **Intercept** — position in passing lanes

The defense ends when:
- They win the ball (tackle/interception)
- The attack scores
- They run out of 3 moves (possession retained)

---

## 5. Interception & Tackle Mechanics

### 5.1 Line of Sight

A pass is **interceptable** if ANY defender is on the straight line between:

- Pass start position (ball carrier)
- Pass end position (teammate)

```
Detection: Point-to-point line intersection with defender position
Threshold: defender within 1 cell radius of the pass line
```

### 5.2 Pressing

If a defender moves to the same cell as the ball carrier (or adjacent), they can **press**:
- Check distance: ≤1 cell from ball carrier
- Press success chance: 60% base + (0-40 based on positioning)

### 5.3 Tackle

If defender moves TO the ball carrier's cell while carrier tries to move:
- Only valid if defender starts their move BEFORE ball carrier
- Tackle success chance: 50% base + positioning bonus

---

## 6. Outcomes

### 6.1 Possession Retention

Attack completes 3 moves → ball stays with attack team → new play begins

### 6.2 Possession Change

- **Interception**: defender catches the pass → ball flips to them
- **Tackle**: defender wins ball → ball flips to them
- **Save**: shot saved by GK or defender → ball released

### 6.3 Goal Scored

- Shot goes into goal area (e-g, opponent goal column)
- No defender blocks it
- Goal confirmed

---

## 7. Data Structures

```typescript
interface GridPosition {
  col: number;  // 1-22
  row: string;  // 'a'-'k'
}

interface Player {
  id: string;           // 'home_gk', 'home_def1', etc.
  name: string;        // 'Onana', 'Konate', etc.
  role: Role;          // 'gk' | 'def' | 'mid' | 'fwd'
  team: Team;          // 'home' | 'away'
  position: GridPosition;
  hasBall: boolean;
}

interface GameState {
  players: Player[];   // 22 players total
  ball: GridPosition;  // Current ball position (dupe for convenience)
  ballCarrierId: string | null;

  possession: Team;     // 'home' | 'away'
  turn: number;        // 1, 2, 3 (current move in play)
  movePhase: 'attack' | 'defense';

  score: { home: number; away: number };
  history: TurnRecord[];
}

interface TurnRecord {
  moveNumber: number;    // 1, 2, or 3 within the play
  phase: 'attack' | 'defense';
  team: Team;
  moveType: 'move' | 'pass' | 'shoot' | 'tackle' | 'intercept';
  positions: MovePositions;
  outcome: Outcome;
}
```

---

## 8. API Design

```typescript
// Core engine functions
Engine.init(formtionHome: Formation, formationAway: Formation): GameState
Engine.commitMove(state: GameState, move: Move): MoveResult
Engine.checkInterception(state: GameState, passFrom: Pos, passTo: Pos): InterceptionResult
Engine.resolvePlay(state: GameState): PlayResult

// Types
type Role = 'gk' | 'def' | 'mid' | 'fwd'
type Team = 'home' | 'away'
type MoveType = 'move' | 'pass' | 'shoot'
type Outcome = 'success' | 'intercepted' | 'blocked' | 'tackled' | 'goal' | 'miss'
```

---

## 9. Edge Cases

1. **Crowded square**: Two players try to occupy same cell → invalid move, request retry
2. **Pass to self**: Pass to same position → treated as "move" instead
3. **All paths blocked**: Ball carrier has no valid moves → turnover
4. **GK in play**: GK can receive pass but cannot carry ball forward past midfield
5. **Simultaneous moves**: Two players move to same cell → attacker wins, defender blocked
6. **Out of bounds**: Pass to off-grid → treated as miss
7. **Zero moves left**: Possession flips, turn resets to 1

---

## 10. Future Considerations (Out of Scope for v1)

- Half-time / full-time structure
- Penalty shootouts
- Free kicks / corners / throw-ins
- Real-time mode (seconds per move)
- AI evaluation
- Formation presets
- Player ratings
- Commentary / events log
- Animated visualization

---

## 11. File Structure

```
matchup_/engine/
├── index.ts          # Engine entry point
├── types.ts         # All interfaces
├── state.ts         # GameState management
├── moves.ts         # Move validation
├── resolution.ts   # Interception/tackle logic
├── formations.ts    # Default formations
└── README.md        # This file
```