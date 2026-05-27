import { listTransactions } from '../services/transactionRepository.js';

export async function getTransactions(req, res) {
  const branchId =
    req.user.role === 'cashier' && req.user.branch_id
      ? req.user.branch_id
      : req.query.branch_id || undefined;

  const transactions = await listTransactions({
    branchId,
    dateFrom: req.query.date_from,
    dateTo: req.query.date_to,
    limit: Number(req.query.limit || 50),
    page: req.query.page,
    pageSize: req.query.page_size || req.query.pageSize,
    search: req.query.search,
    status: req.query.status
  });

  if (Array.isArray(transactions)) {
    res.json({ transactions });
    return;
  }

  res.json(transactions);
}
