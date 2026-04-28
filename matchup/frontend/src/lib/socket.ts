import type { GameState, SpatialResolution, GameMove } from '../types';

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:3001';

type EventHandler<T = unknown> = (payload: T) => void;

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected';

interface SocketEvents {
  OPPONENT_COMMITTED: EventHandler;
  TURN_RESOLVED: EventHandler<{ resolution: SpatialResolution; gameState: GameState }>;
  PHASE_TRANSITION: EventHandler<{ newPhase: number; attackingSide: PlayerSide; state: GameState }>;
  MATCHUP_COMPLETE: EventHandler<{ finalState: GameState; result: { homeGoals: number; awayGoals: number; homePossession: number; awayPossession: number } }>;
  OPPONENT_DISCONNECTED: EventHandler<{ reconnectWindowSeconds: number }>;
  BOT_SUBSTITUTED: EventHandler;
  PONG: EventHandler;
  GAME_STATE: EventHandler<GameState>;
  MOVE_COMMITTED: EventHandler<{ playerSide: PlayerSide; turnStatus: TurnStatus }>;
  MATCHUP_ABANDONED: EventHandler;
  CONNECTION_STATUS: EventHandler<ConnectionStatus>;
}

type PlayerSide = 'home' | 'away';
type TurnStatus = 'waiting_both' | 'waiting_home' | 'waiting_away' | 'resolving';

class SocketClient {
  private ws: WebSocket | null = null;
  private handlers: Partial<{ [K in keyof SocketEvents]: SocketEvents[K] }> = {};
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pingInterval: ReturnType<typeof setInterval> | null = null;
  
  private sessionId: string | null = null;
  private token: string | null = null;
  
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private baseReconnectDelay = 1000;
  private status: ConnectionStatus = 'disconnected';

  connect(sessionId: string, token: string): void {
    this.sessionId = sessionId;
    this.token = token;
    this.reconnectAttempts = 0;
    this.connectInternal();
  }

  private connectInternal(): void {
    if (this.ws?.readyState === WebSocket.OPEN || this.ws?.readyState === WebSocket.CONNECTING) {
      return;
    }

    if (!this.sessionId || !this.token) return;

    this.updateStatus('connecting');

    const url = `${WS_URL}/matchup?sessionId=${this.sessionId}&token=${this.token}`;
    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      console.log('WebSocket connected');
      this.reconnectAttempts = 0;
      this.updateStatus('connected');
      this.startPing();
    };

    this.ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data) as {
          type: keyof SocketEvents;
          payload: unknown;
        };
        this.handleMessage(message.type, message.payload);
      } catch (err) {
        console.error('Failed to parse WebSocket message:', err);
      }
    };

    this.ws.onclose = (event) => {
      console.log('WebSocket disconnected:', event.code, event.reason);
      this.stopPing();
      this.updateStatus('disconnected');
      
      if (event.code === 1000 || event.code === 1001) {
        return;
      }
      
      this.handleReconnect();
    };

    this.ws.onerror = (err) => {
      console.error('WebSocket error:', err);
    };
  }
  
  private handleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max WebSocket reconnect attempts reached');
      return;
    }

    this.clearReconnectTimer();

    const delay = Math.min(
      30000, 
      this.baseReconnectDelay * Math.pow(2, this.reconnectAttempts) + Math.random() * 1000
    );

    this.reconnectAttempts++;
    console.log(`Scheduling reconnect attempt ${this.reconnectAttempts} in ${Math.round(delay)}ms`);

    this.reconnectTimer = setTimeout(() => {
      this.connectInternal();
    }, delay);
  }

  disconnect(): void {
    this.stopPing();
    this.clearReconnectTimer();
    
    this.sessionId = null;
    this.token = null;

    if (this.ws) {
      this.ws.close(1000, 'Intentional disconnect');
      this.ws = null;
    }
    
    this.updateStatus('disconnected');
  }

  send(type: string, payload?: unknown): void {
    if (this.ws?.readyState !== WebSocket.OPEN) {
      console.warn('WebSocket not connected');
      return;
    }

    this.ws.send(
      JSON.stringify({
        type,
        payload,
      })
    );
  }

  commitMove(move: GameMove): void {
    this.send('COMMIT_MOVE', { move });
  }

  on<K extends keyof SocketEvents>(event: K, handler: SocketEvents[K]): void {
    this.handlers[event] = handler;
  }

  off<K extends keyof SocketEvents>(event: K): void {
    delete this.handlers[event];
  }
  
  private updateStatus(newStatus: ConnectionStatus): void {
    if (this.status !== newStatus) {
      this.status = newStatus;
      this.handleMessage('CONNECTION_STATUS', newStatus);
    }
  }

  private handleMessage<K extends keyof SocketEvents>(
    type: K,
    payload: unknown
  ): void {
    const handler = this.handlers[type];
    if (handler) {
      (handler as (p: unknown) => void)(payload);
    }
  }

  private startPing(): void {
    this.stopPing();
    this.pingInterval = setInterval(() => {
      this.send('PING');
    }, 30000);
  }

  private stopPing(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }
}

export const socket = new SocketClient();