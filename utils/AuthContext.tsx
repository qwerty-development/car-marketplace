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

  // CRITICAL NEW FUNCTION: Direct token registration that bypasses verification
  const forceDirectTokenRegistration = async (userId: string): Promise<boolean> => {
    console.log("[AUTH] Directly forcing push token registration for user:", userId);
    
    try {
      // 1. Try to get a fresh token directly from Expo
      const projectId = Constants.expoConfig?.extra?.projectId || 'aaf80aae-b9fd-4c39-a48a-79f2eac06e68';
      const tokenResponse = await Notifications.getExpoPushTokenAsync({ projectId });
      const token = tokenResponse.data;
      
      if (!token || !token.startsWith('ExponentPushToken[')) {
        console.error("[AUTH] Invalid token format from Expo");
        return false;
      }
      
      console.log("[AUTH] Got fresh token from Expo for current device");
      
      // 2. Save the token to secure storage for this device
      await SecureStore.setItemAsync('expoPushToken', token);
      await SecureStore.setItemAsync('expoPushTokenTimestamp', Date.now().toString());
      
      // 3. Clear any existing token for THIS DEVICE ONLY to prevent duplicates
      // Note: This preserves tokens for the user's other devices
      try {
        console.log("[AUTH] Clearing existing tokens for current device type only");
        await supabase
          .from('user_push_tokens')
          .update({ 
            active: false,
            signed_in: false,
            last_updated: new Date().toISOString()
          })
          .eq('user_id', userId)
          .eq('device_type', Platform.OS); // Only affects current platform (iOS/Android)
      } catch (clearError) {
        console.warn("[AUTH] Error clearing existing tokens for current device:", clearError);
        // Continue anyway - not critical
      }
      
      // 4. Insert the new token with a direct database operation
      console.log("[AUTH] Registering new token for current device");
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
      
      if (insertError) {
        // Check if it's a unique constraint violation
        if (insertError.code === '23505') {
          console.log("[AUTH] Token already exists for this device, updating instead");
          
          // If token already exists, update it instead
          const { error: updateError } = await supabase
            .from('user_push_tokens')
            .update({
              signed_in: true,
              active: true,
              last_updated: new Date().toISOString()
            })
            .eq('user_id', userId)
            .eq('token', token);
          
          if (updateError) {
            console.error("[AUTH] Error updating existing token:", updateError);
            return false;
          }
          
          // Get the ID of the existing token
          const { data: existingToken, error: fetchError } = await supabase
            .from('user_push_tokens')
            .select('id')
            .eq('user_id', userId)
            .eq('token', token)
            .single();
          
          if (!fetchError && existingToken) {
            await SecureStore.setItemAsync('expoPushTokenId', existingToken.id);
          }
          
          return true;
        }
        
        console.error("[AUTH] Error inserting new token:", insertError);
        return false;
      }
      
      // 5. Save the token ID in secure storage
      if (insertData && insertData.length > 0) {
        await SecureStore.setItemAsync('expoPushTokenId', insertData[0].id);
      }
      
      // 6. Optionally, log the number of active devices for this user
      try {
        const { count } = await supabase
          .from('user_push_tokens')
          .select('*', { count: 'exact' })
          .eq('user_id', userId)
          .eq('active', true);
        
        console.log(`[AUTH] User now has ${count || 0} active device tokens`);
      } catch (countError) {
        // Non-critical, just for logging
      }
      
      console.log("[AUTH] Token registration completed successfully for current device");
      return true;
    } catch (error) {
      console.error("[AUTH] Critical error during force token registration:", error);
      return false;
    }
  };
  
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

// In AuthProvider component in utils/AuthContext.tsx
// Update the signIn function:

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
      
      // CRITICAL CHANGE: Defer token registration to happen after UI is shown
      setTimeout(async () => {
        try {
          console.log('[AUTH] Deferred token registration started');
          const success = await forceDirectTokenRegistration(data.user.id);
          
          if (!success) {
            console.log('[AUTH] Direct registration failed, trying NotificationService');
            await NotificationService.registerForPushNotificationsAsync(data.user.id, true);
          }
        } catch (tokenError) {
          console.error('[AUTH] Token registration error during sign-in:', tokenError);
          // Non-blocking error - app continues to function
        }
      }, 5000); // Increased timeout to 5 seconds after sign-in completes
    }

    // Still show loader for visual continuity but reduce time
    await new Promise(resolve => setTimeout(resolve, 800)); // Reduced from 1500ms
    
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

                // Step 7: SIMPLIFIED TOKEN REGISTRATION
                console.log('[AUTH] Google sign-in successful, forcing token registration');
                
                // Use setTimeout to ensure auth state has stabilized
                setTimeout(async () => {
                  try {
                    // Direct registration bypassing all checks
                    const success = await forceDirectTokenRegistration(sessionData.session.user.id);
                    
                    if (!success) {
                      // Fall back to NotificationService
                      console.log('[AUTH] Direct token registration failed for Google sign-in, trying NotificationService');
                      await NotificationService.registerForPushNotificationsAsync(sessionData.session.user.id, true);
                    }
                  } catch (tokenError) {
                    console.error('[AUTH] Token registration error during Google sign-in:', tokenError);
                  }
                }, 1000);
                
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
          
          // SIMPLIFIED TOKEN REGISTRATION
          console.log('[AUTH] Google sign-in fallback path, forcing token registration');
          
          // Use setTimeout to ensure auth state has stabilized
          setTimeout(async () => {
            try {
              // Direct registration bypassing all checks
              const success = await forceDirectTokenRegistration(currentSession.session.user.id);
              
              if (!success) {
                // Fall back to NotificationService
                console.log('[AUTH] Direct token registration failed for Google sign-in fallback, trying NotificationService');
                await NotificationService.registerForPushNotificationsAsync(currentSession.session.user.id, true);
              }
            } catch (tokenError) {
              console.error('[AUTH] Token registration error during Google sign-in fallback:', tokenError);
            }
          }, 1000);
          
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

            // SIMPLIFIED TOKEN REGISTRATION
            console.log('[AUTH] Apple sign-in successful, forcing token registration');
            
            // Use setTimeout to ensure auth state has stabilized
            setTimeout(async () => {
              try {
                // Direct registration bypassing all checks
                const success = await forceDirectTokenRegistration(sessionData.session.user.id);
                
                if (!success) {
                  // Fall back to NotificationService
                  console.log('[AUTH] Direct token registration failed for Apple sign-in, trying NotificationService');
                  await NotificationService.registerForPushNotificationsAsync(sessionData.session.user.id, true);
                }
              } catch (tokenError) {
                console.error('[AUTH] Token registration error during Apple sign-in:', tokenError);
              }
            }, 1000);
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
          // SIMPLIFIED TOKEN REGISTRATION
          console.log('[AUTH] Sign-up successful with session, forcing token registration');
          
          // Use setTimeout to ensure auth state has stabilized
          setTimeout(async () => {
            try {
              // Direct registration bypassing all checks
              const success = await forceDirectTokenRegistration(data.user.id);
              
              if (!success) {
                // Fall back to NotificationService
                console.log('[AUTH] Direct token registration failed for sign-up, trying NotificationService');
                await NotificationService.registerForPushNotificationsAsync(data.user.id, true);
              }
            } catch (tokenError) {
              console.error('[AUTH] Token registration error during sign-up:', tokenError);
            }
          }, 1000);
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