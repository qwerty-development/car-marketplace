// app/(auth)/callback.tsx - FIXED: Android-specific OAuth handling
import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, Platform } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/utils/supabase';
import { useAuth } from '@/utils/AuthContext';

export default function OAuthCallback() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { isSignedIn } = useAuth();
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    const handleCallback = async () => {
      // Prevent multiple processing attempts
      if (isProcessing) return;
      setIsProcessing(true);

      try {
        console.log(`[OAuth Callback - ${Platform.OS}] Processing OAuth callback with params:`, params);

        // Extract tokens from URL parameters
        const accessToken = params.access_token as string;
        const refreshToken = params.refresh_token as string;
        const tokenType = params.token_type as string;

        if (accessToken && refreshToken) {
          console.log(`[OAuth Callback - ${Platform.OS}] Setting session with tokens`);
          
          // Set the session with the tokens
          const { data, error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (error) {
            console.error(`[OAuth Callback - ${Platform.OS}] Error setting session:`, error);
            // Redirect to sign-in on error
            router.replace('/(auth)/sign-in');
            return;
          }

          if (data.session) {
            console.log(`[OAuth Callback - ${Platform.OS}] Session set successfully, redirecting to home`);
            
            // FIXED: Android-specific navigation timing
            if (Platform.OS === 'android') {
              // Android needs more time and explicit route
              setTimeout(() => {
                router.replace('/(home)/(user)' as any);
              }, 1500);
            } else {
              // iOS can use shorter timeout
              setTimeout(() => {
                router.replace('/(home)/(user)' as any);
              }, 1000);
            }
          } else {
            console.error(`[OAuth Callback - ${Platform.OS}] No session data received`);
            router.replace('/(auth)/sign-in');
          }
        } else {
          console.error(`[OAuth Callback - ${Platform.OS}] Missing tokens in callback`);
          // FIXED: Handle URL fragment tokens (common on Android)
          const currentUrl = new URL(window.location.href);
          const hashParams = new URLSearchParams(currentUrl.hash.substring(1));
          const hashAccessToken = hashParams.get('access_token');
          const hashRefreshToken = hashParams.get('refresh_token');
          
          if (hashAccessToken && hashRefreshToken) {
            console.log(`[OAuth Callback - ${Platform.OS}] Found tokens in URL hash, retrying`);
            const { data, error } = await supabase.auth.setSession({
              access_token: hashAccessToken,
              refresh_token: hashRefreshToken,
            });
            
            if (!error && data.session) {
              setTimeout(() => {
                router.replace('/(home)/(user)' as any);
              }, Platform.OS === 'android' ? 1500 : 1000);
              return;
            }
          }
          
          router.replace('/(auth)/sign-in');
        }
      } catch (error) {
        console.error(`[OAuth Callback - ${Platform.OS}] Error processing callback:`, error);
        router.replace('/(auth)/sign-in');
      } finally {
        setIsProcessing(false);
      }
    };

    // FIXED: Android requires slight delay for proper URL processing
    const delay = Platform.OS === 'android' ? 500 : 100;
    const timeoutId = setTimeout(handleCallback, delay);
    
    return () => clearTimeout(timeoutId);
  }, [params, router, isProcessing]);

  // Redirect if already signed in
  useEffect(() => {
    if (isSignedIn && !isProcessing) {
      console.log(`[OAuth Callback - ${Platform.OS}] User already signed in, redirecting to home`);
      router.replace('/(home)/(user)' as any);
    }
  }, [isSignedIn, router, isProcessing]);

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
        {Platform.OS === 'android' ? 'Processing sign in...' : 'Completing sign in...'}
      </Text>
      {Platform.OS === 'android' && (
        <Text style={{ 
          marginTop: 8, 
          fontSize: 12, 
          color: '#999',
          textAlign: 'center'
        }}>
          This may take a moment
        </Text>
      )}
    </View>
  );
}