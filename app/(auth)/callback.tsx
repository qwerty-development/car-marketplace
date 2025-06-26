// app/(auth)/callback.tsx
import React, { useEffect } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/utils/supabase';
import { useAuth } from '@/utils/AuthContext';

export default function OAuthCallback() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { isSignedIn } = useAuth();

  useEffect(() => {
    const handleCallback = async () => {
      try {
        console.log('[OAuth Callback] Processing OAuth callback with params:', params);

        // Extract tokens from URL parameters
        const accessToken = params.access_token as string;
        const refreshToken = params.refresh_token as string;
        const tokenType = params.token_type as string;

        if (accessToken && refreshToken) {
          console.log('[OAuth Callback] Setting session with tokens');
          
          // Set the session with the tokens
          const { data, error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (error) {
            console.error('[OAuth Callback] Error setting session:', error);
            // Redirect to sign-in on error
            router.replace('/(auth)/sign-in');
            return;
          }

          if (data.session) {
            console.log('[OAuth Callback] Session set successfully, redirecting to home');
            // Wait a moment for auth state to update, then redirect
            setTimeout(() => {
              router.replace('/(home)');
            }, 1000);
          } else {
            console.error('[OAuth Callback] No session data received');
            router.replace('/(auth)/sign-in');
          }
        } else {
          console.error('[OAuth Callback] Missing tokens in callback');
          router.replace('/(auth)/sign-in');
        }
      } catch (error) {
        console.error('[OAuth Callback] Error processing callback:', error);
        router.replace('/(auth)/sign-in');
      }
    };

    handleCallback();
  }, [params, router]);

  // Redirect if already signed in
  useEffect(() => {
    if (isSignedIn) {
      console.log('[OAuth Callback] User already signed in, redirecting to home');
      router.replace('/(home)');
    }
  }, [isSignedIn, router]);

  return (
    <View style={{ 
      flex: 1, 
      justifyContent: 'center', 
      alignItems: 'center',
      backgroundColor: '#fff'
    }}>
      <ActivityIndicator size="large" color="#D55004" />
      <Text style={{ 
        marginTop: 16, 
        fontSize: 16, 
        color: '#666',
        textAlign: 'center'
      }}>
        Completing sign in...
      </Text>
    </View>
  );
}