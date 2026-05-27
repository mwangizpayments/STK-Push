import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  Building2,
  CalendarDays,
  CreditCard,
  LayoutDashboard,
  Loader2,
  LogOut,
  Pencil,
  Plus,
  ReceiptText,
  RefreshCcw,
  Search,
  Trash2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { StatusPill } from '@/components/StatusPill';
import { api } from '@/lib/apiClient';

const emptyDashboard = {
  totals: {
    total_count: 0,
    pending_count: 0,
    success_count: 0,
    failed_count: 0,
    total_amount: 0,
    success_rate: 0,
    failed_rate: 0
  },
  branches: [],
  branch_performance: [],
  revenue_over_time: [],
  volume_by_hour: []
};

const timeRanges = [
  { label: 'Today', value: 'today' },
  { label: 'Last 7 days', value: 'last_7_days' },
  { label: 'Last 30 days', value: 'last_30_days' },
  { label: 'Last 12 months', value: 'last_12_months' },
  { label: 'Custom', value: 'custom' }
];

const pages = [
  { icon: LayoutDashboard, label: 'Dashboard', value: 'dashboard' },
  { icon: ReceiptText, label: 'Transactions', value: 'transactions' },
  { icon: Building2, label: 'Branch Setup', value: 'branches' }
];

