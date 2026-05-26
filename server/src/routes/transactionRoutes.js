import { Router } from 'express';
import { getTransactions } from '../controllers/transactionController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const transactionRoutes = Router();

transactionRoutes.get(
  '/transactions',
  requireAuth,
  requireRole(['admin', 'cashier']),
  asyncHandler(getTransactions)
);

