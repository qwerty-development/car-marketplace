import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
const SUCCESS_REDIRECT_URL = 'https://fleetapp.me/success';
const FAILURE_REDIRECT_URL = 'https://fleetapp.me/failure';
const PRICE_MONTHLY_USD = 1;
const PRICE_YEARLY_USD = 2500;
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};
const json = (data, status = 200)=>new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders
    }
  });
const enc = new TextEncoder();
const toHex = (buf)=>Array.from(new Uint8Array(buf)).map((b)=>b.toString(16).padStart(2, '0')).join('');
async function hmacSha256Hex(secret, data) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), {
    name: 'HMAC',
    hash: 'SHA-256'
  }, false, [
    'sign'
  ]);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(data));
  return toHex(sig);
}
function canonicalizeQuery(params) {
  const keys = Object.keys(params).filter((k)=>params[k] !== undefined).sort();
  const usp = new URLSearchParams();
  for (const k of keys)usp.append(k, String(params[k]));
  return usp.toString();
}
function getEnvOrThrow(name, fallback) {
  const v = Deno.env.get(name) ?? fallback;
  if (!v) throw new Error(`Missing required env: ${name}`);
  return v;
}
Deno.serve(async (req)=>{
  if (req.method === 'OPTIONS') return new Response('ok', {
    headers: corsHeaders
  });
  if (req.method !== 'POST') return json({
    error: 'Method not allowed'
  }, 405);
  try {
    // Read env
    const apiUrl = getEnvOrThrow('WHISH_API_URL', 'https://lb.sandbox.whish.money/itel-service/api/').replace(/\/+$/, '') + '/';
    const channel = getEnvOrThrow('WHISH_CHANNEL');
    const secret = getEnvOrThrow('WHISH_SECRET');
    const websiteurl = getEnvOrThrow('WHISH_WEBSITEURL');
    const successCbBase = getEnvOrThrow('CALLBACK_SUCCESS_URL');
    // Make failure callback optional - use success callback as fallback
    const failureCbBase = Deno.env.get('CALLBACK_FAILURE_URL') || successCbBase;
    const appHmacSecret = Deno.env.get('APP_HMAC_SECRET'); // optional
    // Parse request
    const body = await req.json().catch(()=>({}));
    const dealerId = Number(body?.dealerId);
    const plan = String(body?.plan);
    if (!Number.isFinite(dealerId) || dealerId <= 0) {
      return json({
        error: 'Invalid dealerId'
      }, 400);
    }
    if (![
      'monthly',
      'yearly'
    ].includes(plan)) {
      return json({
        error: 'Invalid plan (monthly|yearly)'
      }, 400);
    }
    const amount = plan === 'monthly' ? PRICE_MONTHLY_USD : PRICE_YEARLY_USD;
    const invoice = plan === 'monthly' ? 'Monthly subscription' : 'Yearly subscription';
    // Generate externalId (numeric)
    const externalId = Date.now();
    // Build callback query with optional signature
    const state = crypto.randomUUID();
    const baseParams = {
      eid: String(externalId),
      dealerId: String(dealerId),
      plan,
      state
    };
    const canonical = canonicalizeQuery(baseParams);
    const sig = appHmacSecret ? await hmacSha256Hex(appHmacSecret, canonical) : undefined;
    const qs = new URLSearchParams({
      ...baseParams,
      ...sig ? {
        sig
      } : {}
    }).toString();
    const successCallbackUrl = `${successCbBase}?${qs}`;
    const failureCallbackUrl = `${failureCbBase}?${qs}`;
    // Optional logging (won't block the flow if table is missing)
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (supabaseUrl && supabaseKey) {
      try {
        const supabase = createClient(supabaseUrl, supabaseKey);
        await supabase.from('payment_logs').insert({
          external_id: externalId,
          dealer_id: dealerId,
          plan,
          amount,
          currency: 'USD',
          status: 'pending',
          whish_status: 'pending',
          processed_at: new Date().toISOString()
        });
      } catch (e) {
        // Ignore logging errors
        console.warn('Failed to log pending transaction:', e.message);
      }
    }
    // Call Whish create payment
    const controller = new AbortController();
    const timeout = setTimeout(()=>controller.abort(), 10000);
    const resp = await fetch(`${apiUrl}payment/whish`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        channel,
        secret,
        websiteurl
      },
      body: JSON.stringify({
        amount,
        currency: 'USD',
        invoice,
        externalId,
        successCallbackUrl,
        failureCallbackUrl,
        successRedirectUrl: SUCCESS_REDIRECT_URL,
        failureRedirectUrl: FAILURE_REDIRECT_URL
      }),
      signal: controller.signal
    }).catch((e)=>{
      throw new Error(`Whish request failed: ${e?.message ?? 'network error'}`);
    }).finally(()=>clearTimeout(timeout));
    const data = await resp.json().catch(()=>({}));
    if (!resp.ok || !data?.status || !data?.data?.collectUrl) {
      // Try to log error
      if (supabaseUrl && supabaseKey) {
        try {
          const supabase = createClient(supabaseUrl, supabaseKey);
          await supabase.from('payment_logs').insert({
            external_id: externalId,
            dealer_id: dealerId,
            plan,
            amount,
            currency: 'USD',
            status: 'failed',
            whish_status: data?.code ?? 'error',
            processed_at: new Date().toISOString(),
            error_message: data?.dialog?.message ?? 'Create payment failed'
          });
        } catch (e) {
          // Ignore logging errors
          console.warn('Failed to log failed transaction:', e.message);
        }
      }
      return json({
        error: 'Create payment failed',
        code: data?.code ?? resp.status,
        detail: data?.dialog?.message ?? null
      }, 502);
    }
    // Success: return collectUrl + externalId to the app
    return json({
      collectUrl: data.data.collectUrl,
      externalId
    });
  } catch (err) {
    return json({
      error: 'Internal error',
      message: err?.message ?? String(err)
    }, 500);
  }
});
