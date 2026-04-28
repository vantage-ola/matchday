# Matchup — Idea Brief
### A simultaneous hidden-move football strategy game, settled by real match results

> Status: Phase 1 implemented and playable. Spatial 11-a-side engine, bot matchmaking, settlement, wallet — all working. See SPEC.md for technical details.

---

## The Spark
I used to play a lot of football games growing up - FIFA, PES, DREAM LEAGUE SOCCER, FTS, FOOTBALL MANAGER... name it. Yesterday I sat down to watch the second leg of the 2026 UCL game of Barca against Atletico... and as a Barca hater, I felt a lot of anxiety while watching the game as I did not want Barca to qualify...I wonder how Barca fans felt in that game...

The goal is to recapture that feeling but make it social, competitive, and tied to actual football happening in the world.

The core fantasy: you're not just watching Barcelona vs Atletico — you're *playing* it, with skin in the game, against someone on the other side who wants the opposite result.

---

## What This Is

A game that is **chess in structure but never feels like chess** — because the theme, visuals, pace, and vocabulary are pure football.

References:
- **Chess** — simultaneous hidden moves, resource management, defined move sets
- **Football Manager (FM)** — top-down 2D pitch view, tactical positioning
- **Score Hero** — gesture-based, cinematic moment-to-moment feel

Nothing on mobile combines all three. That's the gap.

---

## The Game Loop

```
           User picks a real upcoming fixture and chooses home/away side + stake.
           Matched with opponent (or bot after 20s timeout). Stake deducted from wallet.

           ~5-minute Matchup begins.
           6 phases × 5 turns = 30 turns of simultaneous hidden-move spatial football.
           Each turn: attacker drags ball carrier, defender positions a cap.
           Moves resolve via line intersection → outcomes animate on pitch.
           Goals scored, possession tracked, stats recorded.

           Matchup ends. Settlement runs immediately.
           Scoreline + full stats shown side by side.
           Proportional payout credited to wallet (10% platform fee).

[Future: Real Match Mode]
           Matchup scoreline locked. Users watch the real match.
           Real result fetched via API at full-time.
           Accuracy bonus calculated. Combined settlement.
```

---

## The Matchup — Core Mechanic (Implemented)

### The Spatial Move System

Both players control 11 player caps on a 15×9 grid. Each turn, both players simultaneously commit a move by dragging a cap on the pitch — neither sees what the other did until both have committed. Moves resolve via line intersection geometry. That simultaneous reveal is the mind game.

**Attacker moves** (only the ball carrier can initiate):
- **Pass** — advance ball to a nearby position
- **Through Pass** — risky forward ball past defenders
- **Cross** — delivery from the wing
- **Long Ball** — bypass midfield, high distance
- **Run** — ball carrier advances with the ball
- **Shoot** — attempt on goal (position-gated: must be within 4 cols of goal)

**Defender moves** (any defender cap can be dragged):
- **Press** — move toward the ball, high pressure
- **Tackle** — direct challenge (must be within range)
- **Intercept** — move into the passing lane
- **Hold Shape** — maintain position, close lanes
- **Track Back** — retreat toward own goal

### Turn Resolution

Both players commit moves hidden from each other. Resolution checks if the defender's movement line intersects the attacker's action line. Outcome is determined by:
- `base chance + (attackerRating - defenderRating) / 10 + action modifier + random(-15, +15)`

Player ratings are derived from real market values (€80M player = ~88 rating). This means using a star player for the right action at the right moment matters.

### The Possession Flip

If the defender wins the ball (intercept, tackle, press won), attacking side swaps for the remainder of the phase. A bad pass leads to a counter-attack — a real football consequence.

### Pitch View

FM 2D simulation style. Top-down, 22 player caps on a green pitch with team colors and real player shirt numbers. Ball position updates after each resolution. Drag lines show planned movement — gold for attacker, red for defender.

### Structure & Fairness

6 phases × 5 turns = 30 turns total. Attacking/defending sides swap each phase. Both players get exactly 3 phases of attack and 3 of defense. No structural advantage for either side.

### Possession Tracking

Tracked by turns spent with the ball. Feeds into post-match stats on the settlement screen.

---

## Scoreline Generation — Two Modes

### Direct (v1 — Arcade)
Goals scored in the Matchup = the predicted scoreline. Raw, immediate.

### Probabilistic (v2 — Simulation)
Matchup performance stats (possession %, shots, tackles, moves landed) feed a formula that generates a realistic scoreline. A dominant performance that only converted 1 goal might resolve to 2-0 or 3-1. Feels more like real football.

