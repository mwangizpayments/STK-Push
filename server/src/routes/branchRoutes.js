import { Router } from 'express';
import { getBranches, postBranch, putBranch, removeBranch } from '../controllers/branchController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const branchRoutes = Router();

branchRoutes.get('/branches', requireAuth, requireRole(['admin']), asyncHandler(getBranches));
branchRoutes.post('/branches', requireAuth, requireRole(['admin']), asyncHandler(postBranch));
branchRoutes.put('/branches/:id', requireAuth, requireRole(['admin']), asyncHandler(putBranch));
branchRoutes.delete('/branches/:id', requireAuth, requireRole(['admin']), asyncHandler(removeBranch));
