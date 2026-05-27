import { useCallback, useEffect, useMemo, useState } from 'react';
import { format, isValid, parseISO } from 'date-fns';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  XAxis,
  YAxis
} from 'recharts';
import {
  ArrowDownRight,
  ArrowUpRight,
  Building2,
  CalendarDays,
  CircleDollarSign,
  Info,
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent
} from '@/components/ui/chart';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AboutModal } from '@/components/AboutModal';
import { StatusPill } from '@/components/StatusPill';
import { appName, iconPath } from '@/config/branding';
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
  { label: '7 days', value: 'last_7_days' },
  { label: '30 days', value: 'last_30_days' },
  { label: '12 months', value: 'last_12_months' },
  { label: 'Custom', value: 'custom' }
];

const pages = [
  { icon: LayoutDashboard, label: 'Dashboard', value: 'dashboard' },
  { icon: ReceiptText, label: 'Transactions', value: 'transactions' },
  { icon: Building2, label: 'Branch Setup', value: 'branches' }
];

const chartConfig = {
  revenue: { label: 'Revenue', color: 'hsl(var(--primary))' },
  transactions: { label: 'Transactions', color: 'hsl(var(--accent))' },
  success: { label: 'Success', color: '#059669' },
  failed: { label: 'Failed', color: '#dc2626' },
  total_amount: { label: 'Revenue', color: 'hsl(var(--primary))' },
  total_count: { label: 'Volume', color: 'hsl(var(--accent))' }
};

const defaultBranchColor = '#059669';
const branchColorOptions = [
  '#059669',
  '#2563EB',
  '#DC2626',
  '#D97706',
  '#7C3AED',
  '#0891B2',
  '#DB2777',
  '#4F46E5'
];