Both modes coexist eventually. Could be a user-facing setting or per-fixture game mode.

---

## Settlement — Two Layers

### Layer 1 — Matchup Result (always active)
Higher simulated scoreline wins.

### Layer 2 — Real Match Accuracy (toggleable — Real Match Mode)
Each player's simulated scoreline scored against the actual result. Points for correct winner, goal difference, exact score, total goals.

### Payout — Proportional, Not Winner-Takes-All

```
₦500 each. ₦1,000 pot. 10% platform fee = ₦900 to split.

User1 combined score: 74%  →  ~₦666
User2 combined score: 26%  →  ~₦234
```

Nobody walks away with zero. No LMSR — proportional scoring is simpler, transparent, sufficient.

### The Key Insight

**You can lose the real match and still win the Matchup.**

A Chelsea fan gets destroyed 4-0 by Barcelona. But if he dominated the Matchup and his simulated scoreline was closer to the real result — he walks away with more money. Skill beats luck. Better player wins, not luckier supporter. This is what separates MatchDay from a bet slip.

---

## Fairness Algorithm — The Walkover Problem

Pre-match probability weighting on Layer 2 only. If the real result was a low-probability outcome, predictions in reasonable ranges lose fewer points. Correct predictions of unlikely outcomes earn bonus points. Layer 1 (Matchup game) is completely unaffected — pure skill.

Must be fully transparent. After settlement, show users exactly how their score was calculated. Trust depends on it.

---

## The Settlement Screen

Two states — one screen:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
MATCHUP-ONLY MODE

  YOUR RESULT       OPPONENT
     2 - 1            1 - 2

  ⚽ Jiménez 23'    ⚽ Nketiah 67'
  ⚽ Jiménez 71'
  🅰 Andreas 23'    🅰 Martinelli 67'

  Possession  54%  |  46%
  Tackles      4   |   2
  Shots        3   |   2

  YOU WON THE MATCHUP ✓
  +₦566 credited to wallet

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REAL MATCH MODE (pending)

  [same stats]

  YOU WON THE MATCHUP ✓
  +₦200 from Matchup — credited now

  ════════════════════════════════
  LIVE MODE — waiting for real match
  Arsenal vs Chelsea · Kicks off 2h 14m

  Your predicted result: 2-1
  Potential bonus: +₦340
  ════════════════════════════════
```

The reveal — both simulated scorelines shown side by side before the real result drops in — needs to feel like the final whistle, not a receipt. This screen is the product.

---

## No-Opponent Fallback (Implemented)

If no opponent is found within 20 seconds of joining the queue, a bot fills the slot automatically. The bot uses directional AI — it evaluates the game state and picks moves that are contextually reasonable (pressing the ball carrier, passing forward, shooting when in range). Bot user is flagged `is_bot: true` in the database.

---

## Leagues at Launch

Major leagues — EPL, UCL, La Liga, Serie A, Ligue 1. AFCON when in season. Prioritised by Nigerian audience interest.

---

## Target User

People who want something new, built for banter — clean, real, not seen before. Already deep in football culture. Want more than a bet slip. Mobile-first. Defined by appetite, not age.

---

## v1 Scope

**Built:**
- 1v1 matchmaking with queue + 20s bot timeout
- In-app currency (Naira, starting balance ₦1,000)
- Spatial 11-a-side game engine on 15×9 grid
- Real player data from football-data.org (squad names, positions, shirt numbers, market value ratings)
- Squad fallback when lineup data isn't available (picks best 11 by market value)
- Direct scoreline mode (goals scored in Matchup = the scoreline)
- Matchup-only settlement with proportional payout (10% platform fee)
- Bot opponent with directional AI
- WebSocket real-time game state sync
- Post-match settlement with full stats (goals, possession, tackles, shots, assists)
- Wallet system with transaction history
- Team colors (200+ teams) with DB caching
- Swiss Modernist design system (landscape game, portrait prompt)

**Deferred:**
- Real money (needs legal structure — NLRC)
- Probabilistic scoreline mode
- Real Match Mode (Layer 2 settlement — accuracy bonus from real match result)
- Many-vs-many
- Move count balancing (variable, tuned through playtesting)
- Social features (friends, banter, leaderboards)
- AFCON and more leagues beyond PL

---

## What's Next

Phase 1 is playable. The core loop works: pick a fixture → match with opponent or bot → play 30 turns of spatial football → settlement → payout. See **SPEC.md** for full technical details.

---

