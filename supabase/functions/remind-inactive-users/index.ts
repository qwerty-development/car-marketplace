// supabase/functions/remind-inactive-users/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

Deno.serve(async (req) => {
  try {
    const inactiveDays = [7, 14, 21]; // Days of inactivity to check for
    let totalNotificationsScheduled = 0;

    for (const days of inactiveDays) {
      // Calculate the date threshold for each period
      const thresholdDate = new Date();
      thresholdDate.setDate(thresholdDate.getDate() - days);

      // Fetch users who were last active 'days' days ago and have valid push tokens
      // FIXED: Changed eq to neq for token null check
      // ADDED: Filters for signed_in and active status
      const { data: users, error: usersError } = await supabase
        .from('users')
        .select(`
          id,
          user_push_tokens!inner(token)
        `)
        .neq('user_push_tokens.token', null) // FIXED: Changed from eq to neq
        .eq('user_push_tokens.signed_in', true) // ADDED: Filter for signed in tokens
        .eq('user_push_tokens.active', true) // ADDED: Filter for active tokens
        .lte('last_active', thresholdDate.toISOString())
        .gte('last_active', new Date(thresholdDate.getTime() - 24 * 60 * 60 * 1000).toISOString()); // Check within a 24-hour window

      if (usersError) throw usersError;

      if (users.length === 0) {
        console.log(`No users found with last active ${days} days ago.`);
        continue; // Move to the next period if no users found
      }

      const notificationsToInsert = users.map(user => ({
        user_id: user.id,
        type: 'inactive_reminder',
        data: {
          title: "👋 We Miss You!",
          message: `It's been ${days} days! Come back and find your dream car.`,
          screen: '/(home)', // Or any other screen you prefer
          metadata: {
            inactivityDays: days,
            reminderSentAt: new Date().toISOString()
          }
        },
        processed: false,
      }));

      const { error: insertError } = await supabase
        .from('pending_notifications')
        .insert(notificationsToInsert);

      if (insertError) throw insertError;

      totalNotificationsScheduled += users.length;
      console.log(`Scheduled inactive reminder notifications for ${users.length} users who were last active ${days} days ago.`);
    }

    // Log the operation for monitoring
    await supabase
      .from('notification_schedule_logs')
      .insert({
        scheduled_at: new Date().toISOString(),
        users_processed: totalNotificationsScheduled,
        success: true,
        metrics: {
          notificationsScheduled: totalNotificationsScheduled,
          inactivityRanges: inactiveDays,
          executionTime: new Date().toISOString()
        }
      });

    return new Response(
      JSON.stringify({
        success: true,
        notificationsScheduled: totalNotificationsScheduled
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error reminding inactive users:', error);

    // Log the error
    await supabase
      .from('notification_schedule_logs')
      .insert({
        scheduled_at: new Date().toISOString(),
        success: false,
        error_details: {
          message: error.message,
          stack: error.stack
        }
      });

    return new Response(
      JSON.stringify({ error: 'Failed to remind inactive users', details: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});