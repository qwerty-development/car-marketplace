import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { supabase } from '@/utils/supabase';

const DEFAULT_PROJECT_ID = 'aaf80aae-b9fd-4c39-a48a-79f2eac06e68';

/**
 * Register an Expo push token for the user and persist to Supabase.
 * Extracted verbatim from the inline blocks that previously lived in sign-in.tsx
 * and sign-up.tsx after Apple Sign-In completed.
 *
 * This intentionally swallows errors and only logs them — never throws — because
 * the auth flow must succeed even if token registration fails.
 */
export async function registerPushTokenForUser(userId: string) {
  try {
    const projectId =
      (Constants.expoConfig?.extra as { projectId?: string } | undefined)?.projectId ||
      DEFAULT_PROJECT_ID;
    const tokenResponse = await Notifications.getExpoPushTokenAsync({ projectId });
    const token = tokenResponse.data;

    await SecureStore.setItemAsync('expoPushToken', token);

    const { data: existingToken } = await supabase
      .from('user_push_tokens')
      .select('id')
      .eq('user_id', userId)
      .eq('token', token)
      .maybeSingle();

    if (existingToken) {
      await supabase
        .from('user_push_tokens')
        .update({
          signed_in: true,
          active: true,
          last_updated: new Date().toISOString(),
        })
        .eq('id', existingToken.id);

      console.log('[AUTH-PUSH] Updated existing push token');
    } else {
      const { error: insertError } = await supabase
        .from('user_push_tokens')
        .insert({
          user_id: userId,
          token,
          device_type: Platform.OS,
          signed_in: true,
          active: true,
          last_updated: new Date().toISOString(),
        });

      if (insertError) {
        console.error('[AUTH-PUSH] Token insert error:', insertError);
      } else {
        console.log('[AUTH-PUSH] Inserted new push token');
      }
    }
  } catch (tokenError) {
    console.error('[AUTH-PUSH] Token registration error:', tokenError);
  }
}
