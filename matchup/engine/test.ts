import Engine from './index.js';
import { initGameState, getBallCarrier, resetPositions } from './formations.js';
import { validateMove, isBackwardMove, isForwardMove, canMoveTo, canTackle, checkInterception, classifyMove } from './moves.js';
import { isInGoalArea, isGoalPosition, posEq, gridDistance, MAX_DRIBBLE_DIST, MAX_PASS_DIST, MAX_RUN_DIST, MAX_TACKLE_DIST, MAX_SHOT_DIST, passApCost } from './types.js';

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
const engine19 = new Engine(state19, () => 0); // force tackle success

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

// Test 22: Successful dribble keeps possession (AP cost 2 leaves 1)
const game22 = Engine.init();
const bc22 = game22.getBallCarrier()!;
const initPoss22 = game22.getState().possession;
game22.applyMove(bc22.id, { col: bc22.position.col + 1, row: bc22.position.row });
const after22 = game22.getState();
assert(after22.possession === initPoss22, `Successful dribble should KEEP possession`);
assert(after22.actionPoints.home === 18, `After dribble, home AP should be 18, got ${after22.actionPoints.home}`);

// Test 22b: Off-ball run keeps possession but spends 1 AP
const game22b = Engine.init();
const offBall22b = game22b.getTeam('home').find(p => !p.hasBall)!;
const initPoss22b = game22b.getState().possession;
game22b.applyMove(offBall22b.id, { col: offBall22b.position.col + 1, row: offBall22b.position.row });
const after22b = game22b.getState();
assert(after22b.possession === initPoss22b, `Off-ball run should KEEP possession (costs 1 AP)`);
assert(after22b.actionPoints.home === 19, `Off-ball run should leave 19 AP, got ${after22b.actionPoints.home}`);

// Test 23: Tackle immediately flips possession
const game23 = Engine.init('4-3-3');
const state23 = game23.getState();
const fwd23 = state23.players.find(p => p.id === 'home_fwd1')!;
const def23 = state23.players.find(p => p.id === 'away_def2')!;
def23.position = { col: fwd23.position.col - 1, row: fwd23.position.row };
const engine23 = new Engine(state23, () => 0); // force tackle success
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

// Test 26: Shoot from close range (force position near goal)
const game26 = Engine.init('4-3-3');
const forcedState26 = game26.getState();
const forcedFwd26 = forcedState26.players.find(p => p.id === 'home_fwd1')!;
forcedFwd26.position = { col: 20, row: 'f' };
forcedFwd26.hasBall = true;
forcedState26.ball = { ...forcedFwd26.position };
forcedState26.ballCarrierId = forcedFwd26.id;
forcedState26.possession = 'home';
const engine26 = new Engine(forcedState26);
assert(isInGoalArea(forcedFwd26.position, 'home'), `At col 20, should be in goal area`);
const shotResult26 = engine26.applyMove(forcedFwd26.id, { col: 22, row: 'f' });
assert(shotResult26.valid === true, `Should be able to shoot from col 20`);
assert(shotResult26.outcome === 'goal' || shotResult26.outcome === 'blocked', `Shot outcome should be goal or blocked, got ${shotResult26.outcome}`);

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

// Test 30: Game ends at fullTime when clock reaches 0
const game30 = Engine.init();
const forcedState30 = game30.getState();
forcedState30.timeRemaining = 10;
const engine30 = new Engine(forcedState30);
const carrier30 = engine30.getBallCarrier()!;
engine30.applyMove(carrier30.id, { col: carrier30.position.col + 1, row: carrier30.position.row });
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

console.log('\n=== ACTION POINT TESTS ===\n');

// AP Test 1: Fresh game starts with 20 AP for both teams
const apGame1 = Engine.init();
assert(apGame1.getState().actionPoints.home === 20, 'Fresh game should start with 20 AP for home');
assert(apGame1.getState().actionPoints.away === 20, 'Fresh game should start with 20 AP for away');
assert(apGame1.getState().maxActionPoints === 20, 'maxActionPoints should be 20');

