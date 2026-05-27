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
