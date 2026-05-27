import { getDashboardStatsForRange } from '../services/dashboardService.js';

export async function getDashboard(req, res) {
  const branchId =
    req.user.role === 'cashier' && req.user.branch_id
      ? req.user.branch_id
      : req.query.branch_id || undefined;

  const dashboard = await getDashboardStatsForRange({
    branchId,
    dateFrom: req.query.date_from,
    dateTo: req.query.date_to,
    range: req.query.range
  });
  res.json(dashboard);
}
