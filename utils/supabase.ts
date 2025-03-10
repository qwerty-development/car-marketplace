import 'react-native-url-polyfill/auto'
import { createClient } from '@supabase/supabase-js'
import * as SecureStore from 'expo-secure-store'

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    realtime: {
      params: {
        eventsPerSecond: 10,
      },
    },
    auth: {
      storage: {
        async getItem(key) {
          try {
            return await SecureStore.getItemAsync(key) || null;
          } catch (error) {
            console.error('Error getting secure store item:', error);
            return null;
          }
        },
        async setItem(key, value) {
          try {
            await SecureStore.setItemAsync(key, value);
          } catch (error) {
            console.error('Error setting secure store item:', error);
          }
        },
        async removeItem(key) {
          try {
            await SecureStore.deleteItemAsync(key);
          } catch (error) {
            console.error('Error removing secure store item:', error);
          }
        },
      },
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
    },
  }
);