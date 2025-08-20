# Whish Payment Integration with Supabase Edge Functions

This guide provides step-by-step instructions for implementing Whish payment gateway integration using Supabase Edge Functions for secure server-side payment processing.

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Architecture](#architecture)
4. [Environment Setup](#environment-setup)
5. [Database Schema](#database-schema)
6. [Edge Function 1: Payment Creation](#edge-function-1-payment-creation)
7. [Edge Function 2: Payment Callback Handler](#edge-function-2-payment-callback-handler)
8. [Client Integration](#client-integration)
9. [Testing](#testing)
10. [Security Considerations](#security-considerations)
11. [Troubleshooting](#troubleshooting)

## Overview

This integration consists of two Supabase Edge Functions:

1. **`whish-create-payment`**: Server-side function that securely creates payments with Whish API
2. **`whish-success`**: Callback handler that processes payment success/failure notifications

### Why Use Server-Side Payment Creation?

- **Security**: Prevents client-side tampering of payment amounts
- **Credentials Protection**: Keeps Whish API credentials secure on the server
- **Consistency**: Ensures pricing is controlled server-side
- **Audit Trail**: Provides server-side logging of all payment attempts

## Prerequisites

- Supabase project with Edge Functions enabled
- Whish API credentials (channel, secret, websiteurl)
- Node.js/npm for local development (optional)
- Supabase CLI for deployment

## Architecture

```
[Mobile App] → [whish-create-payment] → [Whish API] → [Payment Page]
                                                           ↓
[whish-success] ← [Whish Callback] ← [Payment Complete]
      ↓
[Database Update]
```

## Environment Setup

### Required Environment Variables

Set these in your Supabase Dashboard → Project Settings → Edge Functions → Environment Variables:

```env
# Whish API Configuration
WHISH_API_URL=https://lb.sandbox.whish.money/itel-service/api/
WHISH_CHANNEL=your_channel_id
WHISH_SECRET=your_secret_key
WHISH_WEBSITEURL=your_website_url

# Callback URLs
CALLBACK_SUCCESS_URL=https://your-project.supabase.co/functions/v1/whish-success
CALLBACK_FAILURE_URL=https://your-project.supabase.co/functions/v1/whish-success

# Security
APP_HMAC_SECRET=your_secure_random_string

# Pricing (in USD cents)
PRICE_MONTHLY_USD=250
PRICE_YEARLY_USD=2500

# Redirect URLs (shown to user after payment)
SUCCESS_REDIRECT_URL=https://yourapp.com/success
FAILURE_REDIRECT_URL=https://yourapp.com/failure

# Supabase (automatically available in Edge Functions)
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### Generating HMAC Secret

```bash
# Generate a secure HMAC secret
openssl rand -hex 32
```

## Database Schema

### 1. Dealerships Table (existing)

```sql
-- Assuming you already have a dealerships table like this:
CREATE TABLE dealerships (
  id BIGINT PRIMARY KEY,
  name TEXT NOT NULL,
  subscription_end_date DATE,
  subscription_status TEXT DEFAULT 'inactive',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### 2. Payment Logs Table (new)

```sql
-- Create payment logs table for audit trail and idempotency
CREATE TABLE payment_logs (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Transaction identifiers
  external_id BIGINT NOT NULL,
  dealer_id BIGINT NOT NULL REFERENCES dealerships(id),
  
  -- Payment details
  plan TEXT NOT NULL CHECK (plan IN ('monthly', 'yearly')),
  amount NUMERIC(12,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  
  -- Status tracking
  status TEXT NOT NULL CHECK (status IN ('pending', 'success', 'failed')),
  whish_status TEXT,
  processed_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT
);

-- Create unique index for idempotency
CREATE UNIQUE INDEX idx_payment_logs_external_id ON payment_logs(external_id);

-- Create index for dealer lookups
CREATE INDEX idx_payment_logs_dealer_id ON payment_logs(dealer_id);
```

## Edge Function 1: Payment Creation

### File: `supabase/functions/whish-create-payment/index.ts`

```typescript
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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
const toHex = (buf: ArrayBuffer) => Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');

async function hmacSha256Hex(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), {
    name: 'HMAC',
    hash: 'SHA-256'
  }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(data));
  return toHex(sig);
}

function canonicalizeQuery(params: Record<string, any>): string {
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
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    // Read environment variables
    const apiUrl = getEnvOrThrow('WHISH_API_URL', 'https://lb.sandbox.whish.money/itel-service/api/').replace(/\/+$/, '') + '/';
    const channel = getEnvOrThrow('WHISH_CHANNEL');
    const secret = getEnvOrThrow('WHISH_SECRET');
    const websiteurl = getEnvOrThrow('WHISH_WEBSITEURL');
    const successCbBase = getEnvOrThrow('CALLBACK_SUCCESS_URL');
    const failureCbBase = Deno.env.get('CALLBACK_FAILURE_URL') || successCbBase;
    const appHmacSecret = Deno.env.get('APP_HMAC_SECRET');
    const priceMonthly = parseInt(Deno.env.get('PRICE_MONTHLY_USD') || '250');
    const priceYearly = parseInt(Deno.env.get('PRICE_YEARLY_USD') || '2500');
    const successRedirect = Deno.env.get('SUCCESS_REDIRECT_URL') || 'https://yourapp.com/success';
    const failureRedirect = Deno.env.get('FAILURE_REDIRECT_URL') || 'https://yourapp.com/failure';

    // Parse and validate request
    const body = await req.json().catch(() => ({}));
    const dealerId = Number(body?.dealerId);
    const plan = String(body?.plan);

    if (!Number.isFinite(dealerId) || dealerId <= 0) {
      return json({ error: 'Invalid dealerId' }, 400);
    }
    if (!['monthly', 'yearly'].includes(plan)) {
      return json({ error: 'Invalid plan (monthly|yearly)' }, 400);
    }

    // Calculate payment details
    const amount = plan === 'monthly' ? priceMonthly : priceYearly;
    const invoice = plan === 'monthly' ? 'Monthly subscription' : 'Yearly subscription';
    const externalId = Date.now(); // Unique numeric ID

    // Build signed callback URLs
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

    // Optional: Log pending transaction
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
        console.warn('Failed to log pending transaction:', e);
      }
    }

    // Call Whish API
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    
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
        successRedirectUrl: successRedirect,
        failureRedirectUrl: failureRedirect
      }),
      signal: controller.signal
    }).finally(() => clearTimeout(timeout));

    const data = await resp.json().catch(() => ({}));

    if (!resp.ok || !data?.status || !data?.data?.collectUrl) {
      return json({
        error: 'Create payment failed',
        code: data?.code ?? resp.status,
        detail: data?.dialog?.message ?? null
      }, 502);
    }

    return json({
      collectUrl: data.data.collectUrl,
      externalId
    });

  } catch (err: any) {
    return json({
      error: 'Internal error',
      message: err?.message ?? String(err)
    }, 500);
  }
});
```

## Edge Function 2: Payment Callback Handler

### File: `supabase/functions/whish-success/index.ts`

```typescript
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
async function verifyHmac(query: URLSearchParams, secret: string): Promise<boolean> {
  const sig = query.get('sig');
  if (!sig) return true; // No signature to verify

  const params = new URLSearchParams();
  ['eid', 'dealerId', 'plan', 'state'].sort().forEach(param => {
    const value = query.get(param);
    if (value !== null) params.append(param, value);
  });

  const expectedSig = await crypto.subtle.sign(
    'HMAC',
    await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), 
      { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']),
    new TextEncoder().encode(params.toString())
  );

  const expectedHex = Array.from(new Uint8Array(expectedSig))
    .map(b => b.toString(16).padStart(2, '0')).join('');

  return sig === expectedHex;
}

// Verify payment with Whish API
async function getWhishStatus(externalId: number): Promise<'success' | 'failed' | 'pending' | 'error'> {
  try {
    const apiUrl = Deno.env.get('WHISH_API_URL') || 'https://lb.sandbox.whish.money/itel-service/api/';
    const channel = Deno.env.get('WHISH_CHANNEL');
    const secret = Deno.env.get('WHISH_SECRET');
    const websiteUrl = Deno.env.get('WHISH_WEBSITEURL');

    if (!channel || !secret || !websiteUrl) {
      console.error('Missing Whish API credentials');
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

    if (!response.ok) return 'error';

    const data: WhishStatusResponse = await response.json();
    return data.status && data.data?.collectStatus ? data.data.collectStatus : 'error';
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
  const correlationId = crypto.randomUUID();
  console.log(`[${correlationId}] Processing callback: ${req.method} ${req.url}`);

  try {
    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders });
    }

    if (req.method !== 'GET') {
      return json({ error: 'Method not allowed' }, 405);
    }

    // Parse and validate query parameters
    const url = new URL(req.url);
    const eid = url.searchParams.get('eid');
    const dealerId = url.searchParams.get('dealerId');
    const plan = url.searchParams.get('plan');

    if (!eid || !dealerId || !plan) {
      return json({ error: 'Missing required parameters: eid, dealerId, plan' }, 400);
    }

    if (!['monthly', 'yearly'].includes(plan)) {
      return json({ error: 'Invalid plan' }, 400);
    }

    const externalId = parseInt(eid, 10);
    if (isNaN(externalId)) {
      return json({ error: 'Invalid external ID' }, 400);
    }

    // Verify HMAC if present
    const hmacSecret = Deno.env.get('APP_HMAC_SECRET');
    if (hmacSecret && !(await verifyHmac(url.searchParams, hmacSecret))) {
      return json({ error: 'Invalid signature' }, 401);
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify payment status with Whish
    const whishStatus = await getWhishStatus(externalId);
    
    if (whishStatus !== 'success') {
      console.log(`[${correlationId}] Payment not successful: ${whishStatus}`);
      
      // Update payment log if exists
      await supabase
        .from('payment_logs')
        .update({ 
          status: whishStatus === 'error' ? 'failed' : whishStatus,
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

    // Check for idempotency (already processed)
    const { data: existingLog } = await supabase
      .from('payment_logs')
      .select('status')
      .eq('external_id', externalId)
      .eq('status', 'success')
      .single();

    if (existingLog) {
      return json({
        eid: externalId,
        dealerId,
        plan,
        status: 'already_processed',
        message: 'Payment already processed',
        processedAt: new Date().toISOString()
      });
    }

    // Get current dealership
    const { data: dealership, error: dealerError } = await supabase
      .from('dealerships')
      .select('subscription_end_date')
      .eq('id', dealerId)
      .single();

    if (dealerError) {
      console.error(`[${correlationId}] Dealership not found:`, dealerError);
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
        amount: plan === 'monthly' ? 250 : 2500,
        currency: 'USD',
        status: 'success',
        whish_status: 'success',
        processed_at: new Date().toISOString()
      });

    console.log(`[${correlationId}] Successfully processed payment`);

    return json({
      eid: externalId,
      dealerId,
      plan,
      status: 'success',
      message: 'Payment processed successfully',
      processedAt: new Date().toISOString()
    });

  } catch (error: any) {
    console.error(`[${correlationId}] Unexpected error:`, error);
    return json({
      error: 'Internal server error',
      correlationId
    }, 500);
  }
});
```

## Client Integration

### React Native Example

```typescript
// In your profile component
const handleSelectPlan = async (selectedPlan: 'monthly' | 'yearly') => {
  try {
    setLoading(true);
    
    // Call your Supabase Edge Function
    const response = await fetch('https://your-project.supabase.co/functions/v1/whish-create-payment', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
        'Authorization': `Bearer ${process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!}`
      },
      body: JSON.stringify({
        dealerId: user.dealership_id, // Your dealer ID
        plan: selectedPlan
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Payment creation failed');
    }

    // Open payment URL
    await Linking.openURL(data.collectUrl);
    
  } catch (error) {
    console.error('Payment error:', error);
    Alert.alert('Error', 'Failed to create payment. Please try again.');
  } finally {
    setLoading(false);
  }
};
```

## Testing

### 1. Test Payment Creation

```bash
curl -X POST "https://your-project.supabase.co/functions/v1/whish-create-payment" \
  -H "Content-Type: application/json" \
  -H "apikey: your_supabase_anon_key" \
  -H "Authorization: Bearer your_supabase_anon_key" \
  -d '{"dealerId": 123, "plan": "monthly"}'
```

### 2. Test Callback Handler

```bash
curl "https://your-project.supabase.co/functions/v1/whish-success?eid=1234567890&dealerId=123&plan=monthly"
```

### 3. Whish Sandbox Testing

- **Success**: Use phone number `96170902894` with OTP `111111`
- **Failure**: Use any phone number with OTP other than `111111`

## Security Considerations

### 1. Environment Variables
- Never expose Whish credentials in client-side code
- Use Supabase environment variables for all sensitive data
- Rotate HMAC secrets regularly

### 2. HMAC Signatures
- Always verify HMAC signatures in production
- Use timing-safe comparison for signature verification
- Include all relevant parameters in signature calculation

### 3. Idempotency
- Always check for duplicate processing using `external_id`
- Use database constraints to prevent race conditions
- Log all payment attempts for audit trails

### 4. Input Validation
- Validate all input parameters
- Check dealer permissions before processing
- Sanitize all user inputs

## Troubleshooting

### Common Issues

1. **500 Internal Server Error**
   - Check environment variables are set correctly
   - Verify Supabase credentials
   - Check Edge Function logs

2. **Whish API Errors**
   - Verify API credentials
   - Check callback URL accessibility
   - Ensure external ID is numeric

3. **Database Errors**
   - Check table exists and has correct schema
   - Verify foreign key constraints
   - Check RLS policies if enabled

### Debugging

```bash
# View Edge Function logs
supabase functions logs whish-create-payment --local

# Test locally
supabase functions serve --env-file .env
```

### Monitoring

Monitor these metrics:
- Payment creation success rate
- Callback processing time
- Database update failures
- Whish API response times

## Production Deployment

1. **Deploy Edge Functions**
```bash
supabase functions deploy whish-create-payment
supabase functions deploy whish-success
```

2. **Set Environment Variables**
   - Update all environment variables in Supabase Dashboard
   - Use production Whish API URL
   - Set strong HMAC secret

3. **Database Migration**
```bash
supabase db push
```

4. **Testing**
   - Test with real payment flows
   - Verify callback handling
   - Monitor error rates

## Conclusion

This integration provides a secure, scalable solution for Whish payment processing using Supabase Edge Functions. The server-side approach ensures payment security while providing a smooth user experience.

For support or questions, refer to:
- [Whish API Documentation](your-whish-docs-url)
- [Supabase Edge Functions Documentation](https://supabase.com/docs/guides/functions)
