export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';
export const DEFAULT_BRANCH_ID = normalizeUuid(import.meta.env.VITE_DEFAULT_BRANCH_ID);

export function normalizeUuid(value) {
  const normalized = String(value || '').trim();

  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      normalized
    )
  ) {
    return '';
  }

  return normalized;
}
