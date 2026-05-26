import { useEffect, useMemo, useState } from 'react';
import { Loader2, RefreshCcw, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { StatusPill } from '@/components/StatusPill';
import { DEFAULT_BRANCH_ID } from '@/config/app';
import { api } from '@/lib/apiClient';

export function CashierDashboard({ onRefreshTransactions, profile, transactions }) {
  const [phone, setPhone] = useState('');
  const [amount, setAmount] = useState('');
  const [branchId, setBranchId] = useState(profile?.branch_id || DEFAULT_BRANCH_ID);
  const [status, setStatus] = useState('idle');
  const [message, setMessage] = useState('');
  const [currentTransactionId, setCurrentTransactionId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setBranchId(profile?.branch_id || DEFAULT_BRANCH_ID);
  }, [profile?.branch_id]);

  const currentTransaction = useMemo(
    () => transactions.find((item) => item.id === currentTransactionId),
    [currentTransactionId, transactions]
  );

  useEffect(() => {
    if (!currentTransaction) {
      return;
    }

    setStatus(currentTransaction.status || 'pending');
    if (currentTransaction.status === 'success') {
      setMessage(`Receipt ${currentTransaction.mpesa_receipt || currentTransaction.receipt_number || 'received'}`);
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
      setMessage('Branch ID is required.');
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
      setMessage(data.stk.customer_message || 'STK Push sent.');
      await onRefreshTransactions();
    } catch (error) {
      setStatus('failed');
      setMessage(error.response?.data?.message || error.message || 'Failed to send STK Push.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen flex-1 overflow-y-auto">
      <div className="mx-auto max-w-5xl px-8 py-8">
        <div className="mb-8 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-normal">Cashier dashboard</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Branch-scoped STK Push requests and transaction status.
            </p>
          </div>
          <Button variant="outline" onClick={onRefreshTransactions}>
            <RefreshCcw className="h-4 w-4" aria-hidden="true" />
            Refresh
          </Button>
        </div>

        <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <form className="rounded-lg border bg-card p-6 shadow-sm" onSubmit={handleSubmit}>
            <div className="mb-6 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold">Send STK Push</h2>
                <p className="text-sm text-muted-foreground">Enter the customer payment details.</p>
              </div>
              <StatusPill status={status} />
            </div>

            <div className="grid gap-5 md:grid-cols-2">
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

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="branch">Branch ID</Label>
                <Input
                  id="branch"
                  value={branchId}
                  onChange={(event) => setBranchId(event.target.value)}
                  disabled={Boolean(profile?.branch_id)}
                  required
                />
              </div>
            </div>

            <div className="mt-6 flex items-center justify-between gap-4">
              <div className="min-h-10 text-sm text-muted-foreground">{message}</div>
              <Button type="submit" disabled={isSubmitting || status === 'pending'}>
                {isSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Send className="h-4 w-4" aria-hidden="true" />
                )}
                Send STK Push
              </Button>
            </div>
          </form>

          <aside className="rounded-lg border bg-card p-5 shadow-sm">
            <h2 className="text-base font-semibold">Status area</h2>
            <div className="mt-4 space-y-3">
              {['idle', 'pending', 'success', 'failed'].map((item) => (
                <div className="flex items-center justify-between rounded-md border px-3 py-2" key={item}>
                  <span className="text-sm capitalize">{item}</span>
                  <StatusPill status={item} />
                </div>
              ))}
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}
