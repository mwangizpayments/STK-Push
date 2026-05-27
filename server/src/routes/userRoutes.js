import { Router } from 'express';
import { getCashiers, postCashier } from '../controllers/userController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const userRoutes = Router();

userRoutes.get('/cashiers', requireAuth, requireRole(['admin']), asyncHandler(getCashiers));
userRoutes.post('/cashiers', requireAuth, requireRole(['admin']), asyncHandler(postCashier));

