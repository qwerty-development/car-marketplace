// wallet-purchase-callback — Whish server-to-server callback for wallet purchases.
// Deploy WITHOUT JWT verification: supabase functions deploy wallet-purchase-callback --no-verify-jwt
//
// Security: HMAC signature on the query params is REQUIRED, and the payment
// status is re-verified server-to-server with Whish before crediting. Crediting
// itself is idempotent at the DB layer (credit_wallet_purchase only acts on the
// pending → paid transition), so replayed callbacks are no-ops.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  corsHeaders, json, getEnvOrThrow, verifyHmacRequired, whishCollectStatus,
} from '../_shared/whish.ts';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'GET' && req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  try {
    const url = new URL(req.url);
    const eid = url.searchParams.get('eid');
    const externalId = eid ? parseInt(eid, 10) : NaN;
    if (!Number.isFinite(externalId)) return json({ error: 'Missing or invalid eid' }, 400);

    const hmacSecret = getEnvOrThrow('APP_HMAC_SECRET');
    const valid = await verifyHmacRequired(url.searchParams, hmacSecret, ['eid', 'state']);
    if (!valid) {
      console.warn(`wallet-purchase-callback: HMAC verification failed for eid=${externalId}`);
      return json({ error: 'Invalid signature' }, 401);
    }

    const supabase = createClient(
      getEnvOrThrow('SUPABASE_URL'),
      getEnvOrThrow('SUPABASE_SERVICE_ROLE_KEY'),
    );

    const status = await whishCollectStatus(externalId);

    if (status === 'success') {
      const { data, error } = await supabase.rpc('credit_wallet_purchase', {
        p_external_id: externalId,
      });
      if (error) {
        console.error(`credit_wallet_purchase failed for eid=${externalId}:`, error);
        return json({ error: 'Crediting failed' }, 500);
      }
      console.log(`wallet-purchase-callback eid=${externalId}:`, data);
      return json({ eid: externalId, status: 'success', ...data });
    }

    if (status === 'failed') {
      await supabase.rpc('mark_wallet_purchase_failed', { p_external_id: externalId });
      return json({ eid: externalId, status: 'failed' }, 202);
    }

    // 'pending' or 'error' — don't change anything; Whish retries / client polls
    return json({ eid: externalId, status }, 202);
  } catch (err) {
    console.error('wallet-purchase-callback unexpected error:', err?.message ?? String(err));
    return json({ error: 'Internal error' }, 500);
  }
});
