import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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

function getEnvOrThrow(name, fallback) {
  const v = Deno.env.get(name) ?? fallback;
  if (!v) throw new Error(`Missing required env: ${name}`);
  return v;
}

Deno.serve(async (req) => {
  const debugLog = [];
  
  try {
    debugLog.push("1. Starting request processing");
    
    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders });
    }
    
    if (req.method !== 'POST') {
      return json({ error: 'Method not allowed' }, 405);
    }

    debugLog.push("2. Method check passed");

    // Environment variable check
    debugLog.push("3. Checking environment variables...");
    
    let apiUrl, channel, secret, websiteurl, successCbBase, failureCbBase;
    
    try {
      apiUrl = getEnvOrThrow('WHISH_API_URL', 'https://lb.sandbox.whish.money/itel-service/api/').replace(/\/+$/, '') + '/';
      debugLog.push(`3a. WHISH_API_URL: ${apiUrl}`);
    } catch (e) {
      debugLog.push(`3a. ERROR getting WHISH_API_URL: ${e.message}`);
      throw e;
    }
    
    try {
      channel = getEnvOrThrow('WHISH_CHANNEL');
      debugLog.push(`3b. WHISH_CHANNEL: ${channel}`);
    } catch (e) {
      debugLog.push(`3b. ERROR getting WHISH_CHANNEL: ${e.message}`);
      throw e;
    }
    
    try {
      secret = getEnvOrThrow('WHISH_SECRET');
      debugLog.push(`3c. WHISH_SECRET: ${secret.substring(0, 8)}...`);
    } catch (e) {
      debugLog.push(`3c. ERROR getting WHISH_SECRET: ${e.message}`);
      throw e;
    }
    
    try {
      websiteurl = getEnvOrThrow('WHISH_WEBSITEURL');
      debugLog.push(`3d. WHISH_WEBSITEURL: ${websiteurl}`);
    } catch (e) {
      debugLog.push(`3d. ERROR getting WHISH_WEBSITEURL: ${e.message}`);
      throw e;
    }
    
    try {
      successCbBase = getEnvOrThrow('CALLBACK_SUCCESS_URL');
      debugLog.push(`3e. CALLBACK_SUCCESS_URL: ${successCbBase}`);
    } catch (e) {
      debugLog.push(`3e. ERROR getting CALLBACK_SUCCESS_URL: ${e.message}`);
      throw e;
    }
    
    failureCbBase = Deno.env.get('CALLBACK_FAILURE_URL') || successCbBase;
    debugLog.push(`3f. CALLBACK_FAILURE_URL: ${failureCbBase}`);

    debugLog.push("4. All environment variables loaded successfully");

    // Parse request body
    debugLog.push("5. Parsing request body...");
    let body;
    try {
      body = await req.json().catch(() => ({}));
      debugLog.push(`5a. Request body: ${JSON.stringify(body)}`);
    } catch (e) {
      debugLog.push(`5a. ERROR parsing request body: ${e.message}`);
      throw e;
    }

    const dealerId = Number(body?.dealerId);
    const plan = String(body?.plan);
    
    debugLog.push(`5b. Parsed dealerId: ${dealerId}, plan: ${plan}`);

    if (!Number.isFinite(dealerId) || dealerId <= 0) {
      debugLog.push("5c. ERROR: Invalid dealerId");
      return json({ error: 'Invalid dealerId', debugLog }, 400);
    }
    
    if (!['monthly', 'yearly'].includes(plan)) {
      debugLog.push("5d. ERROR: Invalid plan");
      return json({ error: 'Invalid plan', debugLog }, 400);
    }

    debugLog.push("6. Request validation passed");

    const amount = plan === 'monthly' ? 250 : 2500;
    const invoice = plan === 'monthly' ? 'Monthly subscription' : 'Yearly subscription';
    const externalId = Date.now();
    
    debugLog.push(`7. Payment details: amount=${amount}, invoice=${invoice}, externalId=${externalId}`);

    // Build callback URLs
    debugLog.push("8. Building callback URLs...");
    const state = crypto.randomUUID();
    const baseParams = {
      eid: String(externalId),
      dealerId: String(dealerId),
      plan,
      state
    };
    
    const qs = new URLSearchParams(baseParams).toString();
    const successCallbackUrl = `${successCbBase}?${qs}`;
    const failureCallbackUrl = `${failureCbBase}?${qs}`;
    
    debugLog.push(`8a. Success callback: ${successCallbackUrl}`);
    debugLog.push(`8b. Failure callback: ${failureCallbackUrl}`);

    // Test Whish API call
    debugLog.push("9. Preparing Whish API call...");
    const whishPayload = {
      amount,
      currency: 'USD',
      invoice,
      externalId,
      successCallbackUrl,
      failureCallbackUrl,
      successRedirectUrl: 'https://fleetapp.me/success',
      failureRedirectUrl: 'https://fleetapp.me/failure'
    };
    
    debugLog.push(`9a. Whish payload: ${JSON.stringify(whishPayload)}`);
    debugLog.push(`9b. Whish URL: ${apiUrl}payment/whish`);
    debugLog.push(`9c. Headers: channel=${channel}, secret=${secret.substring(0,8)}..., websiteurl=${websiteurl}`);

    try {
      debugLog.push("10. Making Whish API call...");
      
      const controller = new AbortController();
      const timeout = setTimeout(() => {
        debugLog.push("10a. Request timeout!");
        controller.abort();
      }, 10000);
      
      const resp = await fetch(`${apiUrl}payment/whish`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          channel,
          secret,
          websiteurl
        },
        body: JSON.stringify(whishPayload),
        signal: controller.signal
      });
      
      clearTimeout(timeout);
      
      debugLog.push(`10b. Whish response status: ${resp.status}`);
      debugLog.push(`10c. Whish response ok: ${resp.ok}`);
      
      const data = await resp.json().catch((e) => {
        debugLog.push(`10d. Error parsing Whish response JSON: ${e.message}`);
        return {};
      });
      
      debugLog.push(`10e. Whish response data: ${JSON.stringify(data)}`);
      
      if (!resp.ok || !data?.status || !data?.data?.collectUrl) {
        debugLog.push("10f. Whish API call failed or invalid response");
        return json({
          error: 'Whish API call failed',
          whishStatus: resp.status,
          whishData: data,
          debugLog
        }, 502);
      }
      
      debugLog.push("11. Whish API call successful!");
      
      return json({
        success: true,
        collectUrl: data.data.collectUrl,
        externalId,
        debugLog
      });
      
    } catch (e) {
      debugLog.push(`10. ERROR in Whish API call: ${e.message}`);
      debugLog.push(`10. Error stack: ${e.stack}`);
      throw e;
    }

  } catch (err) {
    debugLog.push(`FATAL ERROR: ${err.message}`);
    debugLog.push(`Error stack: ${err.stack}`);
    
    return json({
      error: 'Internal error',
      message: err?.message ?? String(err),
      stack: err?.stack,
      debugLog
    }, 500);
  }
});
