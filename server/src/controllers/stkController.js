import { requestStkPush } from '../services/darajaService.js';
import { env } from '../config/env.js';
import {
  createIdempotentTransaction,
  markTransactionRequestFailed,
  markTransactionStkAccepted,
  scheduleTransactionTimeout
} from '../services/transactionRepository.js';
import {
  createCallbackEventHash,
  recordCallbackEvent
} from '../services/callbackEventRepository.js';
import { processCallbackEvent } from '../services/callbackProcessor.js';
import { httpError } from '../utils/httpError.js';
import {
  normalizeAmount,
  normalizeMpesaPhone,
  requireIdempotencyKey,
  requireUuid
} from '../utils/validators.js';

export async function createStkPush(req, res) {
  const phone = normalizeMpesaPhone(req.body.phone);
  const amount = normalizeAmount(req.body.amount);
  const idempotencyKey = requireIdempotencyKey(
    req.header('Idempotency-Key') || req.body.idempotency_key
  );
  let branchId;

  if (req.user.role === 'cashier') {
    if (!req.user.branch_id) {
      throw httpError(400, 'No branch is assigned to this cashier');
    }

    branchId = requireUuid(req.user.branch_id, 'cashier branch_id');
  } else {
    branchId = requireUuid(req.body.branch_id, 'branch_id');
  }

  const { created, transaction: createdTransaction } = await createIdempotentTransaction({
    amount,
    branch_id: branchId,
    cashier_id: req.user.id,
    idempotency_key: idempotencyKey,
    phone,
    raw_request: {
      phone,
      amount,
      branch_id: branchId,
      idempotency_key: idempotencyKey
    }
  });

  ensureIdempotentReplayMatches(createdTransaction, {
    amount,
    branchId,
    phone
  });

  if (!created) {
    res.status(200).json({
      idempotent_replay: true,
      transaction: createdTransaction,
      stk: buildReplayStkResponse(createdTransaction)
    });
    return;
  }

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
    const callbackPayload = {
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
    };

    recordCallbackEvent({
      checkoutRequestId,
      eventHash: createCallbackEventHash(callbackPayload),
      payload: callbackPayload,
      resultCode: 0,
      mpesaReceipt: receiptNumber
    })
      .then((event) => processCallbackEvent(event.id))
      .then((result) => {
        console.log(
          `Mock auto-complete finished: checkout=${checkoutRequestId}, updated=${Boolean(result.transaction)}, status=${result.transaction?.status || 'not_found'}`
        );
      })
      .catch((error) => {
        console.error(`Mock callback failed: checkout=${checkoutRequestId}, error=${error.message}`);
      });
  }, env.daraja.mockAutoCompleteDelayMs);
}

function createMockReceipt() {
  return `MOCK${Date.now().toString().slice(-8)}${Math.floor(Math.random() * 1000)
    .toString()
    .padStart(3, '0')}`;
}

function buildReplayStkResponse(transaction) {
  return {
    merchant_request_id: transaction.merchant_request_id,
    checkout_request_id: transaction.checkout_request_id,
    response_code: transaction.checkout_request_id ? '0' : '202',
    response_description: transaction.checkout_request_id
      ? 'Idempotent replay: payment request already accepted'
      : 'Idempotent replay: payment request is still being initiated',
    customer_message: transaction.checkout_request_id
      ? buildCustomerMessage(transaction)
      : 'Payment request is already being initiated.',
    mode: env.daraja.useMock ? 'mock' : 'daraja',
    callback_url_configured: Boolean(env.daraja.callbackUrl)
  };
}

function buildCustomerMessage(transaction) {
  if (['created', 'pending_pin', 'processing'].includes(transaction.status)) {
    return 'Waiting for customer PIN.';
  }

  if (transaction.status === 'success') {
    return 'Payment already confirmed.';
  }

  return 'Payment request already completed.';
}

function ensureIdempotentReplayMatches(transaction, { amount, branchId, phone }) {
  const rawRequest = transaction.raw_request || {};
  const samePayload =
    String(transaction.branch_id) === String(branchId) &&
    String(transaction.phone) === String(phone) &&
    Number(transaction.amount) === Number(amount) &&
    (!rawRequest.phone || String(rawRequest.phone) === String(phone)) &&
    (!rawRequest.branch_id || String(rawRequest.branch_id) === String(branchId)) &&
    (!rawRequest.amount || Number(rawRequest.amount) === Number(amount));

  if (!samePayload) {
    throw httpError(409, 'Idempotency-Key was already used for a different payment request');
  }
}
