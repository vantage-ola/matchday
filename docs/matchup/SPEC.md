# Matchup — Technical Specification
### Phase 1 — Spatial 11-a-side Game Engine

> Status: Implemented and playable. Real money, probabilistic scoring, and many-vs-many are out of scope.

---

## Table of Contents

1. System Architecture
2. Data Models
3. Game State Machine
4. The Matchup Engine (Spatial)
5. Settlement Engine
6. API Endpoints
7. WebSocket Events
8. Frontend Screens & Flows
9. Bot / House Player
10. Third-party Integrations
11. Tech Stack
12. Project Structure
13. Environment Variables
14. Build & Run

---

## 1. System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      FRONTEND                               │
│              Vite + React 19 + TypeScript                   │
│                                                             │
│  /fixture/:id    /matchup/:sessionId    /settlement/:id     │
│                                                             │
│  WebSocket client — live spatial game state sync            │
│  Zustand stores — auth (persisted), game (volatile), wallet │
└─────────────────────────┬───────────────────────────────────┘
                          │  HTTP + WebSocket
┌─────────────────────────▼───────────────────────────────────┐
│                      BACKEND                                │
│              Bun + Express 5 + TypeScript                   │
│                                                             │
│  REST API          WebSocket Server        Scheduler        │
│  (auth, fixtures,  (spatial engine,        (fixture sync,   │
│   sessions,         game state)            settlement)      │
│   settlements,                                              │
│   wallet)                                                   │
└──────┬──────────────────┬───────────────────────────────────┘
       │                  │
┌──────▼──────┐   ┌──────▼──────┐
│ PostgreSQL  │   │    Redis    │
│ persistent  │   │  game state │
│ data        │   │  + caches   │
└─────────────┘   └─────────────┘
                        │
            ┌───────────▼───────────┐
            │  Football Data API    │
            │  (v4 — football-      │
            │   data.org)           │
            └───────────────────────┘
```

**Pitch Dimensions: 15 columns × 9 rows**

- Home attacks right (goal at col 14)
- Away attacks left (goal at col 0)
- Ball starts at center (7, 4)

---

## 2. Data Models

### PostgreSQL Schema (Prisma ORM)

```prisma
model User {
  id             String   @id @default(uuid())
  username       String   @unique
  password_hash  String
  display_name   String
  avatar_url     String?
  wallet_balance Int      @default(1000)    // in-app currency (Naira)
  created_at     DateTime @default(now())
  is_bot         Boolean  @default(false)
}

model Fixture {
  id             String   @id @default(uuid())
  external_id    String   @unique            // football-data.org match ID
  home_team      String
  away_team      String
  home_team_logo String?
  away_team_logo String?
  league         String
  kickoff_at     DateTime
  status         String   @default("scheduled")
  real_home_goals Int?
  real_away_goals Int?
  raw_result     Json?                       // full API match response (contains team IDs)
  created_at     DateTime @default(now())
}

model Lobby {
  id         String   @id @default(uuid())
  fixture_id String
  opens_at   DateTime
  closes_at  DateTime
  status     String   @default("open")
  created_at DateTime @default(now())
}

model MatchupSession {
  id               String    @id @default(uuid())
  lobby_id         String
  fixture_id       String
  player1_id       String
  player2_id       String?                    // null when bot hasn't been assigned yet
  player1_side     String                     // 'home' | 'away' — player1 is NOT always home
  player2_side     String
  stake_per_player Int
  pot              Int
  game_mode        String    @default("matchup_only")
  status           String    @default("pending")  // pending → active → completed → settled
  started_at       DateTime?
  ended_at         DateTime?
  created_at       DateTime  @default(now())
}

model MatchupResult {
  id                 String   @id @default(uuid())
  session_id         String   @unique
  player1_goals      Int
  player2_goals      Int
  player1_possession Int
  player2_possession Int
  player1_tackles    Int
  player2_tackles    Int
  player1_shots      Int
  player2_shots      Int
  player1_assists    Int
  player2_assists    Int
  player_events      Json
  created_at         DateTime @default(now())
}

