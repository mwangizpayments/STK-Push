import { Router } from 'express';
import { getDashboard } from '../controllers/dashboardController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const dashboardRoutes = Router();

dashboardRoutes.get(
  '/dashboard',
  requireAuth,
  requireRole(['admin', 'cashier']),
  asyncHandler(getDashboard)
);

