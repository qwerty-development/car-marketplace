import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUCCESS_REDIRECT_URL = 'https://fleetapp.me/success';
const FAILURE_REDIRECT_URL = 'https://fleetapp.me/failure';
const PRICE_MONTHLY_USD = 250; // Production pricing
const PRICE_YEARLY_USD = 2500;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: {
    'Content-Type': 'application/json',
    ...corsHeaders
  }
});

const enc = new TextEncoder();
const toHex = (buf) => Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');

async function hmacSha256Hex(secret, data) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), {
    name: 'HMAC',
    hash: 'SHA-256'
  }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(data));
  return toHex(sig);
}

function canonicalizeQuery(params) {
  const keys = Object.keys(params).filter((k) => params[k] !== undefined).sort();
  const usp = new URLSearchParams();
  for (const k of keys) usp.append(k, String(params[k]));
  return usp.toString();
}

function getEnvOrThrow(name, fallback) {
  const v = Deno.env.get(name) ?? fallback;
  if (!v) throw new Error(`Missing required env: ${name}`);
  return v;
}

Deno.serve(async (req) => {
  const requestId = crypto.randomUUID().slice(0, 8);
  console.log(`[${requestId}] Request started: ${req.method} ${req.url}`);

  if (req.method === 'OPTIONS') {
    console.log(`[${requestId}] OPTIONS request - returning CORS headers`);
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    console.log(`[${requestId}] Invalid method: ${req.method}`);
    return json({ error: 'Method not allowed' }, 405);
  }

  try {
    // Read environment variables - PRODUCTION WHISH API
    console.log(`[${requestId}] Reading environment variables...`);
    const baseApiUrl = getEnvOrThrow('WHISH_API_URL', 'https://whish.money/itel-service/api');
    const channel = getEnvOrThrow('WHISH_CHANNEL');
    const secret = getEnvOrThrow('WHISH_SECRET');
    const websiteurl = getEnvOrThrow('WHISH_WEBSITEURL');
    const successCbBase = getEnvOrThrow('CALLBACK_SUCCESS_URL');
    const failureCbBase = Deno.env.get('CALLBACK_FAILURE_URL') || successCbBase;
    const appHmacSecret = Deno.env.get('APP_HMAC_SECRET');

    console.log(`[${requestId}] Environment loaded:`);
    console.log(`  - Base API URL: ${baseApiUrl}`);
    console.log(`  - Channel: ${channel}`);
    console.log(`  - Secret: ${secret ? '[REDACTED]' : 'NOT SET'}`);
    console.log(`  - Website URL: ${websiteurl}`);

    // Parse and validate request
    const body = await req.json().catch((e) => {
      console.error(`[${requestId}] Failed to parse JSON:`, e.message);
      return {};
    });
    
    const dealerId = Number(body?.dealerId);
    const plan = String(body?.plan);

    console.log(`[${requestId}] Parsed parameters: dealerId=${dealerId}, plan=${plan}`);

    if (!Number.isFinite(dealerId) || dealerId <= 0) {
      console.error(`[${requestId}] Invalid dealerId: ${dealerId}`);
      return json({ error: 'Invalid dealerId' }, 400);
    }

    if (!['monthly', 'yearly'].includes(plan)) {
      console.error(`[${requestId}] Invalid plan: ${plan}`);
      return json({ error: 'Invalid plan (monthly|yearly)' }, 400);
    }

    const amount = plan === 'monthly' ? PRICE_MONTHLY_USD : PRICE_YEARLY_USD;
    const invoice = plan === 'monthly' ? 'Monthly subscription' : 'Yearly subscription';
    const externalId = Date.now();

    console.log(`[${requestId}] Payment: ${amount} USD for ${invoice}`);

    // Build callback URLs
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
      ...(sig ? { sig } : {})
    }).toString();

    const successCallbackUrl = `${successCbBase}?${qs}`;
    const failureCallbackUrl = `${failureCbBase}?${qs}`;

    // Optional database logging
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
        console.log(`[${requestId}] Database log successful`);
      } catch (e) {
        console.warn(`[${requestId}] Failed to log pending transaction:`, e.message);
      }
    }

    // FIXED: Proper URL construction for production Whish API
    const cleanApiUrl = baseApiUrl.replace(/\/+$/, ''); // Remove trailing slashes
    const whishEndpoint = `${cleanApiUrl}/payment/whish`;
    
    const whishPayload = {
      amount,
      currency: 'USD',
      invoice,
      externalId,
      successCallbackUrl,
      failureCallbackUrl,
      successRedirectUrl: SUCCESS_REDIRECT_URL,
      failureRedirectUrl: FAILURE_REDIRECT_URL
    };

    const whishHeaders = {
      'Content-Type': 'application/json',
      channel,
      secret,
      websiteurl
    };

    console.log(`[${requestId}] Calling Whish Production API:`);
    console.log(`  - Endpoint: ${whishEndpoint}`);
    console.log(`  - Payload:`, JSON.stringify(whishPayload, null, 2));

    // Call Whish Production API
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      console.error(`[${requestId}] Request timeout after 15s`);
      controller.abort();
    }, 15000); // Longer timeout for production

    const resp = await fetch(whishEndpoint, {
      method: 'POST',
      headers: whishHeaders,
      body: JSON.stringify(whishPayload),
      signal: controller.signal
    }).catch((e) => {
      console.error(`[${requestId}] Fetch failed:`, e.message);
      throw new Error(`Whish request failed: ${e?.message ?? 'network error'}`);
    }).finally(() => {
      clearTimeout(timeout);
    });

    console.log(`[${requestId}] Whish response: ${resp.status} ${resp.statusText}`);

    const data = await resp.json().catch((e) => {
      console.error(`[${requestId}] Failed to parse Whish response JSON:`, e.message);
      return {};
    });

    console.log(`[${requestId}] Whish response data:`, JSON.stringify(data, null, 2));

    if (!resp.ok || !data?.status || !data?.data?.collectUrl) {
      console.error(`[${requestId}] Whish request failed`);

      // Log failure to database
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
            error_message: data?.dialog?.message ?? data?.message ?? 'Create payment failed'
          });
        } catch (e) {
          console.warn(`[${requestId}] Failed to log failed transaction:`, e.message);
        }
      }

      const errorResponse = {
        error: 'Create payment failed',
        code: data?.code ?? resp.status,
        detail: data?.dialog?.message ?? data?.message ?? null,
        debug: {
          endpoint: whishEndpoint,
          status: resp.status,
          statusText: resp.statusText,
          responseData: data
        }
      };

      return json(errorResponse, 502);
    }

    // Success
    console.log(`[${requestId}] Payment creation successful! Collect URL: ${data.data.collectUrl}`);

    return json({
      collectUrl: data.data.collectUrl,
      externalId
    });

  } catch (err) {
    console.error(`[${requestId}] Unhandled error:`, err);
    
    return json({
      error: 'Internal error',
      message: err?.message ?? String(err)
    }, 500);
  }
});
