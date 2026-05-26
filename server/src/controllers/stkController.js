import { requestStkPush } from '../services/darajaService.js';
import { createTransaction } from '../services/transactionRepository.js';
import { normalizeAmount, normalizeMpesaPhone, requireString } from '../utils/validators.js';

export async function createStkPush(req, res) {
  const phone = normalizeMpesaPhone(req.body.phone);
  const amount = normalizeAmount(req.body.amount);
  const branchId =
    req.user.role === 'cashier' && req.user.branch_id
      ? req.user.branch_id
      : requireString(req.body.branch_id, 'branch_id');

  const stk = await requestStkPush({
    amount,
    phone,
    transactionId: `${branchId}-${Date.now()}`
  });

  const transaction = await createTransaction({
    amount,
    branch_id: branchId,
    cashier_id: req.user.id,
    phone,
    merchant_request_id: stk.MerchantRequestID,
    checkout_request_id: stk.CheckoutRequestID,
    raw_request: {
      phone,
      amount,
      branch_id: branchId
    },
    raw_response: stk
  });

  res.status(201).json({
    transaction,
    stk: {
      merchant_request_id: stk.MerchantRequestID,
      checkout_request_id: stk.CheckoutRequestID,
      response_code: stk.ResponseCode,
      response_description: stk.ResponseDescription,
      customer_message: stk.CustomerMessage
    }
  });
}

