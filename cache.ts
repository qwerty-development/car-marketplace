// cache.ts
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

/**
 * Supabase Session Storage
 *
 * This utility manages the secure storage of Supabase authentication sessions.
 * It provides functions to save, retrieve, and remove session data.
 */
export const sessionStorage = {
  /**
   * Retrieves a session value from secure storage
   *
   * @param key - The storage key to retrieve
   * @returns The stored value or null if not found
   */
  getSession: async (key: string): Promise<string | null> => {
    try {
      if (Platform.OS === 'web') {
        return localStorage.getItem(key);
      }

      const item = await SecureStore.getItemAsync(key);
      if (!item) {
        console.log(`No session found under key: ${key}`);
        return null;
      }

      return item;
    } catch (error) {
      console.error("Secure storage retrieval error:", error);
      return null;
    }
  },

  /**
   * Saves a session value to secure storage
   *
   * @param key - The storage key to use
   * @param value - The value to store
   * @returns A promise that resolves when the operation completes
   */
  saveSession: async (key: string, value: string): Promise<void> => {
    try {
      if (Platform.OS === 'web') {
        localStorage.setItem(key, value);
        return;
      }

      await SecureStore.setItemAsync(key, value);
    } catch (error) {
      console.error("Secure storage save error:", error);
    }
  },

  /**
   * Removes a session value from secure storage
   *
   * @param key - The storage key to remove
   * @returns A promise that resolves when the operation completes
   */
  removeSession: async (key: string): Promise<void> => {
    try {
      if (Platform.OS === 'web') {
        localStorage.removeItem(key);
        return;
      }

      await SecureStore.deleteItemAsync(key);
    } catch (error) {
      console.error("Secure storage deletion error:", error);
    }
  }
};

// Export session keys for consistent usage across the app
export const SESSION_KEYS = {
  AUTH_TOKEN: 'supabase-auth-token',
  REFRESH_TOKEN: 'supabase-refresh-token',
  USER_DATA: 'supabase-user-data'
};