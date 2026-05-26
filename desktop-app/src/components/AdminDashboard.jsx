import { useEffect, useState } from 'react';
import { Building2, Loader2, RefreshCcw, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/apiClient';

const emptyStats = {
  totals: {
    total_count: 0,
    pending_count: 0,
    success_count: 0,
    failed_count: 0,
    total_amount: 0
  },
  branches: []
};

export function AdminDashboard() {
  const [dashboard, setDashboard] = useState(emptyStats);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  async function loadDashboard() {
    setIsLoading(true);
    setError('');

    try {
      const { data } = await api.get('/api/dashboard');
      setDashboard(data);
    } catch (requestError) {
      setError(requestError.response?.data?.message || requestError.message);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadDashboard();
  }, []);

  const totals = dashboard.totals || emptyStats.totals;

  return (
    <main className="min-h-screen flex-1 overflow-y-auto">
      <div className="mx-auto max-w-6xl px-8 py-8">
        <div className="mb-8 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-normal">Admin dashboard</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Analytics and branch overview are ready for live reporting.
            </p>
          </div>
          <Button variant="outline" onClick={loadDashboard} disabled={isLoading}>
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
            Refresh
          </Button>
        </div>

        {error ? (
          <div className="mb-6 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <section className="grid gap-4 md:grid-cols-4">
          <Metric label="Transactions" value={totals.total_count} />
          <Metric label="Successful" value={totals.success_count} tone="success" />
          <Metric label="Pending" value={totals.pending_count} tone="pending" />
          <Metric label="Failed" value={totals.failed_count} tone="failed" />
        </section>

        <section className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="rounded-lg border bg-card p-6 shadow-sm">
            <div className="mb-5 flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" aria-hidden="true" />
              <h2 className="text-lg font-semibold">Analytics placeholder</h2>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <Metric label="Total amount" value={`KES ${Number(totals.total_amount || 0).toLocaleString()}`} />
              <Metric label="Success rate" value={`${calculateRate(totals.success_count, totals.total_count)}%`} />
              <Metric label="Branch count" value={dashboard.branches?.length || 0} />
            </div>
          </div>

          <div className="rounded-lg border bg-card p-6 shadow-sm">
            <div className="mb-5 flex items-center gap-2">
              <Building2 className="h-5 w-5 text-accent" aria-hidden="true" />
              <h2 className="text-lg font-semibold">Branch overview placeholder</h2>
            </div>
            <div className="space-y-3">
              {dashboard.branches?.length ? (
                dashboard.branches.map((branch) => (
                  <div className="flex items-center justify-between rounded-md border px-3 py-2" key={branch.id}>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{branch.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{branch.code || branch.id}</p>
                    </div>
                    <Badge variant="outline">{branch.till_number || branch.shortcode || 'Active'}</Badge>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No branches created yet.</p>
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function Metric({ label, tone = 'default', value }) {
  const toneClass = {
    default: 'text-foreground',
    success: 'text-emerald-700',
    pending: 'text-amber-700',
    failed: 'text-red-700'
  }[tone];

  return (
    <div className="rounded-lg border bg-card p-5 shadow-sm">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className={`mt-2 text-2xl font-semibold tracking-normal ${toneClass}`}>{value}</p>
    </div>
  );
}

function calculateRate(part, total) {
  if (!total) {
    return 0;
  }

  return Math.round((Number(part || 0) / Number(total)) * 100);
}