model Settlement {
  id                     String    @id @default(uuid())
  session_id             String    @unique
  player1_matchup_score  Decimal?  @db.Decimal(5, 2)
  player2_matchup_score  Decimal?  @db.Decimal(5, 2)
  player1_accuracy_score Decimal?  @db.Decimal(5, 2)
  player2_accuracy_score Decimal?  @db.Decimal(5, 2)
  player1_combined_score Decimal?  @db.Decimal(5, 2)
  player2_combined_score Decimal?  @db.Decimal(5, 2)
  player1_payout         Int?
  player2_payout         Int?
  status                 String    @default("pending")
  settled_at             DateTime?
  created_at             DateTime  @default(now())
}

model Transaction {
  id          String   @id @default(uuid())
  user_id     String
  type        String                          // 'debit' | 'credit'
  amount      Int
  description String
  session_id  String?
  created_at  DateTime @default(now())
}

model TeamColors {
  id          String   @id @default(uuid())
  team_name   String   @unique
  primary     String
  secondary   String
  text        String
  club_colors String?
  created_at  DateTime @default(now())
  updated_at  DateTime @default(now())
}
```

### Redis Schema

```
# Game state (24h TTL)
matchup:{sessionId}:state           → JSON GameState
matchup:{sessionId}:home_move       → committed move (30s TTL, cleared after resolution)
matchup:{sessionId}:away_move       → committed move (30s TTL, cleared after resolution)

# Football data caches
team:{teamId}                       → JSON TeamDetails (24h TTL)
squad:{fixtureId}                   → JSON {home: TeamPlayer[], away: TeamPlayer[]} (24h TTL)
lineup:{externalFixtureId}          → JSON {home: MatchLineup, away: MatchLineup} (1h TTL)
```

---

## 3. Game State Machine

### Matchup Session States

```
PENDING ──► ACTIVE ──► COMPLETED ──► SETTLED
             │
             └──► ABANDONED
```

### Turn States (within ACTIVE)

```
WAITING_BOTH
    Attacker commits ──► WAITING_DEFENDER
    Defender commits ──► WAITING_ATTACKER
    Both commit     ──► RESOLVING ──► ANIMATING ──► WAITING_BOTH
                                                          │
                                              (if turn > movesPerPhase)
                                                          ▼
                                              PHASE_TRANSITION
```

---

## 4. The Matchup Engine (Spatial)

### 4.1 Session Initialization

```typescript
interface GameState {
  sessionId: string;
  phase: number;
  totalPhases: number;
  turn: number;
  movesPerPhase: number;
  attackingSide: 'home' | 'away';

  ball: {
    position: GridPosition;      // {col, row}
    carrierCapId: string | null; // "home_fwd_2"
  };

  formations: {
    home: Formation;
    away: Formation;
  };

  turnStatus: TurnStatus;
  score: { home: number; away: number };
  stats: {
    home: MatchupStats;
    away: MatchupStats;
  };
  events: MatchEvent[];
  lastResolution: SpatialResolution | null;
}

type TurnStatus = 'waiting_both' | 'waiting_home' | 'waiting_away' | 'resolving';

interface Formation {
  side: 'home' | 'away';
  shape: string;  // "4-3-3"
  caps: PlayerCap[];
}

interface PlayerCap {
  id: string;           // "home_gk_1"
  name: string;         // "Raya", "Saka"
  shirtNumber: number;
  role: 'gk' | 'def' | 'mid' | 'fwd';
  position: GridPosition;
  rating: number;       // 1-99, from marketValue
  hasBall: boolean;
}
```

### 4.2 Move Types

```typescript
// Attacker moves (when you have the ball)
interface AttackerMove {
  side: 'attacker';
  fromCapId: string;          // must be ball carrier
  toCapId?: string;
  toPosition: GridPosition;
  action: AttackerAction;
}

type AttackerAction = 'pass' | 'through_pass' | 'cross' | 'long_ball' | 'shoot' | 'run';

