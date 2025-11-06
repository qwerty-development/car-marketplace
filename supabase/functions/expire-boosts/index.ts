// supabase/functions/expire-boosts/index.ts
// Cron job to expire boosted listings that have passed their end_date

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async () => {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();

  console.log(`[${requestId}] EXPIRE_BOOSTS_START:`, {
    timestamp: new Date().toISOString()
  });

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing environment variables');
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const now = new Date().toISOString();

    // Find expired boosts
    const { data: expiredBoosts, error: findError } = await supabase
      .from('boosted_listings')
      .select('id, car_id, boost_slot, end_date')
      .eq('status', 'active')
      .lt('end_date', now);

    if (findError) {
      console.error(`[${requestId}] Error finding expired boosts:`, findError);
      throw findError;
    }

    if (!expiredBoosts || expiredBoosts.length === 0) {
      console.log(`[${requestId}] No expired boosts found`);
      return new Response(JSON.stringify({
        success: true,
        expired: 0,
        message: 'No expired boosts'
      }), {
        headers: { 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    console.log(`[${requestId}] Found ${expiredBoosts.length} expired boosts:`, {
      count: expiredBoosts.length,
      boostIds: expiredBoosts.map(b => b.id)
    });

    // Update boost status
    const { error: updateBoostError } = await supabase
      .from('boosted_listings')
      .update({ status: 'expired' })
      .in('id', expiredBoosts.map(b => b.id));

    if (updateBoostError) {
      console.error(`[${requestId}] Error updating boost status:`, updateBoostError);
      throw updateBoostError;
    }

    // Update cars
    const { error: updateCarsError } = await supabase
      .from('cars')
      .update({
        is_boosted: false,
        boost_slot: null,
        boost_end_date: null
      })
      .in('id', expiredBoosts.map(b => b.car_id));

    if (updateCarsError) {
      console.error(`[${requestId}] Error updating cars:`, updateCarsError);
      throw updateCarsError;
    }

    const totalTime = Date.now() - startTime;

    console.log(`[${requestId}] EXPIRE_BOOSTS_SUCCESS:`, {
      expired: expiredBoosts.length,
      processingTimeMs: totalTime,
      expiredBoostIds: expiredBoosts.map(b => b.id)
    });

    return new Response(JSON.stringify({
      success: true,
      expired: expiredBoosts.length,
      boosts: expiredBoosts.map(b => ({
        id: b.id,
        carId: b.car_id,
        slot: b.boost_slot,
        endDate: b.end_date
      })),
      processingTimeMs: totalTime
    }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    const totalTime = Date.now() - startTime;
    console.error(`[${requestId}] EXPIRE_BOOSTS_ERROR after ${totalTime}ms:`, {
      error: error.message,
      stack: error.stack
    });
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      headers: { 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
