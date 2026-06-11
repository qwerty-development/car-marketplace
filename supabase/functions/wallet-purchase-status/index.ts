// wallet-purchase-status — client-pollable purchase status + lost-callback recovery.
// Deploy WITH JWT verification (default): supabase functions deploy wallet-purchase-status
//
// After the Whish WebView closes, the app polls this endpoint. If the callback
// was lost (user killed the WebView, network blip), this re-verifies with Whish
// and credits the wallet through the same idempotent RPC.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, json, getEnvOrThrow, whishCollectStatus } from '../_shared/whish.ts';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    const token = authHeader.replace(/^Bearer\s+/i, '');
    if (!token) return json({ error: 'Missing Authorization header' }, 401);

    const supabase = createClient(
      getEnvOrThrow('SUPABASE_URL'),
      getEnvOrThrow('SUPABASE_SERVICE_ROLE_KEY'),
    );

    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !userData?.user) return json({ error: 'Invalid or expired token' }, 401);

    const body = await req.json().catch(() => ({}));
    const externalId = Number(body?.externalId);
    if (!Number.isFinite(externalId)) return json({ error: 'Invalid externalId' }, 400);

    // Ownership check — users can only poll their own purchases
    const { data: acq, error: acqErr } = await supabase
      .from('wallet_acquisitions')
      .select('id, status, owner_user_id')
      .eq('whish_external_id', externalId)
      .eq('owner_user_id', userData.user.id)
      .maybeSingle();
    if (acqErr) {
      console.error('wallet-purchase-status lookup error:', acqErr);
      return json({ error: 'Lookup failed' }, 500);
    }
    if (!acq) return json({ error: 'Purchase not found' }, 404);

    if (acq.status !== 'pending') {
      return json({ externalId, status: acq.status });
    }

    const whishStatus = await whishCollectStatus(externalId);

    if (whishStatus === 'success') {
      const { data, error } = await supabase.rpc('credit_wallet_purchase', {
        p_external_id: externalId,
      });
      if (error) {
        console.error(`credit_wallet_purchase failed for eid=${externalId}:`, error);
        return json({ error: 'Crediting failed' }, 500);
      }
      return json({ externalId, status: 'paid', ...data });
    }

    if (whishStatus === 'failed') {
      await supabase.rpc('mark_wallet_purchase_failed', { p_external_id: externalId });
      return json({ externalId, status: 'failed' });
    }

    return json({ externalId, status: 'pending' });
  } catch (err) {
    console.error('wallet-purchase-status unexpected error:', err?.message ?? String(err));
    return json({ error: 'Internal error' }, 500);
  }
});
