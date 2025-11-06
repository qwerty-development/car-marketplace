const SUCCESS_REDIRECT_URL = 'https://fleetapp.me/success';
const FAILURE_REDIRECT_URL = 'https://fleetapp.me/failure';
const PRICE_MONTHLY_USD = Deno.env.get('PRICE_MONTHLY_USD');
const PRICE_YEARLY_USD = Deno.env.get('PRICE_YEARLY_USD');
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
  const requestId = crypto.randomUUID();
  const startTime = Date.now();
  console.log(`[${requestId}] REQUEST_START:`, {
    method: req.method,
    url: req.url,
    userAgent: req.headers.get('user-agent'),
    origin: req.headers.get('origin'),
    timestamp: new Date().toISOString()
  });
  if (req.method === 'OPTIONS') {
    console.log(`[${requestId}] CORS_PREFLIGHT: Handled successfully`);
    return new Response('ok', {
      headers: corsHeaders
    });
  }
  if (req.method !== 'POST') {
    console.error(`[${requestId}] METHOD_ERROR:`, {
      method: req.method,
      expectedMethod: 'POST'
    });
    return json({
      error: 'Method not allowed'
    }, 405);
  }
  try {
    console.log(`[${requestId}] ENV_CHECK: Starting environment validation`);
    // Read env with enhanced logging
    // const apiUrl = "https://lb.sandbox.whish.money/itel-service/api/";
    // const apiUrl = "https://ae.sandbox.whish.money/itel-service/api/";
    const apiUrl = "https://whish.money/itel-service/api/";
    let channel, secret, websiteurl, successCbBase, failureCbBase, appHmacSecret;
    try {
      channel = getEnvOrThrow('WHISH_CHANNEL');
      secret = getEnvOrThrow('WHISH_SECRET');
      websiteurl = getEnvOrThrow('WHISH_WEBSITEURL');
      successCbBase = getEnvOrThrow('CALLBACK_SUCCESS_URL');
      failureCbBase = Deno.env.get('CALLBACK_FAILURE_URL') || successCbBase;
      appHmacSecret = Deno.env.get('APP_HMAC_SECRET');
      // DEBUG: Log actual values (be careful with secrets in production)
      console.log(`[${requestId}] ENV_DEBUG:`, {
        hasChannel: !!channel,
        channelValue: channel,
        hasSecret: !!secret,
        secretValue: secret,
        hasWebsiteUrl: !!websiteurl,
        websiteUrlValue: websiteurl,
        hasSuccessCallback: !!successCbBase,
        successCallbackValue: successCbBase,
        hasFailureCallback: !!Deno.env.get('CALLBACK_FAILURE_URL'),
        failureCallbackValue: failureCbBase,
        hasHmacSecret: !!appHmacSecret,
        apiUrl: apiUrl
      });
    } catch (envError) {
      console.error(`[${requestId}] ENV_ERROR:`, {
        error: envError.message,
        availableEnvVars: Object.keys(Deno.env.toObject()).filter((k)=>k.startsWith('WHISH_') || k.startsWith('CALLBACK_'))
      });
      throw envError;
    }
    // Parse request body
    let body;
    try {
      const bodyText = await req.text();
      console.log(`[${requestId}] BODY_RAW:`, {
        bodyLength: bodyText.length,
        bodyPreview: bodyText.substring(0, 200)
      });
      body = JSON.parse(bodyText || '{}');
      console.log(`[${requestId}] BODY_PARSED:`, {
        keys: Object.keys(body || {}),
        dealerId: body?.dealerId,
        plan: body?.plan
      });
    } catch (parseError) {
      console.error(`[${requestId}] BODY_PARSE_ERROR:`, {
        error: parseError.message
      });
      body = {};
    }
    // Validate input
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
    const externalId = Date.now();
    const state = crypto.randomUUID();
    // Build callback URLs
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
    console.log(`[${requestId}] WHISH_REQUEST_DEBUG:`, {
      url: `${apiUrl}payment/whish`,
      method: 'POST',
      headers: requestHeaders,
      payload: whishPayload
    });
    // Test the API endpoint first with a simple GET to see if it's reachable
    console.log(`[${requestId}] TESTING_API_CONNECTIVITY`);
    try {
      const testResponse = await fetch(`${apiUrl}payment/account/balance`, {
        method: 'GET',
        headers: requestHeaders
      });
      console.log(`[${requestId}] API_CONNECTIVITY_TEST:`, {
        status: testResponse.status,
        statusText: testResponse.statusText,
        ok: testResponse.ok,
        headers: Object.fromEntries(testResponse.headers.entries())
      });
      if (testResponse.status === 404) {
        const testResponseText = await testResponse.text();
        console.log(`[${requestId}] API_404_RESPONSE:`, {
          responseLength: testResponseText.length,
          responsePreview: testResponseText.substring(0, 500)
        });
      }
    } catch (testError) {
      console.error(`[${requestId}] API_CONNECTIVITY_ERROR:`, {
        error: testError.message,
        errorName: testError.name
      });
    }
    // Call Whish API
    const controller = new AbortController();
    const timeout = setTimeout(()=>{
      console.error(`[${requestId}] WHISH_TIMEOUT: Request timed out after 10 seconds`);
      controller.abort();
    }, 10000);
    let resp;
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
        responseTimeMs: whishResponseTime,
        headers: Object.fromEntries(resp.headers.entries())
      });
    } catch (fetchError) {
      const whishResponseTime = Date.now() - whishStartTime;
      console.error(`[${requestId}] WHISH_FETCH_ERROR:`, {
        error: fetchError.message,
        errorName: fetchError.name,
        responseTimeMs: whishResponseTime
      });
      throw new Error(`Whish request failed: ${fetchError?.message ?? 'network error'}`);
    } finally{
      clearTimeout(timeout);
    }
    // Parse response
    let data;
    try {
      const responseText = await resp.text();
      console.log(`[${requestId}] WHISH_RESPONSE_RAW:`, {
        responseLength: responseText.length,
        responsePreview: responseText.substring(0, 1000) // Show more for debugging
      });
      data = JSON.parse(responseText || '{}');
    } catch (parseError) {
      console.error(`[${requestId}] WHISH_PARSE_ERROR:`, {
        error: parseError.message,
        responseStatus: resp.status,
        responseOk: resp.ok
      });
      data = {};
    }
    if (!resp.ok || !data?.status || !data?.data?.collectUrl) {
      console.error(`[${requestId}] WHISH_PAYMENT_FAILED:`, {
        responseOk: resp.ok,
        responseStatus: resp.status,
        whishStatus: data?.status,
        whishCode: data?.code,
        whishMessage: data?.dialog?.message,
        fullWhishResponse: data
      });
      return json({
        error: 'Create payment failed',
        code: data?.code ?? resp.status,
        detail: data?.dialog?.message ?? null
      }, 502);
    }
    // Success
    console.log(`[${requestId}] PAYMENT_SUCCESS:`, {
      externalId,
      dealerId,
      plan,
      amount,
      collectUrl: data.data.collectUrl
    });
    return json({
      collectUrl: data.data.collectUrl,
      externalId
    });
  } catch (err) {
    console.error(`[${requestId}] UNEXPECTED_ERROR:`, {
      error: err?.message ?? String(err),
      errorStack: err?.stack
    });
    return json({
      error: 'Internal error',
      message: err?.message ?? String(err)
    }, 500);
  }
});
