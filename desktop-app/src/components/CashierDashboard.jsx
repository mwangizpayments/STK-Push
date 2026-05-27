import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Clock3,
  Info,
  Loader2,
  LogOut,
  Menu,
  Phone,
  ReceiptText,
  Send,
  Settings,
  Smartphone,
  X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AboutModal } from '@/components/AboutModal';
import { CashierSettingsModal } from '@/components/CashierSettingsModal';
import { StatusPill } from '@/components/StatusPill';
import { CASHIER_MODES } from '@/config/cashierMode';
import { DEFAULT_BRANCH_ID } from '@/config/app';
import { api } from '@/lib/apiClient';

const activeStatuses = ['created', 'pending', 'pending_pin', 'processing'];
const failedStatuses = ['failed', 'timeout', 'cancelled'];
const visibleTransactionCount = 10;
const SAFARICOM_PREFIXES = new Set([
  '0700',
  '0701',
  '0702',
  '0703',
  '0704',
  '0705',
  '0706',
  '0707',
  '0708',
  '0709',
  '0710',
  '0711',
  '0712',
  '0713',
  '0714',
  '0715',
  '0716',
  '0717',
  '0718',
  '0719',
  '0720',
  '0721',
  '0722',
  '0723',
  '0724',
  '0725',
  '0726',
  '0727',
  '0728',
  '0729',
  '0740',
  '0741',
  '0742',
  '0743',
  '0745',
  '0746',
  '0748',
  '0757',
  '0758',
  '0759',
  '0768',
  '0769',
  '0790',
  '0791',
  '0792',
  '0793',
  '0794',
  '0795',
  '0796',
  '0797',
  '0798',
  '0799',
  '0110',
  '0111',
  '0112',
  '0113',
  '0114',
  '0115',
  '0116',
  '0117'
]);

