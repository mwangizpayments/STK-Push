import { Router } from 'express';
import { createStkPush } from '../controllers/stkController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const stkRoutes = Router();

stkRoutes.post('/stkpush', requireAuth, requireRole(['admin', 'cashier']), asyncHandler(createStkPush));

