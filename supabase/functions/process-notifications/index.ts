// supabase/functions/process-notifications/index.ts

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { Expo } from 'https://esm.sh/expo-server-sdk@3.7.0'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

const expo = new Expo();

Deno.serve(async (req) => {
  const { record } = await req.json();

  if (record.processed) {
    return new Response('Notification already processed', {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const { data: userTokenData, error: userTokenError } = await supabase
    .from('user_push_tokens')
    .select('token')
    .eq('user_id', record.user_id)
    .single();

  if (userTokenError || !userTokenData) {
    console.error('Error fetching user push token:', userTokenError);
    return new Response('Error fetching push token', {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const pushToken = userTokenData.token;
  const notificationId = crypto.randomUUID();

  const message = {
    to: pushToken,
    sound: 'default',
    title: record.data.title,
    body: record.data.message,
    data: {
      ...record.data,
      notificationId
    },
    badge: 1,
   channelId: 'default', // for Android
      priority: 'high'
  };

  try {
    const ticket = await expo.sendPushNotificationsAsync([message]);
    console.log('Push notification ticket:', ticket);

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
          notificationId
        },
        is_read: false
      });

    if (insertError) {
      throw insertError;
    }

    const { error: updateError } = await supabase
      .from('pending_notifications')
      .update({ processed: true })
      .eq('id', record.id);

    if (updateError) {
      throw updateError;
    }

    return new Response(JSON.stringify({ success: true, ticket }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error sending/processing notification:', error);
    return new Response('Error sending/processing notification', {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
});