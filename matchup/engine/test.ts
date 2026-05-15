import Engine from './index.js';
import { initGameState, getBallCarrier } from './formations.js';
import {
  validateMove,
  canMoveTo,
  classifyMove,
  checkInterception,
  previewPass,
  previewTackle,
  getPassTargets,
} from './moves.js';
import {
  posEq,
  gridDistance,
  isGoalPosition,
  MAX_STEP_DIST,
  MAX_PASS_DIST,
  HALF_TIME_THRESHOLD,
  type GameState,
  type GridPosition,
} from './types.js';

let pass = 0;
let fail = 0;

function assert(condition: boolean, label: string) {
  if (condition) {
    pass++;
  } else {
    fail++;
    console.log(`  FAIL: ${label}`);
  }
}

// ----- helpers -----

function clone(state: GameState): GameState {
  return JSON.parse(JSON.stringify(state));
}

function clearOpponents(state: GameState, team: 'home' | 'away') {
  // Move every opposing non-GK far away so they can't interfere with the test scenario.
  const opp = team === 'home' ? 'away' : 'home';
  let parkRow = 0;
  for (const p of state.players) {
    if (p.team === opp && p.role !== 'gk') {
      // Park in column 22/1 corner-ish rows that aren't the goal cells.
      p.position = { col: opp === 'away' ? 22 : 1, row: 'a' };
      // To prevent overlap, give each a unique row offset by reassigning sequentially.
      const rowChar = String.fromCharCode('a'.charCodeAt(0) + (parkRow % 11));
      p.position.row = rowChar;
      // park GKs in their goal column already; non-GK opponents share col with their GK but distinct rows.
      // If the assigned row collides with the GK row 'f', shift.
      if (p.position.row === 'f') p.position.row = String.fromCharCode('a'.charCodeAt(0) + ((parkRow + 1) % 11));
      parkRow++;
    }
  }
}

function moveTo(state: GameState, playerId: string, to: GridPosition) {
  const p = state.players.find((q) => q.id === playerId);
  if (p) p.position = { ...to };
}

console.log('=== FORMATION TESTS ===\n');

const formations = ['4-3-3', '4-4-2', '3-5-2', '5-3-2', '4-2-3-1', '3-4-3'] as const;
for (const f of formations) {
  const g = Engine.init(f);
  assert(g.getTeam('home').length === 11, `${f} home should have 11 players`);
  assert(g.getTeam('away').length === 11, `${f} away should have 11 players`);
}

for (const f of formations) {
  const g = Engine.init(f);
  const all = [...g.getTeam('home'), ...g.getTeam('away')];
  const positions = all.map((p) => `${p.position.row}${p.position.col}`);
  assert(positions.length === new Set(positions).size, `${f} no overlapping positions`);
}

const initGame = Engine.init();
const bc = initGame.getBallCarrier();
assert(bc !== undefined, 'Ball carrier exists at init');
assert(bc!.team === 'home', 'Ball carrier is home at init');
assert(bc!.role === 'fwd', 'Ball carrier is a forward at init');

const state0 = initGame.getState();
assert(state0.homeFormation === '4-3-3', 'homeFormation stored');
assert(state0.awayFormation === '4-3-3', 'awayFormation stored');
assert(state0.possession === 'home', 'home has possession at init');

const mixed = Engine.init('4-4-2', '3-4-3');
const ms = mixed.getState();
assert(ms.homeFormation === '4-4-2', 'mixed: home 4-4-2');
assert(ms.awayFormation === '3-4-3', 'mixed: away 3-4-3');
assert(mixed.getTeam('home').filter((p) => p.role === 'def').length === 4, '4-4-2 has 4 defs');
assert(mixed.getTeam('away').filter((p) => p.role === 'def').length === 3, '3-4-3 has 3 defs');

console.log('\n=== STATE SHAPE (NO AP/MOVE-NUMBER) ===\n');

const sShape = initGame.getState();
assert(!('actionPoints' in sShape), 'GameState has no actionPoints');
assert(!('moveNumber' in sShape), 'GameState has no moveNumber');
assert(!('movePhase' in sShape), 'GameState has no movePhase');
assert(!('maxActionPoints' in sShape), 'GameState has no maxActionPoints');

console.log('\n=== CHESS-STYLE TURN ALTERNATION ===\n');

// Every successful action flips possession.
{
  const g = Engine.init();
  const c = g.getBallCarrier()!;
  const r = g.applyMove(c.id, { col: c.position.col + 1, row: c.position.row });
  assert(r.valid, 'forward dribble valid');
  assert(g.getState().possession === 'away', 'possession flips to away after home dribble');
}

// Off-ball run also flips.
{
  const g = Engine.init();
  const runner = g.getTeam('home').find((p) => p.role === 'def')!;
  const r = g.applyMove(runner.id, { col: runner.position.col + 1, row: runner.position.row });
  assert(r.valid, 'home defender run valid');
  assert(g.getState().possession === 'away', 'run by possession-team flips possession');
}