// AP Test 2: Dribble (2 AP) leaves 18 AP and keeps possession
const apGame2 = Engine.init();
const apCarrier2 = apGame2.getBallCarrier()!;
apGame2.applyMove(apCarrier2.id, { col: apCarrier2.position.col + 1, row: apCarrier2.position.row });
assert(apGame2.getState().actionPoints.home === 18, `After dribble, AP should be 18, got ${apGame2.getState().actionPoints.home}`);
assert(apGame2.getState().possession === 'home', 'Possession should remain home after dribble');

// AP Test 3: Cannot dribble with only 1 AP (cost 2)
const apState3 = Engine.init().getState();
apState3.actionPoints.home = 1;
const apEngine3 = new Engine(apState3);
const apCarrier3 = apEngine3.getBallCarrier()!;
const ap3Result = apEngine3.applyMove(apCarrier3.id, { col: apCarrier3.position.col + 1, row: apCarrier3.position.row });
assert(ap3Result.valid === false, 'Should not be able to dribble with 1 AP');

// AP Test 4: Can pass (cost 1) with 1 AP remaining; AP just hits 0, no flip yet
const apState4 = Engine.init().getState();
const apFwd4 = apState4.players.find(p => p.id === 'home_fwd1')!;
const apMid4 = apState4.players.find(p => p.id === 'home_mid2')!;
apMid4.position = { col: apFwd4.position.col + 2, row: apFwd4.position.row };
apFwd4.hasBall = true;
apState4.ball = { ...apFwd4.position };
apState4.ballCarrierId = apFwd4.id;
apState4.actionPoints.home = 1;
const apEngine4 = new Engine(apState4);
const ap4Result = apEngine4.applyMove(apFwd4.id, apMid4.position);
assert(ap4Result.valid === true, `Pass with 1 AP should succeed (cost 1), got ${ap4Result.outcome}`);
assert(apEngine4.getState().actionPoints.home === 0, 'Home AP should be 0 after the pass');
// Possession does NOT flip immediately; flip happens at start of next applyMove via exhaustion check.

// AP Test 5: Tackle does NOT refill AP — both teams keep their pool
const apState5 = Engine.init().getState();
const apFwd5 = apState5.players.find(p => p.id === 'home_fwd1')!;
const apDef5 = apState5.players.find(p => p.id === 'away_def1')!;
apFwd5.position = { col: 11, row: 'f' };
apFwd5.hasBall = true;
apDef5.position = { col: 12, row: 'f' };
apState5.ball = { ...apFwd5.position };
apState5.ballCarrierId = apFwd5.id;
apState5.actionPoints.home = 18;
apState5.actionPoints.away = 17;
const apEngine5 = new Engine(apState5, () => 0); // force tackle success
const ap5Result = apEngine5.applyMove(apDef5.id, apFwd5.position);
assert(ap5Result.outcome === 'tackled', 'Should be a tackle');
assert(apEngine5.getState().possession === 'away', 'Possession flips to tackler');
assert(apEngine5.getState().actionPoints.away === 16, 'Tackler team paid 1 AP for the tackle (17 - 1 = 16)');
assert(apEngine5.getState().actionPoints.home === 18, 'Attacking team keeps its AP after tackle');

// AP Test 6: Goal does NOT refill AP — kickoff happens but pools persist
const apState6 = Engine.init().getState();
const apFwd6 = apState6.players.find(p => p.id === 'home_fwd1')!;
apFwd6.position = { col: 21, row: 'f' };
apFwd6.hasBall = true;
apState6.ball = { ...apFwd6.position };
apState6.ballCarrierId = apFwd6.id;
apState6.players.filter(p => p.team === 'away' && p.role !== 'gk').forEach(p => {
  p.position = { col: 1, row: 'a' };
});
apState6.actionPoints.home = 5;
apState6.actionPoints.away = 8;
const apEngine6 = new Engine(apState6);
const ap6Result = apEngine6.applyMove(apFwd6.id, { col: 22, row: 'f' });
if (ap6Result.outcome === 'goal') {
  assert(apEngine6.getState().possession === 'away', 'Conceding team gets ball');
  assert(apEngine6.getState().actionPoints.away === 8, 'Conceding team keeps its AP after a goal (no refill)');
  assert(apEngine6.getState().actionPoints.home === 3, 'Scoring team AP debited shot cost (5 - 2 = 3)');
} else {
  assert(false, `Expected goal, got ${ap6Result.outcome}`);
}