// Defender moves (when opponent has the ball)
interface DefenderMove {
  side: 'defender';
  fromCapId: string;
  toPosition: GridPosition;
  action: DefenderAction;
  targetCapId?: string;
}

type DefenderAction = 'press' | 'tackle' | 'intercept' | 'hold_shape' | 'track_back';
```

### 4.3 Move Validation

**Critical Rule: Only the ball carrier can initiate attacks.**

```typescript
async function commitMove(sessionId: string, playerSide: 'home' | 'away', move: GameMove): Promise<void> {
  const state = await getState(sessionId);
  
  // Validate ball carrier
  if (move.side === 'attacker' && move.fromCapId !== state.ball.carrierCapId) {
    throw new Error('Not the ball carrier');
  }
  
  // Validate position bounds
  const { col, row } = move.toPosition;
  if (col < 0 || col > 14 || row < 0 || row > 8) {
    throw new Error('Invalid position');
  }
  
  // Store move in Redis
  const key = move.side === 'attacker' ? 'attacker_move' : 'defender_move';
  await redis.set(`matchup:${sessionId}:${key}`, move, { EX: 30 });
  
  // Check if both moves present
  const attackerMove = await redis.get(`matchup:${sessionId}:attacker_move`);
  const defenderMove = await redis.get(`matchup:${sessionId}:defender_move`);
  
  if (attackerMove && defenderMove) {
    await resolveTurn(sessionId);
  } else {
    const newStatus = attackerMove ? 'waiting_defender' : 'waiting_attacker';
    await updateTurnStatus(sessionId, newStatus);
    await broadcastMoveCommitted(sessionId, playerSide);
  }
}
```

### 4.4 Turn Resolution

Resolution uses line intersection to determine outcomes.

```typescript
interface SpatialResolution {
  attackerMove: AttackerMove;
  defenderMove: DefenderMove;
  outcome: Outcome;
  ballFinalPosition: GridPosition;
  interceptionPoint: GridPosition | null;
  movedCaps: CapMovement[];
  possessionChange: boolean;
  goalScored: boolean;
  scorerCapId: string | null;
  ratingBonus: number;
}

type Outcome = 'advance' | 'intercept' | 'tackle' | 'goal' | 'save' | 'miss' | 'through' | 'press_won' | 'blocked' | 'wide';

interface CapMovement {
  capId: string;
  fromPosition: GridPosition;
  toPosition: GridPosition;
}