// Time decrements 10s per successful move.
{
  const g = Engine.init();
  const c = g.getBallCarrier()!;
  const t0 = g.getState().timeRemaining;
  g.applyMove(c.id, { col: c.position.col + 1, row: c.position.row });
  assert(g.getState().timeRemaining === t0 - 10, 'clock drops 10s on successful action');
}

// Failed (invalid) move does not flip possession or tick clock.
{
  const g = Engine.init();
  const c = g.getBallCarrier()!;
  const t0 = g.getState().timeRemaining;
  const r = g.applyMove(c.id, { col: c.position.col + 5, row: c.position.row }); // 5-cell dribble = invalid
  assert(!r.valid, 'multi-cell dribble is invalid');
  assert(g.getState().possession === 'home', 'invalid move does not flip possession');
  assert(g.getState().timeRemaining === t0, 'invalid move does not tick the clock');
}

// Off-ball run by any side that lands on an empty cell is a valid grid move.
{
  const g = Engine.init();
  const awayPlayer = g.getTeam('away').find((p) => p.id === 'away_def1')!; // (20,b)
  const r = g.applyMove(awayPlayer.id, { col: awayPlayer.position.col - 1, row: awayPlayer.position.row });
  assert(r.valid, 'off-ball run from any side validates as a legal grid move');
}

console.log('\n=== 1-CELL CAPS: DRIBBLE / RUN / TACKLE ===\n');

// Dribble exactly 1 cell — 2 cells invalid.
{
  const g = Engine.init();
  const c = g.getBallCarrier()!;
  const r = g.applyMove(c.id, { col: c.position.col + 2, row: c.position.row });
  assert(!r.valid, 'dribble 2 cells is invalid');
}

// Off-ball run 2 cells invalid.
{
  const g = Engine.init();
  const runner = g.getTeam('home').find((p) => p.role === 'def' && p.id === 'home_def1')!;
  const r = g.applyMove(runner.id, { col: runner.position.col + 2, row: runner.position.row });
  assert(!r.valid, 'off-ball run 2 cells is invalid');
}

// Backward dribble is legal (chess-style: any direction).
{
  const g = Engine.init();
  const c = g.getBallCarrier()!;
  const r = g.applyMove(c.id, { col: c.position.col - 1, row: c.position.row });
  assert(r.valid, 'backward dribble is legal');
}

// Sideways dribble is legal.
{
  const g = Engine.init();
  const c = g.getBallCarrier()!;
  // 4-3-3 ST is at f9; e9 is empty.
  const r = g.applyMove(c.id, { col: c.position.col, row: 'e' });
  assert(r.valid, 'sideways dribble is legal');
}

// Diagonal dribble 1 cell is legal.
{
  const g = Engine.init();
  const c = g.getBallCarrier()!; // ST at col 9 row f
  const r = g.applyMove(c.id, { col: c.position.col + 1, row: 'e' });
  assert(r.valid, 'diagonal 1-cell dribble is legal');
}

// Pass onto a teammate's cell (chess-style: any teammate cell within 10 cells).
{
  const g = Engine.init();
  const c = g.getBallCarrier()!; // home_fwd1 at (9,d)
  const teammate = g.getTeam('home').find((p) => p.id === 'home_fwd2')!; // (9,f)
  // dist from (9,d) to (9,f) = 2 — valid pass distance (≤10).
  const r = g.applyMove(c.id, teammate.position);
  assert(r.valid, 'pass to teammate 2 cells away is valid');
}

// Cannot dribble into opponent's cell (invalid classification).
{
  const g = Engine.init();
  const c = g.getBallCarrier()!;
  // Move an opponent adjacent to ball carrier first.
  const s = g.getState();
  const oppId = 'away_fwd2';
  moveTo(s, oppId, { col: c.position.col + 1, row: c.position.row });
  const g2 = new Engine(s);
  const r = g2.applyMove(c.id, { col: c.position.col + 1, row: c.position.row });
  assert(!r.valid, 'ball carrier moving into opponent cell is invalid');
}

// Out of bounds.
{
  const g = Engine.init();
  const gk = g.getPlayer('home_gk')!;
  const r = g.applyMove(gk.id, { col: 0, row: 'f' });
  assert(!r.valid, 'col 0 out of bounds');
  const r2 = g.applyMove(gk.id, { col: 5, row: 'l' });
  assert(!r2.valid, 'row l out of bounds');
}

console.log('\n=== 10-CELL PASS / SHOOT CAPS ===\n');

// Pass up to 10 cells legal in any direction.
{
  const g = Engine.init();
  const c = g.getBallCarrier()!; // (9,f)
  // Place a teammate at distance 10 — col 19 same row, after parking opponents.
  const s = g.getState();
  clearOpponents(s, 'home');
  const teammate = s.players.find((p) => p.id === 'home_mid1')!;
  teammate.position = { col: 19, row: 'f' };
  const g2 = new Engine(s, () => 0); // rng=0 so any roll < threshold "succeeds" but here pass is geometric only.
  const r = g2.applyMove(c.id, { col: 19, row: 'f' });
  assert(r.valid, 'pass 10 cells away is valid');
  assert(r.outcome === 'success' || r.outcome === 'intercepted', 'pass 10 cells outcome is success or intercepted');
}

