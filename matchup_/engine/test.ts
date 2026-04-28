import Engine from './index.js';
import { initGameState, getBallCarrier } from './formations.js';
import { validateMove, isBackwardMove, isForwardMove, canMoveTo } from './moves.js';
import { isInGoalArea, posEq } from './types.js';

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

// Test 1: 4-3-3 has 10 players per side (missing 1 — only 2 fwd, no 3rd)
const game433 = Engine.init('4-3-3');
const homePlayers = game433.getTeam('home');
const awayPlayers = game433.getTeam('away');
assert(homePlayers.length === 11, `4-3-3 home should have 11 players, got ${homePlayers.length}`);
assert(awayPlayers.length === 11, `4-3-3 away should have 11 players, got ${awayPlayers.length}`);

// Test 2: All formations have 11 players
const formations = ['4-3-3', '4-4-2', '3-5-2', '5-3-2', '4-2-3-1', '3-4-3'] as const;
for (const f of formations) {
  const g = Engine.init(f);
  const h = g.getTeam('home');
  const a = g.getTeam('away');
  assert(h.length === 11, `${f} home should have 11 players, got ${h.length}`);
  assert(a.length === 11, `${f} away should have 11 players, got ${a.length}`);
}

// Test 3: No two players on same cell at init
for (const f of formations) {
  const g = Engine.init(f);
  const allPlayers = [...g.getTeam('home'), ...g.getTeam('away')];
  const positions = allPlayers.map(p => `${p.position.row}${p.position.col}`);
  const uniquePositions = new Set(positions);
  assert(positions.length === uniquePositions.size, `${f} should have no overlapping positions`);
}

// Test 4: Ball starts with home fwd
const initGame = Engine.init();
const bc = initGame.getBallCarrier();
assert(bc !== undefined, 'Ball carrier should exist at init');
assert(bc!.team === 'home', `Ball carrier should be home, got ${bc!.team}`);
assert(bc!.role === 'fwd', `Ball carrier should be fwd, got ${bc!.role}`);

console.log('\n=== MOVEMENT TESTS ===\n');

// Test 5: Ball carrier can move forward
const game1 = Engine.init();
const carrier1 = game1.getBallCarrier()!;
const forwardPos = { col: carrier1.position.col + 1, row: carrier1.position.row };
const r1 = game1.applyMove(carrier1.id, forwardPos);
assert(r1.valid === true, 'Ball carrier should be able to move forward');

// Test 6: Ball carrier cannot move backward
const game2 = Engine.init();
const carrier2 = game2.getBallCarrier()!;
const backwardPos = { col: carrier2.position.col - 1, row: carrier2.position.row };
const r2 = game2.applyMove(carrier2.id, backwardPos);
assert(r2.valid === false, 'Ball carrier should NOT be able to move backward');

// Test 7: Ball carrier can move sideways (to empty cell)
const game3 = Engine.init();
const carrier3 = game3.getBallCarrier()!;
// Find an empty cell in same column
const sameColPlayers = game3.getTeam('home').filter(p => p.position.col === carrier3.position.col);
const usedRows = new Set(sameColPlayers.map(p => p.position.row));
const freeRow = ['a','b','c','d','e','f','g','h','i','j','k'].find(r => !usedRows.has(r))!;
const sidewaysPos = { col: carrier3.position.col, row: freeRow };
const r3 = game3.applyMove(carrier3.id, sidewaysPos);
assert(r3.valid === true, `Ball carrier should be able to move sideways to empty cell ${freeRow}${carrier3.position.col}`);

// Test 8: Cannot move to occupied cell
const game4 = Engine.init();
const gk = game4.getPlayer('home_gk')!;
const occupiedPos = { col: gk.position.col, row: gk.position.row };
const somePlayer = game4.getTeam('home').find(p => p.id !== 'home_gk')!;
const r4 = game4.applyMove(somePlayer.id, occupiedPos);
assert(r4.valid === false, 'Should not be able to move to occupied cell');

// Test 9: Cannot move out of bounds
const game5 = Engine.init();
const gk2 = game5.getPlayer('home_gk')!;
const outOfBounds = { col: 0, row: 'f' };
const r5 = game5.applyMove(gk2.id, outOfBounds);
assert(r5.valid === false, 'Should not be able to move out of bounds');

