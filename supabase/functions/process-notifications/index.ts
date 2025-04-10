import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Initialize Supabase client
const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

// Constants for Expo Push API
const EXPO_PUSH_API_URL = 'https://exp.host/--/api/v2/push/send';
const EXPO_RECEIPTS_API_URL = 'https://exp.host/--/api/v2/push/getReceipts';
const CHUNK_SIZE = 100; // Maximum allowed by Expo API

// Direct Expo Push API implementation
class DirectExpoPush {
  // Check if a token has the correct format
  isExpoPushToken(token: string): boolean {
    return token.startsWith('ExponentPushToken[') || token.startsWith('ExpoPushToken[');
  }

  // Split tokens into chunks of CHUNK_SIZE
  chunkPushNotifications(messages: any[]): any[][] {
    const chunks = [];
    for (let i = 0; i < messages.length; i += CHUNK_SIZE) {
      chunks.push(messages.slice(i, i + CHUNK_SIZE));
    }
    return chunks;
  }

  // Split receipt IDs into chunks of CHUNK_SIZE
  chunkPushNotificationReceiptIds(receiptIds: string[]): string[][] {
    const chunks = [];
    for (let i = 0; i < receiptIds.length; i += CHUNK_SIZE) {
      chunks.push(receiptIds.slice(i, i + CHUNK_SIZE));
    }
    return chunks;
  }

  // Send push notifications directly to Expo Push API
  async sendPushNotificationsAsync(messages: any[]): Promise<any[]> {
    console.log(`Sending ${messages.length} push notifications directly to Expo API`);

    try {
      const response = await fetch(EXPO_PUSH_API_URL, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(messages),
      });

      if (!response.ok) {
        const errorData = await response.text();
        console.error(`API error (${response.status}): ${errorData}`);
        throw new Error(`Expo Push API error: ${response.status} ${errorData}`);
      }

      const data = await response.json();
      return data.data || [];
    } catch (error) {
      console.error('Error sending push notifications:', error);
      throw error;
    }
  }

  // Get receipts for push notifications
  async getPushNotificationReceiptsAsync(receiptIds: string[]): Promise<Record<string, any>> {
    console.log(`Getting receipts for ${receiptIds.length} notifications`);

    try {
      const response = await fetch(EXPO_RECEIPTS_API_URL, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ids: receiptIds }),
      });

      if (!response.ok) {
        const errorData = await response.text();
        console.error(`Receipts API error (${response.status}): ${errorData}`);
        throw new Error(`Expo Receipts API error: ${response.status} ${errorData}`);
      }

      const data = await response.json();
      return data.data || {};
    } catch (error) {
      console.error('Error getting push notification receipts:', error);
      throw error;
    }
  }
}

// Create an instance of our direct implementation
const expo = new DirectExpoPush();

// Helper function to handle receipts
async function handlePushNotificationReceipts(
  tickets: any[],
  record: any
) {
  console.log('Processing receipts for notification tickets');
  const receiptIds = [];

  for (const ticket of tickets) {
    if (ticket.id) {
      receiptIds.push(ticket.id);
    }
  }

  if (receiptIds.length === 0) {
    console.log('No receipt IDs to process');
    return;
  }

  try {
    console.log(`Processing ${receiptIds.length} receipt IDs`);
    const receiptChunks = expo.chunkPushNotificationReceiptIds(receiptIds);

    for (let i = 0; i < receiptChunks.length; i++) {
      const chunk = receiptChunks[i];
      try {
        console.log(`Processing receipt chunk ${i+1}/${receiptChunks.length}`);
        const receipts = await expo.getPushNotificationReceiptsAsync(chunk);

        for (const [receiptId, receipt] of Object.entries(receipts)) {
          if (receipt.status === 'error') {
            console.log(`Receipt ${receiptId} has error:`, receipt);

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
  const ticket = tickets.find(t => t.id === receiptId);
  if (ticket && ticket.message) {
    await supabase
      .from('user_push_tokens')
      .update({ active: false })
      .eq('token', ticket.message.to);

    console.log(`Marked unregistered token as inactive: ${ticket.message.to}`);
  }
}
          } else {
            console.log(`Receipt ${receiptId} status: ${receipt.status}`);
          }
        }
      } catch (error) {
        console.error(`Error processing receipt chunk ${i+1}:`, error);
        await supabase.from('notification_errors').insert({
          error_details: {
            message: error.message,
            stack: error.stack,
          },
          record: record,
        });
      }
    }
  } catch (error) {
    console.error('Error processing receipt chunks:', error);
    await supabase.from('notification_errors').insert({
      error_details: {
        message: error.message,
        stack: error.stack,
      },
      record: record,
    });
  }
}

