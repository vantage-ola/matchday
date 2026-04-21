import { useEffect, useState } from 'react';
import { PageLayout } from '@/components/layouts';

interface Transaction {
  id: string;
  type: 'debit' | 'credit';
  amount: number;
  description: string;
  createdAt: string;
}

const MOCK_TRANSACTIONS: Transaction[] = [
  {
    id: '1',
    type: 'credit',
    amount: 566,
    description: 'Won vs @drillz99 · Arsenal/Chelsea',
    createdAt: new Date().toISOString(),
  },
  {
    id: '2',
    type: 'credit',
    amount: 200,
    description: 'Daily Claim',
    createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: '3',
    type: 'debit',
    amount: 200,
    description: 'Lost vs @tactic_master · Man City/Real Madrid',
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: '4',
    type: 'credit',
    amount: 450,
    description: 'Won vs @noob_coach · PSG/Bayern',
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: '5',
    type: 'debit',
    amount: 1500,
    description: 'Squad Upgrade: Midfielder',
    createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

export default function Wallet() {
  const [balance] = useState(4250);
  const [transactions] = useState<Transaction[]>(MOCK_TRANSACTIONS);
  const [canClaim] = useState(true);

  useEffect(() => {
    // TODO: Fetch wallet balance and transactions
  }, []);

  const handleClaim = async () => {
    // TODO: Call POST /api/wallet/claim-daily
    alert('Daily claim: +₦200');
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
    <PageLayout title="WALLET" balance={balance}>
      <div className="flex flex-col lg:flex-row h-full gap-6">
        <section className="lg:w-[35%] flex flex-col">
          <div className="py-4 border-t border-b border-primary-container mb-6">
            <span className="text-label text-muted">Available Balance</span>
            <div className="text-display text-foreground mt-2">₦{balance.toLocaleString()}</div>
          </div>

          {canClaim && (
            <button
              onClick={handleClaim}
              className="w-full py-3 px-4 border border-primary-container text-primary font-bold text-label hover:bg-surface-container transition-colors flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined text-lg">redeem</span>
              Claim daily ₦200
            </button>
          )}

          <p className="text-label-xs text-muted mt-6">
            Currency is for game use only.
          </p>
        </section>

        <section className="lg:w-[65%] flex flex-col">
          <h3 className="text-label text-muted mb-4">Recent Activity</h3>

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
        </section>
      </div>
    </PageLayout>
  );
}

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}