// AP Test 7: Open receiver — 1 marker still allows pass
const apState7 = Engine.init().getState();
const apFwd7 = apState7.players.find(p => p.id === 'home_fwd1')!;
const apMid7 = apState7.players.find(p => p.id === 'home_mid2')!;
const apOneMarker = apState7.players.find(p => p.id === 'away_def1')!;
apFwd7.position = { col: 10, row: 'f' };
apFwd7.hasBall = true;
apMid7.position = { col: 12, row: 'f' };
apOneMarker.position = { col: 13, row: 'f' }; // 1 cell from receiver
apState7.ball = { ...apFwd7.position };
apState7.ballCarrierId = apFwd7.id;
const apEngine7 = new Engine(apState7);
const ap7Valid = canMoveTo(apEngine7.getState(), apFwd7, apMid7.position);
assert(ap7Valid === true, '1 marker within 1 cell should NOT block pass (relaxed rule)');

// AP Test 8: Open receiver — 2 markers blocks pass
const apState8 = Engine.init().getState();
const apFwd8 = apState8.players.find(p => p.id === 'home_fwd1')!;
const apMid8 = apState8.players.find(p => p.id === 'home_mid2')!;
const apMarker8a = apState8.players.find(p => p.id === 'away_def1')!;
const apMarker8b = apState8.players.find(p => p.id === 'away_def2')!;
apFwd8.position = { col: 10, row: 'f' };
apFwd8.hasBall = true;
apMid8.position = { col: 12, row: 'f' };
apMarker8a.position = { col: 13, row: 'f' };
apMarker8b.position = { col: 12, row: 'g' };
apState8.ball = { ...apFwd8.position };
apState8.ballCarrierId = apFwd8.id;
const apEngine8 = new Engine(apState8);
const ap8Valid = canMoveTo(apEngine8.getState(), apFwd8, apMid8.position);
assert(ap8Valid === false, '2 markers within 1 cell should block pass');

// AP Test 9: skipPhase() flips possession with no AP spend or refill
const apGame9 = Engine.init();
const apCarrier9 = apGame9.getBallCarrier()!;
apGame9.applyMove(apCarrier9.id, { col: apCarrier9.position.col + 1, row: apCarrier9.position.row });
assert(apGame9.getState().actionPoints.home === 18, 'After dribble AP=18');
apGame9.skipPhase();
assert(apGame9.getState().possession === 'away', 'skipPhase flips possession');
assert(apGame9.getState().actionPoints.home === 18, 'skipPhase does not refill or spend home AP');
assert(apGame9.getState().actionPoints.away === 20, 'skipPhase does not refill away AP');

// AP Test 10: skipPhase() does not advance the clock
const apGame10 = Engine.init();
const apTimeBefore = apGame10.getState().timeRemaining;
apGame10.skipPhase();
assert(apGame10.getState().timeRemaining === apTimeBefore, 'skipPhase should not deduct time');

// AP Test 11: Exhaustion auto-flip — if possessing team has 0 AP, possession flips on next applyMove
const apState11 = Engine.init().getState();
apState11.actionPoints.home = 0;
const apEngine11 = new Engine(apState11);
// Try a move with the away team after the auto-flip
const apEng11State = apEngine11.getState();
// Need to move an away player; pick one with a free target
const awayCarrier11 = apEng11State.players.find(p => p.id === 'away_fwd1')!;
const awayMoveTarget = { col: awayCarrier11.position.col - 1, row: awayCarrier11.position.row };
// Calling applyMove on home will auto-flip possession to away first; then the home player call will fail validation since possession is now away.
// Easier: try to move a home player and confirm possession flips even though the move is invalid.
const apEngine11b = new Engine({ ...JSON.parse(JSON.stringify(apState11)) });
const homeCarrier11 = apEngine11b.getBallCarrier()!;
apEngine11b.applyMove(homeCarrier11.id, { col: homeCarrier11.position.col + 1, row: homeCarrier11.position.row });
assert(apEngine11b.getState().possession === 'away', 'Exhausted team possession flips to opponent');
// Now away should be able to move
const apEngine11c = new Engine(apEngine11b.getState());
// Place an away player adjacent to a free cell, then move
const ap11cAwayFwd = apEngine11c.getPlayer(awayCarrier11.id)!;
const ap11cResult = apEngine11c.applyMove(ap11cAwayFwd.id, awayMoveTarget);
assert(ap11cResult.valid === true, 'After auto-flip, away team can move');

