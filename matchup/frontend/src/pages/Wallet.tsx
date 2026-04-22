import { useEffect, useState, useCallback } from 'react';
import { toast } from 'sonner';
import { Gift } from 'lucide-react';
import { PageLayout } from '@/components/layouts';
import { api } from '@/lib/api';
import { useAuthStore, useWalletStore } from '@/lib/store';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface Transaction {
  id: string;
  type: 'debit' | 'credit';
  amount: number;
  description: string;
  createdAt: string;
}

export default function Wallet() {
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const { user, token, updateBalance } = useAuthStore();
  const { balance, canClaim, transactions, setBalance, setCanClaim, setTransactions } = useWalletStore();

  const fetchWallet = useCallback(async () => {
    if (!token) return;
    
    try {
      const data = await api.getWallet(token);
      setBalance(data.balance);
      setTransactions(data.transactions as Transaction[]);
      setCanClaim(true);
    } catch {
      toast.error('Failed to load wallet');
    } finally {
      setLoading(false);
    }
  }, [token, setBalance, setTransactions, setCanClaim]);

  useEffect(() => {
    fetchWallet();
  }, [fetchWallet]);

  const handleClaim = async () => {
    if (!user || !token) return;
    
    setClaiming(true);
    try {
      const result = await api.claimDaily(token);
      setBalance(result.balance);
      updateBalance(result.balance);
      setCanClaim(false);
      toast.success(`Claimed ₦${result.claimedAmount}!`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to claim';
      toast.error(message);
    } finally {
      setClaiming(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today, ' + date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday, ' + date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <PageLayout title="WALLET" balance={user?.walletBalance ?? balance}>
      <div className="flex flex-col lg:flex-row h-full gap-6">
        <section className="lg:w-[35%] flex flex-col">
          {loading ? (
            <>
              <div className="py-4 border-t border-b border-primary-container mb-6">
                <Skeleton className="h-4 w-32 mb-2" />
                <Skeleton className="h-12 w-40" />
              </div>
              <Skeleton className="h-12 w-full" />
            </>
          ) : (
            <>
              <div className="py-4 border-t border-b border-primary-container mb-6">
                <span className="text-label text-muted">Available Balance</span>
                <div className="text-display text-foreground mt-2">₦{balance.toLocaleString()}</div>
              </div>

              {canClaim && (
                <button
                  onClick={handleClaim}
                  disabled={claiming}
                  className="w-full py-3 px-4 border border-primary-container text-primary font-bold text-label hover:bg-surface-container transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <Gift className="w-4 h-4" />
                  {claiming ? 'CLAIMING...' : 'Claim daily ₦200'}
                </button>
              )}

              <p className="text-label-xs text-muted mt-6">
                Currency is for game use only.
              </p>
            </>
          )}
        </section>

        <section className="lg:w-[65%] flex flex-col">
          <h3 className="text-label text-muted mb-4">Recent Activity</h3>

          {loading ? (
            <div className="flex flex-col gap-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex justify-between items-center py-4">
                  <div className="flex flex-col gap-1">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                  <Skeleton className="h-4 w-16" />
                </div>
              ))}
            </div>
          ) : transactions.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-muted">
              No transactions yet
            </div>
          ) : (
            <div className="flex flex-col">
              {transactions.map((tx) => (
                <div
                  key={tx.id}
                  className="flex justify-between items-center py-4 border-b border-outline-variant/20 hover:bg-surface-container-high/50 transition-colors px-2 -mx-2"
                >
                  <div className="flex flex-col gap-1">
                    <span className="text-sm font-medium">{tx.description}</span>
                    <span className="text-label-xs text-muted">{formatDate(tx.createdAt)}</span>
                  </div>
                  <span className={cn(
                    'text-sm font-bold',
                    tx.type === 'credit' ? 'text-primary' : 'text-foreground'
                  )}>
                    {tx.type === 'credit' ? '+' : '-'}₦{tx.amount.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </PageLayout>
  );
}
