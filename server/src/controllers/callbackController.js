import { updateTransactionFromCallback } from '../services/transactionRepository.js';
import { httpError } from '../utils/httpError.js';

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

  res.json({
    received: true,
    status,
    transaction
  });
}

function findMetadataValue(items, name) {
  return items.find((item) => item.Name === name)?.Value || null;
}

