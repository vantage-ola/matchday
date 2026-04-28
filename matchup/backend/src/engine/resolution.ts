import type { 
  GameState, 
  GridPosition, 
  AttackerMove, 
  DefenderMove, 
  GameMove, 
  Outcome, 
  SpatialResolution,
  CapMovement,
  CapSide,
  PlayerCap,
  Formation
} from '../types/index.js';
import { endPhase } from './matchup.js';
import { updateGameState as saveGameStateToRedis } from '../services/matchmaking.js';
import { moveCap, transferBall, getFormationAtPosition, getBallCarrier } from './formations.js';

function randomiser(): number {
  return Math.floor(Math.random() * 31) - 15;
}

function clampPosition(pos: GridPosition): GridPosition {
  return {
    col: Math.max(0, Math.min(14, pos.col)),
    row: Math.max(0, Math.min(8, pos.row)),
  };
}

function distanceBetween(a: GridPosition, b: GridPosition): number {
  const dx = b.col - a.col;
  const dy = b.row - a.row;
  return Math.sqrt(dx * dx + dy * dy);
}

function lineIntersectsPoint(
  start: GridPosition,
  end: GridPosition,
  point: GridPosition,
  threshold: number = 1.5
): boolean {
  const lineLen = distanceBetween(start, end);
  if (lineLen < 0.1) return distanceBetween(start, point) < threshold;

  const t = Math.max(0, Math.min(1,
    ((point.col - start.col) * (end.col - start.col) + 
     (point.row - start.row) * (end.row - start.row)) / (lineLen * lineLen)
  ));

  const proj = {
    col: start.col + t * (end.col - start.col),
    row: start.row + t * (end.row - start.row),
  };

  return distanceBetween(proj, point) < threshold;
}

function getDefendersNear(formation: Formation, position: GridPosition, radius: number = 2): PlayerCap[] {
  return formation.caps.filter(cap => {
    if (cap.role === 'gk') return false;
    return distanceBetween(cap.position, position) < radius;
  });
}

function isInGoalArea(pos: GridPosition, attackingSide: CapSide): boolean {
  // Returns true if pos is near the goal that attackingSide is shooting at
  if (attackingSide === 'home') {
    // Home attacks toward col 14
    return pos.col >= 12 && pos.row >= 2 && pos.row <= 6;
  }
  // Away attacks toward col 0
  return pos.col <= 2 && pos.row >= 2 && pos.row <= 6;
}

function isInShootingRange(position: GridPosition, side: CapSide): boolean {
  // Distance to the goal this side is attacking
  const goalDistance = side === 'home' ? (14 - position.col) : position.col;
  return goalDistance <= 4;
}

function isOnWing(position: GridPosition): boolean {
  return position.row <= 2 || position.row >= 6;
}

function getActionModifier(action: string, fromPos: GridPosition, toPos: GridPosition, side: CapSide): number {
  const dist = distanceBetween(fromPos, toPos);
  const towardGoal = side === 'home' ? toPos.col > fromPos.col : toPos.col < fromPos.col;
  
  switch (action) {
    case 'pass':
      return 0;
    case 'through_pass':
      return -10;
    case 'cross':
      if (isOnWing(fromPos) && towardGoal) return 5;
      return -5;
    case 'long_ball':
      return dist > 6 ? 10 : 0;
    case 'shoot':
      if (isInGoalArea(toPos, side)) return 15;
      if (isInShootingRange(fromPos, side)) return 5;
      return -10;
    case 'run':
      return towardGoal ? 5 : -5;
    default:
      return 0;
  }
}

function getDefenderActionModifier(action: string, defenderPos: GridPosition, ballPos: GridPosition): number {
  const dist = distanceBetween(defenderPos, ballPos);
  
  switch (action) {
    case 'press':
      if (dist <= 2) return 10;
      if (dist <= 4) return 0;
      return -10;
    case 'tackle':
      if (dist <= 1.5) return 15;
      if (dist <= 2.5) return 5;
      return -15;
    case 'intercept':
      return 5;
    case 'hold_shape':
      return dist <= 3 ? 5 : 0;
    case 'track_back':
      return -5;
    default:
      return 0;
  }
}