// Pass 11 cells is invalid (>10).
{
  const g = Engine.init();
  const c = g.getBallCarrier()!; // (9,f)
  const s = g.getState();
  const teammate = s.players.find((p) => p.id === 'home_mid1')!;
  teammate.position = { col: 20, row: 'f' };
  const g2 = new Engine(s);
  const r = g2.applyMove(c.id, { col: 20, row: 'f' });
  assert(!r.valid, 'pass 11 cells is invalid');
}

// Backward pass is legal.
{
  const g = Engine.init();
  const c = g.getBallCarrier()!; // (9,f)
  const teammate = g.getTeam('home').find((p) => p.id === 'home_def2')!; // (3,d)
  const r = g.applyMove(c.id, teammate.position);
  assert(r.valid, 'backward pass is legal');
}

// Pass onto opponent's cell is invalid.
{
  const g = Engine.init();
  const c = g.getBallCarrier()!;
  const opp = g.getTeam('away').find((p) => p.id === 'away_fwd2')!; // (14,f) — dist 5
  const r = g.applyMove(c.id, opp.position);
  assert(!r.valid, 'pass onto opponent cell is invalid');
}

// Shot up to 10 cells legal; 11 invalid.
{
  const g = Engine.init();
  const c = g.getBallCarrier()!; // (9,f)
  const s = g.getState();
  // Park away non-GK far away so the shot path is clear.
  for (const p of s.players) {
    if (p.team === 'away' && p.role !== 'gk') {
      p.position = { col: 22, row: String.fromCharCode('a'.charCodeAt(0) + ((p.id.charCodeAt(p.id.length - 1) - 48) % 4)) };
    }
  }
  // Move carrier to col 12, row f — distance to col 22 row f is 10.
  const carrier = s.players.find((p) => p.id === c.id)!;
  carrier.position = { col: 12, row: 'f' };
  s.ball = { ...carrier.position };
  // Ensure away GK is at (22,f) and not blocking near goal cell — distance from GK to (22,f) is 0 → "near" but it's the GK so the engine's near check excludes GK.
  const g2 = new Engine(s);
  const r = g2.applyMove(c.id, { col: 22, row: 'f' });
  assert(r.valid, 'shot 10 cells away is legal');
}

{
  const g = Engine.init();
  const c = g.getBallCarrier()!;
  const s = g.getState();
  const carrier = s.players.find((p) => p.id === c.id)!;
  carrier.position = { col: 11, row: 'f' };
  s.ball = { ...carrier.position };
  const g2 = new Engine(s);
  const r = g2.applyMove(c.id, { col: 22, row: 'f' });
  assert(!r.valid, 'shot 11 cells away is invalid');
}

console.log('\n=== PASS RISK: GEOMETRIC ONLY ===\n');

// No defender on line: pass succeeds even on a long pass.
{
  const g = Engine.init();
  const c = g.getBallCarrier()!;
  const s = g.getState();
  clearOpponents(s, 'home');
  const teammate = s.players.find((p) => p.id === 'home_mid1')!;
  teammate.position = { col: 15, row: 'f' };
  const g2 = new Engine(s, () => 0.99);
  const r = g2.applyMove(c.id, { col: 15, row: 'f' });
  assert(r.valid && r.outcome === 'success', 'long pass with clear lane succeeds (no RNG bust)');
}

// No swarm rule: 2 defenders adjacent to receiver but not on the pass line still allows the pass.
{
  const g = Engine.init();
  const c = g.getBallCarrier()!; // (9,f)
  const s = g.getState();
  clearOpponents(s, 'home');
  const teammate = s.players.find((p) => p.id === 'home_mid1')!;
  teammate.position = { col: 12, row: 'f' };
  // Place two opposing defenders adjacent to receiver but off the pass line (line is row f cols 9..12).
  const def1 = s.players.find((p) => p.id === 'away_def1')!;
  def1.position = { col: 12, row: 'd' }; // 2 rows above target — off the line
  const def2 = s.players.find((p) => p.id === 'away_def2')!;
  def2.position = { col: 12, row: 'h' }; // 2 rows below — off the line
  const g2 = new Engine(s);
  const r = g2.applyMove(c.id, { col: 12, row: 'f' });
  assert(r.valid && r.outcome === 'success', 'swarm rule no longer blocks: pass succeeds with off-line adjacent defenders');
}

// Defender on line intercepts.
{
  const g = Engine.init();
  const c = g.getBallCarrier()!; // (9,f)
  const s = g.getState();
  clearOpponents(s, 'home');
  const teammate = s.players.find((p) => p.id === 'home_mid1')!;
  teammate.position = { col: 12, row: 'f' };
  const def = s.players.find((p) => p.id === 'away_def1')!;
  def.position = { col: 11, row: 'f' };
  const g2 = new Engine(s);
  const r = g2.applyMove(c.id, { col: 12, row: 'f' });
  assert(r.outcome === 'intercepted', 'defender directly on pass line intercepts');
  assert(g2.getState().possession === 'away', 'interception flips possession to defender team');
}

