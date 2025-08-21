import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

interface WhishStatusResponse {
  status: boolean;
  code: string | null;
  data: {
    collectStatus: 'success' | 'failed' | 'pending';
  } | null;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS'
};

const json = (data: any, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: {
    'Content-Type': 'application/json',
    ...corsHeaders
  }
});

// HMAC verification function
async function verifyHmacIfPresent(query: URLSearchParams, secret: string): Promise<boolean> {
  const sig = query.get('sig');
  if (!sig) return true; // No signature to verify

  const params = new URLSearchParams();
  const requiredParams = ['eid', 'dealerId', 'plan'];
  const optionalParams = ['state'];

  // Build canonical query string (sorted by key)
  const allParams = [...requiredParams, ...optionalParams];
  allParams.sort();

  for (const param of allParams) {
    const value = query.get(param);
    if (value !== null) {
      params.append(param, value);
    }
  }

  const baseString = params.toString();

  // Create expected signature
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), {
    name: 'HMAC',
    hash: 'SHA-256'
  }, false, ['sign']);
  
  const expectedSig = await crypto.subtle.sign('HMAC', key, enc.encode(baseString));
  const expectedHex = Array.from(new Uint8Array(expectedSig))
    .map(b => b.toString(16).padStart(2, '0')).join('');

  // Timing-safe comparison
  if (sig.length !== expectedHex.length) return false;
  let result = 0;
  for (let i = 0; i < sig.length; i++) {
    result |= sig.charCodeAt(i) ^ expectedHex.charCodeAt(i);
  }
  return result === 0;
}

// Verify payment with Whish API
async function getWhishStatus(externalId: number): Promise<'success' | 'failed' | 'pending' | 'error'> {
  try {
    const apiUrl = Deno.env.get('WHISH_API_URL') || 'https://lb.sandbox.whish.money/itel-service/api/';
    const channel = Deno.env.get('WHISH_CHANNEL');
    const secret = Deno.env.get('WHISH_SECRET');
    const websiteUrl = Deno.env.get('WHISH_WEBSITEURL');

    if (!channel || !secret || !websiteUrl) {
      console.error('Missing required Whish API credentials');
      return 'error';
    }

    const response = await fetch(`${apiUrl}payment/collect/status`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'channel': channel,
        'secret': secret,
        'websiteurl': websiteUrl,
      },
      body: JSON.stringify({
        currency: 'USD',
        externalId: externalId
      })
    });

    if (!response.ok) {
      console.error(`Whish API HTTP error: ${response.status}`);
      return 'error';
    }

    const data: WhishStatusResponse = await response.json();

    if (!data.status) {
      console.warn(`Whish API returned error: ${data.code}`);
      return 'error';
    }

    if (!data.data || !data.data.collectStatus) {
      console.error('Invalid response structure from Whish API');
      return 'error';
    }

    return data.data.collectStatus;
  } catch (error) {
    console.error('Error calling Whish status API:', error);
    return 'error';
  }
}

// Calculate new subscription end date
function extendSubscription(endDate: Date | null, plan: 'monthly' | 'yearly'): Date {
  const now = new Date();
  const currentEnd = endDate || now;
  const baseDate = currentEnd > now ? currentEnd : now;
  const newEndDate = new Date(baseDate);

  if (plan === 'monthly') {
    newEndDate.setDate(newEndDate.getDate() + 30);
  } else if (plan === 'yearly') {
    newEndDate.setDate(newEndDate.getDate() + 365);
  }

  return newEndDate;
}

