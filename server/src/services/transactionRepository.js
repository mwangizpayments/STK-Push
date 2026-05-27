import crypto from 'node:crypto';
import { env } from '../config/env.js';
import { supabase } from '../config/supabase.js';
import {
  ACTIVE_TRANSACTION_STATES,
  CALLBACK_MUTABLE_STATES,
  TRANSACTION_STATES,
  isFinalTransactionState
} from './transactionState.js';

const memoryTransactions = [];

export async function createTransaction(payload) {
  const now = new Date().toISOString();
  const timeoutAt = new Date(Date.now() + env.paymentTimeoutMs).toISOString();
  const transaction = {
    id: crypto.randomUUID(),
    branch_id: payload.branch_id,
    cashier_id: isUuid(payload.cashier_id) ? payload.cashier_id : null,
    phone: payload.phone,
    amount: payload.amount,
    status: payload.status || TRANSACTION_STATES.CREATED,
    merchant_request_id: payload.merchant_request_id || null,
    checkout_request_id: payload.checkout_request_id || null,
    mpesa_receipt: null,
    failure_reason: null,
    raw_request: payload.raw_request || {},
    raw_response: payload.raw_response || {},
    callback_payload: null,
    callback_received_at: null,
    callback_processed_at: null,
    callback_attempts: 0,
    timeout_at: timeoutAt,
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

export async function markTransactionStkAccepted(id, { checkoutRequestId, merchantRequestId, rawResponse }) {
  const timeoutAt = new Date(Date.now() + env.paymentTimeoutMs).toISOString();
  const patch = {
    status: TRANSACTION_STATES.PENDING_PIN,
    merchant_request_id: merchantRequestId,
    checkout_request_id: checkoutRequestId,
    raw_response: rawResponse || {},
    timeout_at: timeoutAt,
    updated_at: new Date().toISOString()
  };

  return updateTransactionById(id, patch);
}

export async function markTransactionRequestFailed(id, failureReason = 'Payment request could not be sent.') {
  return updateTransactionById(id, {
    status: TRANSACTION_STATES.FAILED,
    failure_reason: failureReason,
    updated_at: new Date().toISOString()
  });
}

export async function applyCallbackToTransaction({
  callbackPayload,
  checkoutRequestId,
  failureReason,
  receiptNumber,
  resultCode,
  status
}) {
  if (receiptNumber) {
    const transactionWithReceipt = await findTransactionByReceiptNumber(receiptNumber);

    if (
      transactionWithReceipt &&
      transactionWithReceipt.checkout_request_id !== checkoutRequestId
    ) {
      return {
        duplicate: true,
        reason: 'receipt_already_processed',
        transaction: transactionWithReceipt
      };
    }
  }

  const processingTransaction = await markTransactionProcessing({
    callbackPayload,
    checkoutRequestId,
    resultCode
  });

  if (!processingTransaction) {
    return {
      duplicate: true,
      reason: 'checkout_already_processed',
      transaction: await findTransactionByCheckoutRequestId(checkoutRequestId)
    };
  }

  const patch = {
    status,
    result_code: resultCode,
    mpesa_receipt: receiptNumber || null,
    failure_reason: failureReason || null,
    callback_payload: callbackPayload,
    callback_processed_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('transactions')
        .update(patch)
        .eq('checkout_request_id', checkoutRequestId)
        .is('callback_processed_at', null)
        .in('status', [TRANSACTION_STATES.PROCESSING, ...CALLBACK_MUTABLE_STATES])
        .select('*')
        .maybeSingle();

      if (error) throw error;
      if (data) {
        return {
          duplicate: false,
          reason: null,
          transaction: data
        };
      }
    } catch (error) {
      if (!env.allowMemoryFallback) throw error;
      console.warn(`Supabase transaction update failed; using memory fallback: ${error.message}`);
    }
  }

  const existing = memoryTransactions.find((item) => item.checkout_request_id === checkoutRequestId);
  if (
    !existing ||
    existing.callback_processed_at ||
    (isFinalTransactionState(existing.status) && existing.status !== TRANSACTION_STATES.TIMEOUT)
  ) {
    return {
      duplicate: true,
      reason: 'checkout_already_processed',
      transaction: existing || null
    };
  }

  Object.assign(existing, patch);
  return {
    duplicate: false,
    reason: null,
    transaction: existing
  };
}

export async function updateTransactionFromCallback(callbackResult) {
  const result = await applyCallbackToTransaction(callbackResult);
  return result.transaction;
}

export async function markTimedOutTransactions() {
  const now = new Date().toISOString();
  const patch = {
    status: TRANSACTION_STATES.TIMEOUT,
    failure_reason: 'The customer did not respond in time.',
    updated_at: now
  };

  if (supabase) {
    try {
      const { error } = await supabase
        .from('transactions')
        .update(patch)
        .lt('timeout_at', now)
        .is('callback_processed_at', null)
        .in('status', ACTIVE_TRANSACTION_STATES);

      if (error) throw error;
    } catch (error) {
      if (!env.allowMemoryFallback) throw error;
      console.warn(`Supabase timeout sweep failed; using memory fallback: ${error.message}`);
    }
  }

  for (const transaction of memoryTransactions) {
    if (
      transaction.timeout_at &&
      new Date(transaction.timeout_at).getTime() <= Date.now() &&
      !transaction.callback_processed_at &&
      ACTIVE_TRANSACTION_STATES.includes(transaction.status)
    ) {
      Object.assign(transaction, patch);
    }
  }
}

export function scheduleTransactionTimeout({ checkoutRequestId }) {
  setTimeout(() => {
    markSingleTransactionTimedOut(checkoutRequestId).catch((error) => {
      console.error(`Payment timeout update failed: checkout=${checkoutRequestId}, error=${error.message}`);
    });
  }, env.paymentTimeoutMs);
}

export async function markSingleTransactionTimedOut(checkoutRequestId) {
  const patch = {
    status: TRANSACTION_STATES.TIMEOUT,
    failure_reason: 'The customer did not respond in time.',
    updated_at: new Date().toISOString()
  };

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('transactions')
        .update(patch)
        .eq('checkout_request_id', checkoutRequestId)
        .is('callback_processed_at', null)
        .in('status', CALLBACK_MUTABLE_STATES)
        .select('*')
        .maybeSingle();

      if (error) throw error;
      return data;
    } catch (error) {
      if (!env.allowMemoryFallback) throw error;
      console.warn(`Supabase transaction timeout failed; using memory fallback: ${error.message}`);
    }
  }

  const existing = memoryTransactions.find((item) => item.checkout_request_id === checkoutRequestId);
  if (
    existing &&
    !existing.callback_processed_at &&
    ACTIVE_TRANSACTION_STATES.includes(existing.status)
  ) {
    Object.assign(existing, patch);
    return existing;
  }

  return null;
}

