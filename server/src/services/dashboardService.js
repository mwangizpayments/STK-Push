import { listBranches } from './branchRepository.js';
import { listTransactions } from './transactionRepository.js';
import { ACTIVE_TRANSACTION_STATES, TRANSACTION_STATES } from './transactionState.js';

export async function getDashboardStats({ branchId } = {}) {
  return getDashboardStatsForRange({ branchId });
}

export async function getDashboardStatsForRange({ branchId, dateFrom, dateTo, range } = {}) {
  const resolvedRange = resolveDateRange({ dateFrom, dateTo, range });
  const [transactions, branches] = await Promise.all([
    listTransactions({
      branchId,
      dateFrom: resolvedRange.dateFrom,
      dateTo: resolvedRange.dateTo,
      limit: 5000
    }),
    listBranches()
  ]);

  const totals = transactions.reduce(
    (summary, transaction) => {
      const isSuccess = transaction.status === TRANSACTION_STATES.SUCCESS;
      summary.total_count += 1;
      summary.total_amount += isSuccess ? Number(transaction.amount || 0) : 0;
      summary.pending_count += isPendingStatus(transaction.status) ? 1 : 0;
      summary.success_count += isSuccess ? 1 : 0;
      summary.failed_count += isFailedStatus(transaction.status) ? 1 : 0;
      return summary;
    },
    {
      total_count: 0,
      total_amount: 0,
      pending_count: 0,
      success_count: 0,
      failed_count: 0
    }
  );

  totals.success_rate = calculateRate(totals.success_count, totals.total_count);
  totals.failed_rate = calculateRate(totals.failed_count, totals.total_count);

  const branchMap = new Map(branches.map((branch) => [branch.id, branch]));

  return {
    totals,
    range: resolvedRange,
    branches,
    branch_performance: buildBranchPerformance(transactions, branchMap),
    revenue_over_time: buildRevenueSeries(transactions, resolvedRange),
    volume_by_hour: buildHourlyVolume(transactions),
    latest_transactions: transactions.slice(0, 10)
  };
}

function resolveDateRange({ dateFrom, dateTo, range }) {
  const now = new Date();
  const end = dateTo ? new Date(dateTo) : now;
  let start;

  if (dateFrom) {
    start = new Date(dateFrom);
  } else if (range === 'today') {
    start = new Date(now);
    start.setHours(0, 0, 0, 0);
  } else if (range === 'last_12_months') {
    start = new Date(now);
    start.setMonth(start.getMonth() - 11, 1);
    start.setHours(0, 0, 0, 0);
  } else if (range === 'last_30_days') {
    start = new Date(now);
    start.setDate(start.getDate() - 29);
    start.setHours(0, 0, 0, 0);
  } else {
    start = new Date(now);
    start.setDate(start.getDate() - 6);
    start.setHours(0, 0, 0, 0);
  }

  end.setHours(23, 59, 59, 999);

  return {
    dateFrom: start.toISOString(),
    dateTo: end.toISOString(),
    range: range || 'last_7_days'
  };
}

function buildBranchPerformance(transactions, branchMap) {
  const byBranch = new Map();

  for (const transaction of transactions) {
    const isSuccess = transaction.status === TRANSACTION_STATES.SUCCESS;
    const branch = branchMap.get(transaction.branch_id);
    const current = byBranch.get(transaction.branch_id) || {
      branch_id: transaction.branch_id,
      branch_name: branch?.name || 'Unknown branch',
      color_code: branch?.color_code || '#059669',
      failed_count: 0,
      success_count: 0,
      total_amount: 0,
      total_count: 0
    };

    current.total_count += 1;
    current.total_amount += isSuccess ? Number(transaction.amount || 0) : 0;
    current.success_count += isSuccess ? 1 : 0;
    current.failed_count += isFailedStatus(transaction.status) ? 1 : 0;
    byBranch.set(transaction.branch_id, current);
  }

  return [...byBranch.values()].sort((a, b) => b.total_amount - a.total_amount);
}

