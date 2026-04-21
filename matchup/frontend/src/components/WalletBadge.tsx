import { cn } from '@/lib/utils';

interface WalletBadgeProps {
  balance: number;
  className?: string;
}

export default function WalletBadge({ balance, className }: WalletBadgeProps) {
  return (
    <a
      href="/wallet"
      className={cn(
        'flex items-center gap-2 px-3 py-2 bg-secondary-container text-on-secondary rounded transition-colors hover:bg-secondary-container/80',
        className
      )}
    >
      <span className="text-sm font-bold">₦</span>
      <span className="text-sm font-bold">{balance.toLocaleString()}</span>
    </a>
  );
}
