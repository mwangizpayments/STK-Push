import crypto from 'node:crypto';
import { env } from '../config/env.js';
import { supabase } from '../config/supabase.js';

const memoryTransactions = [];

export async function createTransaction(payload) {
  const now = new Date().toISOString();
  const transaction = {
    id: crypto.randomUUID(),
    branch_id: payload.branch_id,
    cashier_id: isUuid(payload.cashier_id) ? payload.cashier_id : null,
    phone: payload.phone,
    amount: payload.amount,
    status: 'pending',
    merchant_request_id: payload.merchant_request_id,
    checkout_request_id: payload.checkout_request_id,
    mpesa_receipt: null,
    failure_reason: null,
    raw_request: payload.raw_request || {},
    raw_response: payload.raw_response || {},
    callback_payload: null,
    created_at: now,
    updated_at: now
  };

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('transactions')
        .insert(transaction)
        .select('*')
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      if (!env.allowMemoryFallback) throw error;
      console.warn(`Supabase transaction insert failed; using memory fallback: ${error.message}`);
    }
  }

  memoryTransactions.unshift(transaction);
  return transaction;
}

export async function updateTransactionFromCallback({
  callbackPayload,
  checkoutRequestId,
  failureReason,
  receiptNumber,
  resultCode,
  status
}) {
  const patch = {
    status,
    result_code: resultCode,
    mpesa_receipt: receiptNumber || null,
    failure_reason: failureReason || null,
    callback_payload: callbackPayload,
    updated_at: new Date().toISOString()
  };

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('transactions')
        .update(patch)
        .eq('checkout_request_id', checkoutRequestId)
        .select('*')
        .maybeSingle();

      if (error) throw error;
      if (data) return data;
    } catch (error) {
      if (!env.allowMemoryFallback) throw error;
      console.warn(`Supabase transaction update failed; using memory fallback: ${error.message}`);
    }
  }

  const existing = memoryTransactions.find((item) => item.checkout_request_id === checkoutRequestId);
  if (!existing) {
    return null;
  }

  Object.assign(existing, patch);
  return existing;
}

export async function listTransactions({ branchId, limit = 50 } = {}) {
  if (supabase) {
    try {
      let query = supabase
        .from('transactions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (branchId) {
        query = query.eq('branch_id', branchId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    } catch (error) {
      if (!env.allowMemoryFallback) throw error;
      console.warn(`Supabase transaction query failed; using memory fallback: ${error.message}`);
    }
  }

  return memoryTransactions
    .filter((item) => !branchId || item.branch_id === branchId)
    .slice(0, limit);
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value || '')
  );
}
