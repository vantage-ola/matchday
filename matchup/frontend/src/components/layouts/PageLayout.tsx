import { SideNav } from './SideNav';
import { BottomNav } from './BottomNav';

interface PageLayoutProps {
  children: React.ReactNode;
  title?: string;
  balance?: number;
}

export function PageLayout({ children, title, balance = 0 }: PageLayoutProps) {
  return (
    <div className="min-h-screen flex bg-background">
      <SideNav balance={balance} />
      <main className="flex-1 md:ml-64 flex flex-col min-h-screen">
        {title && (
          <header className="sticky top-0 z-20 px-6 py-4 border-b border-outline-variant/20 bg-surface/95 backdrop-blur">
            <h1 className="text-headline text-primary">{title}</h1>
          </header>
        )}
        <div className="flex-1 p-6 overflow-y-auto pb-20 md:pb-6">
          {children}
        </div>
      </main>
      <BottomNav />
    </div>
  );
}
