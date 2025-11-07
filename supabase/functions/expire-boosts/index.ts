// supabase/functions/expire-boosts/index.ts
// Cron job to expire boosted listings that have passed their end_date
// Updated for priority-based boost system

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

    // Find expired boosts in cars table (include dealership_id for logging)
    const { data: expiredCars, error: findError } = await supabase
      .from('cars')
      .select('id, boost_priority, boost_end_date, dealership_id')
      .eq('is_boosted', true)
      .lt('boost_end_date', now);

    if (findError) {
      console.error(`[${requestId}] Error finding expired boosts:`, findError);
      throw findError;
    }

    // Also check cars_rent table (no dealership_id in rentals)
    const { data: expiredRentals, error: findRentError } = await supabase
      .from('cars_rent')
      .select('id, boost_priority, boost_end_date, user_id')
      .eq('is_boosted', true)
      .lt('boost_end_date', now);

    if (findRentError) {
      console.error(`[${requestId}] Error finding expired rental boosts:`, findRentError);
      throw findRentError;
    }

    const totalExpired = (expiredCars?.length || 0) + (expiredRentals?.length || 0);

    if (totalExpired === 0) {
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

    console.log(`[${requestId}] Found ${totalExpired} expired boosts:`, {
      cars: expiredCars?.length || 0,
      rentals: expiredRentals?.length || 0
    });

    // Update expired cars and log expiration
    if (expiredCars && expiredCars.length > 0) {
      const { error: updateCarsError } = await supabase
        .from('cars')
        .update({
          is_boosted: false,
          boost_priority: null,
          boost_end_date: null
        })
        .in('id', expiredCars.map(c => c.id));

      if (updateCarsError) {
        console.error(`[${requestId}] Error updating cars:`, updateCarsError);
        throw updateCarsError;
      }

      // Log expiration events to boost_history
      const expirationLogs = expiredCars.map(car => ({
        car_id: car.id,
        dealership_id: car.dealership_id,
        user_id: null,
        action_type: 'expired',
        boost_priority: car.boost_priority || 1,
        duration_days: 0,
        credits_spent: 0,
        start_date: car.boost_end_date, // Use end date as reference
        end_date: car.boost_end_date,
        notes: 'Boost expired automatically via cron job'
      }));

      const { error: logError } = await supabase
        .from('boost_history')
        .insert(expirationLogs);

      if (logError) {
        console.warn(`[${requestId}] Error logging expiration:`, logError);
        // Don't throw - expiration logging is non-critical
      }
    }

    // Update expired rentals and log expiration
    if (expiredRentals && expiredRentals.length > 0) {
      const { error: updateRentalsError } = await supabase
        .from('cars_rent')
        .update({
          is_boosted: false,
          boost_priority: null,
          boost_end_date: null
        })
        .in('id', expiredRentals.map(c => c.id));

      if (updateRentalsError) {
        console.error(`[${requestId}] Error updating rentals:`, updateRentalsError);
        throw updateRentalsError;
      }

      // Log rental expiration events to boost_history
      const rentalExpirationLogs = expiredRentals.map(rental => ({
        car_id: rental.id,
        dealership_id: null, // Rentals don't have dealership_id
        user_id: rental.user_id,
        action_type: 'expired',
        boost_priority: rental.boost_priority || 1,
        duration_days: 0,
        credits_spent: 0,
        start_date: rental.boost_end_date,
        end_date: rental.boost_end_date,
        notes: 'Rental boost expired automatically via cron job'
      }));

      const { error: logRentalError } = await supabase
        .from('boost_history')
        .insert(rentalExpirationLogs);

      if (logRentalError) {
        console.warn(`[${requestId}] Error logging rental expiration:`, logRentalError);
        // Don't throw - expiration logging is non-critical
      }
    }

    const totalTime = Date.now() - startTime;

    console.log(`[${requestId}] EXPIRE_BOOSTS_SUCCESS:`, {
      expired: totalExpired,
      processingTimeMs: totalTime
    });

    return new Response(JSON.stringify({
      success: true,
      expired: totalExpired,
      cars: expiredCars?.length || 0,
      rentals: expiredRentals?.length || 0,
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