console.log('\n=== POSSESSION & PHASE TESTS ===\n');

// Test 10: After 3 moves, possession flips
const game6 = Engine.init();
const bc6 = game6.getBallCarrier()!;
const initialPossession = game6.getState().possession;
game6.applyMove(bc6.id, { col: bc6.position.col + 1, row: bc6.position.row });
const bc6b = game6.getBallCarrier()!;
game6.applyMove(bc6b.id, { col: bc6b.position.col + 1, row: bc6b.position.row });
const bc6c = game6.getBallCarrier()!;
game6.applyMove(bc6c.id, { col: bc6c.position.col + 1, row: bc6c.position.row });
const after3 = game6.getState();
assert(after3.possession !== initialPossession, `After 3 moves possession should flip. Was ${initialPossession}, now ${after3.possession}`);
assert(after3.moveNumber === 1, `After flip moveNumber should be 1, got ${after3.moveNumber}`);

// Test 11: Interception causes possession change
// Move home_fwd1 near a defender, then try to pass through them
const game7 = Engine.init('4-3-3');
// Manually test interception by passing to a position near defenders
const homeFwd = game7.getPlayer('home_fwd1')!;
const homeMid = game7.getPlayer('home_mid2')!;
// FWD at col 9, MID at col 6 row e — this is a backward pass, should be blocked
const r7 = game7.applyMove(homeFwd.id, homeMid.position);
assert(r7.valid === false, 'Backward pass should be blocked by validation');

console.log('\n=== SHOOTING TESTS ===\n');

// Test 12: Cannot shoot when too far from goal
const game8 = Engine.init();
const fwd8 = game8.getBallCarrier()!;
assert(!isInGoalArea(fwd8.position, 'home'), `FWD at col ${fwd8.position.col} should NOT be in goal area`);

// Test 13: Shooting at goal from close range
const game9 = Engine.init();
// Move ball carrier all the way to col 19 (within 3 of col 22)
// Need to do this across multiple possessions
const bc9 = game9.getBallCarrier()!;
game9.applyMove(bc9.id, { col: bc9.position.col + 3, row: bc9.position.row }); // move 1
const bc9b = game9.getBallCarrier()!;
game9.applyMove(bc9b.id, { col: bc9b.position.col + 3, row: bc9b.position.row }); // move 2
const bc9c = game9.getBallCarrier()!;
game9.applyMove(bc9c.id, { col: bc9c.position.col + 3, row: bc9c.position.row }); // move 3 — possession flips

// Now away has the ball
assert(game9.getState().possession === 'away', 'After 3 home moves, away should have ball');

console.log('\n=== BUG HUNT: SPECIFIC SCENARIOS ===\n');

// Test 14: Pass moves ball carrier to target position — but target player stays put?
// This is a real bug: when passing, the ball carrier MOVES to the target position
// but the target player is already there — collision!
const game10 = Engine.init();
const fwd10 = game10.getBallCarrier()!;
const mid10 = game10.getPlayer('home_mid2')!;
// FWD at col 9, MID at col 6 row e — but wait, this is backward, won't work
// Let's try a forward pass scenario
// First move mid forward, then pass to them
game10.applyMove(mid10.id, { col: mid10.position.col + 3, row: mid10.position.row }); // mid moves forward
const fwd10b = game10.getBallCarrier()!;
// Now fwd has ball at col 9, mid is at col 9... wait, mid moved to col 9 too
// Actually mid was at col 6, moved to col 9. fwd is at col 9 too — COLLISION
// But the engine allows it because canMoveTo doesn't check properly for this

// Let me check: home_mid2 starts at col 6 row e, home_fwd1 starts at col 9 row f
// mid moves to col 9 row e — different row from fwd, so no collision
const midAfter = game10.getPlayer('home_mid2')!;
assert(midAfter.position.col === 9, `Mid should be at col 9, got ${midAfter.position.col}`);