// Resolution Logic
async function resolveTurn(sessionId: string): Promise<void> {
  const state = await getState(sessionId);
  const attackerMove = await redis.get(`matchup:${sessionId}:attacker_move`);
  const defenderMove = await redis.get(`matchup:${sessionId}:defender_move`);
  
  const attackerSide = state.attackingSide;
  const defenderSide = attackerSide === 'home' ? 'away' : 'home';
  
  const attackerCap = findCap(state, attackerMove.fromCapId);
  const defenderCap = findCap(state, defenderMove.fromCapId);
  
  // Calculate attacker line
  const attackerLine = {
    start: attackerCap.position,
    end: attackerMove.toPosition
  };
  
  // Calculate defender line
  const defenderLine = {
    start: defenderCap.position,
    end: defenderMove.toPosition
  };
  
  // Check for line intersection
  const intersection = getLineIntersection(attackerLine, defenderLine);
  
  let outcome: Outcome;
  let ballFinalPosition = attackerMove.toPosition;
  let interceptionPoint: GridPosition | null = null;
  let possessionChange = false;
  let goalScored = false;
  let ratingBonus = 0;
  
  // Rating bonus: attackerRating - defenderRating
  const attackerRating = attackerCap.rating;
  const defenderRating = defenderCap.rating;
  ratingBonus = (attackerRating - defenderRating) / 10;
  
  // Resolution based on attacker action
  switch (attackerMove.action) {
    case 'shoot': {
      const goalChance = calculateShootChance(attackerMove.toPosition, state, attackerRating);
      const roll = Math.random() * 100;
      if (roll < goalChance) {
        outcome = 'goal';
        goalScored = true;
        ballFinalPosition = { col: attackerSide === 'home' ? 14 : 0, row: 4 };
      } else if (roll < goalChance + 30) {
        outcome = 'save';
        possessionChange = true;
        ballFinalPosition = state.ball.position;
      } else {
        outcome = 'wide';
        possessionChange = true;
        ballFinalPosition = { col: attackerMove.toPosition.col, row: 8 };
      }
      break;
    }
    
    case 'through_pass': {
      if (intersection) {
        outcome = 'intercept';
        possessionChange = true;
        interceptionPoint = intersection;
        ballFinalPosition = intersection;
      } else {
        outcome = 'through';
        ballFinalPosition = attackerMove.toPosition;
      }
      break;
    }
    
    case 'pass': {
      if (intersection) {
        outcome = 'intercept';
        possessionChange = true;
        interceptionPoint = intersection;
        ballFinalPosition = intersection;
      } else {
        outcome = 'advance';
        ballFinalPosition = attackerMove.toPosition;
      }
      break;
    }
    
    default: {
      outcome = 'advance';
      ballFinalPosition = attackerMove.toPosition;
    }
  }
  
  // Defensive response
  if (defenderMove.action === 'press' && intersection) {
    if (defenderMove.toPosition.col < attackerCap.position.col) {
      outcome = 'press_won';
      possessionChange = true;
      ballFinalPosition = defenderMove.toPosition;
    }
  }
  
  // Update cap positions
  const movedCaps: CapMovement[] = [
    {
      capId: attackerMove.fromCapId,
      fromPosition: attackerCap.position,
      toPosition: ballFinalPosition
    }
  ];
  
  // Update state
  state.ball.position = ballFinalPosition;
  state.ball.carrierCapId = possessionChange ? defenderMove.fromCapId : attackerMove.fromCapId;
  
  if (goalScored) {
    state.score[attackerSide]++;
    state.stats[attackerSide].shots++;
  }
  
  if (possessionChange) {
    state.attackingSide = defenderSide;
  }
  
  state.turn++;
  state.turnStatus = 'waiting_both';
  
  // Clear moves
  await redis.del(`matchup:${sessionId}:attacker_move`);
  await redis.del(`matchup:${sessionId}:defender_move`);
  
  // Broadcast resolution
  const resolution: SpatialResolution = {
    attackerMove,
    defenderMove,
    outcome,
    ballFinalPosition,
    interceptionPoint,
    movedCaps,
    possessionChange,
    goalScored,
    scorerCapId: goalScored ? attackerMove.fromCapId : null,
    ratingBonus
  };
  
  state.lastResolution = resolution;
  await saveState(sessionId, state);
  await broadcastTurnResolved(sessionId, resolution, state);
}
```

### 4.5 Player Ratings

Ratings derived from market value using logarithmic scaling:

```typescript
function marketValueToRating(marketValue: number | null | undefined): number {
  if (!marketValue || marketValue <= 0) return 60;
  const logValue = Math.log10(marketValue);
  const rating = Math.round(30 + logValue * 15);
  return Math.max(40, Math.min(99, rating));
}

