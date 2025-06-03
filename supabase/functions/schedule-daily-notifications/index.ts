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

// Define the notification schedules
const notificationSchedules: NotificationSchedule[] = [
  {
    hour: 16, // 4 PM in user's local timezone
    title: "🌅 Daily Update",
    message: "Check out the latest car listings for today!",
    data: {
      screen: '/(home)/(user)',
      type: 'daily_reminder',
      timeOfDay: 'afternoon'
    }
  }
];

// FIXED: Enhanced duplicate prevention with multiple time windows
const checkPreviousNotifications = async (userId: string, hour: number) => {
  console.log(`Checking for existing notifications for user ${userId} at hour ${hour}`);
  
  // Check for notifications sent in the last 2 hours (more robust)
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
  
  // Check both pending_notifications and notifications tables
  const [pendingCheck, sentCheck] = await Promise.all([
    supabase
      .from('pending_notifications')
      .select('id, created_at')
      .eq('user_id', userId)
      .eq('type', 'daily_reminder')
      .gte('created_at', twoHoursAgo.toISOString())
      .maybeSingle(),
    
    supabase
      .from('notifications')
      .select('id, created_at')
      .eq('user_id', userId)
      .eq('type', 'daily_reminder')
      .gte('created_at', twoHoursAgo.toISOString())
      .maybeSingle()
  ]);

  const hasPending = !!pendingCheck.data;
  const hasSent = !!sentCheck.data;
  
  console.log(`User ${userId} - Pending: ${hasPending}, Sent: ${hasSent}`);
  
  return hasPending || hasSent;
};

// FIXED: Proper timezone-aware hour calculation
const getUserLocalHour = (timezone: string): number => {
  try {
    // Use Intl.DateTimeFormat for accurate timezone conversion
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: 'numeric',
      hour12: false
    });
    
    const parts = formatter.formatToParts(new Date());
    const hourPart = parts.find(part => part.type === 'hour');
    
    if (!hourPart) {
      console.warn(`Could not extract hour for timezone ${timezone}, using UTC`);
      return new Date().getUTCHours();
    }
    
    return parseInt(hourPart.value, 10);
  } catch (error) {
    console.error(`Error calculating hour for timezone ${timezone}:`, error);
    return new Date().getUTCHours();
  }
};

// FIXED: Improved schedule matching logic
const isScheduleRelevant = (scheduleHour: number, userLocalHour: number): boolean => {
  // Allow 1-hour window around the target time
  const timeDiff = Math.abs(scheduleHour - userLocalHour);
  
  // Handle day boundary cases (e.g., 23 vs 1)
  const dayBoundaryDiff = Math.abs(timeDiff - 24);
  
  return Math.min(timeDiff, dayBoundaryDiff) <= 1;
};

// EXECUTION THROTTLING: Prevent rapid successive executions
const EXECUTION_KEY = 'daily_notification_last_run';
const MIN_EXECUTION_INTERVAL = 10 * 60 * 1000; // 10 minutes

const checkExecutionThrottle = async (): Promise<boolean> => {
  try {
    // Check if we've run recently by looking at latest log
    const { data: lastLog } = await supabase
      .from('notification_schedule_logs')
      .select('scheduled_at')
      .eq('success', true)
      .order('scheduled_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lastLog) {
      const lastExecution = new Date(lastLog.scheduled_at);
      const timeSinceLastRun = Date.now() - lastExecution.getTime();
      
      if (timeSinceLastRun < MIN_EXECUTION_INTERVAL) {
        console.log(`Execution throttled. Last run was ${Math.round(timeSinceLastRun / 1000)}s ago`);
        return false;
      }
    }
    
    return true;
  } catch (error) {
    console.error('Error checking execution throttle:', error);
    return true; // Allow execution on error
  }
};

