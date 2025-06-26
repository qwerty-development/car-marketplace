// app/(auth)/callback.tsx
import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/utils/supabase';
import { useAuth } from '@/utils/AuthContext';

export default function OAuthCallback() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { isSignedIn, isLoaded } = useAuth();
  const [processed, setProcessed] = useState(false);

  useEffect(() => {
    const handleCallback = async () => {
      if (processed) return;
      setProcessed(true);
      
      try {
        console.log('[CALLBACK ROUTE] Processing with params:', params);
        
        // Get URL from window if available (web) or use params
        let accessToken, refreshToken;
        
        // Try to get from window location first (web OAuth)
        if (typeof window !== 'undefined' && window.location) {
          const urlParams = new URLSearchParams(window.location.hash.substring(1));
          accessToken = urlParams.get('access_token');
          refreshToken = urlParams.get('refresh_token');
        }
        
        // Fallback to route params (mobile OAuth)
        if (!accessToken) {
          accessToken = params.access_token as string;
          refreshToken = params.refresh_token as string;
        }

        console.log('[CALLBACK ROUTE] Tokens found:', { 
          hasAccess: !!accessToken, 
          hasRefresh: !!refreshToken 
        });

        if (accessToken && refreshToken) {
          console.log('[CALLBACK ROUTE] Setting session...');
          
          const { data, error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (error) {
            console.error('[CALLBACK ROUTE] Session error:', error);
          } else {
            console.log('[CALLBACK ROUTE] Session set successfully');
          }
          
          // BRUTE FORCE: Multiple redirect attempts
          console.log('[CALLBACK ROUTE] Starting redirect sequence...');
          
          // Wait a moment for auth state to update
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          // Attempt 1: Immediate redirect
          router.replace('/(home)');
          
          // Attempt 2: Delayed redirect
          setTimeout(() => {
            router.replace('/(home)');
          }, 500);
          
          // Attempt 3: Force navigation after 1 second
          setTimeout(() => {
            router.push('/(home)');
          }, 1000);
          
          // Attempt 4: Nuclear option after 2 seconds
          setTimeout(() => {
            try {
              router.dismissAll();
              router.replace('/(home)');
            } catch (e) {
              console.log('[CALLBACK ROUTE] Nuclear redirect failed, trying push');
              router.push('/(home)');
            }
          }, 2000);
          
        } else {
          console.error('[CALLBACK ROUTE] No tokens found, redirecting to sign-in');
          router.replace('/(auth)/sign-in');
        }
      } catch (error) {
        console.error('[CALLBACK ROUTE] Error:', error);
        router.replace('/(auth)/sign-in');
      }
    };

    // Start processing immediately
    handleCallback();
  }, [params, router, processed]);

  // BRUTE FORCE: If user becomes signed in, redirect immediately
  useEffect(() => {
    if (isLoaded && isSignedIn && !processed) {
      console.log('[CALLBACK ROUTE] User signed in detected, forcing redirect');
      router.replace('/(home)');
    }
  }, [isSignedIn, isLoaded, router, processed]);

  // BRUTE FORCE: Timeout fallback - redirect after 5 seconds no matter what
  useEffect(() => {
    const timeout = setTimeout(() => {
      console.log('[CALLBACK ROUTE] Timeout reached, forcing redirect to home');
      router.replace('/(home)');
    }, 5000);

    return () => clearTimeout(timeout);
  }, [router]);

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
      <Text style={{ 
        marginTop: 8, 
        fontSize: 12, 
        color: '#999',
        textAlign: 'center'
      }}>
        Please wait, redirecting you now...
      </Text>
    </View>
  );
}