export async function resolveTurn(
  sessionId: string,
  attackerMove: GameMove,
  defenderMove: GameMove,
  state: GameState
): Promise<SpatialResolution> {
  const attackerSide = state.attackingSide;
  const defenderSide = attackerSide === 'home' ? 'away' : 'home';

  const attackerFormation = state.formations[attackerSide];
  const defenderFormation = state.formations[defenderSide];

  let outcome: Outcome = 'advance';
  let ballFinalPosition: GridPosition = state.ball.position;
  let interceptionPoint: GridPosition | null = null;
  const movedCaps: CapMovement[] = [];
  let possessionChange = false;
  let goalScored = false;
  let scorerCapId: string | null = null;
  let ratingBonus = 0;

  const attMove = attackerMove as AttackerMove;
  const defMove = defenderMove as DefenderMove;

  const ballCarrier = getBallCarrier(attackerFormation);
  const fromCapId = ballCarrier?.id ?? attMove.fromCapId;

  const action = attMove.action;
  const fromPos = ballCarrier?.position ?? state.ball.position;
  const toPos = attMove.toPosition;

  const attackerActionBonus = getActionModifier(action, fromPos, toPos, attackerSide);
  const defenderActionBonus = getDefenderActionModifier(
    defMove.action,
    defMove.toPosition,
    state.ball.position
  );

  const attackerCapRating = ballCarrier?.rating ?? 60;
  const defenderCapForRating = defenderFormation.caps.find(cap => cap.id === defMove.fromCapId);
  const defenderCapRating = defenderCapForRating?.rating ?? 60;
  ratingBonus = Math.round((attackerCapRating - defenderCapRating) / 10);

  const isShot = action === 'shoot';
  const isPass = action === 'pass' || action === 'through_pass' || action === 'cross' || action === 'long_ball';
  const isRun = action === 'run';

  if (isShot) {
    const goalPos = attackerSide === 'home' ? { col: 14, row: 4 } : { col: 0, row: 4 };
    const nearestDefenders = getDefendersNear(defenderFormation, toPos, 2.5);
    const shotBase = 50 + attackerActionBonus + ratingBonus - defenderActionBonus;
    const shotQuality = shotBase + randomiser();

    if (nearestDefenders.length === 0 && isInGoalArea(toPos, attackerSide)) {
      if (shotQuality > 35) {
        outcome = 'goal';
        goalScored = true;
        scorerCapId = fromCapId;
        ballFinalPosition = goalPos;
      } else {
        outcome = 'miss';
        ballFinalPosition = clampPosition({ col: toPos.col, row: toPos.row + (Math.random() > 0.5 ? 1 : -1) });
      }
    } else if (nearestDefenders.length > 0) {
      if (shotQuality > 50) {
        outcome = 'save';
        const defPos = nearestDefenders[0]?.position;
        ballFinalPosition = defPos ? clampPosition({
          col: attackerSide === 'home' ? defPos.col - 1 : defPos.col + 1,
          row: defPos.row
        }) : { col: 7, row: 4 };
        possessionChange = true;
      } else if (shotQuality > 25) {
        outcome = 'blocked';
        ballFinalPosition = toPos;
        nearestDefenders[0] && movedCaps.push({
          capId: nearestDefenders[0].id,
          fromPosition: nearestDefenders[0].position,
          toPosition: toPos,
        });
      } else {
        outcome = 'wide';
        ballFinalPosition = clampPosition({
          col: toPos.col,
          row: toPos.row + (Math.random() > 0.5 ? 2 : -2)
        });
      }
    } else {
      if (shotQuality > 45) {
        outcome = 'goal';
        goalScored = true;
        scorerCapId = fromCapId;
        ballFinalPosition = goalPos;
      } else {
        outcome = 'miss';
        ballFinalPosition = toPos;
      }
    }

    if (goalScored) {
      state.score[attackerSide]++;
      state.stats[attackerSide].shots++;
    } else {
      state.stats[attackerSide].shots++;
    }

    state.events.push({
      type: goalScored ? 'goal' : 'shot',
      side: attackerSide,
      capId: fromCapId,
      turn: state.turn,
      phase: state.phase,
    });

  } else if (isPass) {
    const passLineEnd = toPos;
    const nearbyDefenders = getDefendersNear(defenderFormation, passLineEnd, 1.5);
    const defendersOnLine = defenderFormation.caps.filter(cap => {
      if (cap.role === 'gk') return false;
      return lineIntersectsPoint(state.ball.position, passLineEnd, cap.position, 1.2);
    });

    const passRisk = (nearbyDefenders?.length ?? 0) * 15 + (defendersOnLine?.length ?? 0) * 20;
    const passBase = 60 + attackerActionBonus + ratingBonus - defenderActionBonus;
    const passQuality = passBase + randomiser() - passRisk;

    if (defendersOnLine && defendersOnLine.length > 0 && passQuality < 40) {
      const intercepCap = defendersOnLine[0];
      if (intercepCap) {
        outcome = 'intercept';
        interceptionPoint = intercepCap.position;
        ballFinalPosition = intercepCap.position;
        possessionChange = true;
        state.stats[defenderSide].tackles++;
        state.events.push({
          type: action === 'through_pass' ? 'interception' : 'tackle',
          side: defenderSide,
          capId: intercepCap.id,
          turn: state.turn,
          phase: state.phase,
        });
      }
    } else if (nearbyDefenders && nearbyDefenders.length > 0 && passQuality < 30) {
      const presserCap = nearbyDefenders[0];
      if (presserCap) {
        outcome = 'press_won';
        interceptionPoint = presserCap.position;
        ballFinalPosition = presserCap.position;
        possessionChange = true;
        state.stats[defenderSide].tackles++;
        state.events.push({
          type: 'tackle',
          side: defenderSide,
          capId: presserCap.id,
          turn: state.turn,
          phase: state.phase,
        });
      }
    } else {
      outcome = action === 'through_pass' ? 'through' : 'advance';
      
      const targetCap = attackerFormation.caps.find(cap => {
        return cap.position.col === passLineEnd.col && cap.position.row === passLineEnd.row;
      });

      if (targetCap) {
        const newFormation = transferBall(attackerFormation, targetCap.id);
        state.formations[attackerSide] = newFormation;
      } else {
        state.formations[attackerSide] = {
          ...attackerFormation,
          caps: attackerFormation.caps.map(cap => {
            if (cap.hasBall) {
              return { ...cap, position: passLineEnd, hasBall: false };
            }
            if (cap.position.col === passLineEnd.col && cap.position.row === passLineEnd.row) {
              return { ...cap, hasBall: true };
            }
            return cap;
          }),
        };
      }

      ballFinalPosition = passLineEnd;
      state.stats[attackerSide].possession++;
      if (targetCap) {
        state.stats[attackerSide].assists++;
      }

      movedCaps.push({
        capId: fromCapId,
        fromPosition: state.ball.position,
        toPosition: passLineEnd,
      });
    }

  } else if (isRun) {
    const runTarget = toPos;
    const nearbyDef = getDefendersNear(defenderFormation, runTarget, 1);
    const runBase = 55 + attackerActionBonus + ratingBonus - defenderActionBonus;
    const runQuality = runBase + randomiser();

    if (nearbyDef && nearbyDef.length > 0 && runQuality < 35) {
      const tackler = nearbyDef[0];
      if (tackler) {
        outcome = 'tackle';
        interceptionPoint = tackler.position;
        ballFinalPosition = tackler.position;
        possessionChange = true;
        state.stats[defenderSide].tackles++;
        state.events.push({
          type: 'tackle',
          side: defenderSide,
          capId: tackler.id,
          turn: state.turn,
          phase: state.phase,
        });
      }
    } else {
      outcome = 'advance';
      state.formations[attackerSide] = moveCap(attackerFormation, fromCapId, runTarget);
      ballFinalPosition = runTarget;
      state.stats[attackerSide].possession++;
      movedCaps.push({
        capId: fromCapId,
        fromPosition: fromPos,
        toPosition: runTarget,
      });
    }
  }

  if (possessionChange) {
    const newAttackingSide = defenderSide;
    state.attackingSide = newAttackingSide;

    const posFlipFormation = state.formations[defenderSide];
    const newBallCarrier = getFormationAtPosition(posFlipFormation, ballFinalPosition.col, ballFinalPosition.row);
    
    if (newBallCarrier) {
      const flippedFormation = transferBall(posFlipFormation, newBallCarrier.id);
      state.formations[defenderSide] = flippedFormation;
      state.ball.carrierCapId = newBallCarrier.id;
    } else {
      state.formations[defenderSide] = {
        ...posFlipFormation,
        caps: posFlipFormation.caps.map(cap => ({
          ...cap,
          hasBall: cap.position.col === ballFinalPosition.col && cap.position.row === ballFinalPosition.row,
        })),
      };
      const carrierCap = posFlipFormation.caps.find(
        c => c.position.col === ballFinalPosition.col && c.position.row === ballFinalPosition.row
      );
      state.ball.carrierCapId = carrierCap?.id ?? null;
    }

    state.ball.position = ballFinalPosition;

    state.events.push({
      type: 'possession_change',
      side: defenderSide,
      turn: state.turn,
      phase: state.phase,
    });

    const defendingCap = defenderFormation.caps.find(cap => cap.id === defMove.fromCapId);
    if (defendingCap) {
      movedCaps.push({
        capId: defMove.fromCapId,
        fromPosition: defendingCap.position,
        toPosition: defMove.toPosition,
      });
      // Use the already-updated formation (not stale defenderFormation reference)
      state.formations[defenderSide] = moveCap(state.formations[defenderSide], defMove.fromCapId, defMove.toPosition);
    }
  } else {
    state.ball.position = ballFinalPosition;

    const attackerCap = attackerFormation.caps.find(cap => cap.id === attMove.fromCapId);
    if (attackerCap) {
      movedCaps.push({
        capId: attMove.fromCapId,
        fromPosition: attackerCap.position,
        toPosition: ballFinalPosition,
      });
    }

    state.formations[attackerSide] = moveCap(attackerFormation, attMove.fromCapId, ballFinalPosition);

    const defendingCap = defenderFormation.caps.find(cap => cap.id === defMove.fromCapId);
    if (defendingCap) {
      movedCaps.push({
        capId: defMove.fromCapId,
        fromPosition: defendingCap.position,
        toPosition: defMove.toPosition,
      });
      state.formations[defenderSide] = moveCap(defenderFormation, defMove.fromCapId, defMove.toPosition);
    }
  }

  const resolution: SpatialResolution = {
    attackerMove: attMove,
    defenderMove: defMove,
    outcome,
    ballFinalPosition,
    interceptionPoint,
    movedCaps,
    possessionChange,
    goalScored,
    scorerCapId,
    ratingBonus,
  };

  state.lastResolution = resolution;
  state.turn++;

  await checkPhaseTransition(sessionId, state);

  return resolution;
}

async function checkPhaseTransition(sessionId: string, state: GameState): Promise<void> {
  if (state.turn > state.movesPerPhase) {
    await endPhase(sessionId, state);
  } else {
    state.turnStatus = 'waiting_both';
    await saveGameStateToRedis(sessionId, state);
  }
}