// Function to check for duplicate notifications
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

// Main request handler
Deno.serve(async (req) => {
  let record: any = null;

  try {
    // Verify request method
    if (req.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    let originalRecord;
    try {
      const body = await req.json();
      originalRecord = body.record;
      console.log('Processing notification for record:', originalRecord);
    } catch (error) {
      console.error('JSON parsing error:', error);
      return new Response(JSON.stringify({ error: 'Invalid JSON payload' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Mark notification as processed
    const { data: fetchedRecord, error } = await supabase
      .from('pending_notifications')
      .update({ processed: true })
      .eq('id', originalRecord.id)
      .eq('processed', false)
      .select()
      .single();

    if (error || !fetchedRecord) {
      console.error('Error updating or already processed:', error);
      return new Response(
        JSON.stringify({
          message: 'Record not found, might be already processed',
        }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    record = fetchedRecord;

    // Get the user's push tokens
 const { data: userTokensData, error: userTokenError } = await supabase
  .from('user_push_tokens')
  .select('token, id')
  .eq('user_id', record.user_id)
  .eq('signed_in', true)
  .eq('active', true);

    if (userTokenError || !userTokensData?.length) {
      console.error('Push tokens not found:', userTokenError);
      return new Response(JSON.stringify({ error: 'No push tokens found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check for duplicate daily reminders
    if (record.type === 'daily_reminder') {
      const hour = record.data?.metadata?.hour;
      const isDuplicate = await checkDuplicateNotification(
        record.user_id,
        'daily_reminder',
        hour
      );

      if (isDuplicate) {
        console.warn('Duplicate daily_reminder notification skipped:', record);
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
    const validTokens = [];

    for (const tokenData of userTokensData) {
      // Check for valid Expo push token format
      try {
        if (!expo.isExpoPushToken(tokenData.token)) {
          console.error('Invalid push token:', tokenData.token);

          // Delete invalid token immediately
await supabase
  .from('user_push_tokens')
  .update({ active: false })
  .eq('token', tokenData.token);

console.log(`Marked invalid token as inactive: ${tokenData.token}`);

          continue; // Skip to the next token
        }

        validTokens.push(tokenData.token);

        // Construct the message based on the notification type
        let message: any = null;

        if (record.type === 'daily_reminder') {
          message = {
            to: tokenData.token,
            sound: 'default',
            title: record.data.title || 'Daily Reminder',
            body: record.data.message || 'Check your app for updates!',
            data: {
              ...record.data,
              notificationId,
            },
            badge: 1,
            channelId: 'default',
          };
        } else if (record.type === 'price_drop') {
          message = {
            to: tokenData.token,
            sound: 'default',
            title: record.data.title || 'Price Drop Alert! 💲',
            body: record.data.message || 'A car you liked has dropped in price!',
            data: {
              ...record.data,
              notificationId,
            },
            badge: 1,
            channelId: 'default',
          };
        } else if (record.type === 'car_sold') {
          message = {
            to: tokenData.token,
            sound: 'default',
            title: record.data.title || 'Car Sold! 🚗',
            body: record.data.message || 'A car you were interested in has been sold.',
            data: {
              ...record.data,
              notificationId,
            },
            badge: 1,
            channelId: 'default',
          };
        } else if (record.type === 'view_milestone') {
          message = {
            to: tokenData.token,
            sound: 'default',
            title: record.data.title || 'Popular Car Alert! 🎉',
            body: record.data.message || 'Your car is getting a lot of views!',
            data: {
              ...record.data,
              notificationId,
            },
            badge: 1,
            channelId: 'default',
          };
        } else if (record.type === 'inactive_reminder') {
          message = {
            to: tokenData.token,
            sound: 'default',
            title: record.data.title || '👋 We Miss You!',
            body: record.data.message || 'Come back and see what\'s new!',
            data: {
              ...record.data,
              notificationId,
            },
            badge: 1,
            channelId: 'default',
          };
        } else {
          // Handle unknown notification type
          console.error('Unknown notification type:', record.type);
          continue; // Skip to the next token
        }

        if (message) {
          messages.push(message);
        }
      } catch (error) {
        console.error('Error processing token:', error, tokenData);
        // Continue with other tokens even if one fails
      }
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

    // Log for debugging purposes
    console.log(`Preparing to send ${messages.length} notifications to ${validTokens.length} tokens`);

    // Send notifications to all devices
    const tickets = [];

    try {
      // Use chunks to handle multiple devices
      const chunks = expo.chunkPushNotifications(messages);
      console.log(`Chunked into ${chunks.length} batches for delivery`);

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        try {
          console.log(`Sending batch ${i+1}/${chunks.length} with ${chunk.length} messages`);
          const ticketChunk = await expo.sendPushNotificationsAsync(chunk);

          // Add original messages to tickets for token reference later
          ticketChunk.forEach((ticket, index) => {
            ticket.message = chunk[index];
          });

          tickets.push(...ticketChunk);
        } catch (error) {
          console.error(`Error sending notification chunk ${i+1}:`, error);
          // Continue with other chunks even if one fails
          await supabase.from('notification_errors').insert({
            error_details: {
              message: error.message,
              stack: error.stack,
              chunk: i+1,
              chunkSize: chunk.length
            },
            record: record,
          });
        }
      }
    } catch (error) {
      console.error('Error chunking notifications:', error);
      await supabase.from('notification_errors').insert({
        error_details: {
          message: error.message,
          stack: error.stack,
          stage: 'chunking'
        },
        record: record,
      });

      throw error; // Rethrow to be caught by the main error handler
    }

    // Store notification in database (only once, not per device)
    try {
      const { error: insertError } = await supabase
        .from('notifications')
        .insert({
          id: notificationId,
          user_id: record.user_id,
          type: record.type,
          title: record.data.title || `Notification: ${record.type}`,
          message: record.data.message || 'Check your notifications',
          data: {
            ...record.data,
            notificationId,
            ticketCount: tickets.length,
          },
          is_read: false,
        });

      if (insertError) throw insertError;
    } catch (error) {
      console.error('Error inserting notification record:', error);
      // Continue processing even if database insert fails
    }

    // Process all tickets (check for errors and handle DeviceNotRegistered)
    for (const ticket of tickets) {
      if (ticket.status === 'error') {
        const error = ticket.details?.error;

        // Log the error
        await supabase.from('notification_errors').insert({
          error_details: ticket,
          record: record,
        });

        // Handle DeviceNotRegistered error
        if (error === 'DeviceNotRegistered' && ticket.message?.to) {
  await supabase
    .from('user_push_tokens')
    .update({ active: false })
    .eq('token', ticket.message.to);

  console.log(`Marked unregistered token as inactive: ${ticket.message.to}`);
}
      }
    }

    // Schedule receipt check
    setTimeout(() => {
      handlePushNotificationReceipts(tickets, record).catch((error) => {
        console.error('Error in receipt handling:', error);
      });
    }, 5000);

    // Log successful delivery
    try {
      await supabase.from('notification_metrics').insert({
        notification_id: notificationId,
        type: record.type,
        user_id: record.user_id,
        delivery_status: 'sent',
        platform: 'deno',
        metadata: {
          scheduledTime: record.data.metadata?.scheduledFor,
          actualDeliveryTime: new Date().toISOString(),
          timeZone: record.data.metadata?.userTimezone,
          ticketCount: tickets.length,
          validTokenCount: validTokens.length
        },
      });
    } catch (error) {
      console.error('Error logging metrics:', error);
    }

    return new Response(
      JSON.stringify({
        success: true,
        ticketCount: tickets.length,
        notificationId,
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error processing notification:', error);

    // Log the error
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