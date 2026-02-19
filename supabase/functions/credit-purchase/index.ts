// supabase/functions/credit-purchase/index.ts
// Handles credit purchases via Whish payment gateway
// Supports creditType: '2month' (users + dealers) and '1year' (dealers only)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUCCESS_REDIRECT_URL = 'https://fleetapp.me/success';
const FAILURE_REDIRECT_URL = 'https://fleetapp.me/failure';

const VALID_CREDIT_TYPES = ['2month', '1year'] as const;
type CreditType = typeof VALID_CREDIT_TYPES[number];

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

const json = (data: any, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: {
    'Content-Type': 'application/json',
    ...corsHeaders
  }
});

const enc = new TextEncoder();
const toHex = (buf: ArrayBuffer) => Array.from(new Uint8Array(buf))
  .map((b) => b.toString(16).padStart(2, '0'))
  .join('');

async function hmacSha256Hex(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(data));
  return toHex(sig);
}

function canonicalizeQuery(params: Record<string, string>): string {
  const keys = Object.keys(params).filter((k) => params[k] !== undefined).sort();
  const usp = new URLSearchParams();
  for (const k of keys) usp.append(k, String(params[k]));
  return usp.toString();
}

function getEnvOrThrow(name: string, fallback?: string): string {
  const v = Deno.env.get(name) ?? fallback;
  if (!v) throw new Error(`Missing required env: ${name}`);
  return v;
}