export async function listTransactions({
  branchId,
  dateFrom,
  dateTo,
  limit = 50,
  page,
  pageSize,
  search,
  status
} = {}) {
  await markTimedOutTransactions();

  const isPaginated = Boolean(page || pageSize);
  const normalizedPage = Math.max(Number(page || 1), 1);
  const normalizedPageSize = Math.min(Math.max(Number(pageSize || limit || 50), 1), 100);

  if (supabase) {
    try {
      let query = supabase
        .from('transactions')
        .select('*', isPaginated ? { count: 'exact' } : undefined)
        .order('created_at', { ascending: false });

      if (branchId) {
        query = query.eq('branch_id', branchId);
      }

      if (status) {
        query = query.eq('status', status);
      }

      if (dateFrom) {
        query = query.gte('created_at', dateFrom);
      }

      if (dateTo) {
        query = query.lte('created_at', dateTo);
      }

      if (search) {
        const normalizedSearch = String(search).replaceAll(',', ' ').trim();
        query = query.or(
          `phone.ilike.%${normalizedSearch}%,mpesa_receipt.ilike.%${normalizedSearch}%,checkout_request_id.ilike.%${normalizedSearch}%`
        );
      }

      if (isPaginated) {
        const from = (normalizedPage - 1) * normalizedPageSize;
        query = query.range(from, from + normalizedPageSize - 1);
      } else {
        query = query.limit(limit);
      }

      const { count, data, error } = await query;
      if (error) throw error;

      const memoryData = env.allowMemoryFallback
        ? filterMemoryTransactions({ branchId, dateFrom, dateTo, search, status })
        : [];
      const mergedData = mergeById([...memoryData, ...(data || [])]);

      if (memoryData.length) {
        const paginatedData = isPaginated
          ? mergedData.slice((normalizedPage - 1) * normalizedPageSize, normalizedPage * normalizedPageSize)
          : mergedData.slice(0, limit);
        return formatTransactionResult(paginatedData, {
          isPaginated,
          page: normalizedPage,
          pageSize: normalizedPageSize,
          total: mergedData.length
        });
      }

      return formatTransactionResult(data || [], {
        isPaginated,
        page: normalizedPage,
        pageSize: normalizedPageSize,
        total: count
      });
    } catch (error) {
      if (!env.allowMemoryFallback) throw error;
      console.warn(`Supabase transaction query failed; using memory fallback: ${error.message}`);
    }
  }

  const filtered = filterMemoryTransactions({ branchId, dateFrom, dateTo, search, status });

  if (isPaginated) {
    const from = (normalizedPage - 1) * normalizedPageSize;
    return formatTransactionResult(filtered.slice(from, from + normalizedPageSize), {
      isPaginated,
      page: normalizedPage,
      pageSize: normalizedPageSize,
      total: filtered.length
    });
  }

  return filtered.slice(0, limit);
}

