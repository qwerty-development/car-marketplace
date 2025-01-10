// supabase/functions/process-notifications/index.ts
import { Expo } from 'https://esm.sh/expo-server-sdk@3.13.0';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

const expo = new Expo();

// Helper function to handle receipts (remains the same)
async function handlePushNotificationReceipts(
  tickets: Expo.ExpoPushTicket[],
  record: any
) {
  const receiptIds = [];

  for (const ticket of tickets) {
    if ((ticket as any).id) {
      receiptIds.push((ticket as any).id);
    }
  }

  if (receiptIds.length === 0) return;

  const receiptChunks = expo.chunkPushNotificationReceiptIds(receiptIds);

  for (const chunk of receiptChunks) {
    try {
      const receipts = await expo.getPushNotificationReceiptsAsync(chunk);

      for (const [receiptId, receipt] of Object.entries(receipts)) {
        if (receipt.status === 'error') {
          // Log the error
          await supabase.from('notification_errors').insert({
            error_details: {
              receipt,
              message: receipt.message,
              details: receipt.details,
            },
            record: record,
          });

          // Handle DeviceNotRegistered error
          if (receipt.details?.error === 'DeviceNotRegistered') {
            await supabase
              .from('user_push_tokens')
              .delete()
              .eq('token', record.token);
          }
        }
      }
    } catch (error) {
      console.error('Error checking receipts:', error);
    }
  }
}

// Function to check for duplicate notifications (remains the same)
const checkDuplicateNotification = async (
  userId: string,
  type: string,
  hour: number
) => {
  // Check for notifications sent in the last hour
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

  const { data } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .eq('type', type)
    .gte('created_at', oneHourAgo.toISOString())
    .maybeSingle();

  return !!data;
};