// Examples: €80M = ~88, €20M = ~79, €2M = ~64, unknown = 60
```

### 4.5.1 Squad Data & Lineup Fallback

Session initialization follows a three-tier data strategy:

1. **Match lineup** (`/matches/{id}`) — real starting XI with formation. Only available ~30min before kickoff.
2. **Squad fallback** (`/teams/{id}`) — full squad roster (~30 players). Always available. `selectStarting11` picks the best 11 by market value in a 4-3-3 shape.
3. **Fallback formation** — generic 4-3-3 with placeholder names ("GK 1", "DEF 2") and rating 60.

Squad and team data are cached in Redis (24h TTL) to avoid redundant API calls and survive server restarts. Team IDs are resolved from the fixture's `raw_result` JSON (most reliable) with a name-to-ID mapping as fallback.

### 4.6 Phase Transition

At end of phase, roles swap and moves reset:

```typescript
async function endPhase(sessionId: string): Promise<void> {
  const state = await getState(sessionId);
  state.phase++;
  
  if (state.phase > state.totalPhases) {
    await endMatchup(sessionId, state);
    return;
  }
  
  // Swap attacker
  state.attackingSide = state.attackingSide === 'home' ? 'away' : 'home';
  
  // Reset ball carrier
  state.ball.carrierCapId = findBallCarrier(state);
  
  state.turn = 1;
  state.turnStatus = 'waiting_both';
  
  await saveState(sessionId, state);
  await broadcastPhaseTransition(sessionId, state);
}
```

---

## 5. Settlement Engine

### 5.1 Matchup Score

```typescript
function calculateMatchupScore(homeGoals: number, awayGoals: number): { home: number; away: number } {
  const total = homeGoals + awayGoals;
  if (total === 0) return { home: 50, away: 50 };
  return {
    home: Math.round((homeGoals / total) * 100),
    away: Math.round((awayGoals / total) * 100),
  };
}
```

### 5.2 Combined Score & Payout

```typescript
const PLATFORM_FEE = 0.1;

function calculatePayout(session, settlement): Settlement {
  const total = settlement.homeCombined + settlement.awayCombined;
  const pot = session.pot * (1 - PLATFORM_FEE);
  
  return {
    homePayout: Math.round((settlement.homeCombined / total) * pot),
    awayPayout: Math.round((settlement.awayCombined / total) * pot),
  };
}
```

---

## 6. API Endpoints

```
POST   /api/auth/register          { username, password, displayName }
POST   /api/auth/login             { username, password }  → JWT
GET    /api/auth/me                → User profile + wallet

GET    /api/fixtures               → Upcoming fixtures (with team colors)
GET    /api/fixtures/:id           → Fixture details
GET    /api/fixtures/:id/lobby     → Lobby status (queue counts)
POST   /api/fixtures/:id/join      { side, stake, gameMode }  → session or queue position
POST   /api/fixtures/:id/bot       { side, stake, gameMode }  → instant bot session
POST   /api/fixtures/seed          ?competition=PL  → seed from football API

GET    /api/sessions/:id           → Session + game state + player side + team colors
GET    /api/sessions/:id/result    → Matchup result + settlement
GET    /api/sessions/user/history  → Recent match history (last 20)

GET    /api/settlements/:id        → Settlement details

GET    /api/wallet                 → Balance + recent transactions
```

---

## 7. WebSocket Events

Connection: `ws://server/matchup?sessionId=<uuid>&token=<jwt>`

### Server → Client

```typescript
{ type: 'GAME_STATE', payload: GameState }
{ type: 'MOVE_COMMITTED', payload: { playerSide, turnStatus } }
{ type: 'OPPONENT_COMMITTED', payload: {} }
{ type: 'TURN_RESOLVED', payload: { resolution: SpatialResolution, gameState: GameState } }
{ type: 'PHASE_TRANSITION', payload: { newPhase, attackingSide, state } }
{ type: 'MATCHUP_COMPLETE', payload: { finalState, result } }
```

### Client → Server

```typescript
{ type: 'COMMIT_MOVE', payload: { move: GameMove } }
{ type: 'GET_GAME_STATE', payload: {} }
{ type: 'PING', payload: {} }
```

---

## 8. Frontend Screens & Flows

### Screen Map

```
/login                   Login
/signup                  Registration
/                        Home — upcoming fixtures list
/fixture/:id             Fixture detail + lobby (pick side, stake, join)
/matchup/:sessionId      Core gameplay (landscape, WebSocket-driven)
/settlement/:sessionId   Results + payout + stats
/wallet                  Balance + transaction history
/profile                 User profile
```

All game routes are protected — unauthenticated users redirect to `/login`.

### Spatial Gameplay Flow

```
1. Attacker drags from ball carrier to target position on pitch
2. Release → action auto-determined based on direction and distance
   (pass, through_pass, cross, long_ball, shoot, run)
3. Defender drags any of their caps to a position
   → action auto-determined (press, tackle, intercept, hold_shape, track_back)
4. Both commit → server resolves via line intersection
5. Resolution overlay shows outcome
6. State updates, next turn begins
7. After 5 turns → phase transition (sides swap attack/defense)
8. After 6 phases (30 turns) → matchup complete → settlement
```