export async function findTransactionByCheckoutRequestId(checkoutRequestId) {
  if (!checkoutRequestId) {
    return null;
  }

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('checkout_request_id', checkoutRequestId)
        .maybeSingle();

      if (error) throw error;
      if (data) return data;
    } catch (error) {
      if (!env.allowMemoryFallback) throw error;
      console.warn(`Supabase transaction lookup failed; using memory fallback: ${error.message}`);
    }
  }

  return memoryTransactions.find((item) => item.checkout_request_id === checkoutRequestId) || null;
}

export async function findTransactionByReceiptNumber(receiptNumber) {
  if (!receiptNumber) {
    return null;
  }

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('mpesa_receipt', receiptNumber)
        .maybeSingle();

      if (error) throw error;
      if (data) return data;
    } catch (error) {
      if (!env.allowMemoryFallback) throw error;
      console.warn(`Supabase receipt lookup failed; using memory fallback: ${error.message}`);
    }
  }

  return memoryTransactions.find((item) => item.mpesa_receipt === receiptNumber) || null;
}

async function markTransactionProcessing({ callbackPayload, checkoutRequestId, resultCode }) {
  const existing = await findTransactionByCheckoutRequestId(checkoutRequestId);
  const attempts = Number(existing?.callback_attempts || 0) + 1;
  const now = new Date().toISOString();
  const patch = {
    status: TRANSACTION_STATES.PROCESSING,
    result_code: resultCode,
    callback_payload: callbackPayload,
    callback_received_at: now,
    callback_attempts: attempts,
    updated_at: now
  };

  if (
    !existing ||
    existing.callback_processed_at ||
    (isFinalTransactionState(existing.status) && existing.status !== TRANSACTION_STATES.TIMEOUT)
  ) {
    return null;
  }

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('transactions')
        .update(patch)
        .eq('checkout_request_id', checkoutRequestId)
        .is('callback_processed_at', null)
        .in('status', CALLBACK_MUTABLE_STATES)
        .select('*')
        .maybeSingle();

      if (error) throw error;
      if (data) return data;
    } catch (error) {
      if (!env.allowMemoryFallback) throw error;
      console.warn(`Supabase transaction processing update failed; using memory fallback: ${error.message}`);
    }
  }

  const memoryTransaction = memoryTransactions.find((item) => item.checkout_request_id === checkoutRequestId);
  if (
    !memoryTransaction ||
    memoryTransaction.callback_processed_at ||
    (isFinalTransactionState(memoryTransaction.status) && memoryTransaction.status !== TRANSACTION_STATES.TIMEOUT)
  ) {
    return null;
  }

  Object.assign(memoryTransaction, patch);
  return memoryTransaction;
}

function filterMemoryTransactions({ branchId, dateFrom, dateTo, search, status }) {
  return memoryTransactions.filter((item) => {
    const createdAt = new Date(item.created_at).getTime();
    const matchesBranch = !branchId || item.branch_id === branchId;
    const matchesStatus = !status || item.status === status;
    const matchesDateFrom = !dateFrom || createdAt >= new Date(dateFrom).getTime();
    const matchesDateTo = !dateTo || createdAt <= new Date(dateTo).getTime();
    const query = String(search || '').toLowerCase().trim();
    const matchesSearch =
      !query ||
      String(item.phone || '').toLowerCase().includes(query) ||
      String(item.mpesa_receipt || '').toLowerCase().includes(query) ||
      String(item.checkout_request_id || '').toLowerCase().includes(query);

    return matchesBranch && matchesStatus && matchesDateFrom && matchesDateTo && matchesSearch;
  });
}

function formatTransactionResult(transactions, { isPaginated, page, pageSize, total }) {
  if (!isPaginated) {
    return transactions;
  }

  return {
    transactions,
    pagination: {
      page,
      page_size: pageSize,
      total: total ?? transactions.length,
      total_pages: Math.max(Math.ceil((total ?? transactions.length) / pageSize), 1)
    }
  };
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value || '')
  );
}

function mergeById(items) {
  const byId = new Map();

  for (const item of items) {
    byId.set(item.id, item);
  }

  return [...byId.values()].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

async function updateTransactionById(id, patch) {
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('transactions')
        .update(patch)
        .eq('id', id)
        .select('*')
        .maybeSingle();

      if (error) throw error;
      if (data) return data;
    } catch (error) {
      if (!env.allowMemoryFallback) throw error;
      console.warn(`Supabase transaction update failed; using memory fallback: ${error.message}`);
    }
  }

  const existing = memoryTransactions.find((item) => item.id === id);
  if (!existing) {
    return null;
  }

  Object.assign(existing, patch);
  return existing;
}
