import { httpError } from './httpError.js';

export const SAFARICOM_PREFIXES = [
  '0700',
  '0701',
  '0702',
  '0703',
  '0704',
  '0705',
  '0706',
  '0707',
  '0708',
  '0709',
  '0710',
  '0711',
  '0712',
  '0713',
  '0714',
  '0715',
  '0716',
  '0717',
  '0718',
  '0719',
  '0720',
  '0721',
  '0722',
  '0723',
  '0724',
  '0725',
  '0726',
  '0727',
  '0728',
  '0729',
  '0740',
  '0741',
  '0742',
  '0743',
  '0745',
  '0746',
  '0748',
  '0757',
  '0758',
  '0759',
  '0768',
  '0769',
  '0790',
  '0791',
  '0792',
  '0793',
  '0794',
  '0795',
  '0796',
  '0797',
  '0798',
  '0799',
  '0110',
  '0111',
  '0112',
  '0113',
  '0114',
  '0115',
  '0116',
  '0117'
];

const safaricomPrefixSet = new Set(SAFARICOM_PREFIXES);

export function normalizeMpesaPhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  let localDigits = '';

  if (/^0(7|1)\d{8}$/.test(digits)) {
    localDigits = digits;
  } else if (/^254(7|1)\d{8}$/.test(digits)) {
    localDigits = `0${digits.slice(3)}`;
  } else if (/^(7|1)\d{8}$/.test(digits)) {
    localDigits = `0${digits}`;
  }

  if (!localDigits || !safaricomPrefixSet.has(localDigits.slice(0, 4))) {
    throw httpError(400, 'Phone number must be a valid Kenyan Safaricom number');
  }

  return `254${localDigits.slice(1)}`;
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

export function requireIdempotencyKey(value) {
  const normalized = requireString(value, 'Idempotency-Key');

  if (normalized.length > 128 || !/^[A-Za-z0-9._:-]+$/.test(normalized)) {
    throw httpError(400, 'Idempotency-Key must be 1-128 URL-safe characters');
  }

  return normalized;
}

export function normalizeHexColor(value, label = 'color_code') {
  const normalized = String(value || '').trim();

  if (!/^#[0-9a-f]{6}$/i.test(normalized)) {
    throw httpError(400, `${label} must be a 6-digit hex color like #059669`);
  }

  return normalized.toUpperCase();
}

export function requireUuid(value, label) {
  const normalized = requireString(value, label);

  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      normalized
    )
  ) {
    throw httpError(400, `${label} must be a valid branch ID`);
  }

  return normalized;
}
