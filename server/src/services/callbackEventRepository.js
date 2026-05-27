import crypto from 'node:crypto';
import { env } from '../config/env.js';
import { supabase } from '../config/supabase.js';

const memoryCallbackEvents = [];

export function createCallbackEventHash(payload) {
  return crypto.createHash('sha256').update(JSON.stringify(payload || {})).digest('hex');
}

export async function recordCallbackEvent({
  checkoutRequestId = null,
  eventHash,
  merchantRequestId = null,
  mpesaReceipt = null,
  payload,
  resultCode = null
}) {
  if (supabase) {
    try {
      const { data, error } = await supabase.rpc('record_stk_callback_event', {
        p_checkout_request_id: checkoutRequestId,
        p_event_hash: eventHash,
        p_merchant_request_id: merchantRequestId,
        p_mpesa_receipt: mpesaReceipt,
        p_payload: payload || {},
        p_result_code: resultCode
      });

      if (error) throw error;
      if (data) return data;
    } catch (error) {
      if (!env.allowMemoryFallback) throw error;
      console.warn(`Supabase callback event insert failed; using memory fallback: ${error.message}`);
    }
  }

  const existing = memoryCallbackEvents.find((item) => item.event_hash === eventHash);

  if (existing) {
    existing.received_count += 1;
    existing.last_received_at = new Date().toISOString();
    existing.updated_at = existing.last_received_at;
    return existing;
  }

  const now = new Date().toISOString();
  const event = {
    id: crypto.randomUUID(),
    event_hash: eventHash,
    checkout_request_id: checkoutRequestId,
    merchant_request_id: merchantRequestId,
    mpesa_receipt: mpesaReceipt,
    result_code: resultCode,
    status: 'received',
    payload: payload || {},
    transaction_id: null,
    received_count: 1,
    attempts: 0,
    error_message: null,
    received_at: now,
    last_received_at: now,
    processing_started_at: null,
    processed_at: null,
    created_at: now,
    updated_at: now
  };

  memoryCallbackEvents.unshift(event);
  return event;
}

export async function findCallbackEventById(id) {
  if (!id) {
    return null;
  }

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('callback_events')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error) throw error;
      if (data) return data;
    } catch (error) {
      if (!env.allowMemoryFallback) throw error;
      console.warn(`Supabase callback event lookup failed; using memory fallback: ${error.message}`);
    }
  }

  return memoryCallbackEvents.find((item) => item.id === id) || null;
}

export async function listReprocessableCallbackEvents({ limit = 25, maxAttempts = 5 } = {}) {
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('callback_events')
        .select('*')
        .in('status', ['received', 'orphan', 'error'])
        .lt('attempts', maxAttempts)
        .order('created_at', { ascending: true })
        .limit(limit);

      if (error) throw error;
      return data || [];
    } catch (error) {
      if (!env.allowMemoryFallback) throw error;
      console.warn(`Supabase callback event sweep failed; using memory fallback: ${error.message}`);
    }
  }

  return memoryCallbackEvents
    .filter((item) => ['received', 'orphan', 'error'].includes(item.status))
    .filter((item) => Number(item.attempts || 0) < maxAttempts)
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
    .slice(0, limit);
}

export async function setCallbackEventState({
  errorMessage = null,
  id,
  processed = true,
  status,
  transactionId = null
}) {
  if (!id) {
    return null;
  }

  const now = new Date().toISOString();

  if (supabase) {
    try {
      const existing = await findCallbackEventById(id);
      const { data, error } = await supabase
        .from('callback_events')
        .update({
          status,
          transaction_id: transactionId,
          attempts: Number(existing?.attempts || 0) + 1,
          error_message: errorMessage,
          processed_at: processed ? now : null,
          updated_at: now
        })
        .eq('id', id)
        .select('*')
        .maybeSingle();

      if (error) throw error;
      return data;
    } catch (error) {
      if (!env.allowMemoryFallback) throw error;
      console.warn(`Supabase callback event update failed; using memory fallback: ${error.message}`);
    }
  }

  const existing = memoryCallbackEvents.find((item) => item.id === id);

  if (!existing) {
    return null;
  }

  Object.assign(existing, {
    status,
    transaction_id: transactionId,
    attempts: Number(existing.attempts || 0) + 1,
    error_message: errorMessage,
    processed_at: processed ? now : null,
    updated_at: now
  });
  return existing;
}

export async function markCallbackEventError(id, errorMessage) {
  return setCallbackEventState({
    errorMessage,
    id,
    processed: false,
    status: 'error'
  });
}
