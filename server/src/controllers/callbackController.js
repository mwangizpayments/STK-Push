import { env } from '../config/env.js';
import { createLog } from '../services/logRepository.js';
import { applyCallbackToTransaction } from '../services/transactionRepository.js';
import { mapDarajaResult } from '../services/transactionState.js';

export function confirmCallbackUrl(_req, res) {
  res.json({
    status: 'ok',
    callback_url_configured: Boolean(env.daraja.callbackUrl),
    callback_url: env.daraja.callbackUrl || null,
    callback_endpoint: '/api/callback',
    daraja_mode: env.daraja.useMock ? 'mock' : 'daraja'
  });
}

export function handleSafaricomCallback(req, res) {
  const payload = req.body || {};

  res.status(200).json({
    received: true
  });

  setImmediate(() => {
    processSafaricomCallback(payload).catch((error) => {
      console.error(`Safaricom callback processing failed: ${error.message}`);
    });
  });
}

async function processSafaricomCallback(payload) {
  const callback = payload?.Body?.stkCallback || payload?.stkCallback || payload;
  const checkoutRequestId = callback.CheckoutRequestID || callback.checkout_request_id;

  console.log(`Safaricom raw callback: ${JSON.stringify(payload)}`);

  if (!checkoutRequestId) {
    console.warn('Safaricom callback ignored: missing CheckoutRequestID');
    await createLog({
      level: 'error',
      message: 'Safaricom callback ignored: missing CheckoutRequestID'
    });
    return;
  }

  const resultCode = Number(callback.ResultCode ?? callback.result_code);
  const metadata = callback.CallbackMetadata?.Item || [];
  const receiptNumber = findMetadataValue(metadata, 'MpesaReceiptNumber');
  const { failureReason, status } = mapDarajaResult({ resultCode });

  const result = await applyCallbackToTransaction({
    callbackPayload: payload,
    checkoutRequestId,
    failureReason,
    receiptNumber,
    resultCode,
    status
  });

  if (result.duplicate) {
    console.warn(
      `Duplicate Safaricom callback ignored: checkout=${checkoutRequestId}, receipt=${receiptNumber || 'none'}, reason=${result.reason}`
    );
    await createLog({
      level: 'info',
      message: `Duplicate Safaricom callback ignored: checkout=${checkoutRequestId}, receipt=${receiptNumber || 'none'}, reason=${result.reason}`,
      transactionId: result.transaction?.id || null
    });
    return;
  }

  console.log(
    `Safaricom callback processed: checkout=${checkoutRequestId}, result_code=${resultCode}, status=${status}, updated=${Boolean(result.transaction)}`
  );
  await createLog({
    level: status === 'success' ? 'info' : 'error',
    message: `Safaricom callback processed: checkout=${checkoutRequestId}, result_code=${resultCode}, status=${status}`,
    transactionId: result.transaction?.id || null
  });
}

function findMetadataValue(items, name) {
  return items.find((item) => item.Name === name)?.Value || null;
}
