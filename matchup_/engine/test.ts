import Engine from './index.js';
import { initGameState, getBallCarrier, resetPositions } from './formations.js';
import { validateMove, isBackwardMove, isForwardMove, canMoveTo, canTackle, checkInterception, classifyMove } from './moves.js';
import { isInGoalArea, isGoalPosition, posEq, gridDistance, MAX_DRIBBLE_DIST, MAX_PASS_DIST, MAX_RUN_DIST, MAX_TACKLE_DIST, MAX_SHOT_DIST } from './types.js';

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

console.log('=== FORMATION TESTS ===\n');

// Test 1: All formations have 11 players per side
const formations = ['4-3-3', '4-4-2', '3-5-2', '5-3-2', '4-2-3-1', '3-4-3'] as const;
for (const f of formations) {
  const g = Engine.init(f);
  const h = g.getTeam('home');
  const a = g.getTeam('away');
  assert(h.length === 11, `${f} home should have 11 players, got ${h.length}`);
  assert(a.length === 11, `${f} away should have 11 players, got ${a.length}`);
}

// Test 2: No overlapping positions
for (const f of formations) {
  const g = Engine.init(f);
  const allPlayers = [...g.getTeam('home'), ...g.getTeam('away')];
  const positions = allPlayers.map(p => `${p.position.row}${p.position.col}`);
  const uniquePositions = new Set(positions);
  assert(positions.length === uniquePositions.size, `${f} should have no overlapping positions`);
}

// Test 3: Ball starts with home fwd
const initGame = Engine.init();
const bc = initGame.getBallCarrier();
assert(bc !== undefined, 'Ball carrier should exist at init');
assert(bc!.team === 'home', `Ball carrier should be home, got ${bc!.team}`);
assert(bc!.role === 'fwd', `Ball carrier should be fwd, got ${bc!.role}`);

// Test 4: GameState stores formation names
const state4 = initGame.getState();
assert(state4.homeFormation === '4-3-3', `homeFormation should be stored, got ${state4.homeFormation}`);
assert(state4.awayFormation === '4-3-3', `awayFormation should be stored, got ${state4.awayFormation}`);

// Test 5: Mixed formations
const mixed = Engine.init('4-4-2', '3-4-3');
const mixedState = mixed.getState();
assert(mixedState.homeFormation === '4-4-2', 'Mixed: home should be 4-4-2');
assert(mixedState.awayFormation === '3-4-3', 'Mixed: away should be 3-4-3');
assert(mixed.getTeam('home').filter(p => p.role === 'def').length === 4, '4-4-2 should have 4 defs');
assert(mixed.getTeam('away').filter(p => p.role === 'def').length === 3, '3-4-3 should have 3 defs');

console.log('\n=== MOVEMENT & DISTANCE TESTS ===\n');

// Test 6: Ball carrier can dribble forward 1 cell
const game6 = Engine.init();
const carrier6 = game6.getBallCarrier()!;
const fwd1 = { col: carrier6.position.col + 1, row: carrier6.position.row };
const r6 = game6.applyMove(carrier6.id, fwd1);
assert(r6.valid === true, 'Ball carrier should dribble forward 1 cell');

// Test 7: Ball carrier cannot move backward
const game7 = Engine.init();
const carrier7 = game7.getBallCarrier()!;
const back1 = { col: carrier7.position.col - 1, row: carrier7.position.row };
const r7 = game7.applyMove(carrier7.id, back1);
assert(r7.valid === false, 'Ball carrier should NOT move backward');

// Test 8: Ball carrier can dribble sideways to empty cell (within distance limit)
// Test 8: Ball carrier can dribble sideways to empty cell
const game8 = Engine.init();
const carrier8 = game8.getBallCarrier()!;
// In 4-3-3, LW is at col 9, row d. Col 9, row c is empty and within dribble range (dist 1).
const side1 = { col: carrier8.position.col, row: 'c' };
const r8 = game8.applyMove(carrier8.id, side1);
assert(r8.valid === true, `Ball carrier should dribble sideways to c${carrier8.position.col}`);