### Pitch Interaction

- **Attacker**: Drag ball carrier → line drawn to target → release to commit
- **Defender**: Drag any of your caps → line drawn → release to commit
- Direction-aware: action detection accounts for home (right) vs away (left)
- Auto-commit timer: 10 seconds. If timer expires:
  - Attacker: auto-submits "run" forward from ball carrier
  - Defender: auto-submits "hold_shape" with nearest defender
- Visual: gold drag line for attacker, red for defender
- Team abbreviations shown on pitch corners with YOU/OPP sub-labels

---

## 9. Bot / House Player

```typescript
function getBotMove(state: GameState, botSide: 'home' | 'away'): GameMove {
  const isAttacking = state.attackingSide === botSide;
  
  if (isAttacking) {
    const ballCarrier = findBallCarrier(state, botSide);
    const action = Math.random() > 0.3 ? 'pass' : 'run';
    return {
      side: 'attacker',
      fromCapId: ballCarrier.id,
      toPosition: { col: ballCarrier.position.col + 2, row: ballCarrier.position.row },
      action
    };
  } else {
    const defenders = getDefenders(state, botSide);
    const closest = defenders[0];
    return {
      side: 'defender',
      fromCapId: closest.id,
      toPosition: state.ball.position,
      action: 'press'
    };
  }
}
```

---

## 10. Third-Party Integrations

### Football Data API (v4 — football-data.org)

Three endpoints used:

| Endpoint | Purpose | Availability |
|---|---|---|
| `/competitions/{code}/matches` | Fetch upcoming fixtures for a league | Always |
| `/teams/{id}` | Full squad roster (names, positions, shirt numbers, market values) | Always |
| `/matches/{id}` | Match lineups (starting XI + formation) and live results | Lineups ~30min pre-kickoff; results after FT |

**Caching strategy**: All API responses cached in Redis. Squad/team data cached 24h (squads rarely change). Lineup data cached 1h (can change close to kickoff). Team colors cached in PostgreSQL permanently.

**Rate limiting**: Free tier allows 10 requests/minute. The caching layer minimizes API calls — squad data is fetched once per fixture and reused across all sessions for that match.

---

## 11. Tech Stack

| Layer | Technology |
|---|---|
| Backend runtime | Bun |
| Backend framework | Express 5 |
| ORM | Prisma 7 |
| Database | PostgreSQL |
| Cache / game state | Redis (ioredis) |
| WebSockets | `ws` library |
| Auth | JWT (jsonwebtoken) |
| Password hashing | bcrypt |
| Validation | Zod |
| Football data | football-data.org v4 |
| Frontend | Vite 8 + React 19 + TypeScript 6 |
| Frontend routing | React Router v7 |
| Frontend state | Zustand |
| UI components | shadcn/ui + TailwindCSS 4 |
| Icons | lucide-react |

---

## 12. Project Structure