// checkInterception returns interceptor id.
{
  const g = Engine.init();
  const s = g.getState();
  clearOpponents(s, 'home');
  const def = s.players.find((p) => p.id === 'away_def1')!;
  def.position = { col: 11, row: 'f' };
  const result = checkInterception(s, { col: 9, row: 'f' }, { col: 13, row: 'f' }, 'home');
  assert(result.intercepted === true, 'checkInterception flags on-line defender');
  assert(result.interceptorId === 'away_def1', 'interceptor id matches');
}

// Defender > 1.2 from line does not intercept.
{
  const g = Engine.init();
  const s = g.getState();
  clearOpponents(s, 'home');
  const def = s.players.find((p) => p.id === 'away_def1')!;
  def.position = { col: 11, row: 'd' }; // 2 rows from line
  const result = checkInterception(s, { col: 9, row: 'f' }, { col: 13, row: 'f' }, 'home');
  assert(result.intercepted === false, 'defender 2 rows from line does not intercept');
}

console.log('\n=== TACKLE GAMBLE (ROLE-WEIGHTED) ===\n');

// 1-cell tackle, rng=0 → success: positions swap, possession flips.
{
  const g = Engine.init();
  const carrier = g.getBallCarrier()!; // home_fwd1 at (9,d)
  const s = g.getState();
  const tackler = s.players.find((p) => p.id === 'away_def1')!;
  tackler.position = { col: 10, row: 'd' };
  const g2 = new Engine(s, () => 0); // away_def1 is def (0.70); 0 < 0.70 → success
  const r = g2.applyMove(tackler.id, carrier.position);
  assert(r.valid, 'tackle move validates');
  assert(r.outcome === 'tackled', 'rng=0 yields tackled');
  const ns = g2.getState();
  const newCarrier = ns.players.find((p) => p.hasBall)!;
  assert(newCarrier.id === tackler.id, 'tackler now has ball');
  assert(posEq(newCarrier.position, carrier.position), 'tackler swapped to carrier cell');
  const oldCarrier = ns.players.find((p) => p.id === carrier.id)!;
  assert(posEq(oldCarrier.position, { col: 10, row: 'd' }), 'carrier displaced to tackler origin');
  assert(ns.possession === 'away', 'possession flipped to tackler team');
}

// rng=0.99 → tackleFailed; carrier keeps ball, tackler bounces back along carrier→tackler vector.
{
  const g = Engine.init();
  const carrier = g.getBallCarrier()!; // (9,d)
  const s = g.getState();
  const tackler = s.players.find((p) => p.id === 'away_def1')!;
  tackler.position = { col: 10, row: 'd' };
  // Bounce-back cell is (11,d). Make sure it's empty.
  for (const p of s.players) {
    if (p.id !== tackler.id && p.position.col === 11 && p.position.row === 'd') {
      p.position = { col: 22, row: 'a' };
    }
  }
  const g2 = new Engine(s, () => 0.99); // away_def1 is def (0.70); 0.99 >= 0.70 → fail
  const r = g2.applyMove(tackler.id, carrier.position);
  assert(r.outcome === 'tackleFailed', 'rng=0.99 yields tackleFailed');
  const ns = g2.getState();
  const stillCarrier = ns.players.find((p) => p.id === carrier.id)!;
  assert(stillCarrier.hasBall, 'carrier still has ball after failed tackle');
  const bounced = ns.players.find((p) => p.id === tackler.id)!;
  assert(posEq(bounced.position, { col: 11, row: 'd' }), 'tackler bounced 1 cell along carrier->tackler vector');
  assert(ns.possession === 'home', 'possession reflects ball holder after failed tackle');
}

// 2-cell tackle is invalid (must be exactly 1 cell).
{
  const g = Engine.init();
  const carrier = g.getBallCarrier()!; // (9,d)
  const s = g.getState();
  const tackler = s.players.find((p) => p.id === 'away_def1')!;
  tackler.position = { col: 11, row: 'd' };
  const g2 = new Engine(s, () => 0);
  const r = g2.applyMove(tackler.id, carrier.position);
  assert(!r.valid, '2-cell tackle is invalid');
}

// Failed-tackle bounce-back blocked by occupant: tackler stays in place.
{
  const g = Engine.init();
  const carrier = g.getBallCarrier()!; // (9,d)
  const s = g.getState();
  const tackler = s.players.find((p) => p.id === 'away_def1')!;
  tackler.position = { col: 10, row: 'd' };
  const blocker = s.players.find((p) => p.id === 'away_def2')!;
  blocker.position = { col: 11, row: 'd' };
  const g2 = new Engine(s, () => 0.99);
  g2.applyMove(tackler.id, carrier.position);
  const ns = g2.getState();
  const stillTackler = ns.players.find((p) => p.id === tackler.id)!;
  assert(posEq(stillTackler.position, { col: 10, row: 'd' }), 'failed tackle with blocked bounce-back: tackler stays');
}

console.log('\n=== SHOOTING ===\n');

