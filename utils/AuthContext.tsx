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

  const getCorrectProjectId = (): string => {
    try {
        // First priority: Environment variable (most reliable in production)
        const envProjectId = process.env.EXPO_PUBLIC_PROJECT_ID;
        if (envProjectId) {
            console.log("[AUTH] Using Project ID from environment:", envProjectId);
            return envProjectId;
        }

        // Second priority: EAS configuration
        const easProjectId = Constants.expoConfig?.extra?.eas?.projectId;
        if (easProjectId) {
            console.log("[AUTH] Using EAS Project ID:", easProjectId);
            return easProjectId;
        }

        // Third priority: Direct extra configuration
        const extraProjectId = Constants.expoConfig?.extra?.projectId;
        if (extraProjectId) {
            console.log("[AUTH] Using Extra Project ID:", extraProjectId);
            return extraProjectId;
        }

        // Fourth priority: App config values
        // @ts-ignore - Accessing manifest properties that might exist in certain builds
        const manifestProjectId = Constants.manifest?.extra?.eas?.projectId ||
                                  // @ts-ignore
                                  Constants.manifest?.extra?.projectId;
        if (manifestProjectId) {
            console.log("[AUTH] Using manifest Project ID:", manifestProjectId);
            return manifestProjectId;
        }

        // Extract from updates URL as last resort
        try {
            // @ts-ignore
            const updatesUrl = Constants.expoConfig?.updates?.url || Constants.manifest?.updates?.url;
            if (updatesUrl && typeof updatesUrl === 'string') {
                const projectIdMatch = updatesUrl.match(/([a-f0-9-]{36})/i);
                if (projectIdMatch && projectIdMatch[1]) {
                    console.log("[AUTH] Extracted Project ID from updates URL:", projectIdMatch[1]);
                    return projectIdMatch[1];
                }
            }
        } catch (urlError) {
            console.error("[AUTH] Error extracting Project ID from URL:", urlError);
        }

        // Fallback to hardcoded value
        const fallbackId = 'aaf80aae-b9fd-4c39-a48a-79f2eac06e68';
        console.warn("[AUTH] Using fallback Project ID. This may cause issues with push notifications.");
        return fallbackId;
    } catch (error) {
        console.error("[AUTH] Critical error resolving Project ID:", error);
        // Absolute last resort fallback
        return 'aaf80aae-b9fd-4c39-a48a-79f2eac06e68';
    }
};


