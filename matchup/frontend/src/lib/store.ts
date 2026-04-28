import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { GameState, PlayerSide, GameMove } from '../types';

interface AuthState {
  token: string | null;
  user: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
    walletBalance: number;
  } | null;
  setToken: (token: string | null) => void;
  setUser: (user: AuthState['user']) => void;
  updateBalance: (balance: number) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      setToken: (token) => set({ token }),
      setUser: (user) => set({ user }),
      updateBalance: (balance) =>
        set((state) => ({
          user: state.user ? { ...state.user, walletBalance: balance } : null,
        })),
      logout: () => {
        localStorage.removeItem('matchup-auth');
        set({ token: null, user: null });
      },
    }),
    {
      name: 'matchup-auth',
    }
  )
);

interface GameStoreState {
  gameState: GameState | null;
  playerSide: PlayerSide | null;
  selectedMove: GameMove | null;
  opponentCommitted: boolean;
  sessionStarted: boolean;
  connectionStatus: 'disconnected' | 'connecting' | 'connected';

  setGameState: (state: GameState | null) => void;
  setPlayerSide: (side: PlayerSide | null) => void;
  setSelectedMove: (move: GameMove | null) => void;
  setOpponentCommitted: (committed: boolean) => void;
  setSessionStarted: (started: boolean) => void;
  setConnectionStatus: (status: GameStoreState['connectionStatus']) => void;
  reset: () => void;
}

export const useGameStore = create<GameStoreState>((set) => ({
  gameState: null,
  playerSide: null,
  selectedMove: null,
  opponentCommitted: false,
  sessionStarted: false,
  connectionStatus: 'disconnected',

  setGameState: (gameState) => set({ gameState }),
  setPlayerSide: (playerSide) => set({ playerSide }),
  setSelectedMove: (selectedMove) => set({ selectedMove }),
  setOpponentCommitted: (opponentCommitted) => set({ opponentCommitted }),
  setSessionStarted: (sessionStarted) => set({ sessionStarted }),
  setConnectionStatus: (connectionStatus) => set({ connectionStatus }),
  reset: () =>
    set({
      gameState: null,
      playerSide: null,
      selectedMove: null,
      opponentCommitted: false,
      sessionStarted: false,
      connectionStatus: 'disconnected',
    }),
}));

interface WalletState {
  balance: number;
  canClaim: boolean;
  transactions: Array<{
    id: string;
    type: 'debit' | 'credit';
    amount: number;
    description: string;
    createdAt: string;
  }>;

  setBalance: (balance: number) => void;
  setCanClaim: (canClaim: boolean) => void;
  setTransactions: (transactions: WalletState['transactions']) => void;
  addTransaction: (transaction: WalletState['transactions'][0]) => void;
}

export const useWalletStore = create<WalletState>((set) => ({
  balance: 0,
  canClaim: false,
  transactions: [],

  setBalance: (balance) => set({ balance }),
  setCanClaim: (canClaim) => set({ canClaim }),
  setTransactions: (transactions) => set({ transactions }),
  addTransaction: (transaction) =>
    set((state) => ({
      transactions: [transaction, ...state.transactions],
    })),
}));

interface FixtureState {
  fixtures: Array<{
    id: string;
    homeTeam: string;
    awayTeam: string;
    homeTeamAbbr?: string;
    awayTeamAbbr?: string;
    league: string;
    kickoffAt: string;
    status: 'scheduled' | 'live' | 'finished';
    homeScore?: number;
    awayScore?: number;
    minute?: number;
    venue?: string;
  }>;
  loading: boolean;
  setFixtures: (fixtures: FixtureState['fixtures']) => void;
  setLoading: (loading: boolean) => void;
}

export const useFixtureStore = create<FixtureState>((set) => ({
  fixtures: [],
  loading: false,
  setFixtures: (fixtures) => set({ fixtures }),
  setLoading: (loading) => set({ loading }),
}));