// Goal scored from a clear shot.
{
  const g = Engine.init();
  const c = g.getBallCarrier()!;
  const s = g.getState();
  // Park away non-GK far from the goal.
  for (const p of s.players) {
    if (p.team === 'away' && p.role !== 'gk') {
      p.position = { col: 1, row: 'a' };
    }
  }
  const carrier = s.players.find((p) => p.id === c.id)!;
  carrier.position = { col: 21, row: 'f' };
  s.ball = { ...carrier.position };
  const g2 = new Engine(s);
  const r = g2.applyMove(c.id, { col: 22, row: 'f' });
  assert(r.outcome === 'goal', 'clear shot scores');
  assert(r.scored === true, 'scored flag set');
  assert(g2.getState().score.home === 1, 'home score is 1');
  // Reset positions: ball goes to conceding team (away) fwd.
  const newCarrier = g2.getState().players.find((p) => p.hasBall)!;
  assert(newCarrier.team === 'away', 'kickoff goes to conceding team');
  assert(g2.getState().possession === 'away', 'possession to conceding team after goal');
}

// Off-target shot → miss, possession to opponent GK.
{
  const g = Engine.init();
  const c = g.getBallCarrier()!;
  const s = g.getState();
  const carrier = s.players.find((p) => p.id === c.id)!;
  carrier.position = { col: 21, row: 'f' };
  s.ball = { ...carrier.position };
  const g2 = new Engine(s);
  // Shoot at col 22 row 'a' — off-target (rows e-g only).
  const r = g2.applyMove(c.id, { col: 22, row: 'a' });
  assert(r.outcome === 'miss', 'shot off-target is miss');
  const newCarrier = g2.getState().players.find((p) => p.hasBall)!;
  assert(newCarrier.id === 'away_gk', 'opposing GK now has the ball after miss');
}

// Blocked shot: defender within distance 2 of goal target.
{
  const g = Engine.init();
  const c = g.getBallCarrier()!;
  const s = g.getState();
  const carrier = s.players.find((p) => p.id === c.id)!;
  carrier.position = { col: 21, row: 'f' };
  s.ball = { ...carrier.position };
  // Park other away non-GK far away first.
  for (const p of s.players) {
    if (p.team === 'away' && p.role !== 'gk') {
      p.position = { col: 1, row: 'a' };
    }
  }
  // Then put one defender right in front of the goal.
  const def = s.players.find((p) => p.id === 'away_def1')!;
  def.position = { col: 21, row: 'g' }; // distance to (22,f) ~ 1.4 < 2
  const g2 = new Engine(s);
  const r = g2.applyMove(c.id, { col: 22, row: 'f' });
  assert(r.outcome === 'blocked', 'shot blocked by close defender');
  const ns = g2.getState();
  const newCarrier = ns.players.find((p) => p.hasBall)!;
  assert(newCarrier.team === 'away', 'blocker team has ball');
}

console.log('\n=== HALF-TIME / FULL-TIME ===\n');

// Half-time triggers when timeRemaining first crosses HALF_TIME_THRESHOLD.
{
  const s = initGameState();
  s.timeRemaining = HALF_TIME_THRESHOLD + 10; // exactly one move from threshold
  const g = new Engine(s);
  const c = g.getBallCarrier()!;
  const r = g.applyMove(c.id, { col: c.position.col + 1, row: c.position.row });
  assert(r.valid, 'pre-half-time move valid');
  assert(g.getState().status === 'halfTime', 'status flips to halfTime when crossing threshold');
  assert(g.getState().halfTimeTriggered, 'halfTimeTriggered set');
}

// resumeFromHalfTime flips status back to playing (no AP refill in chess-style).
{
  const s = initGameState();
  s.timeRemaining = HALF_TIME_THRESHOLD + 10;
  const g = new Engine(s);
  const c = g.getBallCarrier()!;
  g.applyMove(c.id, { col: c.position.col + 1, row: c.position.row });
  assert(g.getState().status === 'halfTime', 'at half-time');
  g.resumeFromHalfTime();
  assert(g.getState().status === 'playing', 'resume flips back to playing');
}

// Half-time blocks input.
{
  const s = initGameState();
  s.status = 'halfTime';
  const g = new Engine(s);
  const c = g.getBallCarrier()!;
  const r = g.applyMove(c.id, { col: c.position.col + 1, row: c.position.row });
  assert(!r.valid, 'cannot move while at half-time');
}

// Full-time when clock hits 0.
{
  const s = initGameState();
  s.timeRemaining = 10;
  const g = new Engine(s);
  const c = g.getBallCarrier()!;
  g.applyMove(c.id, { col: c.position.col + 1, row: c.position.row });
  assert(g.getState().status === 'fullTime', 'status flips to fullTime when clock hits 0');
}

// Full-time blocks input.
{
  const s = initGameState();
  s.status = 'fullTime';
  const g = new Engine(s);
  const c = g.getBallCarrier()!;
  const r = g.applyMove(c.id, { col: c.position.col + 1, row: c.position.row });
  assert(!r.valid, 'cannot move at full-time');
}

console.log('\n=== CLASSIFY MOVE ===\n');