// Test 9: Cannot move to occupied cell (non-ball-carrier opponent)
const game9 = Engine.init();
const homePlayer = game9.getTeam('home').find(p => !p.hasBall)!;
const awayPlayer = game9.getTeam('away').find(p => !p.hasBall)!;
const r9 = game9.applyMove(homePlayer.id, awayPlayer.position);
assert(r9.valid === false, 'Should not move onto opponent without ball');

// Test 10: Cannot move out of bounds
const game10 = Engine.init();
const gk10 = game10.getPlayer('home_gk')!;
const oob = { col: 0, row: 'f' };
const r10 = game10.applyMove(gk10.id, oob);
assert(r10.valid === false, 'Should not move out of bounds (col 0)');

const oob2 = { col: 5, row: 'l' };
const r10b = game10.applyMove(gk10.id, oob2);
assert(r10b.valid === false, 'Should not move out of bounds (row l)');

// Test 11: Distance limit — cannot teleport
const game11 = Engine.init();
const carrier11 = game11.getBallCarrier()!;
const farAway = { col: carrier11.position.col + 5, row: carrier11.position.row };
const r11 = game11.applyMove(carrier11.id, farAway);
assert(r11.valid === false, `Should not dribble 5 cells (max ${MAX_DRIBBLE_DIST})`);

// Test 12: Off-ball run max distance
const game12 = Engine.init();
const offBall12 = game12.getTeam('home').find(p => !p.hasBall)!;
const runFar = { col: offBall12.position.col + MAX_RUN_DIST + 1, row: offBall12.position.row };
const r12 = game12.applyMove(offBall12.id, runFar);
assert(r12.valid === false, `Off-ball run should not exceed ${MAX_RUN_DIST} cells`);

const runOk = { col: offBall12.position.col + MAX_RUN_DIST, row: offBall12.position.row };
const r12b = game12.applyMove(offBall12.id, runOk);
assert(r12b.valid === true, `Off-ball run of ${MAX_RUN_DIST} cells should be allowed`);

console.log('\n=== PASS TESTS ===\n');

// Test 13: Backward passes to teammates are allowed (to relieve pressure)
const game13 = Engine.init('4-3-3');
const fwd13 = game13.getBallCarrier()!;
const mid13 = game13.getPlayer('home_mid2')!;
// fwd at col 9, mid at col 6 — backward pass is legal
const r13 = game13.applyMove(fwd13.id, mid13.position);
assert(r13.valid === true, 'Backward pass to teammate should be allowed');

// Test 14: Forward pass to teammate
const game14 = Engine.init('4-3-3');
const fwd14 = game14.getBallCarrier()!;
const mid14 = game14.getPlayer('home_mid2')!;
const midFwd = { col: mid14.position.col + 3, row: mid14.position.row };
game14.applyMove(mid14.id, midFwd); // move 1: mid runs forward
const midAfter14 = game14.getPlayer('home_mid2')!;
const fwdAfter14 = game14.getBallCarrier()!;
const passResult = game14.applyMove(fwdAfter14.id, midAfter14.position);
assert(passResult.valid === true, `Forward pass should work. Got: ${JSON.stringify(passResult.outcome)}`);
if (passResult.valid) {
  const newBc = game14.getBallCarrier();
  assert(newBc!.id === mid14.id, `Ball should transfer to midfielder, got ${newBc?.id}`);
  const moverAfter = game14.getPlayer(fwdAfter14.id);
  const targetAfter = game14.getPlayer(mid14.id);
  const samePos = posEq(moverAfter!.position, targetAfter!.position);
  assert(!samePos, `Passer and receiver should NOT be on same cell after pass`);
}

// Test 15: Pass beyond max distance
const game15 = Engine.init('4-4-2');
const fwd15 = game15.getBallCarrier()!;
const gk15 = game15.getPlayer('home_gk')!;
const gkDist = gridDistance(fwd15.position, gk15.position);
assert(gkDist > MAX_PASS_DIST, `Fwd-to-GK distance should exceed ${MAX_PASS_DIST}, got ${gkDist}`);
const r15 = game15.applyMove(fwd15.id, gk15.position);
assert(r15.valid === false, `Should not pass ${gkDist} cells (max ${MAX_PASS_DIST})`);

