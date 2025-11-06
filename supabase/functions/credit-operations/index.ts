// supabase/functions/credit-operations/index.ts
// Handles credit deductions for posting cars and boosting listings

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

// Pricing configuration (can be moved to database later)
const PRICING = {
  POST_LISTING_COST: 10,
  BOOST_SLOTS: {
    1: 9, // Highest priority
    2: 8,
    3: 7,
    4: 6,
    5: 5  // Lowest priority
  },
  BOOST_DURATION_MULTIPLIERS: {
    3: 1.0,   // 3 days
    7: 1.8,   // 7 days
    10: 2.3   // 10 days
  }
};

Deno.serve(async (req: Request) => {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();

  console.log(`[${requestId}] REQUEST_START:`, {
    method: req.method,
    url: req.url,
    timestamp: new Date().toISOString()
  });

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { operation, userId, carId, boostConfig } = await req.json();

    console.log(`[${requestId}] OPERATION:`, {
      operation,
      userId,
      carId,
      boostConfig
    });

    if (!operation || !userId) {
      return json({ error: 'Missing operation or userId' }, 400);
    }

    // Get user profile and check if dealer
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('credit_balance, role')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      console.error(`[${requestId}] User not found:`, userError);
      return json({ error: 'User not found' }, 404);
    }

    // Check if user is dealer
    const { data: dealership } = await supabase
      .from('dealerships')
      .select('id')
      .eq('user_id', userId)
      .single();

    const isDealer = !!dealership;

    console.log(`[${requestId}] USER_INFO:`, {
      creditBalance: user.credit_balance,
      isDealer
    });

    // ========================================================================
    // OPERATION: POST LISTING
    // ========================================================================
    if (operation === 'post_listing') {
      // Dealers post for free
      if (isDealer) {
        console.log(`[${requestId}] Dealer posting - no charge`);
        return json({
          success: true,
          charged: 0,
          balance: user.credit_balance,
          message: 'Dealer posts are free'
        });
      }

      // Check balance
      const currentBalance = user.credit_balance || 0;
      if (currentBalance < PRICING.POST_LISTING_COST) {
        console.warn(`[${requestId}] Insufficient credits:`, {
          required: PRICING.POST_LISTING_COST,
          available: currentBalance
        });
        return json({
          error: 'Insufficient credits',
          required: PRICING.POST_LISTING_COST,
          available: currentBalance
        }, 402); // Payment Required
      }

      // Deduct credits
      const newBalance = currentBalance - PRICING.POST_LISTING_COST;

      const { error: updateError } = await supabase
        .from('users')
        .update({ credit_balance: newBalance })
        .eq('id', userId);

      if (updateError) {
        console.error(`[${requestId}] Error updating balance:`, updateError);
        throw updateError;
      }

      // Log transaction
      await supabase.from('credit_transactions').insert({
        user_id: userId,
        amount: -PRICING.POST_LISTING_COST,
        balance_after: newBalance,
        transaction_type: 'deduction',
        purpose: 'post_listing',
        reference_id: String(carId),
        description: `Posted car listing #${carId}`,
        metadata: {
          car_id: carId
        }
      });

      console.log(`[${requestId}] POST_LISTING_SUCCESS:`, {
        charged: PRICING.POST_LISTING_COST,
        newBalance
      });

      return json({
        success: true,
        charged: PRICING.POST_LISTING_COST,
        balance: newBalance,
        message: `Posted listing - ${PRICING.POST_LISTING_COST} credits deducted`
      });
    }

    // ========================================================================
    // OPERATION: BOOST LISTING
    // ========================================================================
    else if (operation === 'boost_listing') {
      if (!boostConfig || !boostConfig.slot || !boostConfig.durationDays) {
        return json({ error: 'Missing boostConfig (slot, durationDays)' }, 400);
      }

      const { slot, durationDays } = boostConfig;

      // Validate slot and duration
      if (![1, 2, 3, 4, 5].includes(slot)) {
        return json({ error: 'Invalid slot - must be 1-5' }, 400);
      }

      if (![3, 7, 10].includes(durationDays)) {
        return json({ error: 'Invalid duration - must be 3, 7, or 10 days' }, 400);
      }

      // Calculate cost
      const baseCost = PRICING.BOOST_SLOTS[slot as keyof typeof PRICING.BOOST_SLOTS];
      const multiplier = PRICING.BOOST_DURATION_MULTIPLIERS[durationDays as keyof typeof PRICING.BOOST_DURATION_MULTIPLIERS];
      const totalCost = Math.round(baseCost * multiplier);

      console.log(`[${requestId}] BOOST_COST_CALCULATION:`, {
        slot,
        durationDays,
        baseCost,
        multiplier,
        totalCost
      });

      // Check balance
      const currentBalance = user.credit_balance || 0;
      if (currentBalance < totalCost) {
        console.warn(`[${requestId}] Insufficient credits for boost:`, {
          required: totalCost,
          available: currentBalance
        });
        return json({
          error: 'Insufficient credits',
          required: totalCost,
          available: currentBalance
        }, 402);
      }

      // Check if car already has an active boost
      const { data: existingBoost } = await supabase
        .from('boosted_listings')
        .select('id, end_date')
        .eq('car_id', carId)
        .eq('status', 'active')
        .single();

      if (existingBoost) {
        console.warn(`[${requestId}] Car already has active boost`);
        return json({
          error: 'Car already has an active boost',
          existingBoostEndDate: existingBoost.end_date
        }, 409); // Conflict
      }

      // Check slot availability
      const { data: slotBoost } = await supabase
        .from('boosted_listings')
        .select('id, car_id')
        .eq('boost_slot', slot)
        .eq('status', 'active')
        .single();

      if (slotBoost) {
        console.warn(`[${requestId}] Boost slot not available:`, { slot });
        return json({
          error: 'Boost slot not available',
          slot,
          message: `Slot ${slot} is currently occupied`
        }, 409);
      }

      // Deduct credits and create boost
      const newBalance = currentBalance - totalCost;
      const endDate = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000);

      // Update balance
      const { error: updateBalanceError } = await supabase
        .from('users')
        .update({ credit_balance: newBalance })
        .eq('id', userId);

      if (updateBalanceError) {
        console.error(`[${requestId}] Error updating balance:`, updateBalanceError);
        throw updateBalanceError;
      }

      // Create boost record
      const { data: boostRecord, error: boostError } = await supabase
        .from('boosted_listings')
        .insert({
          car_id: carId,
          user_id: userId,
          boost_slot: slot,
          duration_days: durationDays,
          credits_paid: totalCost,
          end_date: endDate.toISOString()
        })
        .select()
        .single();

      if (boostError) {
        console.error(`[${requestId}] Error creating boost:`, boostError);
        // Rollback balance update
        await supabase
          .from('users')
          .update({ credit_balance: currentBalance })
          .eq('id', userId);
        throw boostError;
      }

      // Update car with boost info
      const { error: carUpdateError } = await supabase
        .from('cars')
        .update({
          is_boosted: true,
          boost_slot: slot,
          boost_end_date: endDate.toISOString()
        })
        .eq('id', carId);

      if (carUpdateError) {
        console.error(`[${requestId}] Error updating car:`, carUpdateError);
        // Don't rollback - boost record exists, car just won't show as boosted
      }

      // Log transaction
      await supabase.from('credit_transactions').insert({
        user_id: userId,
        amount: -totalCost,
        balance_after: newBalance,
        transaction_type: 'deduction',
        purpose: 'boost_listing',
        reference_id: String(boostRecord.id),
        description: `Boosted car #${carId} (slot ${slot}, ${durationDays} days)`,
        metadata: {
          car_id: carId,
          boost_slot: slot,
          duration_days: durationDays,
          boost_id: boostRecord.id
        }
      });

      console.log(`[${requestId}] BOOST_LISTING_SUCCESS:`, {
        boostId: boostRecord.id,
        charged: totalCost,
        newBalance,
        endDate
      });

      const totalTime = Date.now() - startTime;

      return json({
        success: true,
        charged: totalCost,
        balance: newBalance,
        boostId: boostRecord.id,
        endDate: endDate.toISOString(),
        message: `Listing boosted in slot ${slot} for ${durationDays} days`,
        processingTimeMs: totalTime
      });
    }

    // Unknown operation
    else {
      return json({ error: 'Invalid operation - must be post_listing or boost_listing' }, 400);
    }

  } catch (error: any) {
    const totalTime = Date.now() - startTime;
    console.error(`[${requestId}] UNEXPECTED_ERROR after ${totalTime}ms:`, {
      error: error.message,
      stack: error.stack
    });
    return json({
      error: 'Internal server error',
      message: error.message
    }, 500);
  }
});