// AP Test 12: Half-time fires when timeRemaining crosses 1800s
const apState12 = Engine.init().getState();
apState12.timeRemaining = 1810; // next move (10s tick) will land at 1800
const apEngine12 = new Engine(apState12);
const apCarrier12 = apEngine12.getBallCarrier()!;
apEngine12.applyMove(apCarrier12.id, { col: apCarrier12.position.col + 1, row: apCarrier12.position.row });
assert(apEngine12.getState().status === 'halfTime', 'Half-time should fire when crossing 1800s');
assert(apEngine12.getState().halfTimeTriggered === true, 'halfTimeTriggered should be set');

// AP Test 13: resumeFromHalfTime() refills both teams to maxActionPoints and resumes play
const apEngine13 = new Engine(apEngine12.getState());
// Drain AP first to verify refill
const ap13State = apEngine13.getState();
ap13State.actionPoints.home = 5;
ap13State.actionPoints.away = 8;
ap13State.status = 'halfTime';
const apEngine13b = new Engine(ap13State);
apEngine13b.resumeFromHalfTime();
assert(apEngine13b.getState().status === 'playing', 'resumeFromHalfTime sets status to playing');
assert(apEngine13b.getState().actionPoints.home === 20, 'resumeFromHalfTime refills home AP');
assert(apEngine13b.getState().actionPoints.away === 20, 'resumeFromHalfTime refills away AP');

// AP Test 14: Goal scored on the move that crosses 1800s — score updates and HT fires
const apState14 = Engine.init().getState();
const apFwd14 = apState14.players.find(p => p.id === 'home_fwd1')!;
apFwd14.position = { col: 21, row: 'f' };
apFwd14.hasBall = true;
apState14.ball = { ...apFwd14.position };
apState14.ballCarrierId = apFwd14.id;
apState14.players.filter(p => p.team === 'away' && p.role !== 'gk').forEach(p => {
  p.position = { col: 1, row: 'a' };
});
apState14.timeRemaining = 1810;
const apEngine14 = new Engine(apState14);
const ap14Result = apEngine14.applyMove(apFwd14.id, { col: 22, row: 'f' });
assert(ap14Result.outcome === 'goal', `Expected goal, got ${ap14Result.outcome}`);
assert(apEngine14.getState().score.home === 1, 'Goal counts before half-time');
assert(apEngine14.getState().status === 'halfTime', 'Half-time fires after the goal that crossed 1800s');

// AP Test 15: Long-ball pass cost 2 AP (passApCost helper)
assert(passApCost(1) === 1, 'passApCost(1) === 1');
assert(passApCost(3) === 1, 'passApCost(3) === 1');
assert(passApCost(4) === 2, 'passApCost(4) === 2');
assert(passApCost(7) === 2, 'passApCost(7) === 2');

console.log('\n=== PASS RISK TESTS ===\n');

// Helper: build a state with a clear pass lane between fwd at col=10 and mid at col=10+dist.
function buildPassState(dist: number) {
  const s = Engine.init().getState();
  const fwd = s.players.find(p => p.id === 'home_fwd1')!;
  const mid = s.players.find(p => p.id === 'home_mid2')!;
  fwd.position = { col: 10, row: 'f' };
  fwd.hasBall = true;
  mid.position = { col: 10 + dist, row: 'f' };
  s.ball = { ...fwd.position };
  s.ballCarrierId = fwd.id;
  // Move all opposing outfield players far from the lane.
  s.players.filter(p => p.team === 'away' && p.role !== 'gk').forEach(p => {
    p.position = { col: 1, row: 'a' };
  });
  // Park the GK in their goal so the fallback interceptor exists.
  const awayGk = s.players.find(p => p.id === 'away_gk')!;
  awayGk.position = { col: 22, row: 'f' };
  return { s, fwd, mid, awayGk };
}