console.log('\n=== INTERCEPTION TESTS ===\n');

// Test 16: Pass through defender gets intercepted (pure function)
const game16 = Engine.init('4-3-3');
const fwd16 = game16.getBallCarrier()!;
const passTarget16 = { col: fwd16.position.col + 4, row: fwd16.position.row };
const midCol16 = Math.round((fwd16.position.col + passTarget16.col) / 2);
// Force defender onto the pass line
const state16 = game16.getState();
const def16 = state16.players.find(p => p.id === 'away_def2')!;
def16.position = { col: midCol16, row: fwd16.position.row };
const intResult = checkInterception(state16, fwd16.position, passTarget16, 'home');
assert(intResult.intercepted === true, `Pass through defender at col ${midCol16} should be intercepted`);

// Test 17: Pass NOT intercepted when defender is far from line
const game17 = Engine.init('4-3-3');
const fwd17 = game17.getBallCarrier()!;
const passTarget17 = { col: fwd17.position.col + 4, row: 'a' };
const state17 = game17.getState();
const intResult17 = checkInterception(state17, fwd17.position, passTarget17, 'home');
assert(intResult17.intercepted === false, 'Pass far from defenders should not be intercepted');

// Test 18: Interception via actual applyMove
const game18 = Engine.init('4-3-3');
const state18 = game18.getState();
const fwd18 = state18.players.find(p => p.id === 'home_fwd1')!;
const mid18 = state18.players.find(p => p.id === 'home_mid2')!;
mid18.position = { col: 11, row: 'd' }; // Force mid to valid forward spot
const def18 = state18.players.find(p => p.id === 'away_def2')!;
def18.position = { col: 10, row: 'd' }; // Force def on the pass line
const engine18 = new Engine(state18);
const fwd18b = engine18.getBallCarrier()!;
const mid18b = engine18.getPlayer(mid18.id)!;
const r18 = engine18.applyMove(fwd18b.id, mid18b.position);
assert(r18.outcome === 'intercepted', `Should be intercepted, got ${r18.outcome}`);
assert(r18.possessionChange === true, 'Interception should flip possession');
assert(engine18.getState().moveNumber === 1, 'Move number should reset after interception');

console.log('\n=== TACKLE TESTS ===\n');

// Test 19: Defender can tackle ball carrier (force positions to avoid setup issues)
const game19 = Engine.init('4-3-3');
const state19 = game19.getState();
const homeFwd19 = state19.players.find(p => p.id === 'home_fwd1')!;
const awayDef19 = state19.players.find(p => p.id === 'away_def2')!;
// Place defender exactly 1 cell behind the ball carrier
const tacklerOrigPos = { col: homeFwd19.position.col - 1, row: homeFwd19.position.row };
awayDef19.position = { ...tacklerOrigPos };
const engine19 = new Engine(state19);

const canT = canTackle(engine19.getState(), awayDef19);
assert(canT === true, `Defender should be able to tackle carrier`);
const r19 = engine19.applyMove(awayDef19.id, homeFwd19.position);
assert(r19.valid === true, 'Tackle move should be valid');
assert(r19.outcome === 'tackled', `Outcome should be 'tackled', got '${r19.outcome}'`);
assert(r19.possessionChange === true, 'Tackle should cause possession change');
const newBc19 = engine19.getBallCarrier();
assert(newBc19!.id === awayDef19.id, `Tackler should have ball, got ${newBc19?.id}`);
const tacklerAfter = engine19.getPlayer(awayDef19.id)!;
const carrierAfter = engine19.getPlayer(homeFwd19.id)!;
assert(posEq(tacklerAfter.position, homeFwd19.position), 'Tackler should be at carrier\'s original position');
assert(posEq(carrierAfter.position, tacklerOrigPos), 'Carrier should be displaced to tackler\'s original position');
const allPos19 = engine19.getState().players.map(p => `${p.position.row}${p.position.col}`);
assert(new Set(allPos19).size === allPos19.length, 'No overlapping positions after tackle');

