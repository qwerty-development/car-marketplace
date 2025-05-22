// utils/AuthContext.tsx
import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from './supabase';
import * as SecureStore from 'expo-secure-store';
import { useGuestUser } from './GuestUserContext';
import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri } from 'expo-auth-session';
import * as Linking from 'expo-linking';
import { isSigningOut, setIsSigningOut } from '../app/(home)/_layout';
import { router } from 'expo-router';
import { NotificationService } from '@/services/NotificationService';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

// Add this right after the imports
export let isGlobalSigningOut = false;

export function setGlobalSigningOut(value: boolean) {
  isGlobalSigningOut = value;
}

interface AuthContextProps {
  session: Session | null;
  user: User | null;
  profile: UserProfile | null;
  isLoaded: boolean;
  isSignedIn: boolean;
  isSigningOut: boolean;
  isSigningIn: boolean;
  signIn: (credentials: SignInCredentials) => Promise<{ error: Error | null }>;
  signUp: (credentials: SignUpCredentials) => Promise<{ error: Error | null, needsEmailVerification: boolean }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: Error | null }>;
  updatePassword: (params: { currentPassword: string, newPassword: string }) => Promise<{ error: Error | null }>;
  verifyOtp: (email: string, token: string) => Promise<{ error: Error | null }>;
  googleSignIn: () => Promise<void>;
  appleSignIn: () => Promise<void>;
  refreshSession: () => Promise<void>;
  updateUserProfile: (data: Partial<UserProfile>) => Promise<{ error: Error | null }>;
  updateUserRole: (userId: string, newRole: string) => Promise<{ error: Error | null }>;
}

interface UserProfile {
  id: string;
  name: string;
  email: string;
  favorite: number[];
  last_active: string;
  timezone: string;
  is_guest?: boolean;
  role?: string;
}

interface SignInCredentials {
  email: string;
  password: string;
}

interface SignUpCredentials {
  email: string;
  password: string;
  name: string;
  role?: string;
}

