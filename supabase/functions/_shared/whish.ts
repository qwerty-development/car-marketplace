// Shared Whish payment-gateway helpers for the wallet edge functions.
// Extracted from whish-create-payment / whish-success patterns. Those deployed
// functions are intentionally NOT modified (live subscriptions depend on them).
//
// Differences from the legacy flow (deliberate fixes):
//   - externalId comes from a DB sequence (wallet_acquisitions default), never Date.now()
//   - HMAC signatures on callbacks are REQUIRED, not optional
//   - callback handlers re-verify payment status server-to-server before crediting

export const WHISH_API_URL =
  Deno.env.get('WHISH_API_URL') || 'https://whish.money/itel-service/api/';

export const SUCCESS_REDIRECT_URL =
  Deno.env.get('WHISH_SUCCESS_REDIRECT_URL') || 'https://fleetapp.me/success';
export const FAILURE_REDIRECT_URL =
  Deno.env.get('WHISH_FAILURE_REDIRECT_URL') || 'https://fleetapp.me/failure';

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

export const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });

export function getEnvOrThrow(name: string): string {
  const v = Deno.env.get(name);
  if (!v) throw new Error(`Missing required env: ${name}`);
  return v;
}

export function whishHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    channel: getEnvOrThrow('WHISH_CHANNEL'),
    secret: getEnvOrThrow('WHISH_SECRET'),
    websiteurl: getEnvOrThrow('WHISH_WEBSITEURL'),
  };
}

const enc = new TextEncoder();
const toHex = (buf: ArrayBuffer) =>
  Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');

export async function hmacSha256Hex(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(data));
  return toHex(sig);
}

export function canonicalizeQuery(params: Record<string, string | undefined>): string {
  const keys = Object.keys(params).filter((k) => params[k] !== undefined).sort();
  const usp = new URLSearchParams();
  for (const k of keys) usp.append(k, String(params[k]));
  return usp.toString();
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return result === 0;
}

/**
 * Verifies the `sig` query param against the canonical form of `keys`.
 * Unlike the legacy whish-success check, a MISSING signature fails verification.
 */
export async function verifyHmacRequired(
  query: URLSearchParams,
  secret: string,
  keys: string[],
): Promise<boolean> {
  const sig = query.get('sig');
  if (!sig) return false;
  const params: Record<string, string | undefined> = {};
  for (const k of keys) {
    const v = query.get(k);
    if (v !== null) params[k] = v;
  }
  const expected = await hmacSha256Hex(secret, canonicalizeQuery(params));
  return timingSafeEqual(sig, expected);
}

export interface WhishCreateParams {
  amount: number;
  invoice: string;
  externalId: number;
  successCallbackUrl: string;
  failureCallbackUrl: string;
}

export type WhishCreateResult =
  | { ok: true; collectUrl: string }
  | { ok: false; code: string | number | null; detail: string | null };

export async function whishCreatePayment(p: WhishCreateParams): Promise<WhishCreateResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const resp = await fetch(`${WHISH_API_URL}payment/whish`, {
      method: 'POST',
      headers: whishHeaders(),
      body: JSON.stringify({
        amount: p.amount,
        currency: 'USD',
        invoice: p.invoice,
        externalId: p.externalId,
        successCallbackUrl: p.successCallbackUrl,
        failureCallbackUrl: p.failureCallbackUrl,
        successRedirectUrl: SUCCESS_REDIRECT_URL,
        failureRedirectUrl: FAILURE_REDIRECT_URL,
      }),
      signal: controller.signal,
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok || !data?.status || !data?.data?.collectUrl) {
      console.error('whishCreatePayment failed:', {
        httpStatus: resp.status, whishCode: data?.code, message: data?.dialog?.message,
      });
      return { ok: false, code: data?.code ?? resp.status, detail: data?.dialog?.message ?? null };
    }
    return { ok: true, collectUrl: data.data.collectUrl };
  } catch (err) {
    console.error('whishCreatePayment network error:', err?.message ?? String(err));
    return { ok: false, code: 'network', detail: err?.message ?? String(err) };
  } finally {
    clearTimeout(timeout);
  }
}

export type WhishCollectStatus = 'success' | 'failed' | 'pending' | 'error';

/** Server-to-server payment status verification — the only trusted source of truth. */
export async function whishCollectStatus(externalId: number): Promise<WhishCollectStatus> {
  try {
    const resp = await fetch(`${WHISH_API_URL}payment/collect/status`, {
      method: 'POST',
      headers: whishHeaders(),
      body: JSON.stringify({ currency: 'USD', externalId }),
    });
    if (!resp.ok) {
      console.error(`whishCollectStatus HTTP error: ${resp.status}`);
      return 'error';
    }
    const data = await resp.json().catch(() => null);
    if (!data?.status || !data?.data?.collectStatus) {
      console.error('whishCollectStatus invalid response:', data?.code);
      return 'error';
    }
    return data.data.collectStatus as WhishCollectStatus;
  } catch (err) {
    console.error('whishCollectStatus network error:', err?.message ?? String(err));
    return 'error';
  }
}
