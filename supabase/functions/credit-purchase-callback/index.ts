// supabase/functions/credit-purchase-callback/index.ts
// Handles Whish payment callbacks for credit purchases

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
  const requiredParams = ['eid', 'userId', 'creditAmount'];
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
    const apiUrl = 'https://whish.money/itel-service/api/';
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

Deno.serve(async (req: Request) => {
  const startTime = Date.now();
  const correlationId = crypto.randomUUID();
  console.log(`[${correlationId}] Processing credit purchase callback: ${req.method} ${req.url}`);

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
    const userId = url.searchParams.get('userId');
    const creditAmountStr = url.searchParams.get('creditAmount');

    if (!eid || !userId || !creditAmountStr) {
      console.warn(`[${correlationId}] Missing parameters`);
      return json({
        error: 'Missing or invalid required parameters: eid, userId, creditAmount'
      }, 400);
    }

    const externalId = parseInt(eid, 10);
    const creditAmount = parseFloat(creditAmountStr);

    if (isNaN(externalId) || isNaN(creditAmount) || creditAmount <= 0) {
      console.warn(`[${correlationId}] Invalid parameters`);
      return json({ error: 'Invalid externalId or creditAmount' }, 400);
    }

    console.log(`[${correlationId}] Validated params:`, {
      externalId,
      userId,
      creditAmount
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
    const { data: existingTransaction } = await supabase
      .from('credit_transactions')
      .select('id, payment_status')
      .eq('whish_external_id', externalId)
      .eq('payment_status', 'success')
      .single();

    if (existingTransaction) {
      console.log(`[${correlationId}] Payment already processed`);
      return json({
        eid: externalId,
        userId,
        creditAmount,
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
        userId,
        creditAmount,
        status: 'error',
        message: 'Could not verify payment status',
        processedAt: new Date().toISOString()
      }, 202);
    }

    if (whishStatus !== 'success') {
      console.log(`[${correlationId}] Payment not successful: ${whishStatus}`);

      // Log failed transaction
      await supabase
        .from('credit_transactions')
        .insert({
          user_id: userId,
          amount: 0,
          balance_after: 0,
          transaction_type: 'purchase',
          purpose: 'credit_purchase',
          description: `Credit purchase failed (${whishStatus})`,
          whish_external_id: externalId,
          payment_status: 'failed'
        });

      return json({
        eid: externalId,
        userId,
        creditAmount,
        status: whishStatus,
        message: `Payment status is ${whishStatus}`,
        processedAt: new Date().toISOString()
      }, 202);
    }

    // Get current user balance
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('credit_balance')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      console.error(`[${correlationId}] Error finding user:`, userError);
      return json({ error: 'User not found' }, 404);
    }

    const currentBalance = user.credit_balance || 0;
    const newBalance = currentBalance + creditAmount;

    console.log(`[${correlationId}] Updating credit balance:`, {
      currentBalance,
      creditAmount,
      newBalance
    });

    // Update user's credit balance
    const { error: updateUserError } = await supabase
      .from('users')
      .update({ credit_balance: newBalance })
      .eq('id', userId);

    if (updateUserError) {
      console.error(`[${correlationId}] Error updating user balance:`, updateUserError);
      throw updateUserError;
    }

    // Log successful transaction
    await supabase
      .from('credit_transactions')
      .insert({
        user_id: userId,
        amount: creditAmount,
        balance_after: newBalance,
        transaction_type: 'purchase',
        purpose: 'credit_purchase',
        description: `Purchased ${creditAmount} credits via Whish`,
        whish_external_id: externalId,
        payment_status: 'success',
        metadata: {
          price_usd: creditAmount, // 1:1 ratio
          payment_method: 'whish'
        }
      });

    console.log(`[${correlationId}] Successfully processed credit purchase`);

    const processingTime = Date.now() - startTime;
    console.log(`[${correlationId}] Request completed in ${processingTime}ms`);

    return json({
      eid: externalId,
      userId,
      creditAmount,
      status: 'success',
      message: 'Credits added successfully',
      newBalance,
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
