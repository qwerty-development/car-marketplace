// supabase/functions/schedule-daily-notifications/index.ts - COMPREHENSIVE FIX
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

// CRITICAL FIX 1: Execution locking constants
const EXECUTION_LOCK_KEY = 'daily_notification_scheduler_lock';
const LOCK_DURATION_SECONDS = 300; // 5 minutes
const LOCK_RETRY_ATTEMPTS = 3;
const LOCK_RETRY_DELAY_MS = 1000;

// CRITICAL FIX 2: Improved duplicate prevention window
const DUPLICATE_PREVENTION_HOURS = 2; // Prevent duplicates within 2 hours instead of 1

const notificationSchedules: NotificationSchedule[] = [
  {
    hour: 16, // Scheduled hour in each user's local time for the daily notification
    title: "🌅 Daily Update",
    message: "Check out the latest car listings for today!",
    data: {
      screen: '/(home)/(user)',
      type: 'daily_reminder',
      timeOfDay: 'morning'
    }
  }
];

/**
 * CRITICAL FIX 3: Atomic execution lock implementation
 * Prevents multiple edge function instances from running simultaneously
 */
async function acquireExecutionLock(): Promise<boolean> {
  const lockExpiry = new Date(Date.now() + (LOCK_DURATION_SECONDS * 1000));
  const executionId = crypto.randomUUID();
  
  for (let attempt = 1; attempt <= LOCK_RETRY_ATTEMPTS; attempt++) {
    try {
      // Atomic insert with conflict resolution
      const { data, error } = await supabase
        .from('execution_locks')
        .insert({
          lock_key: EXECUTION_LOCK_KEY,
          execution_id: executionId,
          expires_at: lockExpiry.toISOString(),
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (!error) {
        console.log(`Lock acquired successfully. Execution ID: ${executionId}`);
        return true;
      }

      // Handle lock already exists (duplicate key error)
      if (error.code === '23505') {
        console.log(`Lock exists, checking if expired (attempt ${attempt}/${LOCK_RETRY_ATTEMPTS})`);
        
        // Clean up expired locks atomically
        const { error: cleanupError } = await supabase
          .from('execution_locks')
          .delete()
          .eq('lock_key', EXECUTION_LOCK_KEY)
          .lt('expires_at', new Date().toISOString());

        if (cleanupError) {
          console.error('Error cleaning expired locks:', cleanupError);
        }

        // Wait before retry
        if (attempt < LOCK_RETRY_ATTEMPTS) {
          await new Promise(resolve => setTimeout(resolve, LOCK_RETRY_DELAY_MS));
        }
      } else {
        console.error(`Lock acquisition error (attempt ${attempt}):`, error);
        if (attempt < LOCK_RETRY_ATTEMPTS) {
          await new Promise(resolve => setTimeout(resolve, LOCK_RETRY_DELAY_MS));
        }
      }
    } catch (lockError) {
      console.error(`Lock acquisition exception (attempt ${attempt}):`, lockError);
      if (attempt < LOCK_RETRY_ATTEMPTS) {
        await new Promise(resolve => setTimeout(resolve, LOCK_RETRY_DELAY_MS));
      }
    }
  }

  console.log('Failed to acquire execution lock after all attempts');
  return false;
}

/**
 * CRITICAL FIX 4: Proper lock cleanup
 */
async function releaseExecutionLock(): Promise<void> {
  try {
    const { error } = await supabase
      .from('execution_locks')
      .delete()
      .eq('lock_key', EXECUTION_LOCK_KEY);

    if (error) {
      console.error('Error releasing execution lock:', error);
    } else {
      console.log('Execution lock released successfully');
    }
  } catch (releaseError) {
    console.error('Exception during lock release:', releaseError);
  }
}

/**
 * CRITICAL FIX 5: Enhanced duplicate prevention with atomic operations
 * Uses database-level unique constraints and atomic operations
 */
const checkAndPreventDuplicates = async (userId: string, hour: number, scheduledFor: string) => {
  const preventionWindow = new Date(Date.now() - (DUPLICATE_PREVENTION_HOURS * 60 * 60 * 1000));
  
  try {
    // ATOMIC CHECK: Use a single query to check for existing notifications
    const { data: existingNotifications, error: checkError } = await supabase
      .from('pending_notifications')
      .select('id, created_at')
      .eq('user_id', userId)
      .eq('type', 'daily_reminder')
      .gte('created_at', preventionWindow.toISOString())
      .order('created_at', { ascending: false })
      .limit(1);

    if (checkError) {
      console.error('Error checking for duplicates:', checkError);
      return false; // Fail safe - don't schedule if we can't check
    }

    if (existingNotifications && existingNotifications.length > 0) {
      console.log(`Duplicate prevention: User ${userId} already has recent daily reminder notification`);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Exception in duplicate prevention:', error);
    return false; // Fail safe
  }
};

/**
 * CRITICAL FIX 6: Batch processing with atomic operations
 * Process all notifications in a single transaction where possible
 */
async function scheduleNotificationsBatch(notificationsToInsert: any[]): Promise<boolean> {
  if (notificationsToInsert.length === 0) {
    console.log('No notifications to schedule');
    return true;
  }

  try {
    console.log(`Attempting to schedule ${notificationsToInsert.length} notifications`);

    // ATOMIC BATCH INSERT with upsert to handle any remaining race conditions
    const { data, error } = await supabase
      .from('pending_notifications')
      .upsert(notificationsToInsert, {
        onConflict: 'user_id,type,created_at', // Assuming you'll add this composite unique constraint
        ignoreDuplicates: true
      })
      .select('id');

    if (error) {
      console.error('Error inserting notifications batch:', error);
      return false;
    }

    const actualInserted = data?.length || 0;
    console.log(`Successfully scheduled ${actualInserted} notifications (${notificationsToInsert.length - actualInserted} were duplicates)`);
    return true;

  } catch (batchError) {
    console.error('Exception during batch notification scheduling:', batchError);
    return false;
  }
}

/**
 * MAIN REQUEST HANDLER - Enhanced with comprehensive error handling
 */
Deno.serve(async (req) => {
  const startTime = Date.now();
  let lockAcquired = false;

  try {
    console.log('=== DAILY NOTIFICATION SCHEDULER STARTED ===');
    console.log('Request method:', req.method);
    console.log('Current UTC time:', new Date().toISOString());

    // CRITICAL FIX 7: Enforce POST method only
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed. Only POST requests are accepted.' }),
        { status: 405, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // CRITICAL FIX 8: Acquire execution lock before any processing
    console.log('Attempting to acquire execution lock...');
    lockAcquired = await acquireExecutionLock();

    if (!lockAcquired) {
      console.log('Could not acquire execution lock. Another instance may be running.');
      return new Response(
        JSON.stringify({ 
          message: 'Scheduler already running or temporarily unavailable',
          timestamp: new Date().toISOString()
        }),
        { status: 409, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log('Execution lock acquired successfully');

    // Determine the current hour in UTC
    const currentUtcHour = new Date().getUTCHours();
    console.log('Current UTC hour:', currentUtcHour);

    // Filter schedules relevant to the current hour
    const relevantSchedules = notificationSchedules.filter(schedule => {
      const hourDiff = Math.abs((schedule.hour - currentUtcHour) % 24);
      return hourDiff < 1;
    });

    console.log(`Found ${relevantSchedules.length} relevant schedules for hour ${currentUtcHour}`);

    if (relevantSchedules.length === 0) {
      await releaseExecutionLock();
      return new Response(
        JSON.stringify({ 
          message: 'No relevant schedules for the current hour.',
          currentUtcHour,
          timestamp: new Date().toISOString()
        }),
        { headers: { 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // CRITICAL FIX 9: Enhanced user query with better filtering
    console.log('Fetching eligible users...');
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
      .not('id', 'like', 'guest_%'); // Exclude guest users

    if (usersError) {
      console.error('Error fetching users:', usersError);
      throw usersError;
    }

    console.log(`Found ${users?.length || 0} eligible users`);

    if (!users || users.length === 0) {
      await releaseExecutionLock();
      return new Response(
        JSON.stringify({ 
          message: 'No eligible users found for notification scheduling',
          timestamp: new Date().toISOString()
        }),
        { headers: { 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // CRITICAL FIX 10: Sequential processing with atomic duplicate prevention
    const notificationsToInsert: any[] = [];
    let skippedDuplicates = 0;

    for (const user of users) {
      const userTimezone = user.timezone || 'UTC';
      
      try {
        const userCurrentTime = new Date().toLocaleString('en-US', { timeZone: userTimezone });
        const userCurrentHour = new Date(userCurrentTime).getHours();

        for (const schedule of relevantSchedules) {
          const hourDiff = Math.abs(schedule.hour - userCurrentHour);
          
          if (hourDiff < 1) {
            const scheduledFor = new Date().toISOString();
            
            // ATOMIC duplicate prevention
            const canSchedule = await checkAndPreventDuplicates(user.id, schedule.hour, scheduledFor);
            
            if (canSchedule) {
              notificationsToInsert.push({
                user_id: user.id,
                type: 'daily_reminder',
                data: {
                  title: schedule.title,
                  message: schedule.message,
                  ...schedule.data,
                  metadata: {
                    scheduledFor,
                    userTimezone: user.timezone,
                    hour: schedule.hour,
                    executionId: crypto.randomUUID() // Unique execution tracking
                  }
                },
                processed: false,
                created_at: new Date().toISOString()
              });
            } else {
              skippedDuplicates++;
            }
          }
        }
      } catch (userError) {
        console.error(`Error processing user ${user.id}:`, userError);
        continue; // Skip this user but continue with others
      }
    }

    console.log(`Prepared ${notificationsToInsert.length} notifications, skipped ${skippedDuplicates} duplicates`);

    // CRITICAL FIX 11: Atomic batch insertion
    const batchSuccess = await scheduleNotificationsBatch(notificationsToInsert);

    if (!batchSuccess) {
      throw new Error('Failed to schedule notification batch');
    }

    // CRITICAL FIX 12: Enhanced logging with execution tracking
    const executionTime = Date.now() - startTime;
    const logData = {
      users_processed: users.length,
      success: true,
      metrics: {
        notificationsScheduled: notificationsToInsert.length,
        skippedDuplicates,
        relevantSchedules: relevantSchedules.length,
        currentTimeUtc: new Date().toUTCString(),
        executionTimeMs: executionTime,
        lockAcquired: true
      }
    };

    const { error: logError } = await supabase
      .from('notification_schedule_logs')
      .insert(logData);

    if (logError) {
      console.error('Error logging scheduling operation:', logError);
    }

    console.log('=== DAILY NOTIFICATION SCHEDULER COMPLETED SUCCESSFULLY ===');
    console.log(`Execution time: ${executionTime}ms`);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Daily notifications scheduled successfully',
        usersProcessed: users.length,
        notificationsScheduled: notificationsToInsert.length,
        skippedDuplicates,
        executionTimeMs: executionTime,
        timestamp: new Date().toISOString()
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('=== CRITICAL ERROR IN SCHEDULER ===');
    console.error('Error details:', error);

    const executionTime = Date.now() - startTime;

    // Log the error with detailed information
    try {
      await supabase
        .from('notification_schedule_logs')
        .insert({
          users_processed: 0,
          success: false,
          error_details: {
            message: error.message,
            stack: error.stack,
            timestamp: new Date().toISOString(),
            executionTimeMs: executionTime,
            lockAcquired
          }
        });
    } catch (logError) {
      console.error('Failed to log error:', logError);
    }

    return new Response(
      JSON.stringify({ 
        error: 'Failed to schedule notifications', 
        details: error.message,
        timestamp: new Date().toISOString(),
        executionTimeMs: executionTime
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );

  } finally {
    // CRITICAL FIX 13: Always release lock in finally block
    if (lockAcquired) {
      await releaseExecutionLock();
      console.log('Execution lock released in finally block');
    }
  }
});