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
    // Read and log environment variables - FIXED URL CONSTRUCTION
    console.log(`[${requestId}] Reading environment variables...`);
    const baseApiUrl = getEnvOrThrow('WHISH_API_URL', 'https://lb.sandbox.whish.money/itel-service/api');
    // Ensure no trailing slash, then construct the full endpoint
    const apiUrl = baseApiUrl.replace(/\/+$/, '');
    const channel = getEnvOrThrow('WHISH_CHANNEL');
    const secret = getEnvOrThrow('WHISH_SECRET');
    const websiteurl = getEnvOrThrow('WHISH_WEBSITEURL');
    const successCbBase = getEnvOrThrow('CALLBACK_SUCCESS_URL');
    const failureCbBase = Deno.env.get('CALLBACK_FAILURE_URL') || successCbBase;
    const appHmacSecret = Deno.env.get('APP_HMAC_SECRET');

    console.log(`[${requestId}] Environment loaded:`);
    console.log(`  - Base API URL: ${apiUrl}`);
    console.log(`  - Channel: ${channel}`);
    console.log(`  - Secret: ${secret ? '[REDACTED]' : 'NOT SET'}`);
    console.log(`  - Website URL: ${websiteurl}`);
    console.log(`  - Success Callback: ${successCbBase}`);
    console.log(`  - Failure Callback: ${failureCbBase}`);
    console.log(`  - HMAC Secret: ${appHmacSecret ? '[SET]' : 'NOT SET'}`);

    // Parse and validate request
    console.log(`[${requestId}] Parsing request body...`);
    const body = await req.json().catch((e) => {
      console.error(`[${requestId}] Failed to parse JSON:`, e.message);
      return {};
    });
    
    console.log(`[${requestId}] Request body:`, JSON.stringify(body, null, 2));

    const dealerId = Number(body?.dealerId);
    const plan = String(body?.plan);

    console.log(`[${requestId}] Parsed parameters:`);
    console.log(`  - dealerId: ${dealerId} (type: ${typeof dealerId})`);
    console.log(`  - plan: ${plan}`);

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

    console.log(`[${requestId}] Payment details:`);
    console.log(`  - Amount: ${amount} USD`);
    console.log(`  - Invoice: ${invoice}`);
    console.log(`  - External ID: ${externalId}`);

    // Build callback URLs
    const state = crypto.randomUUID();
    const baseParams = {
      eid: String(externalId),
      dealerId: String(dealerId),
      plan,
      state
    };

    console.log(`[${requestId}] Callback parameters:`, baseParams);

    const canonical = canonicalizeQuery(baseParams);
    const sig = appHmacSecret ? await hmacSha256Hex(appHmacSecret, canonical) : undefined;
    const qs = new URLSearchParams({
      ...baseParams,
      ...(sig ? { sig } : {})
    }).toString();

    const successCallbackUrl = `${successCbBase}?${qs}`;
    const failureCallbackUrl = `${failureCbBase}?${qs}`;

    console.log(`[${requestId}] Generated callback URLs:`);
    console.log(`  - Success: ${successCallbackUrl}`);
    console.log(`  - Failure: ${failureCallbackUrl}`);

    // Optional database logging
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (supabaseUrl && supabaseKey) {
      console.log(`[${requestId}] Logging to database...`);
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
    } else {
      console.log(`[${requestId}] Skipping database logging (missing credentials)`);
    }

    // FIXED: Prepare Whish request with proper URL construction
    const whishEndpoint = `${apiUrl}/payment/whish`;
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

    console.log(`[${requestId}] Calling Whish API:`);
    console.log(`  - Endpoint: ${whishEndpoint}`);
    console.log(`  - Headers:`, { ...whishHeaders, secret: '[REDACTED]' });
    console.log(`  - Payload:`, JSON.stringify(whishPayload, null, 2));

    // Call Whish API
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      console.error(`[${requestId}] Request timeout after 10s`);
      controller.abort();
    }, 10000);

    console.log(`[${requestId}] Making HTTP request to Whish...`);
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

    console.log(`[${requestId}] Whish response received:`);
    console.log(`  - Status: ${resp.status} ${resp.statusText}`);
    console.log(`  - Headers:`, Object.fromEntries(resp.headers.entries()));

    const data = await resp.json().catch((e) => {
      console.error(`[${requestId}] Failed to parse Whish response JSON:`, e.message);
      return {};
    });

    console.log(`[${requestId}] Whish response data:`, JSON.stringify(data, null, 2));

    if (!resp.ok || !data?.status || !data?.data?.collectUrl) {
      console.error(`[${requestId}] Whish request failed:`);
      console.error(`  - HTTP Status: ${resp.status}`);
      console.error(`  - Response OK: ${resp.ok}`);
      console.error(`  - Data Status: ${data?.status}`);
      console.error(`  - Collect URL: ${data?.data?.collectUrl}`);

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
          console.log(`[${requestId}] Failure logged to database`);
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

      console.log(`[${requestId}] Returning error response:`, errorResponse);
      return json(errorResponse, 502);
    }

    // Success
    console.log(`[${requestId}] Payment creation successful!`);
    console.log(`  - Collect URL: ${data.data.collectUrl}`);
    console.log(`  - External ID: ${externalId}`);

    const successResponse = {
      collectUrl: data.data.collectUrl,
      externalId
    };

    console.log(`[${requestId}] Returning success response:`, successResponse);
    return json(successResponse);

  } catch (err) {
    console.error(`[${requestId}] Unhandled error:`, err);
    console.error(`[${requestId}] Error stack:`, err.stack);
    
    const errorResponse = {
      error: 'Internal error',
      message: err?.message ?? String(err),
      debug: {
        stack: err?.stack,
        name: err?.name
      }
    };

    console.log(`[${requestId}] Returning internal error:`, errorResponse);
    return json(errorResponse, 500);
  }
});