Deno.serve(async (req) => {
  try {
    // Verify request method
    if (req.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    // Parse request body
    let record;
    try {
      const body = await req.json();
      record = body.record;
      console.log('Processing notification for record:', record);
    } catch (error) {
      console.error('JSON parsing error:', error);
      return new Response(JSON.stringify({ error: 'Invalid JSON payload' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // **Removed processed check** (as it is now handled by the trigger)

    // Handle different notification types
    // Get all user's push tokens
    const { data: userTokensData, error: userTokenError } = await supabase
      .from('user_push_tokens')
      .select('token')
      .eq('user_id', record.user_id);

    if (userTokenError || !userTokensData?.length) {
      console.error('Push tokens not found:', userTokenError);
      return new Response(JSON.stringify({ error: 'No push tokens found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // **Add the Daily Reminder Duplicate Check BEFORE Creating Messages**
    if (record.type === 'daily_reminder') {
      const hour = record.data.metadata?.hour; // Get the scheduled hour
      const isDuplicate = await checkDuplicateNotification(
        record.user_id,
        'daily_reminder',
        hour
      );

      if (isDuplicate) {
        // Log the duplicate attempt instead of marking as processed
        console.warn(
          'Duplicate daily_reminder notification detected and skipped:',
          record
        );
        return new Response(
          JSON.stringify({
            message: 'Duplicate notification skipped (logged)',
          }),
          { headers: { 'Content-Type': 'application/json' } }
        );
      }
    }

    // Create messages for all valid tokens
    const notificationId = crypto.randomUUID();
    const messages = [];

    for (const tokenData of userTokensData) {
      if (!Expo.isExpoPushToken(tokenData.token)) {
        console.error('Invalid push token:', tokenData.token);

        // Delete invalid token immediately
        await supabase
          .from('user_push_tokens')
          .delete()
          .eq('token', tokenData.token);

        continue; // Skip to the next token
      }

      // Construct the message based on the notification type
      let message;
      if (record.type === 'daily_reminder') {
        message = {
          to: tokenData.token,
          sound: 'notification.wav',
          title: record.data.title,
          body: record.data.message,
          data: {
            ...record.data,
            notificationId,
          },
          badge: 1,
          channelId: 'default',
          priority: 'high',
          categoryId: record.type,
        };
      } else if (record.type === 'price_drop') {
        message = {
          to: tokenData.token,
          sound: 'notification.wav', // Customize sound as needed
          title: 'Price Drop Alert! 💲',
          body: record.data.message, // Customize the message
          data: {
            ...record.data,
            notificationId,
          },
          badge: 1,
          channelId: 'default', // Customize channel ID as needed
          priority: 'high',
          categoryId: record.type,
        };
      } else if (record.type === 'car_sold') {
        message = {
          to: tokenData.token,
          sound: 'notification.wav', // Customize sound as needed
          title: 'Car Sold! 🚗',
          body: record.data.message, // Customize the message
          data: {
            ...record.data,
            notificationId,
          },
          badge: 1,
          channelId: 'default', // Customize channel ID as needed
          priority: 'high',
          categoryId: record.type,
        };
      } else if (record.type === 'view_milestone') {
        message = {
          to: tokenData.token,
          sound: 'notification.wav', // Customize sound as needed
          title: 'Popular Car Alert! 🎉',
          body: record.data.message, // Customize the message
          data: {
            ...record.data,
            notificationId,
          },
          badge: 1,
          channelId: 'default', // Customize channel ID as needed
          priority: 'high',
          categoryId: record.type,
        };
      } else if (record.type === 'inactive_reminder') {
        message = {
          to: tokenData.token,
          sound: 'notification.wav', // Customize sound as needed
          title: '👋 We Miss You!',
          body: record.data.message, // Customize the message
          data: {
            ...record.data,
            notificationId,
          },
          badge: 1,
          channelId: 'default', // Customize channel ID as needed
          priority: 'high',
          categoryId: record.type,
        };
      } else {
        // Handle unknown notification type
        console.error('Unknown notification type:', record.type);
        continue; // Skip to the next token
      }

      messages.push(message);
    }

    // Check if there are any valid messages to send
    if (messages.length === 0) {
      return new Response(
        JSON.stringify({
          message: 'No valid push tokens found or unknown notification type',
        }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Send notifications to all devices
    const tickets = [];
    const chunks = expo.chunkPushNotifications(messages);

    for (const chunk of chunks) {
      try {
        const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
        tickets.push(...ticketChunk);
      } catch (error) {
        console.error('Error sending notification chunk:', error);
        // Continue with other chunks even if one fails
        await supabase.from('notification_errors').insert({
          error_details: {
            message: error.message,
            stack: error.stack,
          },
          record: record,
        });
      }
    }

    // Store notification in database (only once, not per device)
    const { error: insertError } = await supabase
      .from('notifications')
      .insert({
        id: notificationId,
        user_id: record.user_id,
        type: record.type,
        title: record.data.title,
        message: record.data.message,
        data: {
          ...record.data,
          notificationId,
          tickets: tickets, // You might not need to store all tickets, adjust as needed
        },
        is_read: false,
      });

    if (insertError) throw insertError;

    // Mark as processed **immediately after insertion**
    const { error: updateError } = await supabase
      .from('pending_notifications')
      .update({ processed: true })
      .eq('id', record.id);

    if (updateError) throw updateError;

    // Process all tickets (check for errors and handle DeviceNotRegistered)
    for (const ticket of tickets) {
      if ((ticket as any).status === 'error') {
        const error = (ticket as any).details?.error;

        // Log the error (consider more detailed logging)
        await supabase.from('notification_errors').insert({
          error_details: ticket,
          record: record,
        });

        // Handle DeviceNotRegistered error
        if (error === 'DeviceNotRegistered') {
          const tokenToDelete = messages.find((m) => m.to === (ticket as any).to)
            ?.to;
          if (tokenToDelete) {
            await supabase
              .from('user_push_tokens')
              .delete()
              .eq('token', tokenToDelete);
          }
        }
      }
    }

    // Schedule receipt check
    setTimeout(() => {
      handlePushNotificationReceipts(tickets, record).catch(console.error);
    }, 5000); // Adjust the delay as needed

    // Log successful delivery
    try {
      await supabase.from('notification_metrics').insert({
        notification_id: notificationId,
        type: record.type,
        user_id: record.user_id,
        delivery_status: 'sent',
        platform: Deno.env.get('OS') || 'unknown',
        metadata: {
          scheduledTime: record.data.metadata?.scheduledFor,
          actualDeliveryTime: new Date().toISOString(),
          timeZone: record.data.metadata?.userTimezone,
        },
      });
    } catch (error) {
      console.error('Error logging metrics:', error);
    }

    return new Response(
      JSON.stringify({
        success: true,
        tickets,
        notificationId,
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error processing notification:', error);

    // Log the error (consider more detailed logging)
    if (record) {
      await supabase.from('notification_errors').insert({
        error_details: {
          message: error.message,
          stack: error.stack,
        },
        record: record,
      });
    }

    return new Response(
      JSON.stringify({
        error: 'Failed to process notification',
        details: error.message,
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});