// Pass Risk Test 1: Short pass (dist 2) — risk 0, no roll. Clean pass regardless of RNG.
{
  const { s, fwd, mid } = buildPassState(2);
  const eng = new Engine(s, () => 0);
  const r = eng.applyMove(fwd.id, mid.position);
  assert(r.valid && r.outcome === 'success', `dist=2 with rng=0 should be a clean pass (risk=0), got ${r.outcome}`);
}

// Pass Risk Test 2: Distance 3 with rng=1 — above 0.10 threshold, no forced interception
{
  const { s, fwd, mid } = buildPassState(3);
  const eng = new Engine(s, () => 1);
  const r = eng.applyMove(fwd.id, mid.position);
  assert(r.valid && r.outcome === 'success', `dist=3 with rng=1 should be a clean pass, got ${r.outcome}`);
}

// Pass Risk Test 3: Distance 3 with rng=0.5 — above 0.10, no forced interception
{
  const { s, fwd, mid } = buildPassState(3);
  const eng = new Engine(s, () => 0.5);
  const r = eng.applyMove(fwd.id, mid.position);
  assert(r.valid && r.outcome === 'success', `dist=3 with rng=0.5 should be a clean pass, got ${r.outcome}`);
}

// Pass Risk Test 4: Distance 3 with rng=0.05 — below 0.10, forced interception
{
  const { s, fwd, mid } = buildPassState(3);
  const eng = new Engine(s, () => 0.05);
  const r = eng.applyMove(fwd.id, mid.position);
  assert(r.valid && r.outcome === 'intercepted', `dist=3 with rng=0.05 should force interception, got ${r.outcome}`);
}

// Pass Risk Test 5: Long ball (dist 5) with rng=1 — clean pass
{
  const { s, fwd, mid } = buildPassState(5);
  const eng = new Engine(s, () => 1);
  const r = eng.applyMove(fwd.id, mid.position);
  assert(r.valid && r.outcome === 'success', `dist=5 with rng=1 should be a clean pass, got ${r.outcome}`);
}

// Pass Risk Test 6: Long ball (dist 5) with rng=0 — forced interception (0 < 0.25)
{
  const { s, fwd, mid } = buildPassState(5);
  const eng = new Engine(s, () => 0);
  const r = eng.applyMove(fwd.id, mid.position);
  assert(r.valid && r.outcome === 'intercepted', `dist=5 with rng=0 should force interception, got ${r.outcome}`);
}

// Pass Risk Test 7: Long ball costs 2 AP
{
  const { s, fwd, mid } = buildPassState(5);
  s.actionPoints.home = 20;
  const eng = new Engine(s, () => 1);
  eng.applyMove(fwd.id, mid.position);
  assert(eng.getState().actionPoints.home === 18, `Long ball should cost 2 AP, home AP = ${eng.getState().actionPoints.home}`);
}

// Pass Risk Test 8: Short pass costs 1 AP
{
  const { s, fwd, mid } = buildPassState(2);
  s.actionPoints.home = 20;
  const eng = new Engine(s, () => 1);
  eng.applyMove(fwd.id, mid.position);
  assert(eng.getState().actionPoints.home === 19, `Short pass should cost 1 AP, home AP = ${eng.getState().actionPoints.home}`);
}

// Pass Risk Test 9: Long ball cannot be attempted with only 1 AP
{
  const { s, fwd, mid } = buildPassState(5);
  s.actionPoints.home = 1;
  const eng = new Engine(s, () => 1);
  const r = eng.applyMove(fwd.id, mid.position);
  assert(r.valid === false, `Long ball with 1 AP should be rejected, got ${r.valid}`);
}

console.log('\n=== TACKLE GAMBLE TESTS ===\n');