Deno.serve(async (req: Request) => {
  const startTime = Date.now();
  const correlationId = crypto.randomUUID();
  console.log(`[${correlationId}] Processing request: ${req.method} ${req.url}`);

  try {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders });
    }

    // Only accept GET requests
    if (req.method !== 'GET') {
      console.warn(`[${correlationId}] Method not allowed: ${req.method}`);
      return json({ error: 'Method not allowed' }, 405);
    }

    // Parse and validate query parameters
    const url = new URL(req.url);
    const eid = url.searchParams.get('eid');
    const dealerId = url.searchParams.get('dealerId');
    const plan = url.searchParams.get('plan');

    if (!eid || !dealerId || !plan) {
      console.warn(`[${correlationId}] Missing parameters`);
      return json({
        error: 'Missing or invalid required parameters: eid, dealerId, plan'
      }, 400);
    }

    if (!['monthly', 'yearly'].includes(plan)) {
      console.warn(`[${correlationId}] Invalid plan: ${plan}`);
      return json({ error: 'Invalid plan - must be monthly or yearly' }, 400);
    }

    const externalId = parseInt(eid, 10);
    if (isNaN(externalId)) {
      console.warn(`[${correlationId}] Invalid external ID: ${eid}`);
      return json({ error: 'Invalid external ID - must be numeric' }, 400);
    }

    console.log(`[${correlationId}] Validated params:`, {
      externalId,
      dealerId,
      plan
    });

    // Verify HMAC if present
    const hmacSecret = Deno.env.get('APP_HMAC_SECRET');
    if (hmacSecret) {
      if (!(await verifyHmacIfPresent(url.searchParams, hmacSecret))) {
        console.warn(`[${correlationId}] HMAC verification failed`);
        return json({ error: 'Invalid signature' }, 401);
      }
      console.log(`[${correlationId}] HMAC verified successfully`);
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check for idempotency (already processed)
    const { data: existingLog } = await supabase
      .from('payment_logs')
      .select('status')
      .eq('external_id', externalId)
      .eq('status', 'success')
      .single();

    if (existingLog) {
      console.log(`[${correlationId}] Payment already processed`);
      return json({
        eid: externalId,
        dealerId,
        plan,
        status: 'already_processed',
        message: 'Payment already processed',
        processedAt: new Date().toISOString()
      });
    }

    // Verify payment status with Whish
    console.log(`[${correlationId}] Verifying payment status with Whish`);
    const whishStatus = await getWhishStatus(externalId);

    if (whishStatus === 'error') {
      console.error(`[${correlationId}] Error verifying payment status`);
      return json({
        eid: externalId,
        dealerId,
        plan,
        status: 'error',
        message: 'Could not verify payment status',
        processedAt: new Date().toISOString()
      }, 202);
    }

    if (whishStatus !== 'success') {
      console.log(`[${correlationId}] Payment not successful: ${whishStatus}`);
      
      // Update payment log if exists
      await supabase
        .from('payment_logs')
        .update({
          status: 'failed',
          whish_status: whishStatus,
          processed_at: new Date().toISOString()
        })
        .eq('external_id', externalId);

      return json({
        eid: externalId,
        dealerId,
        plan,
        status: whishStatus,
        message: `Payment status is ${whishStatus}`,
        processedAt: new Date().toISOString()
      }, 202);
    }

    // Get current dealership
    const { data: dealership, error: dealerError } = await supabase
      .from('dealerships')
      .select('subscription_end_date')
      .eq('id', dealerId)
      .single();

    if (dealerError) {
      console.error(`[${correlationId}] Error finding dealership:`, dealerError);
      return json({ error: 'Dealership not found' }, 404);
    }

    // Calculate new subscription end date
    const currentEndDate = dealership.subscription_end_date ? new Date(dealership.subscription_end_date) : null;
    const newEndDate = extendSubscription(currentEndDate, plan as 'monthly' | 'yearly');

    console.log(`[${correlationId}] Extending subscription:`, {
      currentEndDate,
      newEndDate,
      plan
    });

    // Update dealership subscription
    const { error: updateDealerError } = await supabase
      .from('dealerships')
      .update({
        subscription_end_date: newEndDate.toISOString().split('T')[0], // Date only
        subscription_status: 'active'
      })
      .eq('id', dealerId);

    if (updateDealerError) {
      console.error(`[${correlationId}] Error updating dealership:`, updateDealerError);
      throw updateDealerError;
    }

    // Update payment log
    await supabase
      .from('payment_logs')
      .upsert({
        external_id: externalId,
        dealer_id: parseInt(dealerId),
        plan,
        amount: plan === 'monthly' ? 1 : 2500, // Match your pricing
        currency: 'USD',
        status: 'success',
        whish_status: 'success',
        processed_at: new Date().toISOString()
      });

    console.log(`[${correlationId}] Successfully processed payment`);

    const processingTime = Date.now() - startTime;
    console.log(`[${correlationId}] Request completed in ${processingTime}ms`);

    return json({
      eid: externalId,
      dealerId,
      plan,
      status: 'success',
      message: 'Payment processed successfully',
      processedAt: new Date().toISOString()
    });

  } catch (error: any) {
    const processingTime = Date.now() - startTime;
    console.error(`[${correlationId}] Unexpected error after ${processingTime}ms:`, error);
    return json({
      error: 'Internal server error',
      correlationId
    }, 500);
  }
});
