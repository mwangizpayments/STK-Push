import { Router } from 'express';
import { postBranch } from '../controllers/branchController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const branchRoutes = Router();

branchRoutes.post('/branches', requireAuth, requireRole(['admin']), asyncHandler(postBranch));

