# Matchup Web

React 19 + Vite + Tailwind v4 + shadcn/ui frontend for the Matchup engine.

## Commands

```bash
bun --cwd matchup/web dev      # Dev server
bun --cwd matchup/web build    # Production build
```

## Structure

```
public/
└── _redirects                 # SPA fallback for Netlify / Cloudflare Pages

src/
├── main.tsx                   # BrowserRouter + ThemeProvider wrap App
├── App.tsx                    # react-router Routes; phase → URL mirror
├── lib/
│   ├── engine.ts              # Bridge — re-exports from @engine and @simulation
│   └── storage.ts             # localStorage save + IndexedDB history/profile
├── hooks/useGame.ts           # Central state hook (Engine ref + GameState)
└── components/
    ├── NotFoundScreen.tsx     # Branded 404 ("Off the pitch")
    ├── menu/                  # MenuScreen
    ├── setup/                 # SetupScreen (mode + formation picks)
    ├── game/                  # Pitch, PlayerToken, ScoreBar, MoveResult, GameScreen, FullTimeScreen
    ├── tutorial/              # TutorialScreen
    ├── rulebook/              # RulebookScreen
    ├── history/               # HistoryScreen — rows deep-link to replay
    ├── replay/                # ReplayScreen
    └── profile/               # ProfileScreen
```

The web app does not own game logic. It calls into the engine through `lib/engine.ts`, which re-exports `Engine`, `getValidMoves`, formations, and types via Vite path aliases (`@engine`, `@simulation`).

## Routing

Powered by `react-router-dom` v7.

| Path                | Screen                                                       |
| ------------------- | ------------------------------------------------------------ |
| `/`                 | `MenuScreen`                                                 |
| `/play`             | `SetupScreen`                                                |
| `/match`            | `GameScreen` (redirects to `/` if no live engine state)      |
| `/fulltime`         | `FullTimeScreen` (redirects to `/` if no live engine state)  |
| `/tutorial`         | `TutorialScreen`                                             |
| `/rulebook`         | `RulebookScreen`                                             |
| `/history`          | `HistoryScreen` — rows navigate to `/replay/:matchId`        |
| `/replay/:matchId`  | `ReplayScreen` — loaded via `loadMatchById`; 404 if missing  |
| `/profile`          | `ProfileScreen`                                              |
| `*`                 | `NotFoundScreen` — branded 404                               |

Engine state lives in memory inside `useGame`, so reloading on `/match` or `/fulltime` redirects to `/`. Players resume an in-progress match via the menu's "Continue" button, which restores the localStorage save.

`App.tsx` mirrors engine phase changes (`playing`, `fullTime`) into the URL via `useEffect` so engine-driven transitions (e.g. half-time → full-time) keep the URL coherent.

## Adding shadcn components

```bash
bunx shadcn@latest add <component>
```