// Test 20: Tackle beyond max range fails
const game20 = Engine.init('4-3-3');
const homeFwd20 = game20.getBallCarrier()!;
const farDef20 = game20.getTeam('away').find(p => p.role === 'gk')!;
const dist20 = gridDistance(farDef20.position, homeFwd20.position);
assert(dist20 > MAX_TACKLE_DIST, `GK should be far from fwd: ${dist20} > ${MAX_TACKLE_DIST}`);
const r20 = game20.applyMove(farDef20.id, homeFwd20.position);
assert(r20.valid === false, `Should not tackle from ${dist20} cells away`);

// Test 21: Teammate cannot tackle own ball carrier
const game21 = Engine.init('4-3-3');
const homeFwd21 = game21.getBallCarrier()!;
const homeMid21 = game21.getPlayer('home_mid2')!;
const r21 = game21.applyMove(homeMid21.id, homeFwd21.position);
assert(r21.valid === false, 'Teammate should not be able to tackle own ball carrier');

console.log('\n=== POSSESSION & TURN TESTS ===\n');

// Test 22: After 3 moves, possession flips
const game22 = Engine.init();
const bc22 = game22.getBallCarrier()!;
const initPoss22 = game22.getState().possession;
game22.applyMove(bc22.id, { col: bc22.position.col + 1, row: bc22.position.row });
const bc22b = game22.getBallCarrier()!;
game22.applyMove(bc22b.id, { col: bc22b.position.col + 1, row: bc22b.position.row });
const bc22c = game22.getBallCarrier()!;
game22.applyMove(bc22c.id, { col: bc22c.position.col + 1, row: bc22c.position.row });
const after22 = game22.getState();
assert(after22.possession !== initPoss22, `After 3 moves possession should flip`);
assert(after22.moveNumber === 1, `Move number should reset to 1, got ${after22.moveNumber}`);

// Test 23: Tackle immediately flips possession (doesn't wait for 3 moves)
const game23 = Engine.init('4-3-3');
const state23 = game23.getState();
const fwd23 = state23.players.find(p => p.id === 'home_fwd1')!;
const def23 = state23.players.find(p => p.id === 'away_def2')!;
def23.position = { col: fwd23.position.col - 1, row: fwd23.position.row };
const engine23 = new Engine(state23);
engine23.applyMove(def23.id, fwd23.position); // tackle on move 1
const after23 = engine23.getState();
assert(after23.possession === 'away', 'Tackle should immediately give possession to tackling team');
assert(after23.moveNumber === 1, 'Move number should reset after tackle');

console.log('\n=== SHOOTING TESTS ===\n');

// Test 24: isInGoalArea now checks rows
assert(isInGoalArea({ col: 20, row: 'f' }, 'home') === true, 'Col 20 row f IS in home goal area');
assert(isInGoalArea({ col: 20, row: 'a' }, 'home') === false, 'Col 20 row a is NOT in home goal area (wrong row)');
assert(isInGoalArea({ col: 3, row: 'f' }, 'away') === true, 'Col 3 row f IS in away goal area');
assert(isInGoalArea({ col: 3, row: 'k' }, 'away') === false, 'Col 3 row k is NOT in away goal area (wrong row)');
assert(isInGoalArea({ col: 17, row: 'f' }, 'home') === false, 'Col 17 is too far from goal');

// Test 25: canShoot respects row bounds
const game25 = Engine.init();
const fwd25 = game25.getBallCarrier()!;
assert(!isInGoalArea(fwd25.position, 'home'), `FWD at col ${fwd25.position.col} should NOT be in goal area`);

