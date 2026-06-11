// wallet-purchase — starts an in-app wallet package purchase via Whish.
// Deploy WITH JWT verification (default): supabase functions deploy wallet-purchase
//
// Flow: authenticated client sends { packageId } → price/contents are read
// server-side from pricing_packages (client-sent prices are never trusted) →
// a 'pending' wallet_acquisitions row is created (whish_external_id from a DB
// sequence) → Whish collect URL is returned for the client WebView.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  corsHeaders, json, getEnvOrThrow,
  hmacSha256Hex, canonicalizeQuery, whishCreatePayment,
} from '../_shared/whish.ts';

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
    const userId = userData.user.id;

    const body = await req.json().catch(() => ({}));
    const packageId = Number(body?.packageId);
    if (!Number.isFinite(packageId) || packageId <= 0) {
      return json({ error: 'Invalid packageId' }, 400);
    }

    const { data: profile, error: profileErr } = await supabase
      .from('users')
      .select('id, role')
      .eq('id', userId)
      .single();
    if (profileErr || !profile) return json({ error: 'User profile not found' }, 404);

    const { data: pkg, error: pkgErr } = await supabase
      .from('pricing_packages')
      .select('*')
      .eq('id', packageId)
      .eq('active', true)
      .single();
    if (pkgErr || !pkg) return json({ error: 'Package not found or inactive' }, 404);

    if (pkg.audience !== 'all' && pkg.audience !== profile.role) {
      return json({ error: 'Package not available for your account type' }, 403);
    }

    // Resolve dealership for revenue attribution (dealers only)
    let dealershipId: number | null = null;
    if (profile.role === 'dealer') {
      const { data: dealership } = await supabase
        .from('dealerships')
        .select('id')
        .eq('user_id', userId)
        .maybeSingle();
      dealershipId = dealership?.id ?? null;
    }

    const { data: acquisition, error: acqErr } = await supabase
      .from('wallet_acquisitions')
      .insert({
        owner_user_id: userId,
        dealership_id: dealershipId,
        kind: 'online_purchase',
        status: 'pending',
        package_id: pkg.id,
        total_price_usd: pkg.price_usd,
        item_counts: pkg.contents,
        item_validity_days: pkg.item_validity_days,
      })
      .select('id, whish_external_id')
      .single();
    if (acqErr || !acquisition) {
      console.error('Failed to create acquisition:', acqErr);
      return json({ error: 'Failed to start purchase' }, 500);
    }

    const externalId = Number(acquisition.whish_external_id);
    const state = crypto.randomUUID();
    const hmacSecret = getEnvOrThrow('APP_HMAC_SECRET'); // REQUIRED for wallet flow

    const baseParams = { eid: String(externalId), state };
    const sig = await hmacSha256Hex(hmacSecret, canonicalizeQuery(baseParams));
    const qs = new URLSearchParams({ ...baseParams, sig }).toString();
    const callbackBase = `${getEnvOrThrow('SUPABASE_URL')}/functions/v1/wallet-purchase-callback`;

    const result = await whishCreatePayment({
      amount: Number(pkg.price_usd),
      invoice: pkg.name,
      externalId,
      successCallbackUrl: `${callbackBase}?${qs}`,
      failureCallbackUrl: `${callbackBase}?${qs}`,
    });

    if (!result.ok) {
      await supabase
        .from('wallet_acquisitions')
        .update({ status: 'failed' })
        .eq('id', acquisition.id)
        .eq('status', 'pending');
      return json({ error: 'Create payment failed', code: result.code, detail: result.detail }, 502);
    }

    return json({ collectUrl: result.collectUrl, externalId });
  } catch (err) {
    console.error('wallet-purchase unexpected error:', err?.message ?? String(err));
    return json({ error: 'Internal error' }, 500);
  }
});
