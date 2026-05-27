import { StatusPill } from '@/components/StatusPill';

export function RecentTransactions({ transactions = [] }) {
  if (!transactions.length) {
    return <p className="text-sm text-muted-foreground">No transactions yet.</p>;
  }

  return (
    <div className="space-y-2">
      {transactions.slice(0, 6).map((transaction) => (
        <div
          className="rounded-md border bg-card px-3 py-2"
          key={transaction.id || transaction.checkout_request_id}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{transaction.phone}</p>
              <p className="text-xs text-muted-foreground">
                KES {Number(transaction.amount || 0).toLocaleString()}
              </p>
            </div>
            <StatusPill status={transaction.status || 'pending_pin'} />
          </div>
        </div>
      ))}
    </div>
  );
}
