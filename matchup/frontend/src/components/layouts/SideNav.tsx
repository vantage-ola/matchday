import { cn } from '@/lib/utils';
import { Link, useLocation } from 'react-router-dom';
import { Calendar, Wallet, User, PanelLeftClose, PanelLeft } from 'lucide-react';
import WalletBadge from '../WalletBadge';
import { ThemeToggle } from '../ThemeToggle';

const navItems = [
  { href: '/', icon: Calendar, label: 'Fixtures' },
  { href: '/wallet', icon: Wallet, label: 'Wallet' },
  { href: '/profile', icon: User, label: 'Profile' },
];

interface SideNavProps {
  balance?: number;
  expanded: boolean;
  mobileOpen: boolean;
  onToggleExpand: () => void;
  onCloseMobile: () => void;
}

export function SideNav({
  balance = 0,
  expanded,
  mobileOpen,
  onToggleExpand,
  onCloseMobile,
}: SideNavProps) {
  const location = useLocation();

  return (
    <>
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-background/60 backdrop-blur-sm z-40 md:hidden"
          onClick={onCloseMobile}
        />
      )}

      {/* Mobile drawer — slides in from left, full width nav */}
      <nav
        className={cn(
          'fixed left-0 top-0 h-full w-64 bg-surface-container border-r border-outline-variant/20 z-50 flex flex-col transition-transform duration-200 ease-in-out md:hidden',
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="p-6 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-black text-primary tracking-tight uppercase">MATCHUP</h1>
            <p className="text-label text-muted mt-1">STRATEGY ROOM</p>
          </div>
          <button
            onClick={onCloseMobile}
            className="p-2 text-muted hover:text-foreground transition-colors"
          >
            <PanelLeftClose className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 flex flex-col gap-2 px-4 mt-6">
          {navItems.map((item) => {
            const isActive = location.pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                to={item.href}
                onClick={onCloseMobile}
                className={cn(
                  'flex items-center gap-4 px-4 py-3 transition-all duration-200',
                  isActive
                    ? 'text-foreground bg-surface-container-high border-l-4 border-primary-container'
                    : 'text-muted hover:text-foreground hover:bg-surface-container-high/50 rounded'
                )}
              >
                <Icon className="w-5 h-5" />
                <span className="text-label">{item.label}</span>
              </Link>
            );
          })}
        </div>

        <div className="px-4 py-2 flex items-center justify-between">
          <span className="text-label-xs text-muted">THEME</span>
          <ThemeToggle />
        </div>

        <div className="p-4 border-t border-outline-variant/20">
          <WalletBadge balance={balance} />
        </div>
      </nav>

      {/* Desktop — always visible, toggles between expanded (w-64) and icon rail (w-16) */}
      <nav
        className={cn(
          'hidden md:flex fixed left-0 top-0 h-full bg-surface-container border-r border-outline-variant/20 z-40 flex-col transition-[width] duration-200 ease-in-out overflow-hidden',
          expanded ? 'w-64' : 'w-16'
        )}
      >
        <div className={cn('flex items-center', expanded ? 'p-6 justify-between' : 'p-4 justify-center')}>
          {expanded ? (
            <>
              <div className="min-w-0">
                <h1 className="text-lg font-black text-primary tracking-tight uppercase">MATCHUP</h1>
                <p className="text-label text-muted mt-1">STRATEGY ROOM</p>
              </div>
              <button
                onClick={onToggleExpand}
                className="p-2 text-muted hover:text-foreground transition-colors shrink-0"
              >
                <PanelLeftClose className="w-5 h-5" />
              </button>
            </>
          ) : (
            <button
              onClick={onToggleExpand}
              className="p-2 text-muted hover:text-foreground transition-colors"
            >
              <PanelLeft className="w-5 h-5" />
            </button>
          )}
        </div>

        <div className={cn('flex-1 flex flex-col gap-2 mt-6', expanded ? 'px-4' : 'px-2')}>
          {navItems.map((item) => {
            const isActive = location.pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                to={item.href}
                title={!expanded ? item.label : undefined}
                className={cn(
                  'flex items-center transition-all duration-200',
                  expanded ? 'gap-4 px-4 py-3' : 'justify-center py-3',
                  isActive
                    ? 'text-foreground bg-surface-container-high border-l-4 border-primary-container'
                    : 'text-muted hover:text-foreground hover:bg-surface-container-high/50 rounded'
                )}
              >
                <Icon className="w-5 h-5 shrink-0" />
                {expanded && <span className="text-label">{item.label}</span>}
              </Link>
            );
          })}
        </div>

        <div className={cn('py-2 flex items-center', expanded ? 'px-4 justify-between' : 'px-2 justify-center')}>
          {expanded && <span className="text-label-xs text-muted">THEME</span>}
          <ThemeToggle />
        </div>

        {expanded && (
          <div className="p-4 border-t border-outline-variant/20">
            <WalletBadge balance={balance} />
          </div>
        )}
      </nav>
    </>
  );
}