export function AdminDashboard({ onLogout, profile }) {
  const [activePage, setActivePage] = useState('dashboard');
  const [dashboard, setDashboard] = useState(emptyDashboard);
  const [cashiers, setCashiers] = useState([]);
  const [range, setRange] = useState('last_7_days');
  const [customRange, setCustomRange] = useState({ date_from: '', date_to: '' });
  const [transactions, setTransactions] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, page_size: 10, total: 0, total_pages: 1 });
  const [transactionFilters, setTransactionFilters] = useState({
    branch_id: '',
    date_from: '',
    date_to: '',
    search: '',
    status: ''
  });
  const [branchForm, setBranchForm] = useState({
    email: '',
    name: '',
    passkey: '',
    password: '',
    shortcode: '',
    till_number: ''
  });
  const [editingBranch, setEditingBranch] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSavingBranch, setIsSavingBranch] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const branches = dashboard.branches || [];
  const branchMap = useMemo(() => new Map(branches.map((branch) => [branch.id, branch])), [branches]);

  const dashboardParams = useMemo(() => {
    if (range === 'custom') {
      return {
        date_from: customRange.date_from || undefined,
        date_to: customRange.date_to || undefined,
        range
      };
    }

    return { range };
  }, [customRange, range]);

  const loadDashboard = useCallback(async () => {
    setIsLoading(true);
    setError('');

    try {
      const { data } = await api.get('/api/dashboard', { params: dashboardParams });
      setDashboard({ ...emptyDashboard, ...data });
    } catch (requestError) {
      setError(requestError.response?.data?.message || requestError.message);
    } finally {
      setIsLoading(false);
    }
  }, [dashboardParams]);

  const loadCashiers = useCallback(async () => {
    try {
      const { data } = await api.get('/api/cashiers');
      setCashiers(data.cashiers || []);
    } catch (requestError) {
      setError(requestError.response?.data?.message || requestError.message);
    }
  }, []);

  const loadTransactions = useCallback(async () => {
    setIsLoading(true);
    setError('');

    try {
      const { data } = await api.get('/api/transactions', {
        params: {
          ...transactionFilters,
          page: pagination.page,
          page_size: pagination.page_size
        }
      });
      setTransactions(data.transactions || []);
      setPagination((current) => ({ ...current, ...(data.pagination || {}) }));
    } catch (requestError) {
      setError(requestError.response?.data?.message || requestError.message);
    } finally {
      setIsLoading(false);
    }
  }, [pagination.page, pagination.page_size, transactionFilters]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    loadCashiers();
  }, [loadCashiers]);

  useEffect(() => {
    if (activePage === 'transactions') {
      loadTransactions();
    }
  }, [activePage, loadTransactions]);

  async function refreshAll() {
    await Promise.all([loadDashboard(), loadCashiers()]);
    if (activePage === 'transactions') {
      await loadTransactions();
    }
  }

  async function handleCreateBranch(event) {
    event.preventDefault();
    setError('');
    setNotice('');
    setIsSavingBranch(true);

    try {
      const { data } = await api.post('/api/branches', branchForm);
      setBranchForm({
        email: '',
        name: '',
        passkey: '',
        password: '',
        shortcode: '',
        till_number: ''
      });
      setNotice(`Branch created for ${data.cashier.email}`);
      await refreshAll();
    } catch (requestError) {
      setError(requestError.response?.data?.message || requestError.message);
    } finally {
      setIsSavingBranch(false);
    }
  }

  async function handleUpdateBranch(event) {
    event.preventDefault();
    if (!editingBranch) {
      return;
    }

    setError('');
    setNotice('');
    setIsSavingBranch(true);

    try {
      const { data } = await api.put(`/api/branches/${editingBranch.id}`, editingBranch);
      setEditingBranch(null);
      setNotice(`Branch updated: ${data.branch.name}`);
      await refreshAll();
    } catch (requestError) {
      setError(requestError.response?.data?.message || requestError.message);
    } finally {
      setIsSavingBranch(false);
    }
  }

  async function handleDeleteBranch(branch) {
    setError('');
    setNotice('');

    try {
      await api.delete(`/api/branches/${branch.id}`);
      setNotice(`Branch removed: ${branch.name}`);
      await refreshAll();
    } catch (requestError) {
      setError(requestError.response?.data?.message || requestError.message);
    }
  }

  function setFilter(key, value) {
    setPagination((current) => ({ ...current, page: 1 }));
    setTransactionFilters((current) => ({ ...current, [key]: value }));
  }

  return (
    <main className="flex min-h-screen bg-background">
      <aside className="flex h-screen w-72 shrink-0 flex-col border-r bg-white">
        <div className="border-b px-5 py-5">
          <p className="text-lg font-semibold">Mwangiz Admin</p>
          <p className="truncate text-xs text-muted-foreground">{profile?.email}</p>
        </div>

        <nav className="flex-1 space-y-2 px-3 py-4">
          {pages.map((page) => {
            const Icon = page.icon;
            return (
              <Button
                className="w-full justify-start"
                key={page.value}
                variant={activePage === page.value ? 'secondary' : 'ghost'}
                onClick={() => setActivePage(page.value)}
              >
                <Icon className="h-4 w-4" />
                {page.label}
              </Button>
            );
          })}
        </nav>

        <div className="border-t p-4">
          <Button className="w-full justify-start" variant="outline" onClick={onLogout}>
            <LogOut className="h-4 w-4" />
            Logout
          </Button>
        </div>
      </aside>

      <section className="min-w-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-7xl px-8 py-8">
          <div className="mb-6 flex items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-semibold tracking-normal">{pageTitle(activePage)}</h1>
              <p className="mt-1 text-sm text-muted-foreground">Admin access across all branches.</p>
            </div>
            <Button variant="outline" onClick={refreshAll} disabled={isLoading}>
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
              Refresh
            </Button>
          </div>

          {notice ? (
            <div className="mb-6 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              {notice}
            </div>
          ) : null}

          {error ? (
            <div className="mb-6 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          {activePage === 'dashboard' ? (
            <DashboardPage
              customRange={customRange}
              dashboard={dashboard}
              range={range}
              setCustomRange={setCustomRange}
              setRange={setRange}
            />
          ) : null}

          {activePage === 'transactions' ? (
            <TransactionsPage
              branchMap={branchMap}
              branches={branches}
              filters={transactionFilters}
              pagination={pagination}
              setFilter={setFilter}
              setPagination={setPagination}
              transactions={transactions}
            />
          ) : null}

          {activePage === 'branches' ? (
            <BranchSetupPage
              branchForm={branchForm}
              branches={branches}
              cashiers={cashiers}
              editingBranch={editingBranch}
              handleCreateBranch={handleCreateBranch}
              handleDeleteBranch={handleDeleteBranch}
              handleUpdateBranch={handleUpdateBranch}
              isSavingBranch={isSavingBranch}
              setBranchForm={setBranchForm}
              setEditingBranch={setEditingBranch}
            />
          ) : null}
        </div>
      </section>
    </main>
  );
}

