import { env } from '../config/env.js';
import {
  createCallbackEventHash,
  recordCallbackEvent
} from '../services/callbackEventRepository.js';
import { parseStkCallbackPayload, processCallbackEvent } from '../services/callbackProcessor.js';

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
  const payload = req.body || {};
  const parsed = parseStkCallbackPayload(payload);
  const event = await recordCallbackEvent({
    checkoutRequestId: parsed.checkoutRequestId,
    eventHash: createCallbackEventHash(payload),
    merchantRequestId: parsed.merchantRequestId,
    mpesaReceipt: parsed.receiptNumber,
    payload,
    resultCode: parsed.resultCode
  });

  res.status(200).json({
    callback_event_id: event.id,
    received: true
  });

  setImmediate(() => {
    processCallbackEvent(event.id).catch((error) => {
      console.error(`Safaricom callback processing failed: ${error.message}`);
    });
  });
}