Deno.serve(async (req) => {
  const startTime = Date.now();
  console.log('=== DAILY NOTIFICATION SCHEDULING STARTED ===');
  
  try {
    // EXECUTION THROTTLING CHECK
    const canExecute = await checkExecutionThrottle();
    if (!canExecute) {
      return new Response(
        JSON.stringify({ 
          message: 'Execution throttled - ran too recently',
          throttled: true 
        }),
        { headers: { 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Get current time information
    const now = new Date();
    const currentUtcHour = now.getUTCHours();
    
    console.log(`Current UTC time: ${now.toISOString()}, UTC Hour: ${currentUtcHour}`);

    // FIXED: Better schedule filtering logic
    const relevantSchedules = notificationSchedules.filter(schedule => {
      // Check if any timezone could match this schedule within reasonable bounds
      // This is a rough filter - precise matching happens per user
      const hourDiffs = [];
      for (let offset = -12; offset <= 14; offset++) { // Common timezone range
        const adjustedHour = (currentUtcHour + offset + 24) % 24;
        if (isScheduleRelevant(schedule.hour, adjustedHour)) {
          hourDiffs.push(offset);
        }
      }
      
      const isRelevant = hourDiffs.length > 0;
      console.log(`Schedule hour ${schedule.hour} - Relevant: ${isRelevant} (UTC: ${currentUtcHour})`);
      return isRelevant;
    });

    if (relevantSchedules.length === 0) {
      console.log('No relevant schedules for current time window');
      
      // Log this run
      await supabase.from('notification_schedule_logs').insert({
        users_processed: 0,
        success: true,
        metrics: {
          notificationsScheduled: 0,
          relevantSchedules: 0,
          currentTimeUtc: now.toUTCString(),
          reason: 'No relevant schedules'
        }
      });

      return new Response(
        JSON.stringify({ 
          message: 'No relevant schedules for the current hour.',
          currentUtcHour,
          schedules: notificationSchedules.map(s => s.hour)
        }),
        { headers: { 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    console.log(`Found ${relevantSchedules.length} relevant schedules`);

    // FIXED: Enhanced user query with better filtering
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select(`
        id,
        timezone,
        user_push_tokens!inner(token, signed_in, active)
      `)
      .neq('user_push_tokens.token', null)
      .eq('user_push_tokens.signed_in', true)
      .eq('user_push_tokens.active', true)
      .neq('is_guest', true) // Exclude guest users
      .limit(1000); // Reasonable limit for safety

    if (usersError) {
      console.error('Error fetching users:', usersError);
      throw usersError;
    }

    console.log(`Found ${users?.length || 0} eligible users`);

    if (!users || users.length === 0) {
      await supabase.from('notification_schedule_logs').insert({
        users_processed: 0,
        success: true,
        metrics: {
          notificationsScheduled: 0,
          relevantSchedules: relevantSchedules.length,
          currentTimeUtc: now.toUTCString(),
          reason: 'No eligible users found'
        }
      });

      return new Response(
        JSON.stringify({ 
          message: 'No eligible users found for notifications.',
          relevantSchedules: relevantSchedules.length 
        }),
        { headers: { 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // FIXED: Improved notification creation logic
    const notificationsToInsert = [];
    let usersProcessed = 0;
    let duplicatesSkipped = 0;

    for (const user of users) {
      try {
        const userTimezone = user.timezone || 'UTC';
        const userLocalHour = getUserLocalHour(userTimezone);
        
        console.log(`Processing user ${user.id} - Timezone: ${userTimezone}, Local Hour: ${userLocalHour}`);

        for (const schedule of relevantSchedules) {
          // Check if this user should receive this schedule now
          if (isScheduleRelevant(schedule.hour, userLocalHour)) {
            console.log(`User ${user.id} matches schedule hour ${schedule.hour}`);
            
            // Enhanced duplicate check
            const alreadySent = await checkPreviousNotifications(user.id, schedule.hour);
            if (alreadySent) {
              console.log(`Skipping duplicate for user ${user.id}`);
              duplicatesSkipped++;
              continue;
            }

            notificationsToInsert.push({
              user_id: user.id,
              type: 'daily_reminder',
              data: {
                title: schedule.title,
                message: schedule.message,
                ...schedule.data,
                metadata: {
                  scheduledFor: now.toISOString(),
                  userTimezone: userTimezone,
                  userLocalHour: userLocalHour,
                  scheduleHour: schedule.hour,
                  executionId: `daily_${startTime}_${user.id}` // Unique execution ID
                }
              },
              processed: false
            });
            
            console.log(`Notification queued for user ${user.id}`);
          } else {
            console.log(`User ${user.id} doesn't match schedule hour ${schedule.hour} (local: ${userLocalHour})`);
          }
        }
        
        usersProcessed++;
      } catch (userError) {
        console.error(`Error processing user ${user.id}:`, userError);
        // Continue with other users
      }
    }

    console.log(`Processed ${usersProcessed} users, ${notificationsToInsert.length} notifications to insert, ${duplicatesSkipped} duplicates skipped`);

    if (notificationsToInsert.length === 0) {
      await supabase.from('notification_schedule_logs').insert({
        users_processed: usersProcessed,
        success: true,
        metrics: {
          notificationsScheduled: 0,
          relevantSchedules: relevantSchedules.length,
          currentTimeUtc: now.toUTCString(),
          duplicatesSkipped: duplicatesSkipped,
          reason: 'No notifications to schedule for this run'
        }
      });

      return new Response(
        JSON.stringify({ 
          message: 'No notifications to schedule for this run.',
          usersProcessed,
          duplicatesSkipped
        }),
        { headers: { 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Insert notifications in batches for better performance
    const BATCH_SIZE = 100;
    let totalInserted = 0;
    
    for (let i = 0; i < notificationsToInsert.length; i += BATCH_SIZE) {
      const batch = notificationsToInsert.slice(i, i + BATCH_SIZE);
      
      const { error: insertError } = await supabase
        .from('pending_notifications')
        .insert(batch);

      if (insertError) {
        console.error(`Error inserting batch ${Math.floor(i / BATCH_SIZE) + 1}:`, insertError);
        throw insertError;
      }
      
      totalInserted += batch.length;
      console.log(`Inserted batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(notificationsToInsert.length / BATCH_SIZE)}`);
    }

    // Log the successful scheduling operation
    const executionTime = Date.now() - startTime;
    const { error: logError } = await supabase
      .from('notification_schedule_logs')
      .insert({
        users_processed: usersProcessed,
        success: true,
        metrics: {
          notificationsScheduled: totalInserted,
          relevantSchedules: relevantSchedules.length,
          currentTimeUtc: now.toUTCString(),
          duplicatesSkipped: duplicatesSkipped,
          executionTimeMs: executionTime,
          batchCount: Math.ceil(notificationsToInsert.length / BATCH_SIZE)
        }
      });

    if (logError) {
      console.error('Error logging scheduling operation:', logError);
      // Don't throw - operation was successful
    }

    console.log('=== DAILY NOTIFICATION SCHEDULING COMPLETED SUCCESSFULLY ===');
    console.log(`Total execution time: ${executionTime}ms`);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Daily notifications scheduled successfully',
        usersProcessed: usersProcessed,
        notificationsScheduled: totalInserted,
        duplicatesSkipped: duplicatesSkipped,
        executionTimeMs: executionTime
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const executionTime = Date.now() - startTime;
    console.error('=== DAILY NOTIFICATION SCHEDULING FAILED ===');
    console.error('Error details:', error);

    // Log the error
    try {
      await supabase.from('notification_schedule_logs').insert({
        users_processed: 0,
        success: false,
        error_details: {
          message: error.message,
          stack: error.stack,
          timestamp: new Date().toISOString(),
          executionTimeMs: executionTime
        }
      });
    } catch (logError) {
      console.error('Failed to log error:', logError);
    }

    return new Response(
      JSON.stringify({ 
        error: 'Failed to schedule notifications', 
        details: error.message,
        executionTimeMs: executionTime
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});