function DashboardPage({ customRange, dashboard, range, setCustomRange, setRange }) {
  const totals = dashboard.totals || emptyDashboard.totals;

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-center gap-2">
        {timeRanges.map((item) => (
          <Button
            key={item.value}
            size="sm"
            variant={range === item.value ? 'default' : 'outline'}
            onClick={() => setRange(item.value)}
          >
            {item.label}
          </Button>
        ))}
        {range === 'custom' ? (
          <div className="ml-2 flex items-center gap-2">
            <Input
              type="date"
              value={customRange.date_from}
              onChange={(event) => setCustomRange((current) => ({ ...current, date_from: event.target.value }))}
            />
            <Input
              type="date"
              value={customRange.date_to}
              onChange={(event) => setCustomRange((current) => ({ ...current, date_to: event.target.value }))}
            />
          </div>
        ) : null}
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        <Metric icon={ReceiptText} label="Total transactions" value={totals.total_count} />
        <Metric
          icon={CreditCard}
          label="Total revenue"
          value={`KES ${Number(totals.total_amount || 0).toLocaleString()}`}
        />
        <Metric icon={BarChart3} label="Success rate" tone="success" value={`${totals.success_rate || 0}%`} />
        <Metric icon={BarChart3} label="Failed rate" tone="failed" value={`${totals.failed_rate || 0}%`} />
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <ChartCard title="Revenue over time">
          <LineChart data={dashboard.revenue_over_time || []} />
        </ChartCard>
        <ChartCard title="Branch performance comparison">
          <BranchBarChart data={dashboard.branch_performance || []} />
        </ChartCard>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <ChartCard title="Transaction volume by time of day">
          <HourlyBarChart data={dashboard.volume_by_hour || []} />
        </ChartCard>
        <ChartCard title="Transactions per branch">
          <BranchList data={dashboard.branch_performance || []} />
        </ChartCard>
      </section>
    </div>
  );
}

