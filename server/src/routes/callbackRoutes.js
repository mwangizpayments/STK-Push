import { Router } from 'express';
import { confirmCallbackUrl, handleSafaricomCallback } from '../controllers/callbackController.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const callbackRoutes = Router();

callbackRoutes.get('/callback/confirm', confirmCallbackUrl);
callbackRoutes.post('/callback', asyncHandler(handleSafaricomCallback));
