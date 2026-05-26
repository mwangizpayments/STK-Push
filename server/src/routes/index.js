import { Router } from 'express';
import { branchRoutes } from './branchRoutes.js';
import { callbackRoutes } from './callbackRoutes.js';
import { dashboardRoutes } from './dashboardRoutes.js';
import { stkRoutes } from './stkRoutes.js';
import { transactionRoutes } from './transactionRoutes.js';

export const apiRoutes = Router();

apiRoutes.use(stkRoutes);
apiRoutes.use(callbackRoutes);
apiRoutes.use(transactionRoutes);
apiRoutes.use(branchRoutes);
apiRoutes.use(dashboardRoutes);

