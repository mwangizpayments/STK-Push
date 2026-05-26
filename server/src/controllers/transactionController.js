import { listTransactions } from '../services/transactionRepository.js';

export async function getTransactions(req, res) {
  const branchId =
    req.user.role === 'cashier' && req.user.branch_id
      ? req.user.branch_id
      : req.query.branch_id || undefined;

  const transactions = await listTransactions({
    branchId,
    limit: Number(req.query.limit || 50)
  });

  res.json({ transactions });
}