```
matchday/
├── matchup/
│   ├── backend/
│   │   ├── index.ts                    ← Express app + HTTP server + WS upgrade
│   │   ├── prisma/
│   │   │   └── schema.prisma           ← Database schema
│   │   ├── src/
│   │   │   ├── routes/
│   │   │   │   ├── auth.ts
│   │   │   │   ├── fixtures.ts
│   │   │   │   ├── sessions.ts
│   │   │   │   ├── settlements.ts
│   │   │   │   └── wallet.ts
│   │   │   ├── engine/
│   │   │   │   ├── matchup.ts          ← Session init, move commit, phase/turn management
│   │   │   │   ├── resolution.ts       ← Line intersection, outcome calculation
│   │   │   │   ├── formations.ts       ← 11-player positioning, ball carrier logic
│   │   │   │   ├── bot.ts             ← AI opponent move generation
│   │   │   │   └── settlement.ts       ← Score calculation, payout distribution
│   │   │   ├── services/
│   │   │   │   ├── football-api.ts     ← API client, squad/lineup fetching, Redis caching
│   │   │   │   ├── matchmaking.ts      ← Queue management, session creation, Redis game state
│   │   │   │   └── scheduler.ts        ← Cron: fixture sync, settlement triggers
│   │   │   ├── ws/
│   │   │   │   ├── server.ts
│   │   │   │   └── handlers.ts
│   │   │   ├── middleware/
│   │   │   │   └── auth.ts             ← JWT verification
│   │   │   ├── db/
│   │   │   │   ├── prisma.ts
│   │   │   │   └── redis.ts
│   │   │   ├── types/
│   │   │   │   └── index.ts
│   │   │   └── scripts/
│   │   │       └── seed-dev-fixtures.ts
│   │   └── package.json
│   │
│   └── frontend/
│       ├── src/
│       │   ├── App.tsx                  ← React Router config, protected routes
│       │   ├── main.tsx                 ← Entry point
│       │   ├── pages/
│       │   │   ├── Home.tsx             ← Fixture list
│       │   │   ├── Fixture.tsx          ← Fixture detail + lobby
│       │   │   ├── Matchup.tsx          ← Core gameplay (WebSocket + timer + game state)
│       │   │   ├── Settlement.tsx       ← Results + payout display
│       │   │   ├── Wallet.tsx           ← Balance + transaction history
│       │   │   ├── Profile.tsx
│       │   │   ├── Login.tsx
│       │   │   └── Signup.tsx
│       │   ├── components/
│       │   │   ├── Pitch.tsx            ← 15×9 grid, 22 caps, drag-to-move
│       │   │   ├── MoveSelector.tsx     ← Action confirmation panel
│       │   │   ├── ScoreBar.tsx         ← Live score + phase indicator
│       │   │   ├── ResolutionOverlay.tsx ← Move outcome animations
│       │   │   ├── FixtureCard.tsx
│       │   │   ├── SettlementCard.tsx
│       │   │   ├── WalletBadge.tsx
│       │   │   ├── layouts/             ← GameLayout, PageLayout, SideNav, BottomNav
│       │   │   └── ui/                  ← shadcn component library
│       │   ├── lib/
│       │   │   ├── api.ts               ← HTTP client with JWT
│       │   │   ├── socket.ts            ← WebSocket client with auto-reconnect
│       │   │   ├── store.ts             ← Zustand: useAuthStore, useGameStore, useWalletStore
│       │   │   ├── gameState.ts         ← Game helpers (canShoot, etc.)
│       │   │   ├── team-colors.ts
│       │   │   └── utils.ts
│       │   └── types.ts
│       └── package.json
│
└── docs/
    ├── SPEC.md
    ├── IDEA_BRIEF.md
    ├── UI_DESIGN_SYSTEM.md
    ├── BRAND_GUIDELINES.md
    └── DESIGN_PROMPTS.md
```

---

## 13. Environment Variables

```bash
# Backend
DATABASE_URL=postgresql://user:pass@localhost:5432/matchday
REDIS_URL=redis://localhost:6379
JWT_SECRET=your_jwt_secret
FOOTBALL_API_KEY=your_rapidapi_key
PORT=3001
NODE_ENV=development

# Frontend
VITE_API_URL=http://localhost:3001
VITE_WS_URL=ws://localhost:3001
```

---

## 14. Build & Run

Use `bun` everywhere — not npm/node/npx. Bun auto-loads `.env` files, so dotenv is not needed.

```bash
# Backend
cd matchup/backend
bun install
bunx prisma generate        # Generate Prisma client
bunx prisma migrate dev     # Apply migrations
bun --hot index.ts           # Dev server with hot reload

# Frontend
cd matchup/frontend
bun install
bun run dev                  # Vite dev server at :5173

# Seed fixtures from football API
curl -X POST http://localhost:3001/api/fixtures/seed

# Redis + PostgreSQL must be running
redis-server
# createdb matchday (if not created)
```