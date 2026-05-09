import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { loadSettings, updateSettings } from '@/lib/settings';
import {
  type GameState,
  type GridPosition,
  type MoveResult,
  type GameMode,
} from '@/lib/engine';
import { Pitch } from './Pitch';
import { ScoreBar } from './ScoreBar';
import { MoveResultBar } from './MoveResultBar';
import { MatchHud } from './MatchHud';
import { RotateDeviceOverlay } from '@/components/RotateDeviceOverlay';
import { RulebookDialog } from '@/components/rulebook/RulebookDialog';
import { ThemeToggle } from '@/components/theme-toggle';
import { LiveAnnouncer } from './LiveAnnouncer';

interface GameScreenProps {
  state: GameState;
  mode: GameMode;
  homeFormation: string;
  awayFormation: string;
  selectedPlayerId: string | null;
  selectedPlayerMoves: Set<string>;
  lastMoveResult: MoveResult | null;
  isAiThinking: boolean;
  ballHistory?: GridPosition[];
  onSelectPlayer: (playerId: string) => void;
  onExecuteMove: (playerId: string, to: GridPosition) => void;
  onDeselect: () => void;
  onResumeFromHalfTime: () => void;
  onQuit: () => void;
}

export function GameScreen({
  state,
  mode,
  homeFormation,
  awayFormation,
  selectedPlayerId,
  selectedPlayerMoves,
  lastMoveResult,
  isAiThinking,
  ballHistory,
  onSelectPlayer,
  onExecuteMove,
  onDeselect,
  onResumeFromHalfTime,
  onQuit,
}: GameScreenProps) {
  const [paused, setPaused] = useState(false);
  const [showLanes, setShowLanes] = useState(() => loadSettings().passingLanes);
  const [showZones, setShowZones] = useState(() => loadSettings().tackleZones);

  const toggleLanes = () => {
    setShowLanes((prev) => {
      const next = !prev;
      updateSettings({ passingLanes: next });
      return next;
    });
  };

  const toggleZones = () => {
    setShowZones((prev) => {
      const next = !prev;
      updateSettings({ tackleZones: next });
      return next;
    });
  };

  const turnLabel = mode === 'ai'
    ? (state.possession === 'home' ? 'Your turn' : 'AI thinking...')
    : (state.possession === 'home' ? 'Home turn' : 'Away turn');

  const animTacklerId =
    lastMoveResult?.outcome === 'tackleFailed' && lastMoveResult.move
      ? lastMoveResult.move.playerId
      : null;


  if (state.status === 'halfTime') {
    return (
      <div className="flex h-dvh items-center justify-center p-4">
        <div className="w-full max-w-xs space-y-4 text-center">
          <h2 className="text-2xl font-bold">HALF-TIME</h2>
          <p className="text-sm text-muted-foreground">
            {state.score.home} — {state.score.away}
          </p>
          <Button className="h-12 w-full text-lg font-bold" onClick={onResumeFromHalfTime}>
            TAP TO START SECOND HALF
          </Button>
        </div>
      </div>
    );
  }

  if (paused) {
    return (
      <div className="flex h-dvh items-center justify-center p-4">
        <div className="w-full max-w-xs space-y-4 text-center">
          <h2 className="text-2xl font-bold">PAUSED</h2>
          <p className="text-sm text-muted-foreground">
            {state.score.home} — {state.score.away}
          </p>
          <div className="space-y-2">
            <Button className="h-12 w-full text-lg font-bold" onClick={() => setPaused(false)}>
              RESUME
            </Button>
            <Button variant="outline" className="h-12 w-full" onClick={onQuit}>
              QUIT GAME
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
    <RotateDeviceOverlay />
    <div className="flex h-dvh flex-col md:flex-row gap-4 p-2 md:p-4 bg-background">
      {/* ── Left Column (70%): Pitch Area ── */}
      <div className="flex flex-1 md:w-[70%] flex-col gap-2 min-w-0">
        <div className="flex items-center gap-2">
          <div className="flex-1 min-w-0">
            <ScoreBar state={state} homeFormation={homeFormation} awayFormation={awayFormation} />
          </div>
          <div className="md:hidden flex items-center gap-1">
             <ThemeToggle />
             <Button variant="ghost" size="icon" onClick={() => setPaused(true)}>⏸</Button>
          </div>
        </div>

        <MatchHud state={state} />

        <div className="relative flex-1 min-h-0 flex items-center justify-center">
          <div className="w-full">
            <Pitch
              state={state}
              selectedPlayerId={selectedPlayerId}
              selectedPlayerMoves={selectedPlayerMoves}
              isAiThinking={isAiThinking}
              failedTacklerId={animTacklerId}
              showPassingLanes={showLanes}
              showTackleZones={showZones}
              ballHistory={ballHistory}
              lastMoveResult={lastMoveResult}
              onSelectPlayer={onSelectPlayer}
              onExecuteMove={onExecuteMove}
              onDeselect={onDeselect}
            />
            <MoveResultBar result={lastMoveResult} />
          </div>
        </div>
      </div>

      {/* ── Right Column (30%): Controls Area ── */}
      <div className="hidden md:flex flex-col w-[30%] min-w-[260px] shrink-0 border-l border-border pl-4">
        <div className="flex min-h-[5rem] items-center justify-center rounded-lg bg-card border border-border p-4 text-center">
          <p className="text-sm font-bold tracking-wider uppercase text-card-foreground">
            {isAiThinking ? (
              <span className="animate-pulse">AI thinking...</span>
            ) : selectedPlayerId ? (
              <span>Tap highlighted cell to move</span>
            ) : (
              <span>{turnLabel}</span>
            )}
          </p>
        </div>

        <div className="mt-auto grid grid-cols-2 gap-2">
          <Button
            variant="outline"
            className="h-12 text-[10px]"
            aria-pressed={showLanes}
            onClick={toggleLanes}
          >
            {showLanes ? 'LANES ON' : 'LANES OFF'}
          </Button>
          <Button
            variant="outline"
            className="h-12 text-[10px]"
            aria-pressed={showZones}
            onClick={toggleZones}
          >
            {showZones ? 'ZONES ON' : 'ZONES OFF'}
          </Button>
          
          <div className="col-span-2 flex gap-2">
            <RulebookDialog
              trigger={
                <Button variant="outline" className="flex-1 h-12 text-[10px]">
                  RULEBOOK
                </Button>
              }
            />
            <Button
              variant="outline"
              className="flex-1 h-12 text-[10px]"
              onClick={() => setPaused(true)}
            >
              PAUSE
            </Button>
          </div>
          
          <div className="col-span-2 flex justify-center mt-2">
            <ThemeToggle />
          </div>
        </div>
      </div>

      {/* Mobile status bar (visible only on small screens) */}
      <div className="md:hidden flex h-10 items-center justify-center gap-2 rounded-lg bg-card px-2 text-sm text-card-foreground border border-border">
        <div className="flex-1 text-center font-bold uppercase tracking-wider text-[10px]">
          {isAiThinking ? (
            <span className="animate-pulse">AI thinking...</span>
          ) : selectedPlayerId ? (
            <span>Tap cell to move</span>
          ) : (
            <span>{turnLabel}</span>
          )}
        </div>
      </div>
    </div>
    <LiveAnnouncer lastMoveResult={lastMoveResult} />
    </>
  );
}
