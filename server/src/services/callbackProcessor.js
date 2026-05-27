import { createLog } from './logRepository.js';
import { findCallbackEventById, markCallbackEventError } from './callbackEventRepository.js';
import { applyCallbackToTransaction } from './transactionRepository.js';
import { mapDarajaResult } from './transactionState.js';

export async function processCallbackEvent(eventOrId) {
  const event =
    typeof eventOrId === 'string' ? await findCallbackEventById(eventOrId) : eventOrId;

  if (!event) {
    return {
      duplicate: true,
      reason: 'callback_event_not_found',
      transaction: null
    };
  }

  if (!['received', 'orphan', 'error'].includes(event.status)) {
    return {
      duplicate: true,
      reason: `callback_event_${event.status}`,
      transaction: null
    };
  }

  try {
    const parsed = parseStkCallbackPayload(event.payload || {});

    if (!parsed.checkoutRequestId) {
      await markCallbackEventError(event.id, 'Callback missing CheckoutRequestID');
      await createLog({
        level: 'error',
        message: 'Safaricom callback ignored: missing CheckoutRequestID'
      });

      return {
        duplicate: true,
        reason: 'missing_checkout_request_id',
        transaction: null
      };
    }

    const { failureReason, status } = mapDarajaResult({ resultCode: parsed.resultCode });
    const result = await applyCallbackToTransaction({
      callbackEventId: event.id,
      callbackPayload: event.payload || {},
      checkoutRequestId: parsed.checkoutRequestId,
      failureReason,
      merchantRequestId: parsed.merchantRequestId,
      receiptNumber: parsed.receiptNumber,
      resultCode: parsed.resultCode,
      status
    });

    if (result.duplicate) {
      await createLog({
        level: 'info',
        message: `Duplicate or deferred callback: checkout=${parsed.checkoutRequestId}, reason=${result.reason}`,
        transactionId: result.transaction?.id || null
      });
      return result;
    }

    await createLog({
      level: status === 'success' ? 'info' : 'error',
      message: `Safaricom callback processed: checkout=${parsed.checkoutRequestId}, result_code=${parsed.resultCode}, status=${status}`,
      transactionId: result.transaction?.id || null
    });

    return result;
  } catch (error) {
    await markCallbackEventError(event.id, error.message);
    throw error;
  }
}

export function parseStkCallbackPayload(payload) {
  const callback = payload?.Body?.stkCallback || payload?.stkCallback || payload || {};
  const metadata = callback.CallbackMetadata?.Item || callback.callback_metadata?.item || [];
  const resultCode = Number(callback.ResultCode ?? callback.result_code ?? -1);

  return {
    checkoutRequestId: callback.CheckoutRequestID || callback.checkout_request_id || null,
    merchantRequestId: callback.MerchantRequestID || callback.merchant_request_id || null,
    receiptNumber:
      findMetadataValue(metadata, 'MpesaReceiptNumber') ||
      callback.MpesaReceiptNumber ||
      callback.mpesa_receipt ||
      null,
    resultCode: Number.isFinite(resultCode) ? resultCode : -1
  };
}

function findMetadataValue(items, name) {
  return items.find((item) => item.Name === name || item.name === name)?.Value || null;
}

