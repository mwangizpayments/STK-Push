import { useEffect, useMemo, useState } from 'react';
import { Loader2, LogOut, Menu, Send, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { StatusPill } from '@/components/StatusPill';
import { DEFAULT_BRANCH_ID } from '@/config/app';
import { api } from '@/lib/apiClient';

export function CashierDashboard({ onLogout, onRefreshTransactions, profile, transactions }) {
  const [phone, setPhone] = useState('');
  const [amount, setAmount] = useState('');
  const [status, setStatus] = useState('idle');
  const [message, setMessage] = useState('');
  const [currentTransactionId, setCurrentTransactionId] = useState('');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [version, setVersion] = useState('0.1.0');

  const branchId = profile?.branch_id || DEFAULT_BRANCH_ID;
  const currentTransaction = useMemo(
    () => transactions.find((item) => item.id === currentTransactionId),
    [currentTransactionId, transactions]
  );

  useEffect(() => {
    window.mpesaDesktop?.appVersion?.().then(setVersion).catch(() => {});
  }, []);

  useEffect(() => {
    if (!currentTransaction) {
      return;
    }

    setStatus(currentTransaction.status || 'pending');
    if (currentTransaction.status === 'success') {
      setMessage('Backend callback received for this transaction.');
    }
    if (currentTransaction.status === 'failed') {
      setMessage(currentTransaction.failure_reason || 'Payment failed');
    }
  }, [currentTransaction]);

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage('');
    setStatus('idle');

    if (!branchId) {
      setStatus('failed');
      setMessage('No branch is assigned to this cashier.');
      return;
    }

    setIsSubmitting(true);
    setStatus('pending');

    try {
      const { data } = await api.post('/api/stkpush', {
        phone,
        amount: Number(amount),
        branch_id: branchId
      });

      setCurrentTransactionId(data.transaction.id);
      setMessage(data.stk.customer_message || 'STK request accepted. Waiting for backend callback.');
      await onRefreshTransactions();
    } catch (error) {
      setStatus('failed');
      setMessage(error.response?.data?.message || error.message || 'Failed to send STK Push.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="relative min-h-screen overflow-y-auto bg-background px-5 py-5">
      <div className="absolute left-5 top-5 z-20">
        <Button
          aria-label="Menu"
          size="icon"
          variant="outline"
          onClick={() => setIsMenuOpen((current) => !current)}
        >
          {isMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </Button>

        {isMenuOpen ? (
          <div className="mt-2 w-64 rounded-lg border bg-white p-3 shadow-sm">
            <p className="truncate px-2 py-2 text-sm font-medium">{profile?.email}</p>
            <Button className="w-full justify-start" variant="ghost" onClick={onLogout}>
              <LogOut className="h-4 w-4" />
              Logout
            </Button>
          </div>
        ) : null}
      </div>

      <section className="mx-auto flex min-h-[560px] max-w-xl flex-col justify-center pt-16">
        <form className="rounded-lg border bg-card p-6 shadow-sm" onSubmit={handleSubmit}>
          <div className="mb-6 flex items-center justify-between gap-4">
            <h1 className="text-2xl font-semibold tracking-normal">Payment terminal</h1>
            <StatusPill status={status} />
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="phone">Phone number</Label>
              <Input
                id="phone"
                inputMode="tel"
                placeholder="0712345678"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="amount">Amount</Label>
              <Input
                id="amount"
                min="1"
                step="1"
                type="number"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                required
              />
            </div>
          </div>

          <Button className="mt-6 h-12 w-full text-base" type="submit" disabled={isSubmitting || status === 'pending'}>
            {isSubmitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
            PAY
          </Button>

          <div className="mt-4 min-h-6 text-center text-sm text-muted-foreground">{message}</div>
        </form>

        <section className="mt-6 rounded-lg border bg-card p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold">Recent transactions</h2>
          <div className="space-y-2">
            {transactions.length ? (
              transactions.map((transaction) => (
                <div className="grid grid-cols-[1fr_auto] gap-3 rounded-md border px-3 py-2" key={transaction.id}>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{transaction.phone}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatTimestamp(transaction.created_at)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold">KES {Number(transaction.amount || 0).toLocaleString()}</p>
                    <StatusPill status={transaction.status || 'pending'} />
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No transactions yet.</p>
            )}
          </div>
        </section>
      </section>

      <div className="fixed bottom-3 right-4 text-xs text-muted-foreground">v{version}</div>
    </main>
  );
}

function formatTimestamp(value) {
  if (!value) {
    return '';
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(value));
}
