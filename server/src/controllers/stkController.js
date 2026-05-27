import { requestStkPush } from '../services/darajaService.js';
import { env } from '../config/env.js';
import { createTransaction, updateTransactionFromCallback } from '../services/transactionRepository.js';
import { httpError } from '../utils/httpError.js';
import { normalizeAmount, normalizeMpesaPhone, requireUuid } from '../utils/validators.js';

export async function createStkPush(req, res) {
  const phone = normalizeMpesaPhone(req.body.phone);
  const amount = normalizeAmount(req.body.amount);
  let branchId;

  if (req.user.role === 'cashier') {
    if (!req.user.branch_id) {
      throw httpError(400, 'No branch is assigned to this cashier');
    }

    branchId = requireUuid(req.user.branch_id, 'cashier branch_id');
  } else {
    branchId = requireUuid(req.body.branch_id, 'branch_id');
  }

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

  scheduleMockCompletion({
    amount,
    checkoutRequestId: stk.CheckoutRequestID,
    phone
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

function scheduleMockCompletion({ amount, checkoutRequestId, phone }) {
  if (!env.daraja.useMock || !env.daraja.mockAutoComplete) {
    return;
  }

  setTimeout(() => {
    const receiptNumber = createMockReceipt();

    updateTransactionFromCallback({
      callbackPayload: {
        Body: {
          stkCallback: {
            CheckoutRequestID: checkoutRequestId,
            ResultCode: 0,
            ResultDesc: 'Mock payment completed successfully',
            CallbackMetadata: {
              Item: [
                { Name: 'Amount', Value: amount },
                { Name: 'MpesaReceiptNumber', Value: receiptNumber },
                { Name: 'PhoneNumber', Value: phone }
              ]
            }
          }
        }
      },
      checkoutRequestId,
      failureReason: null,
      receiptNumber,
      resultCode: 0,
      status: 'success'
    }).catch((error) => {
      console.error(`Mock callback failed: ${error.message}`);
    });
  }, env.daraja.mockAutoCompleteDelayMs);
}

function createMockReceipt() {
  return `MOCK${Date.now().toString().slice(-8)}`;
}
