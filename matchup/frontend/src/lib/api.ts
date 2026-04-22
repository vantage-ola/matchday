const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

interface FetchOptions extends RequestInit {
  token?: string;
}

async function fetchApi<T>(
  endpoint: string,
  options: FetchOptions = {}
): Promise<T> {
  const { token, ...fetchOptions } = options;

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...fetchOptions.headers,
  };

  if (token) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_URL}${endpoint}`, {
    ...fetchOptions,
    headers,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || `HTTP ${res.status}`);
  }

  return res.json();
}

export type AuthUser = {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  walletBalance: number;
};

export const api = {
  // Auth
  register: (data: { username: string; password: string; displayName: string }) =>
    fetchApi<{ token: string; user: AuthUser }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  login: (data: { username: string; password: string }) =>
    fetchApi<{ token: string; user: AuthUser }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getMe: (token: string) =>
    fetchApi<AuthUser>('/api/auth/me', { token }),

  // Fixtures
  getFixtures: () => fetchApi<{ fixtures: unknown[] }>('/api/fixtures'),

  getFixture: (id: string) => fetchApi<{ fixture: unknown }>(`/api/fixtures/${id}`),

  getLobby: (fixtureId: string) =>
    fetchApi<{ status: string; homeCount: number; awayCount: number }>(
      `/api/fixtures/${fixtureId}/lobby`
    ),

  joinFixture: (
    fixtureId: string,
    data: { side: 'home' | 'away'; stake: number; gameMode: string },
    token: string
  ) =>
    fetchApi<{ sessionId?: string; position?: number; status: string }>(`/api/fixtures/${fixtureId}/join`, {
      method: 'POST',
      body: JSON.stringify(data),
      token,
    }),

  createBotSession: (
    fixtureId: string,
    data: { side: 'home' | 'away'; stake: number; gameMode: string },
    token: string
  ) =>
    fetchApi<{ sessionId: string }>(`/api/fixtures/${fixtureId}/bot`, {
      method: 'POST',
      body: JSON.stringify(data),
      token,
    }),

  // Sessions
  getSession: (sessionId: string, token: string) =>
    fetchApi<{ session: unknown; gameState: unknown; playerSide: string }>(
      `/api/sessions/${sessionId}`,
      { token }
    ),

  commitMove: (sessionId: string, move: string, token: string) =>
    fetchApi<void>(`/api/sessions/${sessionId}/move`, {
      method: 'POST',
      body: JSON.stringify({ move }),
      token,
    }),

  getResult: (sessionId: string, token: string) =>
    fetchApi<{ result: unknown }>(`/api/sessions/${sessionId}/result`, {
      token,
    }),

  // Settlements
  getSettlement: (sessionId: string, token: string) =>
    fetchApi<{ settlement: unknown }>(`/api/settlements/${sessionId}`, {
      token,
    }),

  // Wallet
  getWallet: (token: string) =>
    fetchApi<{
      balance: number;
      transactions: unknown[];
    }>('/api/wallet', { token }),

  claimDaily: (token: string) =>
    fetchApi<{ balance: number; claimedAmount: number }>('/api/wallet/claim-daily', {
      method: 'POST',
      token,
    }),

  // Match history
  getMatchHistory: (token: string) =>
    fetchApi<{ history: unknown[] }>('/api/sessions/user/history', { token }),
};