{
  const g = Engine.init();
  const s = g.getState();
  const carrier = s.players.find((p) => p.hasBall)!;

  // Empty cell forward = dribble
  assert(
    classifyMove(s, carrier, { col: carrier.position.col + 1, row: carrier.position.row }) === 'dribble',
    'classify: empty cell = dribble'
  );

  // Teammate cell = pass
  const mate = s.players.find((p) => p.team === 'home' && !p.hasBall && p.role === 'mid')!;
  assert(classifyMove(s, carrier, mate.position) === 'pass', 'classify: teammate cell = pass');

  // Goal column = shoot
  assert(classifyMove(s, carrier, { col: 22, row: 'f' }) === 'shoot', 'classify: goal column = shoot');

  // Opponent cell while holding ball (not on goal column) = invalid
  const opp = s.players.find((p) => p.team === 'away' && !p.hasBall && p.position.col !== 22)!;
  assert(classifyMove(s, carrier, opp.position) === 'invalid', 'classify: opp cell while holding = invalid');

  // Non-carrier moving onto opposing carrier = tackle
  const tackler = s.players.find((p) => p.team === 'away' && p.role === 'def')!;
  // Move tackler adjacent to carrier
  const s2 = clone(s);
  const t2 = s2.players.find((p) => p.id === tackler.id)!;
  t2.position = { col: carrier.position.col + 1, row: carrier.position.row };
  const c2 = s2.players.find((p) => p.id === carrier.id)!;
  assert(classifyMove(s2, t2, c2.position) === 'tackle', 'classify: into opp carrier = tackle');

  // Non-carrier moving to empty cell = run
  const runner = s.players.find((p) => p.team === 'home' && p.role === 'def')!;
  assert(
    classifyMove(s, runner, { col: runner.position.col + 1, row: runner.position.row }) === 'run',
    'classify: empty cell off-ball = run'
  );
}

console.log('\n=== validateMove / canMoveTo ===\n');

{
  const g = Engine.init();
  const s = g.getState();
  const carrier = s.players.find((p) => p.hasBall)!;

  const v = validateMove(s, carrier.id, { col: carrier.position.col + 1, row: carrier.position.row });
  assert(v.valid === true, 'validateMove: 1-cell forward dribble valid');

  const v2 = validateMove(s, carrier.id, { col: carrier.position.col + 3, row: carrier.position.row });
  assert(!v2.valid, 'validateMove: 3-cell dribble invalid');

  const v3 = validateMove(s, 'no_such_player', { col: 5, row: 'e' });
  assert(!v3.valid, 'validateMove: missing player invalid');

  const v4 = validateMove(s, carrier.id, carrier.position);
  assert(!v4.valid, 'validateMove: same-position invalid');

  // canMoveTo true for valid forward cell
  assert(canMoveTo(s, carrier, { col: carrier.position.col + 1, row: carrier.position.row }) === true, 'canMoveTo: valid');
  assert(canMoveTo(s, carrier, { col: 0, row: 'f' }) === false, 'canMoveTo: out of bounds false');
}

console.log('\n=== CONSTANTS ===\n');

assert(MAX_STEP_DIST === 1, 'MAX_STEP_DIST is 1');
assert(MAX_PASS_DIST === 10, 'MAX_PASS_DIST is 10');
assert(HALF_TIME_THRESHOLD === 2700, 'HALF_TIME_THRESHOLD is 2700');

console.log('\n=== UTILITIES ===\n');

assert(posEq({ col: 5, row: 'e' }, { col: 5, row: 'e' }) === true, 'posEq: equal');
assert(posEq({ col: 5, row: 'e' }, { col: 5, row: 'f' }) === false, 'posEq: not equal');
assert(gridDistance({ col: 1, row: 'a' }, { col: 4, row: 'a' }) === 3, 'gridDistance: row=row, col diff');
assert(gridDistance({ col: 1, row: 'a' }, { col: 1, row: 'd' }) === 3, 'gridDistance: col=col, row diff');
assert(gridDistance({ col: 1, row: 'a' }, { col: 4, row: 'd' }) === 3, 'gridDistance: chebyshev');
assert(isGoalPosition({ col: 22, row: 'f' }, 'home') === true, 'isGoalPosition: home shoots col 22 f');
assert(isGoalPosition({ col: 1, row: 'f' }, 'away') === true, 'isGoalPosition: away shoots col 1 f');
assert(isGoalPosition({ col: 22, row: 'a' }, 'home') === false, 'isGoalPosition: row a is not in goal');

console.log('\n=== getBallCarrier ===\n');

{
  const g = Engine.init();
  const s = g.getState();
  const carrier = getBallCarrier(s);
  assert(carrier !== undefined, 'getBallCarrier returns a player at init');
  assert(carrier!.hasBall === true, 'returned carrier has ball');
}

console.log('\n=== POSSESSION CHANGES MID-GAME ===\n');

// After an interception, possession flips and ballCarrierId updates.
{
  const g = Engine.init();
  const c = g.getBallCarrier()!;
  const s = g.getState();
  clearOpponents(s, 'home');
  const teammate = s.players.find((p) => p.id === 'home_mid1')!;
  teammate.position = { col: 12, row: 'f' };
  const def = s.players.find((p) => p.id === 'away_def1')!;
  def.position = { col: 11, row: 'f' };
  const g2 = new Engine(s);
  g2.applyMove(c.id, { col: 12, row: 'f' });
  const ns = g2.getState();
  assert(ns.ballCarrierId === 'away_def1', 'ballCarrierId updated to interceptor');
  assert(ns.possession === 'away', 'possession is away after interception');
}

