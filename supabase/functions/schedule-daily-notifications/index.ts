// supabase/functions/schedule-daily-notifications/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

interface NotificationSchedule {
  hour: number;
  title: string;
  message: string;
  data: Record<string, any>;
}

// Define the notification schedules (you can customize these)
const notificationSchedules: NotificationSchedule[] = [
  {
    hour: 9,
    title: "🌅 Morning Updates",
    message: "Start your day with fresh car listings!",
    data: {
      screen: '/(home)/(user)',
      type: 'daily_reminder',
      timeOfDay: 'morning'
    }
  },
  {
    hour: 14,
    title: "🚗 Afternoon Picks",
    message: "Take a break and browse new cars!",
    data: {
      screen: '/(home)/(user)',
      type: 'daily_reminder',
      timeOfDay: 'afternoon'
    }
  },
  {
    hour: 19,
    title: "🌆 Evening Selection",
    message: "End your day by finding your dream car!",
    data: {
      screen: '/(home)/(user)',
      type: 'daily_reminder',
      timeOfDay: 'evening'
    }
  }
];

Deno.serve(async (req) => {
  try {
    // Determine the current hour in UTC
    const currentUtcHour = new Date().getUTCHours();

    // Filter schedules relevant to the current hour
    const relevantSchedules = notificationSchedules.filter(schedule => {
      // Use modulo arithmetic to handle hour differences across days
      return Math.abs((schedule.hour - currentUtcHour) % 24) < 1;
    });

    if (relevantSchedules.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No relevant schedules for the current hour.' }),
        { headers: { 'Content-Type': 'application/json' }, status: 200 }
      );
    }
    // Fetch users with their timezones and valid push tokens
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select(`
        id,
        timezone,
        user_push_tokens!inner(token)
      `)
      .neq('user_push_tokens.token', null);

    if (usersError) throw usersError;

    const notificationsToInsert = users.flatMap(user => {
      const userTimezone = user.timezone || 'UTC';
      const userCurrentTime = new Date().toLocaleString('en-US', { timeZone: userTimezone });
      const userCurrentHour = new Date(userCurrentTime).getHours();

      return relevantSchedules
        .filter(schedule => Math.abs(schedule.hour - userCurrentHour) < 1)
        .map(schedule => ({
          user_id: user.id,
          type: 'daily_reminder',
          data: {
            title: schedule.title,
            message: schedule.message,
            ...schedule.data,
            metadata: {
              scheduledFor: new Date().toISOString(),
              userTimezone: user.timezone
            }
          },
          processed: false
        }));
    });

    if (notificationsToInsert.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No notifications to schedule for this run.' }),
        { headers: { 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    const { error: insertError } = await supabase
      .from('pending_notifications')
      .insert(notificationsToInsert);

    if (insertError) throw insertError;

    // Log the scheduling operation
    const { error: logError } = await supabase
      .from('notification_schedule_logs')
      .insert({
        users_processed: users.length,
        success: true,
        metrics: {
          notificationsScheduled: notificationsToInsert.length,
          relevantSchedules: relevantSchedules.length,
          currentTimeUtc: new Date().toUTCString()
        }
      });

    if (logError) console.error('Error logging scheduling operation:', logError);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Daily notifications scheduled',
        usersProcessed: users.length,
        notificationsScheduled: notificationsToInsert.length
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in schedule-daily-notifications:', error);

    // Log the error
    await supabase
      .from('notification_schedule_logs')
      .insert({
        success: false,
        error_details: {
          message: error.message,
          stack: error.stack
        }
      });

    return new Response(
      JSON.stringify({ error: 'Failed to schedule notifications', details: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});