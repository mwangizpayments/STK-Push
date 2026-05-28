export function maskPhoneNumber(value) {
  const digits = String(value || '').replace(/\D/g, '');

  if (!digits) {
    return '-';
  }

  if (/^254(7|1)\d{8}$/.test(digits)) {
    return `${digits.slice(0, 4)} XXX ${digits.slice(-4)}`;
  }

  if (/^0(7|1)\d{8}$/.test(digits)) {
    return `${digits.slice(0, 4)} XXX ${digits.slice(-3)}`;
  }

  if (digits.length > 7) {
    const headLength = Math.min(4, digits.length - 4);
    const tailLength = Math.min(4, digits.length - headLength - 1);
    return `${digits.slice(0, headLength)} XXX ${digits.slice(-tailLength)}`;
  }

  return digits;
}
