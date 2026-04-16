// app/(auth)/callback.tsx
import React, { useCallback, useEffect, useRef } from 'react';
import { View, Text, ActivityIndicator, useColorScheme } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/utils/supabase';
import { useAuth } from '@/utils/AuthContext';

export default function OAuthCallback() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { isSignedIn } = useAuth();
  const hasHandledCallbackRef = useRef(false);
  const hasRedirectedRef = useRef(false);
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const safeRedirect = useCallback((target: '/(home)' | '/(auth)/sign-in') => {
    if (hasRedirectedRef.current) return;
    hasRedirectedRef.current = true;
    router.replace(target);
  }, [router]);

  useEffect(() => {
    const handleCallback = async () => {
      if (hasHandledCallbackRef.current) {
        return;
      }

      try {
        console.log('[OAuth Callback] Processing OAuth callback with params:', params);

        // Extract tokens from URL parameters
        const accessToken = typeof params.access_token === 'string' ? params.access_token : undefined;
        const refreshToken = typeof params.refresh_token === 'string' ? params.refresh_token : undefined;

        if (accessToken && refreshToken) {
          hasHandledCallbackRef.current = true;
          console.log('[OAuth Callback] Setting session with tokens');
          
          // Set the session with the tokens
          const { data, error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (error) {
            console.error('[OAuth Callback] Error setting session:', error);
            // Redirect to sign-in on error
            safeRedirect('/(auth)/sign-in');
            return;
          }

          if (data.session) {
            console.log('[OAuth Callback] Session set successfully, redirecting to home');
            safeRedirect('/(home)');
          } else {
            console.error('[OAuth Callback] No session data received');
            safeRedirect('/(auth)/sign-in');
          }
        } else {
          console.error('[OAuth Callback] Missing tokens in callback');
          if (!isSignedIn) {
            safeRedirect('/(auth)/sign-in');
          }
        }
      } catch (error) {
        console.error('[OAuth Callback] Error processing callback:', error);
        safeRedirect('/(auth)/sign-in');
      }
    };

    handleCallback();
  }, [params.access_token, params.refresh_token, isSignedIn, params, safeRedirect]);

  // Redirect if already signed in
  useEffect(() => {
    if (isSignedIn) {
      console.log('[OAuth Callback] User already signed in, redirecting to home');
      safeRedirect('/(home)');
    }
  }, [isSignedIn, safeRedirect]);

  return (
    <View style={{ 
      flex: 1, 
      justifyContent: 'center', 
      alignItems: 'center',
      backgroundColor: isDark ? '#0D0D0D' : '#FFFFFF',
    }}>
      <ActivityIndicator size="large" color="#D55004" />
      <Text style={{ 
        marginTop: 16, 
        fontSize: 16, 
        color: isDark ? '#9CA3AF' : '#6B7280',
        textAlign: 'center'
      }}>
        Completing sign in…
      </Text>
    </View>
  );
}