// Now try to pass from fwd (col 9, row f) to mid (col 9, row e) — sideways pass
const fwd10c = game10.getBallCarrier()!;
const passResult = game10.applyMove(fwd10c.id, midAfter.position);
// This is a pass because there's a teammate at the target
if (passResult.valid) {
  const newBc = game10.getBallCarrier();
  console.log(`  Pass result: ${passResult.outcome}, new carrier: ${newBc?.id}`);
  // BUG: mover.position = to AND target.hasBall = true
  // But mover moved TO the target's position — now both are at the same cell!
  const moverAfter = game10.getPlayer(fwd10c.id);
  const targetAfter = game10.getPlayer(midAfter.id);
  const samePos = posEq(moverAfter!.position, targetAfter!.position);
  assert(!samePos, `PASS BUG: mover and target on same cell after pass! Both at ${moverAfter!.position.row}${moverAfter!.position.col}`);
}

// Test 15: checkInterception mutates this.state mid-resolve
// This is a serious bug: checkInterception directly mutates this.state
// while applyMove is working on a cloned newState
const game11 = Engine.init('4-3-3');
// Set up: move a defender right on the pass line
const awayDef = game11.getTeam('away').find(p => p.role === 'def')!;
game11.applyMove(awayDef.id, { col: awayDef.position.col - 2, row: awayDef.position.row });
// Now try to pass through — if intercepted, checkInterception mutates this.state
// but applyMove uses a cloned newState, so the mutations are lost
const fwd11 = game11.getBallCarrier()!;
// Try passing to a forward position where a defender might intercept
const passTarget = { col: fwd11.position.col + 4, row: fwd11.position.row };
const passR11 = game11.applyMove(fwd11.id, passTarget);
console.log(`  Pass through defense: ${passR11.outcome}`);

// Test 16: After goal, who gets the ball?
const game12 = Engine.init();
// Check: after a goal, ballCarrierId is null, possession flips to other team
// But new team has no hasBall=true player — next move will fail
const state12 = game12.getState();
// Simulate a goal scenario manually
// Home fwd at col 19, shoot at col 22 row f
// Need to get there first...

// Test 17: Defense moves count toward moveNumber
// When away defends, moveNumber increments — but should it?
const game13 = Engine.init();
// Home uses 3 moves → possession flips to away
const bc13 = game13.getBallCarrier()!;
game13.applyMove(bc13.id, { col: bc13.position.col + 1, row: bc13.position.row });
const bc13b = game13.getBallCarrier()!;
game13.applyMove(bc13b.id, { col: bc13b.position.col + 1, row: bc13b.position.row });
const bc13c = game13.getBallCarrier()!;
game13.applyMove(bc13c.id, { col: bc13c.position.col + 1, row: bc13c.position.row });
// Now away has possession
assert(game13.getState().possession === 'away', 'Away should have possession');
assert(game13.getState().moveNumber === 1, 'Move number should be 1 for new possession');
// Away makes a move
const awayFwd13 = game13.getTeam('away').find(p => p.role === 'fwd' && p.hasBall);
if (awayFwd13) {
  const defMove = game13.applyMove(awayFwd13.id, { col: awayFwd13.position.col - 1, row: awayFwd13.position.row });
  console.log(`  Away move: valid=${defMove.valid}, outcome=${defMove.outcome}, moveNum=${game13.getState().moveNumber}`);
}

// Test 18: Row comparison with strings
// 'a' < 'b' works in JS, but what about 'a' >= 'e'?
assert('a' < 'b', 'String comparison a < b');
assert('e' >= 'e', 'String comparison e >= e');
assert('g' <= 'g', 'String comparison g <= g');
assert('k' > 'j', 'String comparison k > j');
// This is fine for goal checks since we use >= and <=

// Test 19: isGoalPosition for away goal
assert(isInGoalArea({ col: 20, row: 'f' }, 'home') === true, 'Col 20 IS in home goal area (dist 2 from col 22)');
assert(isInGoalArea({ col: 19, row: 'f' }, 'home') === true, 'Col 19 is in home goal area (dist 3 from col 22)');
assert(isInGoalArea({ col: 3, row: 'f' }, 'away') === true, 'Col 3 is in away goal area (dist 2 from col 1)');
assert(isInGoalArea({ col: 4, row: 'f' }, 'away') === true, 'Col 4 is in away goal area (dist 3 from col 1)');

console.log('\n=== SUMMARY ===');
console.log(`Passed: ${pass}/${pass + fail}`);
if (fail > 0) console.log(`Failed: ${fail}`);