// Test 26: Shoot from close range
const game26 = Engine.init('4-3-3');
const fwd26 = game26.getBallCarrier()!;
game26.applyMove(fwd26.id, { col: fwd26.position.col + 2, row: fwd26.position.row }); // move 1
const bc26b = game26.getBallCarrier()!;
game26.applyMove(bc26b.id, { col: bc26b.position.col + 2, row: bc26b.position.row }); // move 2
const bc26c = game26.getBallCarrier()!;
game26.applyMove(bc26c.id, { col: bc26c.position.col + 2, row: bc26c.position.row }); // move 3 (possession flips)
if (game26.getState().possession === 'away') {
  const awayBc = game26.getBallCarrier();
  if (awayBc) {
    game26.applyMove(awayBc.id, { col: awayBc.position.col - 1, row: awayBc.position.row });
    const awayBc2 = game26.getBallCarrier();
    if (awayBc2) {
      game26.applyMove(awayBc2.id, { col: awayBc2.position.col - 1, row: awayBc2.position.row });
      const awayBc3 = game26.getBallCarrier();
      if (awayBc3) {
        game26.applyMove(awayBc3.id, { col: awayBc3.position.col - 1, row: awayBc3.position.row }); // possession flips back to home
      }
    }
  }
}
const homeBc26 = game26.getBallCarrier();
if (homeBc26 && homeBc26.team === 'home') {
  game26.applyMove(homeBc26.id, { col: homeBc26.position.col + 2, row: homeBc26.position.row }); // move 1
  const homeBc26b = game26.getBallCarrier();
  if (homeBc26b && homeBc26b.team === 'home') {
    game26.applyMove(homeBc26b.id, { col: homeBc26b.position.col + 2, row: homeBc26b.position.row }); // move 2
    const homeBc26c = game26.getBallCarrier();
    if (homeBc26c && homeBc26c.team === 'home') {
      assert(isInGoalArea(homeBc26c.position, 'home'), `At col ${homeBc26c.position.col}, should be in goal area`);
      const shotResult = game26.applyMove(homeBc26c.id, { col: 22, row: 'f' });
      assert(shotResult.valid === true, `Should be able to shoot from col ${homeBc26c.position.col}`);
      assert(shotResult.outcome === 'goal' || shotResult.outcome === 'blocked', `Shot outcome should be goal or blocked, got ${shotResult.outcome}`);
    }
  }
}

console.log('\n=== POST-GOAL RESET TESTS ===\n');

// Test 27: After a goal, players reset to ACTUAL formation positions
const game27 = Engine.init('5-3-2', '3-4-3');
const forcedState27 = game27.getState();
const forcedFwd27 = forcedState27.players.find(p => p.id === 'home_fwd1')!;
forcedFwd27.position = { col: 19, row: 'f' };
forcedFwd27.hasBall = true;
forcedState27.ball = { ...forcedFwd27.position };
forcedState27.ballCarrierId = forcedFwd27.id;

// MUST move the nearby defender away BEFORE the shot, or it gets blocked
const awayDef27Setup = forcedState27.players.find(p => p.id === 'away_def2')!;
awayDef27Setup.position = { col: 18, row: 'a' };

const engine27 = new Engine(forcedState27);
const r27 = engine27.applyMove('home_fwd1', { col: 22, row: 'f' });

assert(r27.scored === true, 'Should have scored');
const afterGoal27 = engine27.getState();
assert(afterGoal27.possession === 'away', 'Away should get possession after home goal');

const homeDef27 = afterGoal27.players.find(p => p.id === 'home_def1')!;
assert(homeDef27.position.col === 2, `5-3-2 defender should reset to col 2, got ${homeDef27.position.col}`);

// Check the POST-goal state (afterGoal27), not the pre-game setup state
const awayDef27Check = afterGoal27.players.find(p => p.id === 'away_def2')!;
assert(awayDef27Check.position.col === 21, `3-4-3 defender should reset to col 21, got ${awayDef27Check.position.col}`);

const allPos27 = afterGoal27.players.map(p => `${p.position.row}${p.position.col}`);
assert(new Set(allPos27).size === allPos27.length, 'No overlapping positions after goal reset');
console.log('\n=== SHOOTING EDGE CASES ===\n');

// Test 28: Shot off target (outside goal row bounds) results in miss
const game28 = Engine.init('4-3-3');
const forcedState28 = game28.getState();
const forcedFwd28 = forcedState28.players.find(p => p.id === 'home_fwd1')!;
// Place close to goal so distance is valid, but shoot wide
forcedFwd28.position = { col: 21, row: 'c' };
forcedFwd28.hasBall = true;
forcedState28.ball = { ...forcedFwd28.position };
forcedState28.ballCarrierId = forcedFwd28.id;

