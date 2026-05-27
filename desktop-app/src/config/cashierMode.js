export const CASHIER_MODES = {
  FULL: 'full',
  SIMPLE: 'simple'
};

const CASHIER_MODE_PREFIX = 'mpesa:cashier-mode';

export function normalizeCashierMode(value) {
  return value === CASHIER_MODES.FULL ? CASHIER_MODES.FULL : CASHIER_MODES.SIMPLE;
}

export function getCashierModeStorageKey(userId) {
  return `${CASHIER_MODE_PREFIX}:${userId || 'device'}`;
}

export function loadCashierMode(userId) {
  try {
    const value = localStorage.getItem(getCashierModeStorageKey(userId));
    return value ? normalizeCashierMode(value) : '';
  } catch (_error) {
    return '';
  }
}

export function hasStoredCashierMode(userId) {
  try {
    return localStorage.getItem(getCashierModeStorageKey(userId)) !== null;
  } catch (_error) {
    return false;
  }
}

export function saveCashierMode(userId, mode) {
  const nextMode = normalizeCashierMode(mode);

  try {
    localStorage.setItem(getCashierModeStorageKey(userId), nextMode);
  } catch (_error) {
    // localStorage can be unavailable in hardened browser contexts.
  }

  return nextMode;
}