function TransactionsPage({ branchMap, branches, filters, pagination, setFilter, setPagination, transactions }) {
  return (
    <div className="space-y-5">
      <section className="grid gap-3 rounded-lg border bg-card p-4 shadow-sm lg:grid-cols-[1fr_180px_160px_160px_160px]">
        <div className="space-y-2">
          <Label htmlFor="search">Search</Label>
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9"
              id="search"
              placeholder="Phone or receipt"
              value={filters.search}
              onChange={(event) => setFilter('search', event.target.value)}
            />
          </div>
        </div>
        <SelectField label="Branch" value={filters.branch_id} onChange={(value) => setFilter('branch_id', value)}>
          <option value="">All branches</option>
          {branches.map((branch) => (
            <option key={branch.id} value={branch.id}>
              {branch.name}
            </option>
          ))}
        </SelectField>
        <SelectField label="Status" value={filters.status} onChange={(value) => setFilter('status', value)}>
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="success">Success</option>
          <option value="failed">Failed</option>
        </SelectField>
        <DateField label="From" value={filters.date_from} onChange={(value) => setFilter('date_from', value)} />
        <DateField label="To" value={filters.date_to} onChange={(value) => setFilter('date_to', value)} />
      </section>

      <section className="overflow-hidden rounded-lg border bg-card shadow-sm">
        <table className="w-full border-collapse text-left text-sm">
          <thead className="bg-secondary text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Transaction ID</th>
              <th className="px-4 py-3">Branch</th>
              <th className="px-4 py-3">Phone</th>
              <th className="px-4 py-3">Amount</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">M-Pesa receipt</th>
              <th className="px-4 py-3">Timestamp</th>
            </tr>
          </thead>
          <tbody>
            {transactions.length ? (
              transactions.map((transaction) => (
                <tr className="border-t" key={transaction.id}>
                  <td className="max-w-48 truncate px-4 py-3 font-mono text-xs">{transaction.id}</td>
                  <td className="px-4 py-3">{branchMap.get(transaction.branch_id)?.name || transaction.branch_id}</td>
                  <td className="px-4 py-3">{transaction.phone}</td>
                  <td className="px-4 py-3">KES {Number(transaction.amount || 0).toLocaleString()}</td>
                  <td className="px-4 py-3">
                    <StatusPill status={transaction.status || 'pending'} />
                  </td>
                  <td className="px-4 py-3">{transaction.mpesa_receipt || '-'}</td>
                  <td className="px-4 py-3">{formatTimestamp(transaction.created_at)}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td className="px-4 py-6 text-center text-muted-foreground" colSpan="7">
                  No transactions found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Page {pagination.page} of {pagination.total_pages} · {pagination.total} records
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            disabled={pagination.page <= 1}
            onClick={() => setPagination((current) => ({ ...current, page: current.page - 1 }))}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            disabled={pagination.page >= pagination.total_pages}
            onClick={() => setPagination((current) => ({ ...current, page: current.page + 1 }))}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}

function BranchSetupPage({
  branchForm,
  branches,
  cashiers,
  editingBranch,
  handleCreateBranch,
  handleDeleteBranch,
  handleUpdateBranch,
  isSavingBranch,
  setBranchForm,
  setEditingBranch
}) {
  const cashierByBranch = useMemo(
    () => new Map(cashiers.map((cashier) => [cashier.branch_id, cashier])),
    [cashiers]
  );

  return (
    <div className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
      <section className="space-y-6">
        <form className="rounded-lg border bg-card p-5 shadow-sm" onSubmit={handleCreateBranch}>
          <div className="mb-5 flex items-center gap-2">
            <Plus className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Create branch</h2>
          </div>
          <div className="space-y-4">
            <TextField
              label="Branch name"
              value={branchForm.name}
              onChange={(value) => setBranchForm((current) => ({ ...current, name: value }))}
              required
            />
            <TextField
              label="Branch user email"
              type="email"
              value={branchForm.email}
              onChange={(value) => setBranchForm((current) => ({ ...current, email: value }))}
              required
            />
            <TextField
              label="Branch user password"
              minLength={6}
              type="password"
              value={branchForm.password}
              onChange={(value) => setBranchForm((current) => ({ ...current, password: value }))}
              required
            />
            <div className="grid gap-4 md:grid-cols-2">
              <TextField
                label="Till number"
                value={branchForm.till_number}
                onChange={(value) => setBranchForm((current) => ({ ...current, till_number: value }))}
                required
              />
              <TextField
                label="Shortcode"
                value={branchForm.shortcode}
                onChange={(value) => setBranchForm((current) => ({ ...current, shortcode: value }))}
                required
              />
            </div>
            <TextField
              label="Daraja passkey"
              type="password"
              value={branchForm.passkey}
              onChange={(value) => setBranchForm((current) => ({ ...current, passkey: value }))}
            />
          </div>
          <Button className="mt-5 w-full" type="submit" disabled={isSavingBranch}>
            {isSavingBranch ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Create branch and cashier
          </Button>
        </form>

        {editingBranch ? (
          <form className="rounded-lg border bg-card p-5 shadow-sm" onSubmit={handleUpdateBranch}>
            <div className="mb-5 flex items-center gap-2">
              <Pencil className="h-5 w-5 text-accent" />
              <h2 className="text-lg font-semibold">Edit branch</h2>
            </div>
            <div className="space-y-4">
              <TextField
                label="Branch name"
                value={editingBranch.name || ''}
                onChange={(value) => setEditingBranch((current) => ({ ...current, name: value }))}
                required
              />
              <div className="grid gap-4 md:grid-cols-2">
                <TextField
                  label="Till number"
                  value={editingBranch.till_number || ''}
                  onChange={(value) => setEditingBranch((current) => ({ ...current, till_number: value }))}
                />
                <TextField
                  label="Shortcode"
                  value={editingBranch.shortcode || ''}
                  onChange={(value) => setEditingBranch((current) => ({ ...current, shortcode: value }))}
                />
              </div>
              <TextField
                label="New Daraja passkey"
                type="password"
                value={editingBranch.passkey || ''}
                onChange={(value) => setEditingBranch((current) => ({ ...current, passkey: value }))}
              />
            </div>
            <div className="mt-5 flex gap-2">
              <Button type="submit" disabled={isSavingBranch}>
                Save changes
              </Button>
              <Button type="button" variant="outline" onClick={() => setEditingBranch(null)}>
                Cancel
              </Button>
            </div>
          </form>
        ) : null}
      </section>

      <section className="rounded-lg border bg-card p-5 shadow-sm">
        <h2 className="mb-5 text-lg font-semibold">Branches</h2>
        <div className="space-y-3">
          {branches.length ? (
            branches.map((branch) => {
              const cashier = cashierByBranch.get(branch.id);
              return (
                <div className="rounded-md border p-4" key={branch.id}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="truncate font-medium">{branch.name}</p>
                        <Badge variant={branch.active === false ? 'failed' : 'outline'}>
                          {branch.active === false ? 'Inactive' : 'Active'}
                        </Badge>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Till {branch.till_number || '-'} · Shortcode {branch.shortcode || '-'}
                      </p>
                      <p className="mt-1 truncate text-sm text-muted-foreground">
                        Cashier: {cashier?.email || 'Not linked'}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button size="icon" variant="outline" onClick={() => setEditingBranch(branch)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="destructive" onClick={() => handleDeleteBranch(branch)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <p className="text-sm text-muted-foreground">No branches created yet.</p>
          )}
        </div>
      </section>
    </div>
  );
}

function Metric({ icon: Icon, label, tone = 'default', value }) {
  const toneClass = {
    default: 'text-foreground',
    success: 'text-emerald-700',
    failed: 'text-red-700'
  }[tone];

  return (
    <div className="rounded-lg border bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{label}</p>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <p className={`mt-3 text-2xl font-semibold tracking-normal ${toneClass}`}>{value}</p>
    </div>
  );
}

function ChartCard({ children, title }) {
  return (
    <div className="rounded-lg border bg-card p-5 shadow-sm">
      <h2 className="mb-4 text-lg font-semibold">{title}</h2>
      {children}
    </div>
  );
}

function LineChart({ data }) {
  const max = Math.max(...data.map((item) => Number(item.total_amount || 0)), 1);
  const width = 640;
  const height = 220;
  const points = data.map((item, index) => {
    const x = data.length === 1 ? width / 2 : (index / (data.length - 1)) * width;
    const y = height - (Number(item.total_amount || 0) / max) * (height - 20) - 10;
    return `${x},${y}`;
  });

  if (!data.length) {
    return <EmptyChart />;
  }

  return (
    <div className="h-72">
      <svg className="h-full w-full" viewBox={`0 0 ${width} ${height}`} role="img">
        <polyline fill="none" points={points.join(' ')} stroke="#0f766e" strokeWidth="4" />
        {data.map((item, index) => {
          const [x, y] = points[index].split(',').map(Number);
          return <circle cx={x} cy={y} fill="#0f766e" key={item.label} r="4" />;
        })}
      </svg>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{data[0]?.label}</span>
        <span>{data[data.length - 1]?.label}</span>
      </div>
    </div>
  );
}

function BranchBarChart({ data }) {
  const max = Math.max(...data.map((item) => Number(item.total_amount || 0)), 1);

  if (!data.length) {
    return <EmptyChart />;
  }

  return (
    <div className="space-y-3">
      {data.slice(0, 8).map((item) => (
        <div key={item.branch_id}>
          <div className="mb-1 flex justify-between gap-3 text-sm">
            <span className="truncate">{item.branch_name}</span>
            <span>KES {Number(item.total_amount || 0).toLocaleString()}</span>
          </div>
          <div className="h-3 rounded-sm bg-secondary">
            <div
              className="h-3 rounded-sm bg-primary"
              style={{ width: `${Math.max((Number(item.total_amount || 0) / max) * 100, 4)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function HourlyBarChart({ data }) {
  const max = Math.max(...data.map((item) => Number(item.total_count || 0)), 1);

  return (
    <div>
      <div className="flex h-52 items-end gap-1">
        {data.map((item) => (
          <div className="flex flex-1 flex-col items-center gap-2" key={item.hour}>
            <div
              className="w-full rounded-sm bg-accent"
              style={{ height: `${Math.max((Number(item.total_count || 0) / max) * 100, 3)}%` }}
              title={`${item.hour}:00 · ${item.total_count}`}
            />
          </div>
        ))}
      </div>
      <div className="mt-2 flex justify-between text-xs text-muted-foreground">
        <span>00:00</span>
        <span>06:00</span>
        <span>12:00</span>
        <span>18:00</span>
        <span>23:00</span>
      </div>
    </div>
  );
}

function BranchList({ data }) {
  if (!data.length) {
    return <EmptyChart />;
  }

  return (
    <div className="space-y-3">
      {data.slice(0, 8).map((item) => (
        <div className="flex items-center justify-between rounded-md border px-3 py-2" key={item.branch_id}>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{item.branch_name}</p>
            <p className="text-xs text-muted-foreground">{item.total_count} transactions</p>
          </div>
          <Badge variant="outline">KES {Number(item.total_amount || 0).toLocaleString()}</Badge>
        </div>
      ))}
    </div>
  );
}

function SelectField({ children, label, onChange, value }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <select
        className="flex h-10 w-full rounded-md border border-input bg-white px-3 py-2 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {children}
      </select>
    </div>
  );
}

function DateField({ label, onChange, value }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="relative">
        <CalendarDays className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <Input className="pl-9" type="date" value={value} onChange={(event) => onChange(event.target.value)} />
      </div>
    </div>
  );
}

function TextField({ label, onChange, value, ...props }) {
  const id = label.toLowerCase().replaceAll(' ', '-');

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} value={value} onChange={(event) => onChange(event.target.value)} {...props} />
    </div>
  );
}

function EmptyChart() {
  return (
    <div className="flex h-48 items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
      No data for this range.
    </div>
  );
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

function pageTitle(activePage) {
  if (activePage === 'transactions') {
    return 'Transactions';
  }
  if (activePage === 'branches') {
    return 'Branch Setup';
  }
  return 'Dashboard';
}