Deno.serve(async (req: Request) => {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();

  console.log(`[${requestId}] REQUEST_START:`, {
    method: req.method,
    url: req.url,
    timestamp: new Date().toISOString()
  });

  if (req.method === 'OPTIONS') {
    console.log(`[${requestId}] CORS_PREFLIGHT: Handled successfully`);
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    console.error(`[${requestId}] METHOD_ERROR:`, { method: req.method });
    return json({ error: 'Method not allowed' }, 405);
  }

  try {
    console.log(`[${requestId}] ENV_CHECK: Starting environment validation`);

    // Get environment variables
    const apiUrl = "https://whish.money/itel-service/api/";
    const channel = getEnvOrThrow('WHISH_CHANNEL');
    const secret = getEnvOrThrow('WHISH_SECRET');
    const websiteurl = getEnvOrThrow('WHISH_WEBSITEURL');
    const successCbBase = getEnvOrThrow('CALLBACK_SUCCESS_URL_CREDITS');
    const failureCbBase = Deno.env.get('CALLBACK_FAILURE_URL_CREDITS') || successCbBase;
    const appHmacSecret = Deno.env.get('APP_HMAC_SECRET');

    console.log(`[${requestId}] ENV_LOADED:`, {
      hasChannel: !!channel,
      hasSecret: !!secret,
      hasWebsiteUrl: !!websiteurl,
      hasSuccessCallback: !!successCbBase,
      hasHmacSecret: !!appHmacSecret
    });

    // Parse request body
    let body: any;
    try {
      const bodyText = await req.text();
      console.log(`[${requestId}] BODY_RAW:`, { bodyLength: bodyText.length });
      body = JSON.parse(bodyText || '{}');
      console.log(`[${requestId}] BODY_PARSED:`, {
        keys: Object.keys(body || {}),
        userId: body?.userId,
        creditAmount: body?.creditAmount,
        creditType: body?.creditType
      });
    } catch (parseError: any) {
      console.error(`[${requestId}] BODY_PARSE_ERROR:`, { error: parseError.message });
      body = {};
    }

    // Validate input
    const userId = String(body?.userId);
    const creditAmount = Number(body?.creditAmount);
    const creditType: CreditType = VALID_CREDIT_TYPES.includes(body?.creditType) ? body.creditType : '2month';

    if (!userId) {
      return json({ error: 'Invalid userId' }, 400);
    }

    if (!Number.isFinite(creditAmount) || creditAmount <= 0) {
      return json({ error: 'Invalid creditAmount - must be positive number' }, 400);
    }

    // For '1year' credits, verify the user is a dealer
    let dealerId: number | null = null;
    if (creditType === '1year') {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      const { data: dealership } = await supabase
        .from('dealerships')
        .select('id')
        .eq('user_id', userId)
        .single();

      if (!dealership) {
        console.warn(`[${requestId}] NON_DEALER_1YEAR:`, { userId });
        return json({ error: 'Only dealers can purchase 1-year credits' }, 403);
      }
      dealerId = dealership.id;
      console.log(`[${requestId}] DEALER_VERIFIED:`, { dealerId });
    }

    // Calculate price (1 credit = $1 USD)
    const amount = creditAmount;
    const invoice = `${creditAmount} credits`;
    const externalId = Date.now();
    const state = crypto.randomUUID();

    console.log(`[${requestId}] TRANSACTION_DETAILS:`, {
      userId,
      creditAmount,
      creditType,
      dealerId,
      amount,
      externalId
    });

    // Build callback URLs with HMAC signature
    const baseParams: Record<string, string> = {
      creditAmount: String(creditAmount),
      creditType,
      ...(dealerId ? { dealerId: String(dealerId) } : {}),
      eid: String(externalId),
      state,
      userId: userId,
    };

    const canonical = canonicalizeQuery(baseParams);
    const sig = appHmacSecret ? await hmacSha256Hex(appHmacSecret, canonical) : undefined;

    const qs = new URLSearchParams({
      ...baseParams,
      ...(sig ? { sig } : {})
    }).toString();

    const successCallbackUrl = `${successCbBase}?${qs}`;
    const failureCallbackUrl = `${failureCbBase}?${qs}`;

    // Prepare Whish API request
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

    const requestHeaders = {
      'Content-Type': 'application/json',
      channel,
      secret,
      websiteurl
    };

    console.log(`[${requestId}] WHISH_REQUEST_PREPARED:`, {
      url: `${apiUrl}payment/whish`,
      payload: whishPayload
    });

    // Call Whish API
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      console.error(`[${requestId}] WHISH_TIMEOUT: Request timed out after 10 seconds`);
      controller.abort();
    }, 10000);

    let resp: Response;
    const whishStartTime = Date.now();

    try {
      console.log(`[${requestId}] WHISH_REQUEST: Making API call to Whish`);
      resp = await fetch(`${apiUrl}payment/whish`, {
        method: 'POST',
        headers: requestHeaders,
        body: JSON.stringify(whishPayload),
        signal: controller.signal
      });

      const whishResponseTime = Date.now() - whishStartTime;
      console.log(`[${requestId}] WHISH_RESPONSE:`, {
        status: resp.status,
        statusText: resp.statusText,
        ok: resp.ok,
        responseTimeMs: whishResponseTime
      });
    } catch (fetchError: any) {
      const whishResponseTime = Date.now() - whishStartTime;
      console.error(`[${requestId}] WHISH_FETCH_ERROR:`, {
        error: fetchError.message,
        errorName: fetchError.name,
        responseTimeMs: whishResponseTime
      });
      throw new Error(`Whish request failed: ${fetchError?.message ?? 'network error'}`);
    } finally {
      clearTimeout(timeout);
    }

    // Parse response
    let data: any;
    try {
      const responseText = await resp.text();
      console.log(`[${requestId}] WHISH_RESPONSE_RAW:`, {
        responseLength: responseText.length,
        responsePreview: responseText.substring(0, 500)
      });
      data = JSON.parse(responseText || '{}');
    } catch (parseError: any) {
      console.error(`[${requestId}] WHISH_PARSE_ERROR:`, {
        error: parseError.message,
        responseStatus: resp.status
      });
      data = {};
    }

    if (!resp.ok || !data?.status || !data?.data?.collectUrl) {
      console.error(`[${requestId}] WHISH_PAYMENT_FAILED:`, {
        responseOk: resp.ok,
        responseStatus: resp.status,
        whishStatus: data?.status,
        whishCode: data?.code,
        whishMessage: data?.dialog?.message
      });
      return json({
        error: 'Create payment failed',
        code: data?.code ?? resp.status,
        detail: data?.dialog?.message ?? null
      }, 502);
    }

    // Success
    const totalTime = Date.now() - startTime;
    console.log(`[${requestId}] PAYMENT_SUCCESS:`, {
      externalId,
      userId,
      creditAmount,
      amount,
      collectUrl: data.data.collectUrl,
      totalTimeMs: totalTime
    });

    return json({
      collectUrl: data.data.collectUrl,
      externalId,
      creditAmount
    });

  } catch (err: any) {
    const totalTime = Date.now() - startTime;
    console.error(`[${requestId}] UNEXPECTED_ERROR:`, {
      error: err?.message ?? String(err),
      errorStack: err?.stack,
      totalTimeMs: totalTime
    });
    return json({
      error: 'Internal error',
      message: err?.message ?? String(err)
    }, 500);
  }
});
