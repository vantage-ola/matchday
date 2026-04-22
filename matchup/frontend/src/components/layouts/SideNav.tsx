import { cn } from '@/lib/utils';
import { Link, useLocation } from 'react-router-dom';
import { Calendar, Wallet, User } from 'lucide-react';
import WalletBadge from '../WalletBadge';
import { ThemeToggle } from '../ThemeToggle';

const navItems = [
  { href: '/', icon: Calendar, label: 'Fixtures' },
  { href: '/wallet', icon: Wallet, label: 'Wallet' },
  { href: '/profile', icon: User, label: 'Profile' },
];

interface SideNavProps {
  balance?: number;
}

export function SideNav({ balance = 0 }: SideNavProps) {
  const location = useLocation();

  return (
    <nav className="hidden md:flex flex-col fixed left-0 top-0 h-full w-64 bg-surface-container border-r border-outline-variant/20 z-40">
      <div className="p-6">
        <h1 className="text-lg font-black text-primary tracking-tight uppercase">MATCHUP</h1>
        <p className="text-label text-muted mt-1">STRATEGY ROOM</p>
      </div>

      <div className="flex-1 flex flex-col gap-2 px-4 mt-6">
        {navItems.map((item) => {
          const isActive = location.pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              to={item.href}
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
  );
}