function buildRevenueSeries(transactions, range) {
  const dayCount = daysBetween(range.dateFrom, range.dateTo);

  if (range.range === 'today' || dayCount <= 1) {
    return buildHourlyRevenueSeries(transactions);
  }

  if (range.range === 'last_12_months' || dayCount > 90) {
    return buildMonthlyRevenueSeries(transactions, range);
  }

  return buildDailyRevenueSeries(transactions, range);
}

function buildHourlyRevenueSeries(transactions) {
  const buckets = new Map(
    Array.from({ length: 24 }, (_, hour) => [
      String(hour).padStart(2, '0'),
      {
        granularity: 'hour',
        label: `${String(hour).padStart(2, '0')}:00`,
        total_amount: 0,
        total_count: 0
      }
    ])
  );

  for (const transaction of transactions) {
    const date = new Date(transaction.created_at);
    const key = String(date.getHours()).padStart(2, '0');
    addTransactionToRevenueBucket(buckets.get(key), transaction);
  }

  return [...buckets.values()];
}

function buildDailyRevenueSeries(transactions, range) {
  const buckets = new Map();
  const cursor = startOfDay(new Date(range.dateFrom));
  const end = startOfDay(new Date(range.dateTo));

  while (cursor.getTime() <= end.getTime()) {
    const key = formatDateKey(cursor);
    buckets.set(key, {
      granularity: 'day',
      label: key,
      total_amount: 0,
      total_count: 0
    });
    cursor.setDate(cursor.getDate() + 1);
  }

  for (const transaction of transactions) {
    const key = formatDateKey(new Date(transaction.created_at));
    addTransactionToRevenueBucket(buckets.get(key), transaction);
  }

  return [...buckets.values()];
}

function buildMonthlyRevenueSeries(transactions, range) {
  const buckets = new Map();
  const cursor = startOfMonth(new Date(range.dateFrom));
  const end = startOfMonth(new Date(range.dateTo));

  while (cursor.getTime() <= end.getTime()) {
    const key = formatMonthKey(cursor);
    buckets.set(key, {
      granularity: 'month',
      label: key,
      total_amount: 0,
      total_count: 0
    });
    cursor.setMonth(cursor.getMonth() + 1);
  }

  for (const transaction of transactions) {
    const key = formatMonthKey(new Date(transaction.created_at));
    addTransactionToRevenueBucket(buckets.get(key), transaction);
  }

  return [...buckets.values()];
}

function addTransactionToRevenueBucket(bucket, transaction) {
  if (!bucket) {
    return;
  }

  bucket.total_amount +=
    transaction.status === TRANSACTION_STATES.SUCCESS ? Number(transaction.amount || 0) : 0;
  bucket.total_count += 1;
}

function startOfDay(date) {
  const nextDate = new Date(date);
  nextDate.setHours(0, 0, 0, 0);
  return nextDate;
}

function startOfMonth(date) {
  const nextDate = new Date(date);
  nextDate.setDate(1);
  nextDate.setHours(0, 0, 0, 0);
  return nextDate;
}

function formatDateKey(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0')
  ].join('-');
}

function formatMonthKey(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0')
  ].join('-');
}

function buildHourlyVolume(transactions) {
  const hours = Array.from({ length: 24 }, (_, hour) => ({ hour, total_count: 0 }));

  for (const transaction of transactions) {
    const hour = new Date(transaction.created_at).getHours();
    hours[hour].total_count += 1;
  }

  return hours;
}

function calculateRate(part, total) {
  if (!total) {
    return 0;
  }

  return Math.round((Number(part || 0) / Number(total)) * 100);
}

function isPendingStatus(status) {
  return status === 'pending' || ACTIVE_TRANSACTION_STATES.includes(status);
}

function isFailedStatus(status) {
  return [
    TRANSACTION_STATES.FAILED,
    TRANSACTION_STATES.TIMEOUT,
    TRANSACTION_STATES.CANCELLED
  ].includes(status);
}

function daysBetween(start, end) {
  return Math.ceil((new Date(end).getTime() - new Date(start).getTime()) / 86400000);
}
