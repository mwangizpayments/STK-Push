import { getDashboardStats } from '../services/dashboardService.js';

export async function getDashboard(req, res) {
  const branchId =
    req.user.role === 'cashier' && req.user.branch_id
      ? req.user.branch_id
      : req.query.branch_id || undefined;

  const dashboard = await getDashboardStats({ branchId });
  res.json(dashboard);
}

