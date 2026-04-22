import { OrientationPrompt } from './OrientationPrompt';

interface GameLayoutProps {
  children: React.ReactNode;
}

export function GameLayout({ children }: GameLayoutProps) {
  return (
    <div className="h-screen w-screen overflow-hidden bg-background">
      <OrientationPrompt />
      <div className="flex h-full w-full">{children}</div>
    </div>
  );
}