console.log('\n=== PREVIEW HELPER TESTS ===\n');

// previewTackle returns role-weighted probabilities.
{
  const g = Engine.init();
  const s = g.getState();
  // away_def1 is a defender → 0.70
  assert(previewTackle(s, 'away_def1').successProbability === 0.70, 'previewTackle: def → 0.70');
  // find a mid and fwd on away team
  const mid = s.players.find((p) => p.team === 'away' && p.role === 'mid')!;
  const fwd = s.players.find((p) => p.team === 'away' && p.role === 'fwd')!;
  assert(previewTackle(s, mid.id).successProbability === 0.50, 'previewTackle: mid → 0.50');
  assert(previewTackle(s, fwd.id).successProbability === 0.20, 'previewTackle: fwd → 0.20');
}

// previewPass should agree with applyMove for a clearly intercepted pass.
{
  const g = Engine.init();
  const c = g.getBallCarrier()!;
  const s = g.getState();
  clearOpponents(s, 'home');
  const teammate = s.players.find((p) => p.id === 'home_mid1')!;
  teammate.position = { col: 12, row: 'f' };
  const def = s.players.find((p) => p.id === 'away_def1')!;
  def.position = { col: 11, row: 'f' };

  const preview = previewPass(s, c.position, { col: 12, row: 'f' }, c.team);
  assert(preview.intercepted, 'previewPass flags blocked pass as intercepted');
  assert(preview.lineRisk === 'blocked', 'blocked pass lineRisk is "blocked"');
  assert(preview.interceptorId === 'away_def1', 'previewPass names the interceptor');

  const g2 = new Engine(s);
  const result = g2.applyMove(c.id, { col: 12, row: 'f' });
  assert(
    (result.outcome === 'intercepted') === preview.intercepted,
    'previewPass agrees with applyMove on interception'
  );
}

// previewPass should mark a clear pass as 'clear' and a near-line defender as 'risk'.
{
  const g = Engine.init();
  const c = g.getBallCarrier()!;
  const s = g.getState();
  clearOpponents(s, 'home');
  const teammate = s.players.find((p) => p.id === 'home_mid1')!;
  teammate.position = { col: 12, row: 'f' };

  const clear = previewPass(s, c.position, { col: 12, row: 'f' }, c.team);
  assert(clear.lineRisk === 'clear', 'unobstructed pass lineRisk is "clear"');
  assert(!clear.intercepted, 'unobstructed pass is not intercepted');

  // Place a defender near the line but outside INTERCEPT_RADIUS (1.2)
  // and inside the risk band (1.8). Pass runs from c -> (12,f); place
  // defender at (8, d) — line at col 8 is at row 'f', so distance ~2 rows.
  // Tighter: defender at (9, e) — distance ~1.5 rows from line at row 'f'.
  const def = s.players.find((p) => p.id === 'away_def1')!;
  const startRow = c.position.row;
  // pick a midpoint column and offset row by ~1.5 from the line.
  def.position = { col: Math.floor((c.position.col + 12) / 2), row: startRow };
  // Move the defender 1.5 rows away — but rows are integers, so use 1 row + col stagger.
  const rowOffset = String.fromCharCode(startRow.charCodeAt(0) + 1);
  def.position = { col: def.position.col, row: rowOffset };

  const risky = previewPass(s, c.position, { col: 12, row: 'f' }, c.team);
  assert(
    risky.lineRisk === 'risk' || risky.lineRisk === 'blocked',
    'defender near line yields risk or blocked, not clear'
  );
}

// previewPass agreement: 100 random passes — preview.intercepted must equal applyMove outcome.
{
  let agreements = 0;
  let trials = 0;
  for (let i = 0; i < 100; i++) {
    const g = Engine.init();
    const c = g.getBallCarrier()!;
    const s = g.getState();
    // Pick a random teammate as target
    const teammates = s.players.filter((p) => p.team === c.team && p.id !== c.id);
    const target = teammates[i % teammates.length];
    const preview = previewPass(s, c.position, target.position, c.team);
    const g2 = new Engine(s);
    const result = g2.applyMove(c.id, target.position);
    if (result.valid) {
      trials++;
      const wasIntercepted = result.outcome === 'intercepted';
      if (wasIntercepted === preview.intercepted) agreements++;
    }
  }
  assert(trials > 0, 'preview agreement: had at least one valid pass trial');
  assert(agreements === trials, `preview agrees with applyMove on all ${trials} trials`);
}

// getPassTargets enumerates pass-classified teammates and only those.
{
  const g = Engine.init();
  const c = g.getBallCarrier()!;
  const targets = getPassTargets(g.getState(), c.id);
  assert(targets.length > 0, 'getPassTargets returns at least one target at kickoff');
  for (const t of targets) {
    assert(t.playerId !== c.id, 'getPassTargets never includes the carrier');
    assert(
      t.lineRisk === 'clear' || t.lineRisk === 'risk' || t.lineRisk === 'blocked',
      'getPassTargets lineRisk is well-typed'
    );
  }
}

