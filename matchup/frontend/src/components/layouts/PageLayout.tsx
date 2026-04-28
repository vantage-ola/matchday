import { useState } from 'react';
import { SideNav } from './SideNav';
import { BottomNav } from './BottomNav';

interface PageLayoutProps {
  children: React.ReactNode;
  title?: string;
  balance?: number;
}

export function PageLayout({ children, title, balance = 0 }: PageLayoutProps) {
  const [expanded, setExpanded] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen flex bg-background">
      <SideNav
        balance={balance}
        expanded={expanded}
        mobileOpen={mobileOpen}
        onToggleExpand={() => setExpanded((e) => !e)}
        onCloseMobile={() => setMobileOpen(false)}
      />
      <main
        className={`flex-1 flex flex-col min-h-screen transition-[margin] duration-200 ease-in-out ${
          expanded ? 'md:ml-64' : 'md:ml-16'
        }`}
      >
        {title && (
          <header className="sticky top-0 z-20 px-6 py-4 border-b border-outline-variant/20 bg-surface/95 backdrop-blur">
            <h1 className="text-headline text-primary">{title}</h1>
          </header>
        )}
        <div className="flex-1 p-6 overflow-y-auto pb-20 md:pb-6">
          {children}
        </div>
      </main>
      <BottomNav onMenuTap={() => setMobileOpen(true)} />
    </div>
  );
}
