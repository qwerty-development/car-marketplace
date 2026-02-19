// supabase/functions/credit-purchase-callback/index.ts
// Handles Whish payment callbacks for credit purchases
// Creates credit_batches with expiry dates (2month or 1year)

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
  const allParams = ['creditAmount', 'creditType', 'dealerId', 'eid', 'state', 'userId'];

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
    const creditType = url.searchParams.get('creditType') || '2month';
    const dealerIdStr = url.searchParams.get('dealerId');

    if (!eid || !userId || !creditAmountStr) {
      console.warn(`[${correlationId}] Missing parameters`);
      return json({
        error: 'Missing or invalid required parameters: eid, userId, creditAmount'
      }, 400);
    }

    const externalId = parseInt(eid, 10);
    const creditAmount = parseFloat(creditAmountStr);
    const dealerId = dealerIdStr ? parseInt(dealerIdStr, 10) : null;

    if (isNaN(externalId) || isNaN(creditAmount) || creditAmount <= 0) {
      console.warn(`[${correlationId}] Invalid parameters`);
      return json({ error: 'Invalid externalId or creditAmount' }, 400);
    }

    if (!['2month', '1year'].includes(creditType)) {
      console.warn(`[${correlationId}] Invalid creditType: ${creditType}`);
      return json({ error: 'Invalid creditType' }, 400);
    }

    console.log(`[${correlationId}] Validated params:`, {
      externalId,
      userId,
      creditAmount,
      creditType,
      dealerId
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

    // Check for idempotency (already processed) — check credit_batches
    const { data: existingBatch } = await supabase
      .from('credit_batches')
      .select('id')
      .eq('whish_external_id', externalId)
      .single();

    if (existingBatch) {
      console.log(`[${correlationId}] Payment already processed (batch #${existingBatch.id})`);
      return json({
        eid: externalId,
        userId,
        creditAmount,
        creditType,
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

    // Compute expiry date based on credit type
    const now = new Date();
    let expiresAt: Date;
    if (creditType === '1year') {
      expiresAt = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate(), 23, 59, 59);
    } else {
      expiresAt = new Date(now.getFullYear(), now.getMonth() + 2, now.getDate(), 23, 59, 59);
    }

    console.log(`[${correlationId}] Creating credit batch:`, {
      creditType,
      expiresAt: expiresAt.toISOString(),
      dealerId
    });

    // Create credit batch
    const { data: newBatch, error: batchError } = await supabase
      .from('credit_batches')
      .insert({
        user_id: userId,
        dealer_id: dealerId,
        purchased_credits: creditAmount,
        remaining_credits: creditAmount,
        credit_type: creditType,
        expires_at: expiresAt.toISOString(),
        status: 'active',
        source: 'purchase',
        whish_external_id: externalId,
        metadata: {
          price_usd: creditAmount,
          payment_method: 'whish'
        }
      })
      .select('id')
      .single();

    if (batchError) {
      console.error(`[${correlationId}] Error creating credit batch:`, batchError);
      throw batchError;
    }

    // Sync the cached balance on users table
    const { data: syncResult } = await supabase.rpc('sync_credit_balance', {
      p_user_id: userId
    });

    const newBalance = syncResult ?? (user.credit_balance || 0) + creditAmount;

    console.log(`[${correlationId}] Balance synced:`, { newBalance });

    // Log transaction in audit trail
    await supabase
      .from('credit_transactions')
      .insert({
        user_id: userId,
        amount: creditAmount,
        balance_after: newBalance,
        transaction_type: 'purchase',
        purpose: 'credit_purchase',
        description: `Purchased ${creditAmount} ${creditType} credits via Whish`,
        whish_external_id: externalId,
        payment_status: 'success',
        batch_id: newBatch.id,
        metadata: {
          price_usd: creditAmount,
          payment_method: 'whish',
          credit_type: creditType,
          expires_at: expiresAt.toISOString()
        }
      });

    console.log(`[${correlationId}] Successfully processed credit purchase`);

    const processingTime = Date.now() - startTime;
    console.log(`[${correlationId}] Request completed in ${processingTime}ms`);

    return json({
      eid: externalId,
      userId,
      creditAmount,
      creditType,
      status: 'success',
      message: 'Credits added successfully',
      newBalance,
      expiresAt: expiresAt.toISOString(),
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
