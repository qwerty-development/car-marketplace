/**
 * Phone number normalization utilities.
 *
 * Why digits-only comparison: auth.users.phone is sometimes stored without the
 * "+" prefix (e.g. "96170559916") while the client always builds the request
 * value as "+96170559916". A strict string compare misses these as equal even
 * though they refer to the same number, which forces unnecessary OTP re-sends
 * — and gotrue's "phone unchanged" branch then silently drops the SMS.
 */

/**
 * Strip everything that isn't a digit. Returns "" for null/undefined input.
 *
 * Examples:
 *   normalizeToDigits("+961 70 559 916")  → "96170559916"
 *   normalizeToDigits("96170559916")       → "96170559916"
 *   normalizeToDigits(null)                → ""
 */
export function normalizeToDigits(phone: string | null | undefined): string {
  if (!phone) return '';
  return phone.replace(/\D/g, '');
}

/**
 * True if both strings represent the same phone number (digits-only equality).
 */
export function samePhoneNumber(
  a: string | null | undefined,
  b: string | null | undefined
): boolean {
  const aDigits = normalizeToDigits(a);
  const bDigits = normalizeToDigits(b);
  if (!aDigits || !bDigits) return false;
  return aDigits === bDigits;
}