// Helper: place a home carrier next to an away defender, controlled distance.
function buildTackleState(dist: 1 | 2) {
  const s = Engine.init().getState();
  const fwd = s.players.find(p => p.id === 'home_fwd1')!;
  const def = s.players.find(p => p.id === 'away_def1')!;
  fwd.position = { col: 11, row: 'f' };
  fwd.hasBall = true;
  // dist=1 → adjacent; dist=2 → two cells horizontally
  def.position = { col: 11 + dist, row: 'f' };
  s.ball = { ...fwd.position };
  s.ballCarrierId = fwd.id;
  return { s, fwd, def };
}

// Tackle Test 1: dist=1, rng=0 (below 0.80) → success
{
  const { s, fwd, def } = buildTackleState(1);
  const eng = new Engine(s, () => 0);
  const r = eng.applyMove(def.id, fwd.position);
  assert(r.outcome === 'tackled', `dist=1 with rng=0 should succeed, got ${r.outcome}`);
  assert(eng.getState().possession === 'away', 'Possession flips to tackler on success');
}

// Tackle Test 2: dist=1, rng=0.99 (above 0.80) → failure
{
  const { s, fwd, def } = buildTackleState(1);
  const eng = new Engine(s, () => 0.99);
  const r = eng.applyMove(def.id, fwd.position);
  assert(r.outcome === 'tackleFailed', `dist=1 with rng=0.99 should fail, got ${r.outcome}`);
  assert(eng.getState().possession === 'home', 'Possession stays with carrier on failed tackle');
}

// Tackle Test 3: dist=2, rng=0.5 (above 0.40) → failure
{
  const { s, fwd, def } = buildTackleState(2);
  const eng = new Engine(s, () => 0.5);
  const r = eng.applyMove(def.id, fwd.position);
  assert(r.outcome === 'tackleFailed', `dist=2 with rng=0.5 should fail, got ${r.outcome}`);
}

// Tackle Test 4: dist=2, rng=0 (below 0.40) → success
{
  const { s, fwd, def } = buildTackleState(2);
  const eng = new Engine(s, () => 0);
  const r = eng.applyMove(def.id, fwd.position);
  assert(r.outcome === 'tackled', `dist=2 with rng=0 should succeed, got ${r.outcome}`);
}

// Tackle Test 5: Failed tackle costs 1 AP from defender's pool
{
  const { s, fwd, def } = buildTackleState(1);
  s.actionPoints.away = 10;
  const eng = new Engine(s, () => 0.99);
  eng.applyMove(def.id, fwd.position);
  assert(eng.getState().actionPoints.away === 9, `Failed tackle should debit 1 AP, away AP = ${eng.getState().actionPoints.away}`);
  assert(eng.getState().actionPoints.home === 20, 'Carrier team AP unchanged on failed tackle');
}

// Tackle Test 6: Failed tackle pushes tackler back 1 cell from the carrier
{
  const { s, fwd, def } = buildTackleState(1);
  // Defender is at col 12, carrier at col 11. Direction from carrier→defender is +col,
  // so on failure the defender should push to col 13.
  const eng = new Engine(s, () => 0.99);
  eng.applyMove(def.id, fwd.position);
  const movedDef = eng.getPlayer(def.id)!;
  assert(movedDef.position.col === 13, `Failed tackle should push defender to col 13, got ${movedDef.position.col}`);
  assert(movedDef.position.row === 'f', 'Pushback row should match carrier row');
}

// Tackle Test 7: Failed tackle blocked by occupied pushback cell — defender stays in place
{
  const { s, fwd, def } = buildTackleState(1);
  // Place a blocker on the pushback cell (col 13, row 'f').
  const blocker = s.players.find(p => p.id === 'home_def1')!;
  blocker.position = { col: 13, row: 'f' };
  const eng = new Engine(s, () => 0.99);
  eng.applyMove(def.id, fwd.position);
  const movedDef = eng.getPlayer(def.id)!;
  assert(movedDef.position.col === 12, `Pushback blocked, defender stays at col 12, got ${movedDef.position.col}`);
}

