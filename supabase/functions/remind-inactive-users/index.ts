// supabase/functions/remind-inactive-users/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

Deno.serve(async (req) => {
  try {
    const inactiveDays = [7, 14, 21]; // Days of inactivity to check for

    for (const days of inactiveDays) {
      // Calculate the date threshold for each period
      const thresholdDate = new Date();
      thresholdDate.setDate(thresholdDate.getDate() - days);

      // Fetch users who were last active 'days' days ago and have valid push tokens
      const { data: users, error: usersError } = await supabase
        .from('users')
        .select(`
          id,
          user_push_tokens!inner(token)
        `)
        .eq('user_push_tokens.token', null) // this line was incorrect, fixed it
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
        },
        processed: false,
      }));

      const { error: insertError } = await supabase
        .from('pending_notifications')
        .insert(notificationsToInsert);

      if (insertError) throw insertError;

      console.log(`Scheduled inactive reminder notifications for ${users.length} users who were last active ${days} days ago.`);
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error reminding inactive users:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to remind inactive users', details: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});