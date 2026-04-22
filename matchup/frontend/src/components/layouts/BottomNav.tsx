import { cn } from '@/lib/utils';
import { Link, useLocation } from 'react-router-dom';
import { Calendar, Wallet, User } from 'lucide-react';

const navItems = [
  { href: '/', icon: Calendar, label: 'Fixtures' },
  { href: '/wallet', icon: Wallet, label: 'Wallet' },
  { href: '/profile', icon: User, label: 'Profile' },
];

export function BottomNav() {
  const location = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 flex md:hidden justify-around items-center h-16 px-2 bg-surface border-t border-outline-variant/20">
      {navItems.map((item) => {
        const isActive = location.pathname === item.href;
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            to={item.href}
            className={cn(
              'flex flex-col items-center justify-center p-2 transition-transform active:scale-90',
              isActive ? 'text-primary scale-110' : 'text-muted scale-95'
            )}
          >
            <Icon className="w-5 h-5" />
            <span className="text-label-xs mt-1">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