// Tackle Test 8: Time still ticks on a failed tackle
{
  const { s, fwd, def } = buildTackleState(1);
  const eng = new Engine(s, () => 0.99);
  const before = eng.getState().timeRemaining;
  eng.applyMove(def.id, fwd.position);
  assert(eng.getState().timeRemaining === before - 10, 'Failed tackle still ticks 10s');
}

console.log('\n=== PURSUIT CAP TESTS ===\n');

// Pursuit Test 1: off-ball run capped at MAX_RUN_DIST (2 cells)
const purGame1 = Engine.init('4-3-3');
const purState1 = purGame1.getState();
const purHomeMid = purState1.players.find(p => p.id === 'home_mid1')!;
// Move away from carrier so any run isn't a pursuit. Carrier is at col 14ish.
const farFromCarrier = { col: purHomeMid.position.col, row: 'a' };
const purEngine1 = new Engine(purState1);
// AP setup: home has ball but for off-ball home midfielder to move requires possession
// We test the validator directly by attempting a 3-cell sideways run far from the carrier
const purHomeMid1 = purEngine1.getPlayer(purHomeMid.id)!;
const farRow = String.fromCharCode(purHomeMid1.position.row.charCodeAt(0) + 3);
const purResult1 = purEngine1.applyMove(purHomeMid1.id, { col: purHomeMid1.position.col, row: farRow });
assert(purResult1.valid === false, 'Run of 3 cells should now be rejected (MAX_RUN_DIST=2)');

// Pursuit Test 2: an off-ball move that closes on the ball-carrier is capped at 1 cell
const purGame2 = Engine.init('4-3-3');
const purState2 = purGame2.getState();
const carrier2 = purState2.players.find(p => p.hasBall)!;
const awayDef2 = purState2.players.find(p => p.id === 'away_def2')!;
// Place defender 4 cols away from carrier on a different row so target cell is empty
awayDef2.position = { col: carrier2.position.col + 4, row: 'a' };
// Force possession to away so the defender can move
purState2.possession = 'away';
purState2.actionPoints = { home: 3, away: 3 };
const purEngine2 = new Engine(purState2);
// Run 2 cells closer toward the carrier; before-dist = 4, after-dist = 2 -> closer & dist=2 > 1 -> reject
const closeTarget = { col: awayDef2.position.col - 2, row: 'a' };
const purResult2 = purEngine2.applyMove(awayDef2.id, closeTarget);
assert(purResult2.valid === false, 'Off-ball pursuit should be capped at 1 cell when closing on the ball');

// Pursuit Test 3: same defender can still pursue 1 cell closer
const purGame3 = Engine.init('4-3-3');
const purState3 = purGame3.getState();
const carrier3 = purState3.players.find(p => p.hasBall)!;
const awayDef3 = purState3.players.find(p => p.id === 'away_def2')!;
awayDef3.position = { col: carrier3.position.col + 4, row: 'a' };
purState3.possession = 'away';
purState3.actionPoints = { home: 3, away: 3 };
const purEngine3 = new Engine(purState3);
const oneCloser = { col: awayDef3.position.col - 1, row: 'a' };
const purResult3 = purEngine3.applyMove(awayDef3.id, oneCloser);
assert(purResult3.valid === true, 'Off-ball 1-cell pursuit run should be allowed');

// Pursuit Test 4: moving 2 cells AWAY from the carrier is still allowed
const purGame4 = Engine.init('4-3-3');
const purState4 = purGame4.getState();
const carrier4 = purState4.players.find(p => p.hasBall)!;
const awayDef4 = purState4.players.find(p => p.id === 'away_def2')!;
awayDef4.position = { col: carrier4.position.col + 4, row: 'a' };
purState4.possession = 'away';
purState4.actionPoints = { home: 3, away: 3 };
const purEngine4 = new Engine(purState4);
const twoAway = { col: awayDef4.position.col + 2, row: 'a' };
const purResult4 = purEngine4.applyMove(awayDef4.id, twoAway);
assert(purResult4.valid === true, 'Retreating 2 cells from the carrier should still be allowed');

console.log('\n=== SUMMARY ===');
console.log(`Passed: ${pass}/${pass + fail}`);
if (fail > 0) console.log(`Failed: ${fail}`);