export function AdminDashboard({ onLogout, profile }) {
  const [activePage, setActivePage] = useState('dashboard');
  const [isAboutOpen, setIsAboutOpen] = useState(false);
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
    color_code: defaultBranchColor,
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
  const activeBranchCount = useMemo(
    () => branches.filter((branch) => branch.active !== false).length,
    [branches]
  );

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
        color_code: defaultBranchColor,
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
      setDashboard((current) => ({
        ...current,
        branches: (current.branches || []).filter((item) => item.id !== branch.id),
        branch_performance: (current.branch_performance || []).filter((item) => item.branch_id !== branch.id)
      }));
      setCashiers((current) => current.filter((cashier) => cashier.branch_id !== branch.id));
      setNotice(`Branch deleted: ${branch.name}`);
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
    <main className="flex min-h-screen bg-background text-foreground">
      <aside className="hidden h-screen w-64 shrink-0 border-r bg-card/70 backdrop-blur xl:flex xl:flex-col">
        <div className="border-b px-4 py-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-md bg-primary text-primary-foreground">
              <img alt="" className="h-full w-full object-cover" src={iconPath} />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{appName}</p>
              <p className="truncate text-xs text-muted-foreground">{profile?.email}</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 space-y-1 px-2.5 py-3">
          {pages.map((page) => {
            const Icon = page.icon;
            const active = activePage === page.value;
            return (
              <button
                className={`flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors ${
                  active
                    ? 'bg-secondary text-foreground'
                    : 'text-muted-foreground hover:bg-secondary/70 hover:text-foreground'
                }`}
                key={page.value}
                onClick={() => setActivePage(page.value)}
                type="button"
              >
                <Icon className="h-3.5 w-3.5" />
                {page.label}
              </button>
            );
          })}
        </nav>

        <div className="border-t p-3">
          <Button className="mb-2 h-9 w-full justify-start" variant="outline" onClick={() => setIsAboutOpen(true)}>
            <Info className="h-4 w-4" />
            About
          </Button>
          <Button className="h-9 w-full justify-start" variant="outline" onClick={onLogout}>
            <LogOut className="h-4 w-4" />
            Logout
          </Button>
        </div>
      </aside>

      <section className="min-w-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[1500px] px-4 py-4 sm:px-5 lg:px-6">
          <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="mb-2 flex gap-2 xl:hidden">
                {pages.map((page) => (
                  <Button
                    key={page.value}
                    size="sm"
                    variant={activePage === page.value ? 'default' : 'outline'}
                    onClick={() => setActivePage(page.value)}
                  >
                    {page.label}
                  </Button>
                ))}
              </div>
              <h1 className="text-xl font-semibold tracking-normal lg:text-2xl">{pageTitle(activePage)}</h1>
              <p className="mt-0.5 text-xs text-muted-foreground">Monitor payments and branches from one place.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button className="h-9" variant="outline" onClick={refreshAll} disabled={isLoading}>
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
                Refresh
              </Button>
              <Button className="h-9" variant="outline" onClick={() => setIsAboutOpen(true)}>
                <Info className="h-4 w-4" />
                About
              </Button>
              <Button className="h-9" variant="outline" onClick={onLogout}>
                <LogOut className="h-4 w-4" />
                Logout
              </Button>
            </div>
          </div>

          {notice ? (
            <div className="mb-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300">
              {notice}
            </div>
          ) : null}

          {error ? (
            <div className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-xs text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
              {error}
            </div>
          ) : null}

          {activePage === 'dashboard' ? (
            <DashboardPage
              activeBranchCount={activeBranchCount}
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
      {isAboutOpen ? <AboutModal onClose={() => setIsAboutOpen(false)} /> : null}
    </main>
  );
}

function DashboardPage({ activeBranchCount, customRange, dashboard, range, setCustomRange, setRange }) {
  const totals = dashboard.totals || emptyDashboard.totals;
  const revenueData = (dashboard.revenue_over_time || []).map((item) => ({
    ...item,
    total_amount: Number(item.total_amount || 0),
    chart_label: formatSeriesLabel(item.label)
  }));
  const branchData = (dashboard.branch_performance || []).slice(0, 8).map((item, index) => ({
    ...item,
    fill: getBranchColor(item, index)
  }));
  const successFailedData = [
    { fill: '#059669', name: 'Success', value: Number(totals.success_count || 0) },
    { fill: '#dc2626', name: 'Failed', value: Number(totals.failed_count || 0) }
  ].filter((item) => item.value > 0);
  const hourlyData = (dashboard.volume_by_hour || []).map((item) => ({
    ...item,
    label: String(item.hour).padStart(2, '0')
  }));

  return (
    <div className="space-y-4">
      <FilterBar customRange={customRange} range={range} setCustomRange={setCustomRange} setRange={setRange} />

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <KpiCard
          icon={CircleDollarSign}
          label="Total Revenue"
          trend="Filtered range"
          value={formatCurrency(totals.total_amount)}
        />
        <KpiCard
          icon={ReceiptText}
          label="Total Transactions"
          trend={`${totals.pending_count || 0} pending`}
          value={Number(totals.total_count || 0).toLocaleString()}
        />
        <KpiCard
          icon={ArrowUpRight}
          label="Success Rate"
          tone="success"
          trend={`${totals.success_count || 0} successful`}
          value={`${totals.success_rate || 0}%`}
        />
        <KpiCard
          icon={ArrowDownRight}
          label="Failed Transactions"
          tone="failed"
          trend={`${totals.failed_rate || 0}% failed rate`}
          value={Number(totals.failed_count || 0).toLocaleString()}
        />
        <KpiCard
          icon={Building2}
          label="Active Branches"
          trend="Receiving payments"
          value={Number(activeBranchCount || 0).toLocaleString()}
        />
      </section>

      <section className="grid gap-3 xl:grid-cols-[minmax(0,1.5fr)_minmax(280px,0.8fr)]">
        <Card className="transition-shadow hover:shadow-md">
          <CardHeader>
            <CardTitle>Revenue trend</CardTitle>
            <CardDescription>Gross payment value across the selected period.</CardDescription>
          </CardHeader>
          <CardContent>
            {revenueData.length ? (
              <ChartContainer
                className="h-[260px] w-full rounded-md border bg-background p-2"
                config={chartConfig}
              >
                <LineChart data={revenueData} margin={{ bottom: 0, left: 0, right: 10, top: 12 }}>
                  <CartesianGrid strokeDasharray="2 10" vertical={false} />
                  <XAxis dataKey="chart_label" tickLine={false} axisLine={false} tickMargin={8} />
                  <YAxis
                    domain={['auto', 'auto']}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={formatCompactCurrency}
                    width={58}
                  />
                  <ChartTooltip
                    cursor={{ stroke: 'hsl(var(--primary))', strokeDasharray: '4 4', strokeWidth: 1 }}
                    content={<ChartTooltipContent formatter={(value) => formatCurrency(value)} />}
                  />
                  <Line
                    activeDot={{
                      r: 6,
                      fill: 'hsl(var(--background))',
                      stroke: 'hsl(var(--primary))',
                      strokeWidth: 3
                    }}
                    dataKey="total_amount"
                    dot={{
                      r: 3,
                      fill: 'hsl(var(--background))',
                      stroke: 'hsl(var(--primary))',
                      strokeWidth: 2
                    }}
                    stroke="hsl(var(--primary))"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={3}
                    type="monotone"
                  />
                </LineChart>
              </ChartContainer>
            ) : (
              <EmptyState label="No revenue trend data for this range." />
            )}
          </CardContent>
        </Card>

        <Card className="transition-shadow hover:shadow-md">
          <CardHeader>
            <CardTitle>Success vs failed</CardTitle>
            <CardDescription>Callback outcomes for completed requests.</CardDescription>
          </CardHeader>
          <CardContent>
            {successFailedData.length ? (
              <ChartContainer className="h-[240px] w-full" config={chartConfig}>
                <PieChart>
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Pie
                    cx="50%"
                    cy="50%"
                    data={successFailedData}
                    dataKey="value"
                    innerRadius={56}
                    nameKey="name"
                    outerRadius={82}
                    paddingAngle={4}
                    strokeWidth={0}
                  >
                    {successFailedData.map((entry) => (
                      <Cell fill={entry.fill} key={entry.name} />
                    ))}
                  </Pie>
                </PieChart>
              </ChartContainer>
            ) : (
              <EmptyState label="No outcome data for this range." />
            )}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-3 xl:grid-cols-2">
        <Card className="transition-shadow hover:shadow-md">
          <CardHeader>
            <CardTitle>Branch performance</CardTitle>
            <CardDescription>Revenue comparison by branch.</CardDescription>
          </CardHeader>
          <CardContent>
            {branchData.length ? (
              <ChartContainer className="h-[260px] w-full" config={chartConfig}>
                <BarChart data={branchData} layout="vertical" margin={{ left: 4, right: 10 }}>
                  <CartesianGrid horizontal={false} />
                  <XAxis type="number" tickFormatter={formatCompactCurrency} />
                  <YAxis dataKey="branch_name" type="category" width={110} tickLine={false} axisLine={false} />
                  <ChartTooltip
                    content={<ChartTooltipContent formatter={(value) => formatCurrency(value)} />}
                    cursor={false}
                  />
                  <Bar dataKey="total_amount" radius={[0, 4, 4, 0]}>
                    {branchData.map((entry) => (
                      <Cell fill={entry.fill} key={entry.branch_id || entry.branch_name} />
                    ))}
                  </Bar>
                </BarChart>
              </ChartContainer>
            ) : (
              <EmptyState label="No branch revenue yet." />
            )}
          </CardContent>
        </Card>

        <Card className="transition-shadow hover:shadow-md">
          <CardHeader>
            <CardTitle>Hourly activity</CardTitle>
            <CardDescription>Transaction volume by time of day.</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer className="h-[260px] w-full" config={chartConfig}>
              <BarChart data={hourlyData} margin={{ left: 0, right: 8, top: 4 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="label" interval={2} tickLine={false} axisLine={false} />
                <YAxis tickLine={false} axisLine={false} width={36} />
                <ChartTooltip content={<ChartTooltipContent />} cursor={false} />
                <Bar dataKey="total_count" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function TransactionsPage({ branchMap, branches, filters, pagination, setFilter, setPagination, transactions }) {
  return (
    <div className="space-y-3">
      <Card>
        <CardContent className="p-3">
          <div className="grid gap-2.5 lg:grid-cols-[1fr_170px_145px_145px_145px]">
            <div className="space-y-1.5">
              <Label className="text-xs" htmlFor="search">Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  className="h-9 bg-background pl-8 text-xs"
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
              <option value="created">Created</option>
              <option value="pending_pin">Waiting PIN</option>
              <option value="processing">Processing</option>
              <option value="success">Success</option>
              <option value="failed">Failed</option>
              <option value="timeout">Timeout</option>
              <option value="cancelled">Cancelled</option>
            </SelectField>
            <DateField label="From" value={filters.date_from} onChange={(value) => setFilter('date_from', value)} />
            <DateField label="To" value={filters.date_to} onChange={(value) => setFilter('date_to', value)} />
          </div>
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <div className="max-h-[calc(100vh-230px)] overflow-auto">
          <table className="w-full min-w-[900px] border-collapse text-left text-xs">
            <thead className="sticky top-0 z-10 border-b bg-card/95 text-xs uppercase text-muted-foreground backdrop-blur">
              <tr>
                <th className="px-3 py-2 font-medium">Transaction ID</th>
                <th className="px-3 py-2 font-medium">Branch</th>
                <th className="px-3 py-2 font-medium">Phone</th>
                <th className="px-3 py-2 font-medium">Amount</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">M-Pesa receipt</th>
                <th className="px-3 py-2 font-medium">Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {transactions.length ? (
                transactions.map((transaction) => (
                  <tr className="border-b transition-colors hover:bg-secondary/40" key={transaction.id}>
                    <td className="max-w-40 truncate px-3 py-2 font-mono">{transaction.id}</td>
                    <td className="px-3 py-2">{branchMap.get(transaction.branch_id)?.name || transaction.branch_id}</td>
                    <td className="px-3 py-2">{transaction.phone}</td>
                    <td className="px-3 py-2 font-medium">{formatCurrency(transaction.amount)}</td>
                    <td className="px-3 py-2">
                      <StatusPill status={transaction.status || 'pending'} />
                    </td>
                    <td className="px-3 py-2">{transaction.mpesa_receipt || '-'}</td>
                    <td className="px-3 py-2">{formatTimestamp(transaction.created_at)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="px-3 py-8 text-center text-muted-foreground" colSpan="7">
                    No transactions found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted-foreground">
          Page {pagination.page} of {pagination.total_pages} . {pagination.total} records
        </p>
        <div className="flex gap-2">
          <Button
            className="h-9"
            variant="outline"
            disabled={pagination.page <= 1}
            onClick={() => setPagination((current) => ({ ...current, page: current.page - 1 }))}
          >
            Previous
          </Button>
          <Button
            className="h-9"
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
    <div className="grid gap-4 xl:grid-cols-[380px_minmax(0,1fr)]">
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Create branch</CardTitle>
            <CardDescription>Creates one cashier login and links it to the new branch.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-3" onSubmit={handleCreateBranch}>
              <TextField
                label="Branch name"
                value={branchForm.name}
                onChange={(value) => setBranchForm((current) => ({ ...current, name: value }))}
                required
              />
              <ColorField
                label="Graph color"
                value={branchForm.color_code}
                onChange={(value) => setBranchForm((current) => ({ ...current, color_code: value }))}
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
              <div className="grid gap-3 sm:grid-cols-2">
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
              <Button className="h-9 w-full" type="submit" disabled={isSavingBranch}>
                {isSavingBranch ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Create branch
              </Button>
            </form>
          </CardContent>
        </Card>

        {editingBranch ? (
          <Card>
            <CardHeader>
              <CardTitle>Edit branch</CardTitle>
              <CardDescription>Update branch payment identifiers.</CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-3" onSubmit={handleUpdateBranch}>
                <TextField
                  label="Branch name"
                  value={editingBranch.name || ''}
                  onChange={(value) => setEditingBranch((current) => ({ ...current, name: value }))}
                  required
                />
                <ColorField
                  label="Graph color"
                  value={editingBranch.color_code || defaultBranchColor}
                  onChange={(value) => setEditingBranch((current) => ({ ...current, color_code: value }))}
                />
                <div className="grid gap-3 sm:grid-cols-2">
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
                <div className="flex gap-2">
                  <Button className="h-9" type="submit" disabled={isSavingBranch}>
                    Save changes
                  </Button>
                  <Button className="h-9" type="button" variant="outline" onClick={() => setEditingBranch(null)}>
                    Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        ) : null}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Branches</CardTitle>
          <CardDescription>Active branches and linked cashier accounts.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2.5">
            {branches.length ? (
              branches.map((branch) => {
                const cashier = cashierByBranch.get(branch.id);
                return (
                  <div
                    className="rounded-md border p-3 transition-colors hover:bg-secondary/40"
                    key={branch.id}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            aria-hidden="true"
                            className="h-3 w-3 rounded-sm border"
                            style={{ backgroundColor: getBranchColor(branch, 0) }}
                          />
                          <p className="truncate text-sm font-medium">{branch.name}</p>
                          <Badge variant="outline">Active</Badge>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Till {branch.till_number || '-'} . Shortcode {branch.shortcode || '-'}
                        </p>
                        <p className="mt-1 truncate text-xs text-muted-foreground">
                          Cashier: {cashier?.email || 'Not linked'}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          className="h-8 w-8"
                          size="icon"
                          variant="outline"
                          onClick={() =>
                            setEditingBranch({
                              ...branch,
                              color_code: isHexColor(branch.color_code) ? branch.color_code : defaultBranchColor
                            })
                          }
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button className="h-8 w-8" size="icon" variant="destructive" onClick={() => handleDeleteBranch(branch)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <EmptyState label="No active branches." />
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function FilterBar({ customRange, range, setCustomRange, setRange }) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-2 p-2.5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-2">
          {timeRanges.map((item) => (
            <Button
              className="h-8 px-2.5 text-xs"
              key={item.value}
              size="sm"
              variant={range === item.value ? 'default' : 'outline'}
              onClick={() => setRange(item.value)}
            >
              {item.label}
            </Button>
          ))}
        </div>
        {range === 'custom' ? (
          <div className="flex flex-wrap gap-2">
            <Input
              className="h-8 w-36 bg-background text-xs"
              type="date"
              value={customRange.date_from}
              onChange={(event) => setCustomRange((current) => ({ ...current, date_from: event.target.value }))}
            />
            <Input
              className="h-8 w-36 bg-background text-xs"
              type="date"
              value={customRange.date_to}
              onChange={(event) => setCustomRange((current) => ({ ...current, date_to: event.target.value }))}
            />
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function KpiCard({ icon: Icon, label, tone = 'default', trend, value }) {
  const trendClass = tone === 'failed' ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400';
  const TrendIcon = tone === 'failed' ? ArrowDownRight : ArrowUpRight;

  return (
    <Card className="transition-all hover:-translate-y-0.5 hover:shadow-md">
      <CardContent className="p-3.5">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="mt-2 text-xl font-semibold tracking-normal">{value}</p>
          </div>
          <div className="flex h-8 w-8 items-center justify-center rounded-md border bg-secondary/70">
            <Icon className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
        </div>
        <div className={`mt-3 flex items-center gap-1 text-xs ${trendClass}`}>
          <TrendIcon className="h-3.5 w-3.5" />
          {trend}
        </div>
      </CardContent>
    </Card>
  );
}

function SelectField({ children, label, onChange, value }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <select
        className="flex h-9 w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-xs outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring"
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
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <div className="relative">
        <CalendarDays className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
        <Input className="h-9 bg-background pl-8 text-xs" type="date" value={value} onChange={(event) => onChange(event.target.value)} />
      </div>
    </div>
  );
}

function TextField({ label, onChange, value, ...props }) {
  const id = label.toLowerCase().replaceAll(' ', '-');

  return (
    <div className="space-y-1.5">
      <Label className="text-xs" htmlFor={id}>{label}</Label>
      <Input className="h-9 bg-background text-xs" id={id} value={value} onChange={(event) => onChange(event.target.value)} {...props} />
    </div>
  );
}

function ColorField({ label, onChange, value }) {
  const id = label.toLowerCase().replaceAll(' ', '-');
  const colorValue = isHexColor(value) ? value : defaultBranchColor;

  return (
    <div className="space-y-1.5">
      <Label className="text-xs" htmlFor={id}>{label}</Label>
      <div className="grid grid-cols-[46px_1fr] gap-2">
        <Input
          aria-label={label}
          className="h-9 cursor-pointer bg-background p-1"
          id={id}
          type="color"
          value={colorValue.toLowerCase()}
          onChange={(event) => onChange(event.target.value.toUpperCase())}
        />
        <Input
          className="h-9 bg-background font-mono text-xs uppercase"
          maxLength={7}
          pattern="^#[0-9A-Fa-f]{6}$"
          placeholder={defaultBranchColor}
          value={value || ''}
          onChange={(event) => onChange(event.target.value.toUpperCase())}
        />
      </div>
      <div className="flex flex-wrap gap-1.5">
        {branchColorOptions.map((color) => (
          <button
            aria-label={`Use ${color}`}
            className={`h-5 w-5 rounded-sm border transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
              colorValue.toUpperCase() === color ? 'ring-2 ring-ring ring-offset-2 ring-offset-background' : ''
            }`}
            key={color}
            style={{ backgroundColor: color }}
            title={color}
            type="button"
            onClick={() => onChange(color)}
          />
        ))}
      </div>
    </div>
  );
}

function EmptyState({ label }) {
  return (
    <div className="flex min-h-32 items-center justify-center rounded-md border border-dashed text-xs text-muted-foreground">
      {label}
    </div>
  );
}

function formatCurrency(value) {
  return `KES ${Number(value || 0).toLocaleString()}`;
}

function getBranchColor(branch, index = 0) {
  if (isHexColor(branch?.color_code)) {
    return branch.color_code;
  }

  return branchColorOptions[index % branchColorOptions.length] || defaultBranchColor;
}

function isHexColor(value) {
  return /^#[0-9a-f]{6}$/i.test(String(value || ''));
}

function formatCompactCurrency(value) {
  const number = Number(value || 0);
  if (number >= 1000000) {
    return `KES ${Math.round(number / 1000000)}M`;
  }
  if (number >= 1000) {
    return `KES ${Math.round(number / 1000)}K`;
  }
  return `KES ${number}`;
}

function formatSeriesLabel(label) {
  if (!label) {
    return '';
  }

  const normalized = label.length === 7 ? `${label}-01` : label;
  const parsed = parseISO(normalized);

  if (!isValid(parsed)) {
    return label;
  }

  return label.length === 7 ? format(parsed, 'MMM yy') : format(parsed, 'MMM d');
}

function formatTimestamp(value) {
  if (!value) {
    return '-';
  }

  const parsed = new Date(value);
  if (!isValid(parsed)) {
    return '-';
  }

  return format(parsed, 'MMM d, yyyy h:mm a');
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
