// supabase/functions/process-notifications/index.ts

import { Expo } from 'https://esm.sh/expo-server-sdk@3.13.0 ';

// Initialize Supabase client
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

// Initialize Expo SDK client
const expo = new Expo();

// Helper function to handle receipts
async function handlePushNotificationReceipts(tickets: Expo.ExpoPushTicket[], record: any) {
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
      console.log("Processing notification for record:", record);
    } catch (error) {
      console.error("JSON parsing error:", error);
      return new Response(
        JSON.stringify({ error: "Invalid JSON payload" }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Check if already processed
    if (record.processed) {
      return new Response(
        JSON.stringify({ message: 'Notification already processed' }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Get user's push token
    const { data: userTokenData, error: userTokenError } = await supabase
      .from('user_push_tokens')
      .select('token')
      .eq('user_id', record.user_id)
      .single();

    if (userTokenError || !userTokenData?.token) {
      console.error('Push token not found:', userTokenError);
      return new Response(
        JSON.stringify({ error: 'Push token not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Validate push token
    if (!Expo.isExpoPushToken(userTokenData.token)) {
      console.error('Invalid push token:', userTokenData.token);

      await supabase
        .from('user_push_tokens')
        .delete()
        .eq('token', userTokenData.token);

      return new Response(
        JSON.stringify({ error: 'Invalid Expo push token' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Prepare notification message
    const notificationId = crypto.randomUUID();
    const messages = [{
      to: userTokenData.token,
      sound: 'default',
      title: record.data.title,
      body: record.data.message,
      data: {
        ...record.data,
        notificationId
      },
      badge: 1,
      channelId: 'default',
      priority: 'high',
      categoryId: record.type
    }];

    // Chunk the messages (even though we have only one)
    const chunks = expo.chunkPushNotifications(messages);
    const tickets = [];

    // Send notifications
    for (const chunk of chunks) {
      try {
        const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
        tickets.push(...ticketChunk);
      } catch (error) {
        console.error('Error sending notification chunk:', error);
        throw error;
      }
    }

    // Process all tickets
    for (const ticket of tickets) {
      if ((ticket as any).status === "error") {
        const error = (ticket as any).details?.error;
        await supabase.from('notification_errors').insert({
          error_details: ticket,
          record: record
        });

        if (error === "DeviceNotRegistered") {
          await supabase
            .from('user_push_tokens')
            .delete()
            .eq('token', userTokenData.token);
        }
      }
    }

    // Store notification in database
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
          tickets: tickets
        },
        is_read: false
      });

    if (insertError) throw insertError;

    // Mark as processed
    const { error: updateError } = await supabase
      .from('pending_notifications')
      .update({ processed: true })
      .eq('id', record.id);

    if (updateError) throw updateError;

    // Schedule receipt check
    setTimeout(() => {
      handlePushNotificationReceipts(tickets, record).catch(console.error);
    }, 5000);

    return new Response(
      JSON.stringify({
        success: true,
        tickets,
        notificationId
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
          stack: error.stack
        },
        record: record
      });
    }

    return new Response(
      JSON.stringify({
        error: 'Failed to process notification',
        details: error.message
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});