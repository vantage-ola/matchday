import { cn } from '@/lib/utils';
import { Link, useLocation } from 'react-router-dom';

const navItems = [
  { href: '/', icon: 'calendar_today', label: 'Fixtures' },
  { href: '/wallet', icon: 'account_balance_wallet', label: 'Wallet' },
  { href: '/profile', icon: 'person', label: 'Profile' },
];

export function BottomNav() {
  const location = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 flex md:hidden justify-around items-center h-16 px-2 bg-surface border-t border-outline-variant/20">
      {navItems.map((item) => {
        const isActive = location.pathname === item.href;
        return (
          <Link
            key={item.href}
            to={item.href}
            className={cn(
              'flex flex-col items-center justify-center p-2 transition-transform active:scale-90',
              isActive ? 'text-primary scale-110' : 'text-muted scale-95'
            )}
          >
            <span className="material-symbols-outlined">{item.icon}</span>
            <span className="text-label-xs mt-1">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