export function CashierDashboard({
  cashierMode = CASHIER_MODES.SIMPLE,
  onCashierModeChange,
  onLogout,
  onRefreshTransactions,
  profile,
  transactions
}) {
  const [phone, setPhone] = useState('');
  const [amount, setAmount] = useState('');
  const [status, setStatus] = useState('idle');
  const [message, setMessage] = useState('Ready for next payment.');
  const [currentTransactionId, setCurrentTransactionId] = useState('');
  const [selectedTransactionId, setSelectedTransactionId] = useState('');
  const [isHistoryExpanded, setIsHistoryExpanded] = useState(false);
  const [isAboutOpen, setIsAboutOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [version, setVersion] = useState('1.0.0');

  const phoneRef = useRef(null);
  const amountRef = useRef(null);
  const paymentRequestKeyRef = useRef('');

  const branchId = profile?.branch_id || DEFAULT_BRANCH_ID;
  const currentTransaction = useMemo(
    () => transactions.find((item) => item.id === currentTransactionId),
    [currentTransactionId, transactions]
  );
  const selectedTransaction = useMemo(
    () => transactions.find((item) => item.id === selectedTransactionId),
    [selectedTransactionId, transactions]
  );
  const normalizedPhone = normalizeKenyanPhone(phone);
  const amountValue = Number(amount);
  const canPay = Boolean(normalizedPhone && Number.isFinite(amountValue) && amountValue > 0 && branchId);
  const displayStatus = currentTransaction?.status || status;
  const visibleTransactions = isHistoryExpanded
    ? transactions
    : transactions.slice(0, visibleTransactionCount);
  const hiddenTransactionCount = Math.max(transactions.length - visibleTransactionCount, 0);
  const isSimpleMode = cashierMode === CASHIER_MODES.SIMPLE;

  useEffect(() => {
    window.mpesaDesktop?.appVersion?.().then(setVersion).catch(() => {});
    phoneRef.current?.focus();
  }, []);

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        setIsMenuOpen(false);
        setSelectedTransactionId('');
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (!currentTransaction) {
      return;
    }

    setStatus(currentTransaction.status || 'pending_pin');
    setMessage(buildStateMessage(currentTransaction));
  }, [currentTransaction]);

  useEffect(() => {
    if (!isSimpleMode || displayStatus !== 'success') {
      return undefined;
    }

    const resetTimer = window.setTimeout(() => {
      setCurrentTransactionId('');
      setSelectedTransactionId('');
      setStatus('idle');
      setMessage('Ready for next payment.');
      phoneRef.current?.focus();
    }, 1200);

    return () => window.clearTimeout(resetTimer);
  }, [displayStatus, isSimpleMode]);

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage('');

    if (!branchId) {
      setStatus('failed');
      setMessage('No branch is assigned to this cashier. Ask an admin to finish branch setup.');
      return;
    }

    if (!normalizedPhone) {
      setStatus('failed');
      setMessage('Enter a valid Safaricom number like 0712345678, 0110123456, or +254712345678.');
      phoneRef.current?.focus();
      return;
    }

    if (!Number.isFinite(amountValue) || amountValue <= 0) {
      setStatus('failed');
      setMessage('Enter an amount greater than zero.');
      amountRef.current?.focus();
      return;
    }

    setIsSubmitting(true);
    setStatus('pending_pin');
    setMessage('Waiting for customer PIN. Ask the customer to check their phone.');

    try {
      const idempotencyKey = ensurePaymentRequestKey(paymentRequestKeyRef);
      const { data } = await api.post('/api/stkpush', {
        phone: normalizedPhone,
        amount: Math.round(amountValue),
        branch_id: branchId,
        idempotency_key: idempotencyKey
      }, {
        headers: {
          'Idempotency-Key': idempotencyKey
        }
      });

      setCurrentTransactionId(data.transaction.id);
      paymentRequestKeyRef.current = '';
      setPhone('');
      setAmount('');
      setMessage(data.stk.customer_message || 'Waiting for customer PIN.');
      await onRefreshTransactions();
      phoneRef.current?.focus();
    } catch (error) {
      setStatus('failed');
      setMessage(toFriendlyPaymentError(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  function handlePhoneChange(value) {
    paymentRequestKeyRef.current = '';
    setPhone(formatKenyanPhoneInput(value));
    if (status === 'failed') {
      setStatus('idle');
      setMessage('Ready for next payment.');
    }
  }

  function handleAmountChange(value) {
    paymentRequestKeyRef.current = '';
    setAmount(value);
    if (status === 'failed') {
      setStatus('idle');
      setMessage('Ready for next payment.');
    }
  }

  function handlePhoneKeyDown(event) {
    if (event.key === 'Enter') {
      event.preventDefault();
      amountRef.current?.focus();
    }
  }

  function handleRetryTransaction(transaction) {
    paymentRequestKeyRef.current = '';
    setPhone(formatKenyanPhoneInput(transaction.phone));
    setAmount(String(Math.round(Number(transaction.amount || 0)) || ''));
    setStatus('idle');
    setMessage('Review the details, then press PAY to retry.');
    window.setTimeout(() => amountRef.current?.focus(), 0);
  }

  return (
    <main className="relative min-h-screen overflow-y-auto bg-[linear-gradient(180deg,hsl(var(--background)),hsl(var(--secondary)/0.34))] px-5 py-5 text-foreground lg:h-screen lg:overflow-hidden">
      <div className="absolute left-5 top-5 z-20">
        <Button
          aria-label="Menu"
          className="h-11 w-11 rounded-lg transition-transform active:scale-95"
          size="icon"
          variant="outline"
          onClick={() => setIsMenuOpen((current) => !current)}
        >
          {isMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>

        {isMenuOpen ? (
          <div className="mt-2 w-72 rounded-lg border bg-card p-3 shadow-xl shadow-black/10">
            <p className="truncate px-2 py-2 text-sm font-medium">{profile?.email}</p>
            <p className="truncate px-2 pb-2 text-xs text-muted-foreground">
              Branch {branchId || 'not assigned'}
            </p>
            <Button
              className="w-full justify-start"
              variant="ghost"
              onClick={() => {
                setIsSettingsOpen(true);
                setIsMenuOpen(false);
              }}
            >
              <Settings className="h-4 w-4" />
              Settings
            </Button>
            <Button
              className="w-full justify-start"
              variant="ghost"
              onClick={() => {
                setIsAboutOpen(true);
                setIsMenuOpen(false);
              }}
            >
              <Info className="h-4 w-4" />
              About
            </Button>
            <Button className="w-full justify-start" variant="ghost" onClick={onLogout}>
              <LogOut className="h-4 w-4" />
              Logout
            </Button>
          </div>
        ) : null}
      </div>

      <section
        className={`mx-auto grid min-h-[calc(100vh-40px)] gap-5 pt-14 lg:h-[calc(100vh-40px)] lg:min-h-0 lg:pt-0 ${
          isSimpleMode
            ? 'max-w-3xl place-items-center lg:grid-cols-1'
            : 'max-w-6xl lg:grid-cols-[minmax(0,1fr)_390px]'
        }`}
      >
        <div className="py-1 pr-1 lg:flex lg:min-h-0 lg:items-center lg:overflow-y-auto">
          <form
            className={`w-full rounded-xl border bg-card p-6 shadow-xl shadow-black/5 transition-all duration-200 sm:p-8 ${
              displayStatus === 'success' ? 'border-emerald-300 payment-success-glow dark:border-emerald-900' : ''
            }`}
            onSubmit={handleSubmit}
          >
            <div className="mb-6 flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Payment terminal</p>
                <h1 className="mt-1 text-2xl font-semibold tracking-normal">Collect M-Pesa payment</h1>
              </div>
              <StatusPill status={displayStatus} />
            </div>

            <div className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="phone">Customer phone</Label>
                <div className="relative">
                  <Phone className="absolute left-4 top-4 h-5 w-5 text-muted-foreground" />
                  <Input
                    ref={phoneRef}
                    id="phone"
                    className="h-14 rounded-lg pl-12 text-xl tracking-normal"
                    inputMode="tel"
                    placeholder="0712 345 678"
                    value={phone}
                    onChange={(event) => handlePhoneChange(event.target.value)}
                    onKeyDown={handlePhoneKeyDown}
                    required
                  />
                </div>
                {phone && !normalizedPhone ? (
                  <p className="text-xs text-red-600 dark:text-red-400">
                    Use a Safaricom 07XX or 01XX number assigned to STK Push.
                  </p>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="amount">Amount</Label>
                <div className="rounded-xl border bg-background px-4 py-4">
                  <div className="mb-1 text-center text-xs font-medium text-muted-foreground">KES</div>
                  <Input
                    ref={amountRef}
                    id="amount"
                    className="h-20 border-0 bg-transparent text-center text-5xl font-semibold tracking-normal shadow-none focus-visible:ring-0"
                    inputMode="numeric"
                    min="1"
                    step="1"
                    type="number"
                    value={amount}
                    onChange={(event) => handleAmountChange(event.target.value)}
                    required
                  />
                </div>
              </div>
            </div>

            <Button
              className="mt-6 h-16 w-full rounded-xl text-lg font-semibold tracking-wide shadow-lg shadow-primary/20 transition-all duration-200 active:scale-[0.99]"
              type="submit"
              disabled={isSubmitting || !canPay}
            >
              {isSubmitting ? <Loader2 className="h-6 w-6 animate-spin" /> : <Send className="h-6 w-6" />}
              PAY
            </Button>

            <PaymentStatePanel
              status={displayStatus}
              message={message}
              transaction={currentTransaction}
              onRetry={handleRetryTransaction}
            />
          </form>
        </div>

        {!isSimpleMode ? (
          <section className="flex min-h-[360px] flex-col rounded-xl border bg-card p-4 shadow-sm lg:min-h-0">
            <div className="mb-3 flex shrink-0 items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold">Recent transactions</h2>
                <p className="text-xs text-muted-foreground">Tap a row for receipt details.</p>
              </div>
              <ReceiptText className="h-4 w-4 text-muted-foreground" />
            </div>

            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
              {transactions.length ? (
                visibleTransactions.map((transaction) => (
                  <button
                    className="grid w-full grid-cols-[1fr_auto] gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors hover:bg-secondary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    key={transaction.id}
                    type="button"
                    onClick={() => setSelectedTransactionId(transaction.id)}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{formatPhoneForReceipt(transaction.phone)}</p>
                      <p className="text-xs text-muted-foreground">{formatTimestamp(transaction.created_at)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold">{formatCurrency(transaction.amount)}</p>
                      <StatusPill status={transaction.status || 'pending_pin'} />
                    </div>
                  </button>
                ))
              ) : (
                <p className="rounded-lg border border-dashed px-3 py-8 text-center text-sm text-muted-foreground">
                  No transactions yet.
                </p>
              )}
            </div>

            {hiddenTransactionCount ? (
              <Button
                className="mt-3 h-9 shrink-0"
                type="button"
                variant="outline"
                onClick={() => setIsHistoryExpanded((current) => !current)}
              >
                {isHistoryExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                {isHistoryExpanded ? 'Show less' : `See more (${hiddenTransactionCount})`}
              </Button>
            ) : null}
          </section>
        ) : null}
      </section>

      {selectedTransaction ? (
        <TransactionDetailsModal
          branchId={branchId}
          transaction={selectedTransaction}
          onClose={() => setSelectedTransactionId('')}
        />
      ) : null}

      {isSettingsOpen ? (
        <CashierSettingsModal
          cashierMode={cashierMode}
          onClose={() => setIsSettingsOpen(false)}
          onModeChange={(nextMode) => {
            onCashierModeChange?.(nextMode);
            setIsSettingsOpen(false);
          }}
        />
      ) : null}

      {isAboutOpen ? <AboutModal onClose={() => setIsAboutOpen(false)} /> : null}

      {!isSimpleMode ? <div className="fixed bottom-3 right-4 text-xs text-muted-foreground">v{version}</div> : null}
    </main>
  );
}

function PaymentStatePanel({ message, onRetry, status, transaction }) {
  if (activeStatuses.includes(status)) {
    return (
      <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
        <div className="flex items-center gap-3">
          <div className="relative flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900">
            <span className="absolute h-10 w-10 animate-ping rounded-full bg-amber-300/40" />
            <Smartphone className="relative h-5 w-5" />
          </div>
          <div>
            <p className="font-semibold">Waiting for customer PIN</p>
            <p className="text-sm">Check customer phone. The terminal remains ready.</p>
          </div>
        </div>
      </div>
    );
  }

  if (status === 'success') {
    return (
      <div className="mt-5 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200">
        <div className="flex items-center gap-3">
          <div className="success-check flex h-11 w-11 items-center justify-center rounded-full bg-emerald-600 text-white">
            <CheckCircle2 className="h-7 w-7" />
          </div>
          <div className="min-w-0">
            <p className="font-semibold">Payment confirmed</p>
            <p className="truncate text-sm">
              {transaction?.mpesa_receipt || 'Receipt received'} . {formatCurrency(transaction?.amount)}
            </p>
            <p className="text-xs">{formatTimestamp(transaction?.updated_at || transaction?.created_at)}</p>
          </div>
        </div>
      </div>
    );
  }

  if (failedStatuses.includes(status)) {
    return (
      <div className="mt-5 rounded-lg border border-red-200 bg-red-50 p-4 text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 dark:bg-red-900">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div>
            <p className="font-semibold">{status === 'timeout' ? 'Payment timed out' : 'Payment not completed'}</p>
            <p className="text-sm">{message || 'Ask the customer to retry when ready.'}</p>
            {transaction ? (
              <Button
                className="mt-3 h-9 border-red-300 bg-white text-red-700 hover:bg-red-50 dark:border-red-900 dark:bg-red-950 dark:text-red-200 dark:hover:bg-red-900"
                type="button"
                variant="outline"
                onClick={() => onRetry(transaction)}
              >
                Retry payment
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-5 flex items-center gap-2 rounded-lg border bg-secondary/40 px-4 py-3 text-sm text-muted-foreground">
      <Clock3 className="h-4 w-4" />
      {message || 'Ready for next payment.'}
    </div>
  );
}

function TransactionDetailsModal({ branchId, onClose, transaction }) {
  const isSuccess = transaction.status === 'success';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <section className="w-full max-w-lg rounded-xl border bg-card p-5 shadow-2xl">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Payment receipt</p>
            <h2 className="mt-1 text-xl font-semibold tracking-normal">{formatCurrency(transaction.amount)}</h2>
          </div>
          <Button aria-label="Close receipt" size="icon" variant="outline" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className={`mb-4 rounded-lg border p-4 ${isSuccess ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950' : 'bg-secondary/40'}`}>
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-medium">Status</span>
            <StatusPill status={transaction.status || 'pending_pin'} />
          </div>
        </div>

        <div className="grid gap-3 text-sm">
          <ReceiptRow label="Phone" value={formatPhoneForReceipt(transaction.phone)} />
          <ReceiptRow label="Amount" value={formatCurrency(transaction.amount)} />
          <ReceiptRow label="Receipt number" value={transaction.mpesa_receipt || '-'} />
          <ReceiptRow label="Branch" value={branchId || transaction.branch_id || '-'} />
          <ReceiptRow label="Created" value={formatTimestamp(transaction.created_at)} />
          <ReceiptRow label="Updated" value={formatTimestamp(transaction.updated_at)} />
          <ReceiptRow label="Checkout request ID" value={transaction.checkout_request_id || '-'} mono />
          {transaction.failure_reason ? (
            <ReceiptRow label="Failure reason" value={transaction.failure_reason} />
          ) : null}
        </div>
      </section>
    </div>
  );
}

function ReceiptRow({ label, mono = false, value }) {
  return (
    <div className="grid gap-1 rounded-md border px-3 py-2 sm:grid-cols-[150px_1fr]">
      <span className="text-xs font-medium uppercase text-muted-foreground">{label}</span>
      <span className={`min-w-0 break-words ${mono ? 'font-mono text-xs' : 'font-medium'}`}>{value}</span>
    </div>
  );
}

function formatKenyanPhoneInput(value) {
  const raw = String(value || '').trim();
  const hasPlus = raw.startsWith('+');
  const digits = raw.replace(/\D/g, '').slice(0, 12);

  if (!digits) {
    return '';
  }

  if (digits.startsWith('254')) {
    const body = digits.slice(3);
    const prefix = hasPlus ? '+254' : '254';
    return [prefix, body.slice(0, 3), body.slice(3, 6), body.slice(6, 9)].filter(Boolean).join(' ');
  }

  if (digits.startsWith('0')) {
    return [digits.slice(0, 4), digits.slice(4, 7), digits.slice(7, 10)].filter(Boolean).join(' ');
  }

  if ((digits.startsWith('7') || digits.startsWith('1')) && digits.length <= 9) {
    return [digits.slice(0, 3), digits.slice(3, 6), digits.slice(6, 9)].filter(Boolean).join(' ');
  }

  return digits;
}

function normalizeKenyanPhone(value) {
  const digits = String(value || '').replace(/\D/g, '');
  let localDigits = '';

  if (/^0(7|1)\d{8}$/.test(digits)) {
    localDigits = digits;
  } else if (/^254(7|1)\d{8}$/.test(digits)) {
    localDigits = `0${digits.slice(3)}`;
  } else if (/^(7|1)\d{8}$/.test(digits)) {
    localDigits = `0${digits}`;
  }

  if (!localDigits || !SAFARICOM_PREFIXES.has(localDigits.slice(0, 4))) {
    return '';
  }

  return `254${localDigits.slice(1)}`;
}

function ensurePaymentRequestKey(ref) {
  if (!ref.current) {
    ref.current =
      window.crypto?.randomUUID?.() ||
      `cashier-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }

  return ref.current;
}

function formatPhoneForReceipt(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (/^254(7|1)\d{8}$/.test(digits)) {
    return `+254 ${digits.slice(3, 6)} ${digits.slice(6, 9)} ${digits.slice(9)}`;
  }
  return value || '-';
}

function toFriendlyPaymentError(error) {
  const message = error.response?.data?.message || '';

  if (/branch/i.test(message)) {
    return 'This cashier is not linked to a branch. Ask an admin to check branch setup.';
  }

  if (/phone/i.test(message)) {
    return 'The phone number is not valid for M-Pesa STK Push.';
  }

  if (/amount/i.test(message)) {
    return 'The amount is not valid. Enter a whole amount greater than zero.';
  }

  if (/network|timeout|failed/i.test(error.message || '')) {
    return 'Network issue while sending the request. Please retry.';
  }

  return 'Payment request could not be sent. Please retry.';
}

function buildStateMessage(transaction) {
  if (activeStatuses.includes(transaction.status)) {
    return 'Waiting for customer PIN. Ask the customer to check their phone.';
  }

  if (transaction.status === 'success') {
    return 'Payment confirmed.';
  }

  if (transaction.status === 'timeout') {
    return 'The customer did not respond in time. You can retry safely.';
  }

  if (transaction.status === 'cancelled') {
    return 'The customer cancelled the payment. You can retry when ready.';
  }

  if (transaction.status === 'failed') {
    return transaction.failure_reason || 'Payment could not be completed. Please retry.';
  }

  return 'Ready for next payment.';
}

function formatCurrency(value) {
  return `KES ${Number(value || 0).toLocaleString()}`;
}

function formatTimestamp(value) {
  if (!value) {
    return '-';
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(value));
}
