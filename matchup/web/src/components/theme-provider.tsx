import { ThemeProvider as NextThemesProvider } from 'next-themes';
import type { ReactNode } from 'react';

interface ThemeProviderProps {
  children: ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem={false}
      disableTransitionOnChange
      themes={['light', 'dark', 'high-contrast', 'night-mode', 'pitch-dark', 'ferrous', 'skeleton']}
      storageKey="matchup-theme"
    >
      {children}
    </NextThemesProvider>
  );
}