// getPassTargets returns empty for a non-carrier.
{
  const g = Engine.init();
  const nonCarrier = g.getTeam('away')[0];
  const targets = getPassTargets(g.getState(), nonCarrier.id);
  assert(targets.length === 0, 'getPassTargets is empty for a non-carrier');
}

console.log('\n=== EVENT LOG / STATS / SEED ===\n');

// matchId and seed are populated and stable across getState reads.
{
  const g = Engine.init();
  const s1 = g.getState();
  const s2 = g.getState();
  assert(typeof s1.matchId === 'string' && s1.matchId.length > 0, 'matchId is non-empty');
  assert(typeof s1.seed === 'number', 'seed is a number');
  assert(s1.matchId === s2.matchId, 'matchId stable across reads');
  assert(s1.seed === s2.seed, 'seed stable across reads');
}

// Explicit options propagate.
{
  const g = Engine.init('4-3-3', '4-3-3', undefined, { matchId: 'fixed', seed: 42 });
  const s = g.getState();
  assert(s.matchId === 'fixed', 'matchId honors options');
  assert(s.seed === 42, 'seed honors options');
}

// Events accumulate on applyMove with at least one entry.
{
  const g = Engine.init();
  const c = g.getBallCarrier()!;
  const before = g.getState().events.length;
  // Dribble forward one cell
  const target = { col: c.position.col + 1, row: c.position.row };
  g.applyMove(c.id, target);
  const after = g.getState().events.length;
  assert(after === before + 1, 'event log appends one entry per applyMove');
  const last = g.getState().events[after - 1];
  assert(last.playerId === c.id, 'event records playerId');
  assert(last.team === 'home', 'event records team');
  assert(last.from?.col === c.position.col, 'event records from.col');
  assert(last.to?.col === target.col, 'event records to.col');
}

// Stats: a successful pass increments passes + passesCompleted on the carrier.
{
  const g = Engine.init();
  const c = g.getBallCarrier()!;
  const s = g.getState();
  clearOpponents(s, 'home');
  // Place teammate clearly within pass range with no defenders on line.
  const teammate = s.players.find((p) => p.id === 'home_mid1')!;
  teammate.position = { col: c.position.col + 2, row: c.position.row };
  const g2 = new Engine(s);
  const result = g2.applyMove(c.id, teammate.position);
  assert(result.valid && result.outcome !== 'intercepted', 'pass setup completes');
  const carrierAfter = g2.getState().players.find((p) => p.id === c.id)!;
  assert(carrierAfter.stats.passes === 1, 'pass increments stats.passes');
  assert(carrierAfter.stats.passesCompleted === 1, 'completed pass increments stats.passesCompleted');
}

// Stats: an intercepted pass increments interceptor's interceptions.
{
  const g = Engine.init();
  const c = g.getBallCarrier()!;
  const s = g.getState();
  clearOpponents(s, 'home');
  const teammate = s.players.find((p) => p.id === 'home_mid1')!;
  teammate.position = { col: 12, row: 'f' };
  const def = s.players.find((p) => p.id === 'away_def1')!;
  def.position = { col: 11, row: 'f' };
  const g2 = new Engine(s);
  g2.applyMove(c.id, { col: 12, row: 'f' });
  const interceptor = g2.getState().players.find((p) => p.id === 'away_def1')!;
  assert(interceptor.stats.interceptions === 1, 'interception increments stats.interceptions');
}

// Stats: shot on target increments shots + shotsOnTarget; goal increments goals.
{
  const g = Engine.init();
  const c = g.getBallCarrier()!;
  const s = g.getState();
  // Park every away non-GK far from the away goal so the shot isn't blocked.
  let parkRow = 0;
  for (const p of s.players) {
    if (p.team === 'away' && p.role !== 'gk') {
      p.position = { col: 1, row: String.fromCharCode('a'.charCodeAt(0) + (parkRow % 11)) };
      parkRow++;
    }
  }
  const fwd = s.players.find((p) => p.id === c.id)!;
  fwd.position = { col: 21, row: 'f' };
  const g2 = new Engine(s, () => 0);
  const result = g2.applyMove(c.id, { col: 22, row: 'f' });
  assert(result.outcome === 'goal', 'shot becomes goal in clear scenario');
  const scorer = g2.getState().players.find((p) => p.id === c.id)!;
  assert(scorer.stats.shots === 1, 'shot increments stats.shots');
  assert(scorer.stats.shotsOnTarget === 1, 'on-target shot increments stats.shotsOnTarget');
  assert(scorer.stats.goals === 1, 'goal increments stats.goals');
}

console.log('\n=========================================');
console.log(`PASS: ${pass}   FAIL: ${fail}   TOTAL: ${pass + fail}`);
console.log('=========================================\n');

declare const process: { exit(code: number): never };
if (fail > 0) {
  process.exit(1);
}
