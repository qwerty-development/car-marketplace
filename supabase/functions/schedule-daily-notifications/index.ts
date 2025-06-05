import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
const supabase = createClient(Deno.env.get('SUPABASE_URL'), Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'));
// SIMPLIFIED: SINGLE AFTERNOON NOTIFICATION SCHEDULE
const notificationSchedules = [
  {
    hour: 16,
    title: "🌆 Daily Update",
    message: "Don't miss today's featured vehicles!",
    data: {
      screen: '/(home)/(user)',
      type: 'daily_reminder',
      timeOfDay: 'afternoon'
    }
  }
];
// RULE 2: ENHANCED DUPLICATE PREVENTION WITH SCHEDULE-SPECIFIC LOGIC
const checkPreviousNotifications = async (userId, scheduleHour)=>{
  console.log(`[DUPLICATE_CHECK] User ${userId} - Schedule hour ${scheduleHour}`);
  try {
    // CRITICAL: Check for ANY daily reminder in last 2 hours (not schedule-specific)
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    console.log(`[DUPLICATE_CHECK] Checking since: ${twoHoursAgo.toISOString()}`);
    const [pendingCheck, sentCheck] = await Promise.all([
      supabase.from('pending_notifications').select('id, created_at').eq('user_id', userId).eq('type', 'daily_reminder').gte('created_at', twoHoursAgo.toISOString()).maybeSingle(),
      supabase.from('notifications').select('id, created_at').eq('user_id', userId).eq('type', 'daily_reminder').gte('created_at', twoHoursAgo.toISOString()).maybeSingle()
    ]);
    const hasPending = !!pendingCheck.data;
    const hasSent = !!sentCheck.data;
    console.log(`[DUPLICATE_CHECK] User ${userId} - Pending: ${hasPending}, Sent: ${hasSent}`);
    return hasPending || hasSent;
  } catch (error) {
    console.error(`[DUPLICATE_CHECK] Error for user ${userId}:`, error);
    return false; // Allow notification on error
  }
};
// RULE 3: ENHANCED TIMEZONE CALCULATION WITH FALLBACK MECHANISMS
const getUserLocalHour = (timezone)=>{
  try {
    console.log(`[TIMEZONE_CALC] Processing timezone: ${timezone}`);
    const now = new Date();
    // METHOD 1: Primary calculation using Intl.DateTimeFormat
    try {
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        hour: 'numeric',
        hour12: false
      });
      const parts = formatter.formatToParts(now);
      const hourPart = parts.find((part)=>part.type === 'hour');
      if (hourPart) {
        const localHour = parseInt(hourPart.value, 10);
        console.log(`[TIMEZONE_CALC] Method 1 success - ${timezone}: ${localHour}`);
        return localHour;
      }
    } catch (method1Error) {
      console.warn(`[TIMEZONE_CALC] Method 1 failed for ${timezone}:`, method1Error);
    }
    // METHOD 2: Fallback using toLocaleString
    try {
      const localTime = now.toLocaleString('en-US', {
        timeZone: timezone,
        hour12: false,
        hour: '2-digit'
      });
      const hourMatch = localTime.match(/(\d{2}):/);
      if (hourMatch) {
        const localHour = parseInt(hourMatch[1], 10);
        console.log(`[TIMEZONE_CALC] Method 2 success - ${timezone}: ${localHour}`);
        return localHour;
      }
    } catch (method2Error) {
      console.warn(`[TIMEZONE_CALC] Method 2 failed for ${timezone}:`, method2Error);
    }
    // METHOD 3: UTC fallback
    const utcHour = now.getUTCHours();
    console.warn(`[TIMEZONE_CALC] All methods failed for ${timezone}, using UTC: ${utcHour}`);
    return utcHour;
  } catch (error) {
    console.error(`[TIMEZONE_CALC] Critical error for ${timezone}:`, error);
    return new Date().getUTCHours();
  }
};
// RULE 4: SIMPLIFIED SCHEDULE MATCHING FOR SINGLE AFTERNOON NOTIFICATION
const isScheduleRelevant = (scheduleHour, userLocalHour)=>{
  console.log(`[SCHEDULE_MATCH] Schedule ${scheduleHour} vs User ${userLocalHour}`);
  // Calculate time difference considering 24-hour boundaries
  const timeDiff = Math.abs(scheduleHour - userLocalHour);
  const dayBoundaryDiff = Math.abs(timeDiff - 24);
  const minDiff = Math.min(timeDiff, dayBoundaryDiff);
  // RULE: Allow execution within 1 hour window OR exact match for single notification
  const isExactMatch = minDiff === 0;
  const isWithinWindow = minDiff <= 1;
  const isRelevant = isExactMatch || isWithinWindow;
  console.log(`[SCHEDULE_MATCH] Diff: ${minDiff}h, Exact: ${isExactMatch}, Window: ${isWithinWindow}, Result: ${isRelevant}`);
  return isRelevant;
};
// RULE 5: EXECUTION THROTTLING FOR SINGLE NOTIFICATION
const MIN_EXECUTION_INTERVAL = 30 * 60 * 1000; // 30 minutes for single notification
const checkExecutionThrottle = async ()=>{
  try {
    console.log(`[THROTTLE_CHECK] Checking execution throttling (${MIN_EXECUTION_INTERVAL / 1000}s interval)`);
    const { data: lastLog } = await supabase.from('notification_schedule_logs').select('scheduled_at').eq('success', true).order('scheduled_at', {
      ascending: false
    }).limit(1).maybeSingle();
    if (lastLog) {
      const lastExecution = new Date(lastLog.scheduled_at);
      const timeSinceLastRun = Date.now() - lastExecution.getTime();
      console.log(`[THROTTLE_CHECK] Last: ${lastExecution.toISOString()}, Since: ${Math.round(timeSinceLastRun / 1000)}s`);
      if (timeSinceLastRun < MIN_EXECUTION_INTERVAL) {
        console.log(`[THROTTLE_CHECK] BLOCKED - Too recent`);
        return false;
      }
    }
    console.log(`[THROTTLE_CHECK] ALLOWED - Proceeding`);
    return true;
  } catch (error) {
    console.error('[THROTTLE_CHECK] Error:', error);
    return true;
  }
};
Deno.serve(async (req)=>{
  const startTime = Date.now();
  console.log('=== SIMPLIFIED AFTERNOON NOTIFICATION SCHEDULING STARTED ===');
  console.log(`[EXECUTION_START] ${new Date().toISOString()}`);
  try {
    // STEP 1: EXECUTION THROTTLING CHECK
    const canExecute = await checkExecutionThrottle();
    if (!canExecute) {
      return new Response(JSON.stringify({
        message: 'Execution throttled - ran too recently',
        throttled: true,
        intervalSeconds: MIN_EXECUTION_INTERVAL / 1000
      }), {
        headers: {
          'Content-Type': 'application/json'
        },
        status: 200
      });
    }
    // STEP 2: TIME ANALYSIS FOR SINGLE AFTERNOON SCHEDULE
    const now = new Date();
    const currentUtcHour = now.getUTCHours();
    const currentUtcMinute = now.getUTCMinutes();
    console.log(`[TIME_ANALYSIS] UTC: ${now.toISOString()}`);
    console.log(`[TIME_ANALYSIS] UTC Hour: ${currentUtcHour}, Minute: ${currentUtcMinute}`);
    console.log(`[TIME_ANALYSIS] Target schedule: 16:00 (4 PM) local time`);
    // STEP 3: SINGLE SCHEDULE FILTERING
    console.log(`[SCHEDULE_FILTER] Evaluating single afternoon schedule (hour 16)`);
    const afternoonSchedule = notificationSchedules[0]; // Only one schedule now
    let isRelevant = false;
    // Test against multiple timezone offsets to find matches
    for(let offset = -12; offset <= 14; offset++){
      const adjustedHour = (currentUtcHour + offset + 24) % 24;
      if (isScheduleRelevant(afternoonSchedule.hour, adjustedHour)) {
        isRelevant = true;
        console.log(`[SCHEDULE_FILTER] Afternoon schedule matches at UTC${offset >= 0 ? '+' : ''}${offset}`);
        break;
      }
    }
    if (!isRelevant) {
      console.log('[SCHEDULE_FILTER] TERMINATING - Afternoon schedule not relevant for current time');
      await supabase.from('notification_schedule_logs').insert({
        users_processed: 0,
        success: true,
        metrics: {
          notificationsScheduled: 0,
          relevantSchedules: 0,
          currentTimeUtc: now.toUTCString(),
          reason: 'Afternoon schedule (16:00) not relevant for current time',
          currentUtcHour: currentUtcHour
        }
      });
      return new Response(JSON.stringify({
        message: 'Afternoon schedule not relevant for current time',
        currentUtcHour,
        targetScheduleHour: 16,
        reason: 'No timezone matches found for 4 PM notifications'
      }), {
        headers: {
          'Content-Type': 'application/json'
        },
        status: 200
      });
    }
    // STEP 4: USER RETRIEVAL WITH VALIDATION
    console.log(`[USER_QUERY] Fetching users with active push tokens`);
    const { data: users, error: usersError } = await supabase.from('users').select(`
        id,
        timezone,
        user_push_tokens!inner(token, signed_in, active)
      `).neq('user_push_tokens.token', null).eq('user_push_tokens.signed_in', true).eq('user_push_tokens.active', true).neq('is_guest', true).limit(1000);
    if (usersError) {
      console.error('[USER_QUERY] Database error:', usersError);
      throw usersError;
    }
    console.log(`[USER_QUERY] Retrieved ${users?.length || 0} eligible users`);
    if (!users || users.length === 0) {
      console.log('[USER_QUERY] TERMINATING - No eligible users');
      await supabase.from('notification_schedule_logs').insert({
        users_processed: 0,
        success: true,
        metrics: {
          notificationsScheduled: 0,
          relevantSchedules: 1,
          currentTimeUtc: now.toUTCString(),
          reason: 'No eligible users with active push tokens'
        }
      });
      return new Response(JSON.stringify({
        message: 'No eligible users found',
        relevantSchedules: 1
      }), {
        headers: {
          'Content-Type': 'application/json'
        },
        status: 200
      });
    }
    // STEP 5: USER PROCESSING FOR AFTERNOON NOTIFICATIONS
    const notificationsToInsert = [];
    let usersProcessed = 0;
    let duplicatesSkipped = 0;
    let timezoneMatches = 0;
    let exactMatches = 0;
    let windowMatches = 0;
    console.log(`[USER_PROCESSING] Processing ${users.length} users for afternoon notifications`);
    for (const user of users){
      try {
        const userTimezone = user.timezone || 'UTC';
        const userLocalHour = getUserLocalHour(userTimezone);
        console.log(`[USER_${user.id}] Timezone: ${userTimezone}, Local Hour: ${userLocalHour}`);
        // Check if user's local time matches afternoon schedule (16:00)
        const timeDiff = Math.abs(afternoonSchedule.hour - userLocalHour);
        const dayBoundaryDiff = Math.abs(timeDiff - 24);
        const minDiff = Math.min(timeDiff, dayBoundaryDiff);
        const isExactMatch = minDiff === 0;
        const isWithinWindow = minDiff <= 1 && minDiff > 0;
        const isMatch = isExactMatch || isWithinWindow;
        console.log(`[USER_${user.id}] Afternoon check: Diff=${minDiff}h, Exact=${isExactMatch}, Window=${isWithinWindow}, Match=${isMatch}`);
        if (isMatch) {
          timezoneMatches++;
          if (isExactMatch) exactMatches++;
          if (isWithinWindow) windowMatches++;
          console.log(`[USER_${user.id}] MATCHED - Checking for duplicates`);
          const alreadySent = await checkPreviousNotifications(user.id, afternoonSchedule.hour);
          if (alreadySent) {
            console.log(`[USER_${user.id}] SKIPPED - Duplicate detected`);
            duplicatesSkipped++;
            continue;
          }
          console.log(`[USER_${user.id}] CREATING afternoon notification`);
          notificationsToInsert.push({
            user_id: user.id,
            type: 'daily_reminder',
            data: {
              title: afternoonSchedule.title,
              message: afternoonSchedule.message,
              ...afternoonSchedule.data,
              metadata: {
                scheduledFor: now.toISOString(),
                userTimezone: userTimezone,
                userLocalHour: userLocalHour,
                scheduleHour: afternoonSchedule.hour,
                timeDifference: minDiff,
                matchType: isExactMatch ? 'exact' : 'window',
                executionId: `afternoon_${startTime}_${user.id}`
              }
            },
            processed: false
          });
          console.log(`[USER_${user.id}] QUEUED afternoon notification successfully`);
        } else {
          console.log(`[USER_${user.id}] NO MATCH - Not in afternoon window`);
        }
        usersProcessed++;
      } catch (userError) {
        console.error(`[USER_${user.id}] Processing error:`, userError);
      }
    }
    // STEP 6: PROCESSING SUMMARY
    console.log(`[PROCESSING_SUMMARY] Complete:`);
    console.log(`[PROCESSING_SUMMARY] Users processed: ${usersProcessed}`);
    console.log(`[PROCESSING_SUMMARY] Timezone matches: ${timezoneMatches} (exact: ${exactMatches}, window: ${windowMatches})`);
    console.log(`[PROCESSING_SUMMARY] Notifications queued: ${notificationsToInsert.length}`);
    console.log(`[PROCESSING_SUMMARY] Duplicates skipped: ${duplicatesSkipped}`);
    if (notificationsToInsert.length === 0) {
      console.log(`[PROCESSING_SUMMARY] TERMINATING - No notifications to insert`);
      await supabase.from('notification_schedule_logs').insert({
        users_processed: usersProcessed,
        success: true,
        metrics: {
          notificationsScheduled: 0,
          relevantSchedules: 1,
          currentTimeUtc: now.toUTCString(),
          duplicatesSkipped: duplicatesSkipped,
          timezoneMatches: timezoneMatches,
          exactMatches: exactMatches,
          windowMatches: windowMatches,
          reason: 'All afternoon notifications filtered out (duplicates or no matches)'
        }
      });
      return new Response(JSON.stringify({
        message: 'No afternoon notifications to schedule after filtering',
        usersProcessed,
        timezoneMatches,
        exactMatches,
        windowMatches,
        duplicatesSkipped
      }), {
        headers: {
          'Content-Type': 'application/json'
        },
        status: 200
      });
    }
    // STEP 7: BATCH INSERTION
    console.log(`[INSERTION] Starting insertion of ${notificationsToInsert.length} afternoon notifications`);
    const { error: insertError } = await supabase.from('pending_notifications').insert(notificationsToInsert);
    if (insertError) {
      console.error(`[INSERTION] FAILED:`, insertError);
      throw insertError;
    }
    console.log(`[INSERTION] SUCCESS: ${notificationsToInsert.length} afternoon notifications inserted`);
    // STEP 8: SUCCESS LOGGING
    const executionTime = Date.now() - startTime;
    console.log(`[SUCCESS] Afternoon notification scheduling completed in ${executionTime}ms`);
    console.log(`[SUCCESS] Total afternoon notifications created: ${notificationsToInsert.length}`);
    const { error: logError } = await supabase.from('notification_schedule_logs').insert({
      users_processed: usersProcessed,
      success: true,
      metrics: {
        notificationsScheduled: notificationsToInsert.length,
        relevantSchedules: 1,
        currentTimeUtc: now.toUTCString(),
        duplicatesSkipped: duplicatesSkipped,
        timezoneMatches: timezoneMatches,
        exactMatches: exactMatches,
        windowMatches: windowMatches,
        executionTimeMs: executionTime,
        scheduleType: 'afternoon_only'
      }
    });
    if (logError) {
      console.error('[SUCCESS] Error logging operation:', logError);
    }
    console.log('=== SIMPLIFIED AFTERNOON NOTIFICATION SCHEDULING SUCCESS ===');
    return new Response(JSON.stringify({
      success: true,
      message: 'Afternoon notifications scheduled successfully',
      usersProcessed: usersProcessed,
      notificationsScheduled: notificationsToInsert.length,
      timezoneMatches: timezoneMatches,
      exactMatches: exactMatches,
      windowMatches: windowMatches,
      duplicatesSkipped: duplicatesSkipped,
      executionTimeMs: executionTime,
      scheduleHour: 16
    }), {
      headers: {
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    const executionTime = Date.now() - startTime;
    console.error('=== SIMPLIFIED AFTERNOON NOTIFICATION SCHEDULING FAILED ===');
    console.error('[ERROR]', error);
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
      console.error('[ERROR] Failed to log error:', logError);
    }
    return new Response(JSON.stringify({
      error: 'Failed to schedule afternoon notifications',
      details: error.message,
      executionTimeMs: executionTime
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
});
