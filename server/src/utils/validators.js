import { httpError } from './httpError.js';

export function normalizeMpesaPhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  let normalized = digits;

  if (digits.startsWith('0')) {
    normalized = `254${digits.slice(1)}`;
  } else if ((digits.startsWith('7') || digits.startsWith('1')) && digits.length === 9) {
    normalized = `254${digits}`;
  }

  if (!/^254(7|1)\d{8}$/.test(normalized)) {
    throw httpError(400, 'Phone number must be a valid Kenyan Safaricom number');
  }

  return normalized;
}

export function normalizeAmount(amount) {
  const normalized = Number(amount);

  if (!Number.isFinite(normalized) || normalized <= 0) {
    throw httpError(400, 'Amount must be greater than zero');
  }

  return Math.round(normalized);
}

export function requireString(value, label) {
  if (!String(value || '').trim()) {
    throw httpError(400, `${label} is required`);
  }

  return String(value).trim();
}