const forceDirectTokenRegistration = async (userId: string): Promise<boolean> => {
  console.log("[AUTH] Directly forcing push token registration for user:", userId);
  
  if (isSigningOutState) {
      console.log("[AUTH] User is signing out, skipping direct token registration.");
      return false;
  }

  try {
      // 1. Get project ID with enhanced resolution
      const projectId = getCorrectProjectId();
      if (!projectId) {
          throw new Error("Failed to resolve project ID");
      }
      
      // 2. Get experience ID for production compatibility  
      const getExperienceId = (): string => {
          try {
              // Method 1: From owner and slug
              const owner = Constants.expoConfig?.owner || Constants.manifest?.owner;
              const slug = Constants.expoConfig?.slug || Constants.manifest?.slug;
              
              if (owner && slug) {
                  const experienceId = `@${owner}/${slug}`;
                  console.log(`[AUTH] Built experience ID from owner/slug: ${experienceId}`);
                  return experienceId;
              }

              // Method 2: From app config
              // @ts-ignore
              const directExperienceId = Constants.expoConfig?.experienceId || Constants.manifest?.experienceId;
              if (directExperienceId) {
                  console.log(`[AUTH] Using direct experience ID: ${directExperienceId}`);
                  return directExperienceId;
              }

              // Fallback: construct from known values
              const fallbackExperienceId = '@qwerty-app/clerk-expo-quickstart';
              console.log(`[AUTH] Using fallback experience ID: ${fallbackExperienceId}`);
              return fallbackExperienceId;
          } catch (error) {
              console.log('[AUTH] Error resolving experience ID:', error);
              return '@qwerty-app/clerk-expo-quickstart';
          }
      };

      const experienceId = getExperienceId();
      
      // 3. Get push token with multiple strategies
      let tokenResponse = null;
      let tokenError = null;
      
      for (let attempt = 1; attempt <= 3; attempt++) {
          try {
              console.log(`[AUTH] Token acquisition attempt ${attempt}/3`);
              console.log(`[AUTH] Using projectId: ${projectId}, experienceId: ${experienceId}`);
              
              // Strategy 1: Try with both projectId and experienceId (recommended for production)
              if (attempt === 1) {
                  tokenResponse = await Notifications.getExpoPushTokenAsync({
                      projectId: projectId,
                   
                  });
              }
              // Strategy 2: Try with just projectId  
              else if (attempt === 2) {
                  console.log('[AUTH] Fallback: Trying with projectId only');
                  tokenResponse = await Notifications.getExpoPushTokenAsync({
                      projectId: projectId,
                  });
              }
              // Strategy 3: Try with just experienceId
              else {
                  console.log('[AUTH] Final fallback: Trying with experienceId only');
                  tokenResponse = await Notifications.getExpoPushTokenAsync({
                     projectId: projectId,
                  });
              }
              
              if (tokenResponse && tokenResponse.data) break;
              await new Promise(resolve => setTimeout(resolve, 1000)); // Wait before retry
          } catch (error) {
              tokenError = error;
              console.warn(`[AUTH] Token acquisition attempt ${attempt} failed:`, error);
              if (attempt < 3) await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
          }
      }
      
      if (!tokenResponse || !tokenResponse.data) {
          throw new Error(`Failed to obtain push token after multiple attempts: ${tokenError?.message || "Unknown error"}`);
      }
      
      const token = tokenResponse.data;
      
      // 4. Validate token format
      const validExpoTokenFormat = /^ExponentPushToken\[.+\]$/;
      if (!validExpoTokenFormat.test(token)) {
          console.error("[AUTH] Invalid token format from Expo:", token);
          return false;
      }
      
      console.log("[AUTH] Successfully obtained token from Expo");
      
      // 5. Save token to secure storage immediately (critical for reliability)
      try {
          await SecureStore.setItemAsync('expoPushToken', token);
          await SecureStore.setItemAsync('expoPushTokenTimestamp', Date.now().toString());
          console.log("[AUTH] Token saved to local storage");
      } catch (storageError) {
          console.error("[AUTH] Error saving token to storage:", storageError);
          // Continue with DB operations even if storage fails
      }
      
      // 6. Clean up existing tokens for this device to prevent duplicates
      try {
          const { error: clearError } = await supabase
              .from('user_push_tokens')
              .update({ 
                  active: false,
                  last_updated: new Date().toISOString()
              })
              .eq('user_id', userId)
              .eq('device_type', Platform.OS)
              .neq('token', token); // Don't deactivate the current token
              
          if (clearError) {
              console.warn("[AUTH] Error deactivating existing tokens:", clearError);
              // Continue despite error - non-critical
          } else {
              console.log("[AUTH] Successfully deactivated old tokens for this user on this device");
          }
      } catch (clearError) {
          console.warn("[AUTH] Error during token cleanup:", clearError);
          // Continue despite error - non-critical
      }
      
      // 7. Register new token with retry logic using upsert
      let registrationSuccess = false;
      
      try {
          console.log("[AUTH] Attempting to upsert token with composite key");
          const tokenData = {
              user_id: userId,
              token: token,
              device_type: Platform.OS,
              last_updated: new Date().toISOString(),
              signed_in: true,
              active: true
          };
          
          // Use upsert to handle both insert and update cases
          const { data: upsertData, error: upsertError } = await supabase
              .from('user_push_tokens')
              .upsert(tokenData, {
                  onConflict: 'user_id,token', // Composite unique constraint
                  ignoreDuplicates: false
              })
              .select('id');
          
          if (upsertError) {
              console.error("[AUTH] Error during upsert:", upsertError);
              
              // Fallback to traditional insert/update if upsert fails
              // First check if this user-token combination exists
              const { data: existingToken, error: checkError } = await supabase
                  .from('user_push_tokens')
                  .select('id')
                  .eq('user_id', userId)
                  .eq('token', token)
                  .single();
              
              if (existingToken) {
                  // Update existing
                  console.log("[AUTH] Updating existing user-token combination");
                  const { error: updateError } = await supabase
                      .from('user_push_tokens')
                      .update({
                          signed_in: true,
                          active: true,
                          device_type: Platform.OS,
                          last_updated: new Date().toISOString()
                      })
                      .eq('id', existingToken.id);
                  
                  if (!updateError) {
                      await SecureStore.setItemAsync('expoPushTokenId', existingToken.id);
                      registrationSuccess = true;
                  }
              } else if (!checkError || checkError.code === 'PGRST116') {
                  // Insert new
                  console.log("[AUTH] Inserting new user-token combination");
                  const { data: insertData, error: insertError } = await supabase
                      .from('user_push_tokens')
                      .insert(tokenData)
                      .select('id');
                  
                  if (!insertError && insertData && insertData.length > 0) {
                      await SecureStore.setItemAsync('expoPushTokenId', insertData[0].id);
                      registrationSuccess = true;
                  }
              }
          } else if (upsertData && upsertData.length > 0) {
              console.log("[AUTH] Token upserted successfully with ID:", upsertData[0].id);
              await SecureStore.setItemAsync('expoPushTokenId', upsertData[0].id);
              registrationSuccess = true;
          }
          
          // Deactivate other users' tokens for this device
          if (registrationSuccess) {
              try {
                  console.log("[AUTH] Deactivating other users' tokens for this device");
                  const { error: deactivateError } = await supabase
                      .from('user_push_tokens')
                      .update({
                          signed_in: false,
                          active: false,
                          last_updated: new Date().toISOString()
                      })
                      .eq('token', token)
                      .neq('user_id', userId);
                  
                  if (deactivateError) {
                      console.warn("[AUTH] Failed to deactivate other users' tokens:", deactivateError);
                  } else {
                      console.log("[AUTH] Successfully deactivated other users' tokens");
                  }
              } catch (error) {
                  console.warn("[AUTH] Error deactivating other users' tokens:", error);
              }
          }
      } catch (error) {
          console.error("[AUTH] Exception during token registration:", error);
      }
      
      // 8. Final verification
      const success = registrationSuccess;
      
      if (success) {
          console.log("[AUTH] Token registration completed successfully");
          // Log number of active tokens for debugging
          try {
              const { count } = await supabase
                  .from('user_push_tokens')
                  .select('*', { count: 'exact', head: true })
                  .eq('user_id', userId)
                  .eq('active', true);
              console.log(`[AUTH] User now has ${count || 0} active device tokens`);
          } catch (countError) {
              // Non-critical
          }
      } else {
          // Last resort: try using the NotificationService
          console.log("[AUTH] Direct registration failed, trying NotificationService");
          try {
              const serviceToken = await NotificationService.registerForPushNotificationsAsync(userId, true);
              return !!serviceToken;
          } catch (serviceError) {
              console.error("[AUTH] NotificationService registration also failed:", serviceError);
              return false;
          }
      }
      
      return success;
  } catch (error) {
      console.error("[AUTH] Critical error during token registration:", error);
      
      // Log additional diagnostic information
      try {
          console.log("[AUTH] Device info:", {
              platform: Platform.OS,
              version: Platform.Version,
              isDevice: true,
              constants: {
                  hasExpoConfig: !!Constants.expoConfig,
                  hasExtra: !!(Constants.expoConfig?.extra),
              }
          });
      } catch (diagError) {
          // Ignore diagnostic errors
      }
      
      return false;
  }
};

