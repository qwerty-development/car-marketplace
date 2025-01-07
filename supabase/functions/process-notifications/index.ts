import { Expo } from 'https://esm.sh/expo-server-sdk@3.13.0';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

const expo = new Expo();

// Helper function to handle receipts
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
              details: receipt.details
            },
            record: record
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

    // Check if already processed
    if (record.processed) {
      return new Response(
        JSON.stringify({ message: 'Notification already processed' }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Get all user's push tokens
    const { data: userTokensData, error: userTokenError } = await supabase
      .from('user_push_tokens')
      .select('token')
      .eq('user_id', record.user_id);

    if (userTokenError || !userTokensData?.length) {
      console.error('Push tokens not found:', userTokenError);
      return new Response(
        JSON.stringify({ error: 'No push tokens found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
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

      messages.push({
        to: tokenData.token,
        sound: 'notification',
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
      });
    }

    // Check if there are any valid messages to send
    if (messages.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No valid push tokens found' }),
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
          tickets: tickets // You might not need to store all tickets, adjust as needed
        },
        is_read: false,
      });

    if (insertError) throw insertError;

    // Mark as processed
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
          const tokenToDelete = messages.find((m) => m.to === (ticket as any).to)?.to
          if (tokenToDelete) {
              await supabase
              .from('user_push_tokens')
              .delete()
              .eq('token', tokenToDelete)
          }
        }
      }
    }

    // Schedule receipt check
    setTimeout(() => {
      handlePushNotificationReceipts(tickets, record).catch(console.error);
    }, 5000); // Adjust the delay as needed

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