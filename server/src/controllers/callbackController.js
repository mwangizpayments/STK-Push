import { updateTransactionFromCallback } from '../services/transactionRepository.js';
import { env } from '../config/env.js';
import { httpError } from '../utils/httpError.js';

export function confirmCallbackUrl(_req, res) {
  res.json({
    status: 'ok',
    callback_url_configured: Boolean(env.daraja.callbackUrl),
    callback_url: env.daraja.callbackUrl || null,
    callback_endpoint: '/api/callback',
    daraja_mode: env.daraja.useMock ? 'mock' : 'daraja'
  });
}

export async function handleSafaricomCallback(req, res) {
  const callback = req.body?.Body?.stkCallback || req.body?.stkCallback || req.body;
  const checkoutRequestId = callback.CheckoutRequestID || callback.checkout_request_id;

  if (!checkoutRequestId) {
    throw httpError(400, 'CheckoutRequestID is required');
  }

  const resultCode = Number(callback.ResultCode ?? callback.result_code);
  const status = resultCode === 0 ? 'success' : 'failed';
  const metadata = callback.CallbackMetadata?.Item || [];
  const receiptNumber = findMetadataValue(metadata, 'MpesaReceiptNumber');
  const failureReason = status === 'failed' ? callback.ResultDesc || 'Payment failed' : null;

  const transaction = await updateTransactionFromCallback({
    callbackPayload: req.body,
    checkoutRequestId,
    failureReason,
    receiptNumber,
    resultCode,
    status
  });

  console.log(
    `Safaricom callback received: checkout=${checkoutRequestId}, result_code=${resultCode}, status=${status}, updated=${Boolean(transaction)}`
  );

  res.json({
    received: true,
    status,
    transaction
  });
}

function findMetadataValue(items, name) {
  return items.find((item) => item.Name === name)?.Value || null;
}
