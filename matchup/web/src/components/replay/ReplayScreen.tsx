import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowLeft, SkipBack, Play, Pause, ChevronLeft, ChevronRight } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { Pitch } from '@/components/game/Pitch';
import { ScoreBar } from '@/components/game/ScoreBar';
import { ReplayController, type ReplayState } from '@/lib/replay';
import type { MatchRecord } from '@/lib/storage';

interface ReplayScreenProps {
  match: MatchRecord;
  onBack: () => void;
}

const SPEEDS = [
  { label: '1×', ms: 700 },
  { label: '2×', ms: 350 },
  { label: '4×', ms: 175 },
];

export function ReplayScreen({ match, onBack }: ReplayScreenProps) {
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const controller = useMemo(() => {
    return new ReplayController(
      match.homeFormation,
      match.awayFormation,
      match.seed,
      match.events,
    );
  }, [match]);

  const [replayState, setReplayState] = useState<ReplayState>(() => controller.getState());
  const [isPlaying, setIsPlaying] = useState(false);
  const [speedIdx, setSpeedIdx] = useState(0);

  // Sync state if controller changes (e.g. match prop changes)
  const [lastController, setLastController] = useState(controller);
  if (controller !== lastController) {
    setLastController(controller);
    setReplayState(controller.getState());
  }

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const stopAutoplay = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setIsPlaying(false);
  }, []);

  const stepFwd = useCallback(() => {
    const next = controller.stepForward();
    if (next) {
      setReplayState(next);
    } else {
      stopAutoplay();
    }
  }, [controller, stopAutoplay]);

  const stepBack = useCallback(() => {
    const prev = controller.stepBackward();
    if (prev) setReplayState(prev);
  }, [controller]);

  const seekTo = useCallback((idx: number) => {
    stopAutoplay();
    setReplayState(controller.seekTo(idx));
  }, [controller, stopAutoplay]);

  const togglePlay = useCallback(() => {
    if (isPlaying) {
      stopAutoplay();
    } else {
      if (controller.eventIndex >= controller.totalMoves) return;
      setIsPlaying(true);
      timerRef.current = setInterval(() => {
        const next = controller.stepForward();
        if (next) {
          setReplayState(next);
        } else {
          stopAutoplay();
        }
      }, SPEEDS[speedIdx].ms);
    }
  }, [controller, isPlaying, speedIdx, stopAutoplay]);

  const cycleSpeed = useCallback(() => {
    const next = (speedIdx + 1) % SPEEDS.length;
    setSpeedIdx(next);
    // If currently playing, restart interval with new speed
    if (isPlaying) {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        const s = controller.stepForward();
        if (s) setReplayState(s);
        else stopAutoplay();
      }, SPEEDS[next].ms);
    }
  }, [speedIdx, isPlaying, controller, stopAutoplay]);

  const reset = useCallback(() => {
    stopAutoplay();
    setReplayState(controller.reset());
  }, [controller, stopAutoplay]);

  if (!replayState) return null;

  const { gameState, eventIndex, totalEvents } = replayState;

  return (
    <div className="flex h-dvh flex-col gap-2 p-2">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" className="h-9 w-9 px-0" onClick={onBack}>
          <ArrowLeft size={18} />
        </Button>
        <div className="flex-1">
          <ScoreBar
            state={gameState}
            homeFormation={match.homeFormation}
            awayFormation={match.awayFormation}
          />
        </div>
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Replay</span>
      </div>

      {/* Pitch — read-only */}
      <div className="relative flex-1 min-h-0 flex items-center">
        <div className="w-full">
          <Pitch
            state={gameState}
            selectedPlayerId={null}
            selectedPlayerMoves={new Set()}
            isAiThinking={false}
            showPassingLanes={false}
            showTackleZones={false}
            ballHistory={[]}
            onSelectPlayer={() => {}}
            onExecuteMove={() => {}}
            onDeselect={() => {}}
          />
        </div>
      </div>

      {/* Transport controls */}
      <div className="space-y-2 pb-1">
        {/* Progress bar */}
        <div className="flex items-center gap-2">
          <span className="w-8 text-right text-[10px] tabular-nums text-muted-foreground">
            {eventIndex}
          </span>
          <Slider
            min={0}
            max={totalEvents}
            value={[eventIndex]}
            onValueChange={(val) => seekTo((val as number[])[0])}
            className="flex-1"
          />
          <span className="w-8 text-[10px] tabular-nums text-muted-foreground">
            {totalEvents}
          </span>
        </div>

        {/* Buttons */}
        <div className="flex items-center justify-center gap-2">
          <Button variant="ghost" size="sm" className="h-9 w-9 px-0" onClick={reset}>
            <SkipBack size={16} />
          </Button>
          <Button variant="ghost" size="sm" className="h-9 w-9 px-0" onClick={stepBack} disabled={eventIndex <= 0}>
            <ChevronLeft size={18} />
          </Button>
          <Button
            size="sm"
            className="h-10 w-10 rounded-full px-0"
            onClick={togglePlay}
          >
            {isPlaying ? <Pause size={18} /> : <Play size={18} />}
          </Button>
          <Button variant="ghost" size="sm" className="h-9 w-9 px-0" onClick={stepFwd} disabled={eventIndex >= totalEvents}>
            <ChevronRight size={18} />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-9 px-2 text-[11px] font-bold tabular-nums"
            onClick={cycleSpeed}
          >
            {SPEEDS[speedIdx].label}
          </Button>
        </div>
      </div>
    </div>
  );
}