const AuthContext = createContext<AuthContextProps | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{children: React.ReactNode}> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isSigningOutState, setIsSigningOutState] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const { isGuest, clearGuestMode } = useGuestUser();

  // For OAuth redirects
  const redirectUri = makeRedirectUri({
    scheme: 'com.qwertyapp.clerkexpoquickstart',
    path: 'auth/callback'
  });

  // PRODUCTION-ENHANCED TOKEN REGISTRATION WITH AGGRESSIVE RETRY
  const productionTokenRegistrationWithRetry = async (userId: string, context: string): Promise<boolean> => {
    const MAX_ATTEMPTS = 5;
    const INITIAL_DELAY = 1000;
    
    console.log(`[AUTH-PROD] Starting production token registration for ${context}`);
    
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        console.log(`[AUTH-PROD] Registration attempt ${attempt}/${MAX_ATTEMPTS} for ${context}`);
        
        if (isGlobalSigningOut) {
          console.log(`[AUTH-PROD] Sign out detected, aborting registration`);
          return false;
        }
        
        // Strategy 1: Use NotificationService with force flag
        const token = await NotificationService.registerForPushNotificationsAsync(userId, true);
        
        if (token) {
          console.log(`[AUTH-PROD] Registration successful on attempt ${attempt} for ${context}`);
          
          // Immediate verification
          const verification = await NotificationService.forceTokenVerification(userId);
          if (verification.isValid) {
            console.log(`[AUTH-PROD] Token verification successful for ${context}`);
            return true;
          } else {
            console.log(`[AUTH-PROD] Token verification failed for ${context}, continuing attempts`);
          }
        }
        
        // Strategy 2: Emergency registration for later attempts
        if (attempt >= 3) {
          console.log(`[AUTH-PROD] Attempting emergency registration for ${context}`);
          const emergencySuccess = await NotificationService.emergencyTokenRegistration(userId);
          if (emergencySuccess) {
            console.log(`[AUTH-PROD] Emergency registration successful for ${context}`);
            return true;
          }
        }
        
      } catch (error) {
        console.error(`[AUTH-PROD] Registration attempt ${attempt} failed for ${context}:`, error);
      }
      
      // Progressive delay between attempts
      if (attempt < MAX_ATTEMPTS) {
        const delay = INITIAL_DELAY * Math.pow(2, attempt - 1);
        console.log(`[AUTH-PROD] Waiting ${delay}ms before retry for ${context}`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    console.error(`[AUTH-PROD] All registration attempts failed for ${context}`);
    return false;
  };

  // PRODUCTION-ENHANCED PROJECT ID RESOLUTION
  const getCorrectProjectId = (): string => {
    try {
        console.log("[AUTH-PROD] Starting project ID resolution");
        
        // Priority 1: Environment variable (most reliable)
        const envProjectId = process.env.EXPO_PUBLIC_PROJECT_ID;
        if (envProjectId) {
            console.log("[AUTH-PROD] Using Project ID from environment:", envProjectId);
            return envProjectId;
        }

        // Priority 2: EAS configuration
        const easProjectId = Constants.expoConfig?.extra?.eas?.projectId;
        if (easProjectId) {
            console.log("[AUTH-PROD] Using EAS Project ID:", easProjectId);
            return easProjectId;
        }

        // Priority 3: Direct extra configuration
        const extraProjectId = Constants.expoConfig?.extra?.projectId;
        if (extraProjectId) {
            console.log("[AUTH-PROD] Using Extra Project ID:", extraProjectId);
            return extraProjectId;
        }

        // Priority 4: App config values
        // @ts-ignore - Accessing manifest properties that might exist in certain builds
        const manifestProjectId = Constants.manifest?.extra?.eas?.projectId ||
                                  // @ts-ignore
                                  Constants.manifest?.extra?.projectId;
        if (manifestProjectId) {
            console.log("[AUTH-PROD] Using manifest Project ID:", manifestProjectId);
            return manifestProjectId;
        }

        // Extract from updates URL as last resort
        try {
            // @ts-ignore
            const updatesUrl = Constants.expoConfig?.updates?.url || Constants.manifest?.updates?.url;
            if (updatesUrl && typeof updatesUrl === 'string') {
                const projectIdMatch = updatesUrl.match(/([a-f0-9-]{36})/i);
                if (projectIdMatch && projectIdMatch[1]) {
                    console.log("[AUTH-PROD] Extracted Project ID from updates URL:", projectIdMatch[1]);
                    return projectIdMatch[1];
                }
            }
        } catch (urlError) {
            console.error("[AUTH-PROD] Error extracting Project ID from URL:", urlError);
        }

        // Hardcoded fallback
        const fallbackId = 'aaf80aae-b9fd-4c39-a48a-79f2eac06e68';
        console.warn("[AUTH-PROD] Using hardcoded fallback Project ID");
        return fallbackId;
    } catch (error) {
        console.error("[AUTH-PROD] Critical error resolving Project ID:", error);
        return 'aaf80aae-b9fd-4c39-a48a-79f2eac06e68';
    }
  };

  // PRODUCTION-ENHANCED DIRECT TOKEN REGISTRATION
  const forceDirectTokenRegistration = async (userId: string): Promise<boolean> => {
    console.log("[AUTH-PROD] Starting direct token registration for user:", userId);
    
    if (isSigningOutState) {
        console.log("[AUTH-PROD] User is signing out, skipping registration");
        return false;
    }

    try {
        // 1. Enhanced project ID resolution
        const projectId = getCorrectProjectId();
        console.log(`[AUTH-PROD] Using project ID: ${projectId}`);
        
        // 2. Multiple token acquisition attempts
        let tokenResponse = null;
        let tokenError = null;
        
        for (let attempt = 1; attempt <= 5; attempt++) {
            try {
                console.log(`[AUTH-PROD] Token acquisition attempt ${attempt}/5`);
                
                // Enhanced token request with timeout
                const tokenPromise = Notifications.getExpoPushTokenAsync({ projectId });
                const timeoutPromise = new Promise((_, reject) => {
                    setTimeout(() => reject(new Error('Token request timeout')), 15000);
                });
                
                tokenResponse = await Promise.race([tokenPromise, timeoutPromise]);
                
                if (tokenResponse && tokenResponse.data) {
                    console.log("[AUTH-PROD] Token acquired successfully");
                    break;
                }
                
                await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
            } catch (error) {
                tokenError = error;
                console.warn(`[AUTH-PROD] Token acquisition attempt ${attempt} failed:`, error);
                if (attempt < 5) await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
            }
        }
        
        if (!tokenResponse || !tokenResponse.data) {
            throw new Error(`Failed to obtain push token: ${tokenError?.message || "Unknown error"}`);
        }
        
        const token = tokenResponse.data;
        
        // 3. Validate token format
        const validExpoTokenFormat = /^ExponentPushToken\[.+\]$/;
        if (!validExpoTokenFormat.test(token)) {
            console.error("[AUTH-PROD] Invalid token format:", token);
            return false;
        }
        
        console.log("[AUTH-PROD] Valid token obtained");
        
        // 4. Save to secure storage immediately
        try {
            await SecureStore.setItemAsync('expoPushToken', token);
            await SecureStore.setItemAsync('expoPushTokenTimestamp', Date.now().toString());
            console.log("[AUTH-PROD] Token saved to local storage");
        } catch (storageError) {
            console.error("[AUTH-PROD] Storage error (continuing):", storageError);
        }
        
        // 5. Database registration with multiple strategies
        let success = false;
        
        // Strategy A: Clean and insert
        try {
            console.log("[AUTH-PROD] Strategy A: Clean and insert");
            
            // Clean old tokens
            await supabase
                .from('user_push_tokens')
                .update({ 
                    active: false,
                    last_updated: new Date().toISOString()
                })
                .eq('user_id', userId)
                .eq('device_type', Platform.OS);
            
            // Insert new token
            const { data: insertData, error: insertError } = await supabase
                .from('user_push_tokens')
                .insert({
                    user_id: userId,
                    token: token,
                    device_type: Platform.OS,
                    last_updated: new Date().toISOString(),
                    signed_in: true,
                    active: true
                })
                .select('id');
            
            if (!insertError && insertData && insertData.length > 0) {
                console.log("[AUTH-PROD] Strategy A successful:", insertData[0].id);
                await SecureStore.setItemAsync('expoPushTokenId', insertData[0].id);
                success = true;
            } else {
                console.log("[AUTH-PROD] Strategy A failed:", insertError);
            }
        } catch (strategyAError) {
            console.log("[AUTH-PROD] Strategy A exception:", strategyAError);
        }
        
        // Strategy B: Update existing
        if (!success) {
            try {
                console.log("[AUTH-PROD] Strategy B: Update existing");
                
                const { error: updateError } = await supabase
                    .from('user_push_tokens')
                    .update({
                        signed_in: true,
                        active: true,
                        last_updated: new Date().toISOString(),
                        device_type: Platform.OS,
                    })
                    .eq('user_id', userId)
                    .eq('token', token);
                
                if (!updateError) {
                    console.log("[AUTH-PROD] Strategy B successful");
                    success = true;
                    
                    // Get token ID
                    try {
                        const { data: tokenData } = await supabase
                            .from('user_push_tokens')
                            .select('id')
                            .eq('user_id', userId)
                            .eq('token', token)
                            .single();
                        
                        if (tokenData?.id) {
                            await SecureStore.setItemAsync('expoPushTokenId', tokenData.id);
                        }
                    } catch (e) {
                        console.warn("[AUTH-PROD] Could not retrieve token ID");
                    }
                } else {
                    console.log("[AUTH-PROD] Strategy B failed:", updateError);
                }
            } catch (strategyBError) {
                console.log("[AUTH-PROD] Strategy B exception:", strategyBError);
            }
        }
        
        // Strategy C: Upsert
        if (!success) {
            try {
                console.log("[AUTH-PROD] Strategy C: Upsert");
                
                const { data: upsertData, error: upsertError } = await supabase
                    .from('user_push_tokens')
                    .upsert({
                        user_id: userId,
                        token: token,
                        device_type: Platform.OS,
                        last_updated: new Date().toISOString(),
                        signed_in: true,
                        active: true
                    }, {
                        onConflict: 'token',
                        ignoreDuplicates: false
                    })
                    .select('id');
                
                if (!upsertError && upsertData && upsertData.length > 0) {
                    console.log("[AUTH-PROD] Strategy C successful:", upsertData[0].id);
                    await SecureStore.setItemAsync('expoPushTokenId', upsertData[0].id);
                    success = true;
                } else {
                    console.log("[AUTH-PROD] Strategy C failed:", upsertError);
                }
            } catch (strategyCError) {
                console.log("[AUTH-PROD] Strategy C exception:", strategyCError);
            }
        }
        
        if (success) {
            console.log("[AUTH-PROD] Token registration completed successfully");
            
            // Final verification
            try {
                const { count } = await supabase
                    .from('user_push_tokens')
                    .select('*', { count: 'exact', head: true })
                    .eq('user_id', userId)
                    .eq('active', true);
                console.log(`[AUTH-PROD] User now has ${count || 0} active tokens`);
            } catch (e) {
                console.warn("[AUTH-PROD] Could not verify token count");
            }
            
            return true;
        } else {
            console.error("[AUTH-PROD] All registration strategies failed");
            return false;
        }
        
    } catch (error) {
        console.error("[AUTH-PROD] Critical error during token registration:", error);
        return false;
    }
  };

  // Enhanced periodic token verification
  useEffect(() => {
    if (!user?.id || isGuest) return;

    const verifyTokenInterval = 6 * 60 * 60 * 1000; // 6 hours (more frequent)
    
    const verifyTokenRegistration = async () => {
      try {
        console.log("[AUTH-PROD] Performing periodic token verification");
        
        if (isGlobalSigningOut) {
          console.log("[AUTH-PROD] Sign out in progress, skipping verification");
          return;
        }
        
        // 1. Check if token exists in storage
        const storedToken = await SecureStore.getItemAsync('expoPushToken');
        if (!storedToken) {
          console.log("[AUTH-PROD] No token in storage, registering new token");
          await productionTokenRegistrationWithRetry(user.id, 'periodic_verification_no_token');
          return;
        }
        
        // 2. Verify token format
        const validExpoTokenFormat = /^ExponentPushToken\[.+\]$/;
        if (!validExpoTokenFormat.test(storedToken)) {
          console.log("[AUTH-PROD] Invalid token format, registering new token");
          await productionTokenRegistrationWithRetry(user.id, 'periodic_verification_invalid_format');
          return;
        }
        
        // 3. Verify token exists in database with timeout
        try {
          const verificationPromise = supabase
            .from('user_push_tokens')
            .select('id, active, signed_in')
            .eq('user_id', user.id)
            .eq('token', storedToken)
            .single();
          
          const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Database verification timeout')), 10000);
          });
          
          const { data: tokenData, error } = await Promise.race([verificationPromise, timeoutPromise]);
          
          if (error || !tokenData) {
            console.log("[AUTH-PROD] Token not found in database, registering new token");
            await productionTokenRegistrationWithRetry(user.id, 'periodic_verification_not_in_db');
            return;
          }
          
          // 4. Check if token is active and signed in
          if (!tokenData.active || !tokenData.signed_in) {
            console.log("[AUTH-PROD] Token inactive/signed out, updating status");
            const { error: updateError } = await supabase
              .from('user_push_tokens')
              .update({
                active: true,
                signed_in: true,
                last_updated: new Date().toISOString()
              })
              .eq('id', tokenData.id);
            
            if (updateError) {
              console.error("[AUTH-PROD] Failed to update token status, registering new token");
              await productionTokenRegistrationWithRetry(user.id, 'periodic_verification_update_failed');
            } else {
              console.log("[AUTH-PROD] Token status updated successfully");
            }
          } else {
            console.log("[AUTH-PROD] Token verification successful");
          }
          
        } catch (verifyError) {
          console.error("[AUTH-PROD] Error during token verification:", verifyError);
          await productionTokenRegistrationWithRetry(user.id, 'periodic_verification_error');
        }
      } catch (error) {
        console.error("[AUTH-PROD] Unhandled error in token verification:", error);
      }
    };
    
    // Initial verification
    verifyTokenRegistration();
    
    // Set up periodic verification
    const interval = setInterval(verifyTokenRegistration, verifyTokenInterval);
    
    return () => {
      clearInterval(interval);
    };
  }, [user?.id, isGuest]);
  
  useEffect(() => {
    setIsLoaded(false);

    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, currentSession) => {
        console.log('Auth state change event:', event);

        if (currentSession) {
          setSession(currentSession);
          setUser(currentSession.user);

          // Get user profile from the users table
          if (currentSession.user && !isGuest) {
            fetchUserProfile(currentSession.user.id);
          }
        } else if (event === 'SIGNED_OUT') {
          setSession(null);
          setUser(null);
          setProfile(null);
        }

        setIsLoaded(true);
      }
    );

    // Check for existing session on startup
    const loadSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();

        if (session) {
          setSession(session);
          setUser(session.user);

          if (session.user && !isGuest) {
            await fetchUserProfile(session.user.id);
          }
        }
      } catch (error) {
        console.error('Error loading session:', error);
      } finally {
        setIsLoaded(true);
      }
    };

    loadSession();

    // Cleanup subscription on unmount
    return () => {
      subscription?.unsubscribe();
    };
  }, [isGuest]);

  const processOAuthUser = async (session: Session): Promise<UserProfile | null> => {
    try {
      // Check if user exists in database
      const { data: existingUser, error: fetchError } = await supabase
        .from('users')
        .select('*')
        .eq('id', session.user.id)
        .single();

      // Replace the insert operation in the processOAuthUser function
      if (fetchError && fetchError.code === 'PGRST116') {
        // Extract user details from session
        const userName = session.user.user_metadata.full_name ||
                        session.user.user_metadata.name ||
                        'User';

        const newUser: Partial<UserProfile> = {
          id: session.user.id,
          name: userName,
          email: session.user.email || '',
          favorite: [],
          last_active: new Date().toISOString(),
          timezone: 'UTC',
          role: 'user', // Default role
        };

        // Use upsert instead of insert
        const { data: upsertedUser, error: upsertError } = await supabase
          .from('users')
          .upsert([newUser], {
            onConflict: 'id',
            ignoreDuplicates: false
          })
          .select()
          .single();

        if (upsertError) {
          // Check if it's a constraint violation
          if (upsertError.code === '23505') {
            console.log('User already exists, retrieving existing record');

            // Retrieve the existing user record
            const { data: existingUser, error: getError } = await supabase
              .from('users')
              .select('*')
              .eq('id', session.user.id)
              .single();

            if (getError) {
              console.error('Error retrieving existing user:', getError);
              return null;
            }

            return existingUser as UserProfile;
          } else {
            console.error('Error upserting user after OAuth:', upsertError);
            return null;
          }
        }

        // If user exists but doesn't have a role in auth metadata, add default role
        if (!session.user.user_metadata.role) {
          await supabase.auth.updateUser({
            data: { role: 'user' }
          });
        }

        return upsertedUser as UserProfile;

      } else if (fetchError) {
        // Handle other possible errors
        console.error('Error fetching user profile:', fetchError);
        return null;
      }

      // If user exists but doesn't have a role in auth metadata, add default role
      if (!session.user.user_metadata.role) {
        await supabase.auth.updateUser({
          data: { role: existingUser?.role || 'user' }
        });
      }

      return existingUser as UserProfile;
    } catch (error) {
      console.error('Error processing OAuth user:', error);
      return null;
    }
  };

  const fetchUserProfile = async (userId: string): Promise<void> => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('Error fetching user profile:', error);

        // If user not found, try to get session and create profile
        if (error.code === 'PGRST116') {
          const { data: sessionData } = await supabase.auth.getSession();
          if (sessionData?.session) {
            const createdProfile = await processOAuthUser(sessionData.session);
            if (createdProfile) {
              setProfile(createdProfile);
              return;
            }
          }
        }
        return;
      }

      if (data) {
        setProfile(data as UserProfile);
      }
    } catch (error) {
      console.error('Error in fetchUserProfile:', error);
    }
  };

  const cleanupPushToken = async () => {
    try {
      if (!user?.id) {
        console.log('No user to clean up push token for');
        return;
      }

      // First try to mark the token as signed out using NotificationService
      console.log('Marking tokens as signed out via NotificationService');
      const success = await NotificationService.cleanupPushToken(user.id);

      if (success) {
        console.log('Successfully marked push token as signed out');
      } else {
        console.log('Failed to mark push token as signed out');
      }
    } catch (error) {
      console.error('Push token cleanup error:', error);
      // Continue with sign out even if token cleanup fails
    }
  };

  const cleanupLocalStorage = async () => {
    try {
      console.log('Cleaning up auth-related local storage');
      // List of keys to clean up, EXCLUDING push token-related keys
      const keysToClean = [
        'supabase-auth-token',
        'lastActiveSession',
        // Explicitly NOT including 'expoPushToken' or related keys
      ];

      // Delete only auth-related keys in parallel
      await Promise.all(
        keysToClean.map(key =>
          SecureStore.deleteItemAsync(key)
            .catch(error => console.error(`Error deleting ${key}:`, error))
        )
      );

      console.log('Auth-related local storage cleanup completed');
    } catch (error) {
      console.error('Local storage cleanup error:', error);
    }
  };

  const signOut = async () => {
    // Prevent multiple sign out attempts
    if (isSigningOutState) {
      console.log('Sign out already in progress, ignoring duplicate request');
      return;
    }
  
    try {
      // Set signing out states (including global)
      setIsSigningOutState(true);
      setIsSigningOut(true);
      setGlobalSigningOut(true);
  
      console.log('Starting comprehensive sign out process');
  
      // 1. Clean up push notification token if user exists
      if (user) {
        try {
          console.log('Cleaning up push notification tokens');
          
          // First, mark ALL tokens for this user as signed_out
          const { data: tokenUpdateData, error: tokenUpdateError } = await supabase
            .from('user_push_tokens')
            .update({ 
              signed_in: false,
              last_updated: new Date().toISOString()
            })
            .eq('user_id', user.id)
            .select();
            
          if (tokenUpdateError) {
            console.error('Error marking tokens as signed out:', tokenUpdateError);
          } else {
            console.log('Successfully marked all tokens as signed out:', tokenUpdateData);
          }
  
          // Then proceed with token cleanup
          await cleanupPushToken();
        } catch (tokenError) {
          console.error('Error during push token cleanup:', tokenError);
          // Continue with sign out even if token cleanup fails
        }
      }
  
      // 2. Execute sign out with retry logic
      let signOutSuccess = false;
      let signOutAttempt = 0;
      const maxAttempts = 3;
  
      while (!signOutSuccess && signOutAttempt < maxAttempts) {
        signOutAttempt++;
        try {
          console.log(`Supabase sign out attempt ${signOutAttempt}/${maxAttempts}`);
          const { error } = await supabase.auth.signOut();
  
          if (error) {
            console.error(`Sign out attempt ${signOutAttempt} failed:`, error);
            // Wait before retrying with exponential backoff
            if (signOutAttempt < maxAttempts) {
              const delay = Math.pow(2, signOutAttempt) * 500; // 1s, 2s, 4s
              await new Promise(resolve => setTimeout(resolve, delay));
            }
          } else {
            signOutSuccess = true;
            console.log('Supabase sign out successful');
          }
        } catch (error) {
          console.error(`Sign out attempt ${signOutAttempt} error:`, error);
          // Wait before retrying
          if (signOutAttempt < maxAttempts) {
            const delay = Math.pow(2, signOutAttempt) * 500;
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }
      }
  
      // 3. Clean up local storage regardless of sign out success
      await cleanupLocalStorage();
  
      // 4. Reset auth context state
      setSession(null);
      setUser(null);
      setProfile(null);
      
      // Wait for 1.5 seconds to show the loader before completing sign out 
      await new Promise(resolve => setTimeout(resolve, 1500));
  
      // Use requestAnimationFrame to ensure we navigate only after the next render cycle
      requestAnimationFrame(() => {
        try {
          router.replace('/(auth)/sign-in');
        } catch (navError) {
          console.log('Navigation error handled:', navError);
          requestAnimationFrame(() => {
            try {
              router.replace('/(auth)/sign-in');
            } catch (e) {
              console.error('Final navigation attempt failed:', e);
            }
          });
        }
      });
  
    } catch (error) {
      console.error('Sign out process error:', error);
  
      // Force clean up state even if there was an error
      setSession(null);
      setUser(null);
      setProfile(null);
  
      // Wait before navigation
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Use requestAnimationFrame for safer navigation
      requestAnimationFrame(() => {
        try {
          router.replace('/(auth)/sign-in');
        } catch (navError) {
          console.log('Error navigation handled:', navError);
          setTimeout(() => {
            router.replace('/(auth)/sign-in');
          }, 100);
        }
      });
    } finally {
      // Reset signing out states with delay
      setTimeout(() => {
        setIsSigningOutState(false);
        setIsSigningOut(false);
        setGlobalSigningOut(false);
        console.log('Sign out process completed');
      }, 2000);
    }
  };

  // ENHANCED SIGN IN WITH PRODUCTION TOKEN REGISTRATION
  const signIn = async ({ email, password }: SignInCredentials) => {
    try {
      setIsSigningIn(true);
      
      if (isGuest) {
        await clearGuestMode();
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      if (data.user) {
        await fetchUserProfile(data.user.id);
        
        // PRODUCTION TOKEN REGISTRATION WITH MULTIPLE STRATEGIES
        console.log('[AUTH-PROD] Sign-in successful, starting token registration');
        
        // Strategy 1: Immediate registration attempt
        setTimeout(async () => {
          if (!isGlobalSigningOut) {
            console.log('[AUTH-PROD] Starting immediate token registration');
            const success = await productionTokenRegistrationWithRetry(data.user.id, 'sign_in_immediate');
            
            if (!success) {
              // Strategy 2: Delayed retry
              console.log('[AUTH-PROD] Immediate registration failed, scheduling delayed retry');
              setTimeout(async () => {
                if (!isGlobalSigningOut) {
                  await productionTokenRegistrationWithRetry(data.user.id, 'sign_in_delayed');
                }
              }, 10000); // 10 seconds delay
            }
          }
        }, 1000); // 1 second after sign in
      }
      
      setIsSigningIn(false);
      return { error: null };
    } catch (error: any) {
      console.error('Sign in error:', error);
      setIsSigningIn(false);
      return { error };
    }
  };

  const googleSignIn = async () => {
    try {
      setIsSigningIn(true);

      if (isGuest) {
        await clearGuestMode();
      }

      // Step 1: Initiate OAuth flow
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUri,
          skipBrowserRedirect: true,
        },
      });

      if (error) throw error;

      if (data?.url) {
        console.log("Opening auth session with URL:", data.url);

        // Step 2: Open browser for authentication
        const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUri);
        console.log("WebBrowser result:", JSON.stringify(result));

        if (result.type === 'success') {
          // Step 3: Critical - force setSession with manually extracted token
          try {
            // Extract access token from URL hash fragment
            const url = new URL(result.url);
            const hashParams = new URLSearchParams(url.hash.substring(1)); // Remove the # character
            const accessToken = hashParams.get('access_token');

            console.log("Extracted access token:", accessToken ? "Found" : "Not found");

            if (accessToken) {
              // Step 4: Use setSession directly with the extracted token
              const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
                access_token: accessToken,
                refresh_token: hashParams.get('refresh_token') || '',
              });

              console.log("Manual setSession result:",
                          sessionData ? "Session set successfully" : "Failed to set session",
                          sessionError ? `Error: ${sessionError.message}` : "No error");

              if (sessionError) throw sessionError;

              if (sessionData.session) {
                // Step 5: Update application state
                setSession(sessionData.session);
                setUser(sessionData.session.user);

                // Step 6: Process user profile
                const userProfile = await processOAuthUser(sessionData.session);
                if (userProfile) {
                  setProfile(userProfile);
                }

                // Step 7: PRODUCTION TOKEN REGISTRATION
                console.log('[AUTH-PROD] Google sign-in successful, starting token registration');
                
                setTimeout(async () => {
                  if (!isGlobalSigningOut) {
                    await productionTokenRegistrationWithRetry(sessionData.session.user.id, 'google_sign_in');
                  }
                }, 1500);
                
                return { success: true, user: sessionData.session.user };
              }
            }
          } catch (extractError) {
            console.error("Error processing authentication result:", extractError);
          }
        }
      }

      // Step 8: Fall back to checking current session as safety mechanism
      try {
        const { data: currentSession } = await supabase.auth.getSession();
        if (currentSession?.session?.user) {
          console.log("Session exists despite flow issues, returning success=true");
          setSession(currentSession.session);
          setUser(currentSession.session.user);
          
          // PRODUCTION TOKEN REGISTRATION
          setTimeout(async () => {
            if (!isGlobalSigningOut) {
              await productionTokenRegistrationWithRetry(currentSession.session.user.id, 'google_sign_in_fallback');
            }
          }, 1500);
          
          return { success: true, user: currentSession.session.user };
        }
      } catch (sessionCheckError) {
        console.error("Error checking current session:", sessionCheckError);
      }

      // Step 9: Return failure if all above steps fail
      console.log("All authentication steps failed, returning success=false");
      return { success: false };
    } catch (error) {
      console.error('Google sign in error:', error);
      return { success: false, error };
    } finally {
      setIsSigningIn(false);
    }
  };

  const appleSignIn = async () => {
    try {
      if (isGuest) {
        await clearGuestMode();
      }

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'apple',
        options: {
          redirectTo: redirectUri,
          skipBrowserRedirect: true,
        },
      });

      if (error) throw error;

      if (data?.url) {
        const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUri);

        if (result.type === 'success') {
          // Get the Supabase auth callback URL parameters
          const { data: sessionData } = await supabase.auth.getSession();

          if (sessionData?.session) {
            // Process the user and get the created/existing profile
            const userProfile = await processOAuthUser(sessionData.session);

            // Set the profile directly if available
            if (userProfile) {
              setProfile(userProfile);
            }

            // PRODUCTION TOKEN REGISTRATION
            console.log('[AUTH-PROD] Apple sign-in successful, starting token registration');
            
            setTimeout(async () => {
              if (!isGlobalSigningOut) {
                await productionTokenRegistrationWithRetry(sessionData.session.user.id, 'apple_sign_in');
              }
            }, 1500);
          }
        }
      }
    } catch (error) {
      console.error('Apple sign in error:', error);
    }
  };

  const signUp = async ({ email, password, name, role = 'user' }: SignUpCredentials) => {
    try {
      if (isGuest) {
        await clearGuestMode();
      }

      // 1. First check if email exists in users table
      const { data: existingUser, error: checkError } = await supabase
        .from('users')
        .select('email')
        .eq('email', email)
        .maybeSingle();

      if (existingUser) {
        return {
          error: new Error('An account with this email already exists. Please sign in instead.'),
          needsEmailVerification: false
        };
      }

      // 2. Proceed with signup attempt
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name: name,
            role: role,
          },
          emailRedirectTo: redirectUri,
        },
      });

      if (error) {
        // 3. Detect linked account errors
        if (error.message.includes("Unable to validate email address") ||
            (error.message.includes("already exists") && !error.message.includes("already registered"))) {
          return {
            error: new Error('This email is already linked to a social account. Please sign in with Google or Apple.'),
            needsEmailVerification: false
          };
        }

        // Regular duplicate email errors
        if (error.message.includes('already registered') ||
            error.message.includes('already in use') ||
            error.message.includes('already exists')) {
          return {
            error: new Error('An account with this email already exists. Please sign in instead.'),
            needsEmailVerification: false
          };
        }

        throw error;
      }

      // 4. Create user in users table
      if (data.user) {
        const { error: upsertError } = await supabase.from('users').upsert([{
          id: data.user.id,
          name: name,
          email: email,
          favorite: [],
          last_active: new Date().toISOString(),
          timezone: 'UTC',
          role: role,
        }], {
          onConflict: 'id',
          ignoreDuplicates: false
        });

        if (upsertError && upsertError.code !== '23505') {
          console.error('Error creating user profile:', upsertError);
        }

        // Register for push notifications after successful signup
        if (data.session) {
          // PRODUCTION TOKEN REGISTRATION
          console.log('[AUTH-PROD] Sign-up successful with session, starting token registration');
          
          setTimeout(async () => {
            if (!isGlobalSigningOut) {
              await productionTokenRegistrationWithRetry(data.user.id, 'sign_up');
            }
          }, 1500);
        }
      }

      const needsEmailVerification = data.session === null;
      return { error: null, needsEmailVerification, email: email };
    } catch (error: any) {
      console.error('Sign up error:', error);

      // Improve error messaging for specific cases
      if (error.message.includes("Unable to validate email address")) {
        return {
          error: new Error('This email is already linked to a social account. Please sign in with Google or Apple.'),
          needsEmailVerification: false
        };
      } else if (error.message.includes('already registered') ||
          error.message.includes('already in use') ||
          error.message.includes('already exists')) {
        return {
          error: new Error('An account with this email already exists. Please sign in instead.'),
          needsEmailVerification: false
        };
      }

      return { error, needsEmailVerification: false };
    }
  };

  const resetPassword = async (email: string) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: redirectUri,
      });

      if (error) throw error;
      return { error: null };
    } catch (error: any) {
      console.error('Reset password error:', error);
      return { error };
    }
  };

  const updatePassword = async ({ currentPassword, newPassword }: { currentPassword: string, newPassword: string }) => {
    try {
      // First verify the current password by attempting to sign in
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user?.email || '',
        password: currentPassword,
      });

      if (signInError) throw new Error('Current password is incorrect');

      // If verification succeeded, update to the new password
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;
      return { error: null };
    } catch (error: any) {
      console.error('Update password error:', error);
      return { error };
    }
  };

  const verifyOtp = async (email: string, token: string) => {
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email,
        token,
        type: 'signup',
      });

      if (error) throw error;
      return { error: null, data };
    } catch (error: any) {
      console.error('OTP verification error:', error);
      return { error };
    }
  };

  const refreshSession = async () => {
    try {
      const { data, error } = await supabase.auth.refreshSession();
      if (error) throw error;
      if (data.session) {
        setSession(data.session);
        setUser(data.session.user);
        
        // Ensure token stays marked as signed in when session refreshes
        const pushToken = await SecureStore.getItemAsync('expoPushToken');
        if (pushToken) {
          await NotificationService.markTokenAsSignedIn(data.session.user.id, pushToken);
        }
      }
    } catch (error) {
      console.error('Session refresh error:', error);
    }
  };

  const updateUserProfile = async (data: Partial<UserProfile>) => {
    try {
      if (!user) throw new Error('No user is signed in');

      // Update the user metadata in Supabase Auth if name is provided
      if (data.name) {
        const { error: authUpdateError } = await supabase.auth.updateUser({
          data: { name: data.name }
        });

        if (authUpdateError) {
          console.error('Error updating auth user metadata:', authUpdateError);
        }
      }

      // Update the profile in the database
      const { error } = await supabase
        .from('users')
        .update(data)
        .eq('id', user.id);

      if (error) throw error;

      // Update the local profile state
      if (profile) {
        setProfile({ ...profile, ...data });
      }

      return { error: null };
    } catch (error: any) {
      console.error('Update profile error:', error);
      return { error };
    }
  };

  const updateUserRole = async (userId: string, newRole: string) => {
    try {
      // Update role in auth metadata
      const { error: metadataError } = await supabase.auth.admin.updateUserById(
        userId,
        { user_metadata: { role: newRole } }
      );

      if (metadataError) {
        // Fall back to client-side update if admin is not available
        const { error: clientUpdateError } = await supabase.auth.updateUser({
          data: { role: newRole }
        });
        if (clientUpdateError) throw clientUpdateError;
      }

      // Also update role in users table for consistency
      const { error: dbError } = await supabase
        .from('users')
        .update({ role: newRole })
        .eq('id', userId);

      if (dbError) throw dbError;

      // If updating the current user, reflect changes locally
      if (user && userId === user.id) {
        const updatedUser = { ...user };
        updatedUser.user_metadata = {
          ...updatedUser.user_metadata,
          role: newRole
        };
        setUser(updatedUser);

        if (profile) {
          setProfile({ ...profile, role: newRole });
        }
      }

      return { error: null };
    } catch (error: any) {
      console.error('Error updating user role:', error);
      return { error };
    }
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        profile,
        isLoaded,
        isSignedIn: !!user || !!session,
        isSigningOut: isSigningOutState,
        isSigningIn,
        signIn,
        signUp,
        signOut,
        resetPassword,
        updatePassword,
        verifyOtp,
        googleSignIn,
        appleSignIn,
        refreshSession,
        updateUserProfile,
        updateUserRole
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};