import { useState, useCallback } from 'react';
import { useGame } from '@/hooks/useGame';
import type { FormationName } from '@/lib/engine';
import { MenuScreen } from '@/components/menu/MenuScreen';
import { SetupScreen } from '@/components/setup/SetupScreen';
import { GameScreen } from '@/components/game/GameScreen';
import { FullTimeScreen } from '@/components/game/FullTimeScreen';
import { RulebookScreen } from '@/components/rulebook/RulebookScreen';
import { TutorialScreen } from '@/components/tutorial/TutorialScreen';
import { HistoryScreen } from '@/components/history/HistoryScreen';
import { ProfileScreen } from '@/components/profile/ProfileScreen';
import { ReplayScreen } from '@/components/replay/ReplayScreen';
import type { MatchRecord } from '@/lib/storage';

export function App() {
  const game = useGame();
  const [formations, setFormations] = useState<{ home: FormationName; away: FormationName }>({
    home: '4-3-3',
    away: '4-3-3',
  });
  const [lastMode, setLastMode] = useState<'local' | 'ai'>('local');
  const [showRulebook, setShowRulebook] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [replayMatch, setReplayMatch] = useState<MatchRecord | null>(null);

  const handleStart = useCallback(
    (mode: 'local' | 'ai', home: FormationName, away: FormationName) => {
      setFormations({ home, away });
      setLastMode(mode);
      game.startGame(mode, home, away);
    },
    [game],
  );

  const handleRematch = useCallback(() => {
    const swapped = { home: formations.away, away: formations.home };
    setFormations(swapped);
    game.startGame(lastMode, swapped.home, swapped.away);
  }, [formations, lastMode, game]);

  // ─── Overlay screens (not phase-driven) ────────────────────────

  if (showRulebook) {
    return <RulebookScreen onBack={() => setShowRulebook(false)} />;
  }

  if (replayMatch) {
    return <ReplayScreen match={replayMatch} onBack={() => setReplayMatch(null)} />;
  }

  if (showHistory) {
    return <HistoryScreen onBack={() => setShowHistory(false)} />;
  }

  if (showProfile) {
    return <ProfileScreen onBack={() => setShowProfile(false)} />;
  }

  // ─── Phase-driven screens ──────────────────────────────────────

  if (game.phase === 'menu') {
    return (
      <MenuScreen
        onPlay={game.goToSetup}
        onContinue={game.continueMatch}
        onTutorial={game.goToTutorial}
        onShowRulebook={() => setShowRulebook(true)}
        onHistory={() => setShowHistory(true)}
        onProfile={() => setShowProfile(true)}
      />
    );
  }

  if (game.phase === 'tutorial') {
    return <TutorialScreen onComplete={game.goToMenu} onQuit={game.goToMenu} />;
  }

  if (game.phase === 'setup') {
    return (
      <SetupScreen
        onStart={handleStart}
        onShowRulebook={() => setShowRulebook(true)}
        onBack={game.goToMenu}
      />
    );
  }

  if (game.phase === 'fullTime' && game.state) {
    return (
      <FullTimeScreen
        state={game.state}
        homeFormation={formations.home}
        awayFormation={formations.away}
        onPlayAgain={game.resetGame}
        onRematch={handleRematch}
      />
    );
  }

  if (game.state) {
    return (
      <GameScreen
        state={game.state}
        mode={game.mode}
        homeFormation={formations.home}
        awayFormation={formations.away}
        selectedPlayerId={game.selectedPlayerId}
        selectedPlayerMoves={game.selectedPlayerMoves}
        lastMoveResult={game.lastMoveResult}
        isAiThinking={game.isAiThinking}
        ballHistory={game.ballHistory}
        onSelectPlayer={game.selectPlayer}
        onExecuteMove={game.executeMove}
        onDeselect={game.deselectPlayer}
        onResumeFromHalfTime={game.resumeFromHalfTime}
        onQuit={game.resetGame}
      />
    );
  }

  return null;
}

export default App;
