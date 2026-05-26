import { listBranches } from './branchRepository.js';
import { listTransactions } from './transactionRepository.js';

export async function getDashboardStats({ branchId } = {}) {
  const [transactions, branches] = await Promise.all([
    listTransactions({ branchId, limit: 1000 }),
    listBranches()
  ]);

  const totals = transactions.reduce(
    (summary, transaction) => {
      summary.total_count += 1;
      summary.total_amount += Number(transaction.amount || 0);
      summary.pending_count += transaction.status === 'pending' ? 1 : 0;
      summary.success_count += transaction.status === 'success' ? 1 : 0;
      summary.failed_count += transaction.status === 'failed' ? 1 : 0;
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

  return {
    totals,
    branches,
    latest_transactions: transactions.slice(0, 10)
  };
}