const engine28 = new Engine(forcedState28);
const r28 = engine28.applyMove('home_fwd1', { col: 22, row: 'a' });
assert(r28.outcome === 'miss', `Off-target shot should be 'miss', got '${r28.outcome}'`);
assert(r28.possessionChange === true, 'Miss should cause possession change');
const after28 = engine28.getState();
assert(after28.possession === 'away', 'Away should get ball after miss');
const missReceiver = engine28.getPlayer(after28.ballCarrierId!);
assert(missReceiver?.role === 'gk', `GK should get ball after miss, got ${missReceiver?.role}`);

// Test 29: Shot blocked by nearby defender
const game29 = Engine.init('4-3-3');
const forcedState29 = game29.getState();
const forcedFwd29 = forcedState29.players.find(p => p.id === 'home_fwd1')!;
forcedFwd29.position = { col: 19, row: 'f' };
forcedFwd29.hasBall = true;
forcedState29.ball = { ...forcedFwd29.position };
forcedState29.ballCarrierId = forcedFwd29.id;

const awayDef29 = forcedState29.players.find(p => p.id === 'away_def2')!;
awayDef29.position = { col: 21, row: 'f' };

const engine29 = new Engine(forcedState29);
const r29 = engine29.applyMove('home_fwd1', { col: 22, row: 'f' });
assert(r29.outcome === 'blocked', `Shot should be blocked by nearby defender, got '${r29.outcome}'`);
assert(r29.possessionChange === true, 'Blocked shot should cause turnover');
const after29 = engine29.getState();
assert(after29.possession === 'away', 'Away should get ball after block');

console.log('\n=== GAME STATUS TESTS ===\n');

// Test 30: Game ends at fullTime
const game30 = Engine.init();
const forcedState30 = game30.getState();
forcedState30.timeRemaining = 25; // 2.5 moves left
const engine30 = new Engine(forcedState30);
engine30.applyMove(engine30.getBallCarrier()!.id, { col: 11, row: 'f' }); // 25 - 10 = 15
assert(engine30.getState().status === 'playing', 'Should be playing with 15s left');
engine30.applyMove(engine30.getBallCarrier()!.id, { col: 12, row: 'f' }); // 15 - 10 = 5
assert(engine30.getState().status === 'playing', 'Should be playing with 5s left');
engine30.applyMove(engine30.getBallCarrier()!.id, { col: 13, row: 'f' }); // 5 - 10 = 0
assert(engine30.getState().status === 'fullTime', 'Should be fullTime when time hits 0');

// Test 31: Moves rejected after fullTime
const r31 = engine30.applyMove(engine30.getBallCarrier()!.id, { col: 14, row: 'f' });
assert(r31.valid === false, 'Should not allow moves after fullTime');

console.log('\n=== CLASSIFY & MISC TESTS ===\n');

// Test 32: classifyMove correctly identifies move types
const game32 = Engine.init('4-3-3');
const state32 = game32.getState();
const fwd32 = state32.players.find(p => p.id === 'home_fwd1')!;
const mid32 = state32.players.find(p => p.id === 'home_mid2')!;
const awayDef32 = state32.players.find(p => p.id === 'away_def1')!;

assert(classifyMove(state32, fwd32, { col: 22, row: 'f' }) === 'shoot', 'Should classify as shoot');
assert(classifyMove(state32, fwd32, mid32.position) === 'pass', 'Should classify as pass');
assert(classifyMove(state32, fwd32, { col: 10, row: 'f' }) === 'dribble', 'Should classify as dribble');
assert(classifyMove(state32, awayDef32, fwd32.position) === 'tackle', 'Should classify as tackle');
const emptyCell = { col: 5, row: 'a' };
assert(classifyMove(state32, awayDef32, emptyCell) === 'run', 'Should classify as off-ball run');

// Test 33: String comparison for rows is consistent
assert('a' < 'b', 'String comparison a < b');
assert('e' >= 'e', 'String comparison e >= e');
assert('g' <= 'g', 'String comparison g <= g');
assert('k' > 'j', 'String comparison k > j');

console.log('\n=== SUMMARY ===');
console.log(`Passed: ${pass}/${pass + fail}`);
if (fail > 0) console.log(`Failed: ${fail}`);