// Add this useEffect to the AuthProvider component
useEffect(() => {
  // Skip if not signed in or in guest mode
  if (!user?.id || isGuest) return;

  const verifyTokenInterval = 12 * 60 * 60 * 1000; // 12 hours
  
  // Function to verify token status
  const verifyTokenRegistration = async () => {
    try {
      console.log("[AUTH] Performing periodic token verification");
      
      // 1. Check if token exists in storage
      const storedToken = await SecureStore.getItemAsync('expoPushToken');
      if (!storedToken) {
        console.log("[AUTH] No token in storage, registering new token");
        await forceDirectTokenRegistration(user.id);
        return;
      }
      
      // 2. Verify token exists in database
      try {
        const { data: tokenData, error } = await supabase
          .from('user_push_tokens')
          .select('id, active, signed_in')
          .eq('user_id', user.id)
          .eq('token', storedToken)
          .single();
        
        if (error || !tokenData) {
          console.log("[AUTH] Token not found in database, registering new token");
          await forceDirectTokenRegistration(user.id);
          return;
        }
        
        // 3. Check if token is active and signed in
        if (!tokenData.active || !tokenData.signed_in) {
          console.log("[AUTH] Token exists but inactive/signed out, updating status");
          const { error: updateError } = await supabase
            .from('user_push_tokens')
            .update({
              active: true,
              signed_in: true,
              last_updated: new Date().toISOString()
            })
            .eq('id', tokenData.id);
          
          if (updateError) {
            console.error("[AUTH] Error updating token status:", updateError);
            // Try registration as fallback
            await forceDirectTokenRegistration(user.id);
          }
        }
      } catch (verifyError) {
        console.error("[AUTH] Error during token verification:", verifyError);
        // Wait and retry registration on error
        setTimeout(() => forceDirectTokenRegistration(user.id), 5000);
      }
    } catch (error) {
      console.error("[AUTH] Unhandled error in token verification:", error);
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
      
      // IMPROVED TOKEN REGISTRATION
      // 1. First ensure a minimal delay for UI to stabilize
      await new Promise(resolve => setTimeout(resolve, 800));
      
      // 2. Use a staged approach with multiple retries
      const userId = data.user.id;
      console.log('[AUTH] Starting token registration sequence for user:', userId);
      
      // Execute token registration in a non-blocking way
      (async () => {
        try {
          // First fast attempt - immediate registration
          console.log('[AUTH] Initial token registration attempt');
          let success = await forceDirectTokenRegistration(userId);
          
          if (!success) {
            // If failed, wait and try again
            console.log('[AUTH] Initial registration failed, scheduling retry');
            await new Promise(resolve => setTimeout(resolve, 3000));
            
            // Second attempt with NotificationService
            console.log('[AUTH] Retry #1 with NotificationService');
            const serviceToken = await NotificationService.registerForPushNotificationsAsync(userId, true);
            success = !!serviceToken;
            
            if (!success) {
              // Final attempt after longer delay
              console.log('[AUTH] Second registration failed, scheduling final retry');
              await new Promise(resolve => setTimeout(resolve, 5000));
              
              // Final attempt
              console.log('[AUTH] Final registration attempt');
              await forceDirectTokenRegistration(userId);
            }
          }
        } catch (tokenError) {
          console.error('[AUTH] Unhandled error in token registration sequence:', tokenError);
        }
      })();
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