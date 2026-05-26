import { Router } from 'express';
import { handleSafaricomCallback } from '../controllers/callbackController.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const callbackRoutes = Router();

callbackRoutes.post('/callback', asyncHandler(handleSafaricomCallback));

