import { requestStkPush } from '../services/darajaService.js';
import { env } from '../config/env.js';
import {
  createTransaction,
  markTransactionRequestFailed,
  markTransactionStkAccepted,
  scheduleTransactionTimeout,
  updateTransactionFromCallback
} from '../services/transactionRepository.js';
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

  const createdTransaction = await createTransaction({
    amount,
    branch_id: branchId,
    cashier_id: req.user.id,
    phone,
    raw_request: {
      phone,
      amount,
      branch_id: branchId
    }
  });

  let stk;

  try {
    stk = await requestStkPush({
      amount,
      phone,
      transactionId: createdTransaction.id
    });
  } catch (error) {
    await markTransactionRequestFailed(createdTransaction.id);
    throw error;
  }

  const transaction = await markTransactionStkAccepted(createdTransaction.id, {
    checkoutRequestId: stk.CheckoutRequestID,
    merchantRequestId: stk.MerchantRequestID,
    rawResponse: stk
  });

  if (!transaction) {
    throw httpError(500, 'Payment transaction could not be updated after STK request');
  }

  console.log(
    `STK Push created: transaction=${transaction.id}, checkout=${stk.CheckoutRequestID}, status=${transaction.status}, mock=${env.daraja.useMock}`
  );

  scheduleTransactionTimeout({
    checkoutRequestId: stk.CheckoutRequestID
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
      customer_message: 'Waiting for customer PIN.',
      mode: env.daraja.useMock ? 'mock' : 'daraja',
      callback_url_configured: Boolean(env.daraja.callbackUrl)
    }
  });
}

function scheduleMockCompletion({ amount, checkoutRequestId, phone }) {
  if (!env.daraja.useMock || !env.daraja.mockAutoComplete) {
    console.log(
      `Mock auto-complete skipped: checkout=${checkoutRequestId}, mock=${env.daraja.useMock}, auto_complete=${env.daraja.mockAutoComplete}`
    );
    return;
  }

  console.log(
    `Mock auto-complete scheduled: checkout=${checkoutRequestId}, delay_ms=${env.daraja.mockAutoCompleteDelayMs}`
  );

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
    })
      .then((transaction) => {
        console.log(
          `Mock auto-complete finished: checkout=${checkoutRequestId}, updated=${Boolean(transaction)}, status=${transaction?.status || 'not_found'}`
        );
      })
      .catch((error) => {
        console.error(`Mock callback failed: checkout=${checkoutRequestId}, error=${error.message}`);
      });
  }, env.daraja.mockAutoCompleteDelayMs);
}

function createMockReceipt() {
  return `MOCK${Date.now().toString().slice(-8)}`;
}
