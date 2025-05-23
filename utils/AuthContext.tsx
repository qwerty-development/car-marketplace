// utils/AuthContext.tsx
import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from './supabase';
import * as SecureStore from 'expo-secure-store';
import { useGuestUser } from './GuestUserContext';
import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri } from 'expo-auth-session';
import { isSigningOut, setIsSigningOut } from '../app/(home)/_layout';
import { router } from 'expo-router';
import { NotificationService } from '@/services/NotificationService';

// Global signing out state management
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

  // Use React Native compatible timer type
  const tokenVerificationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const authSubscriptionRef = useRef<{ unsubscribe: () => void } | null>(null);

  // For OAuth redirects
  const redirectUri = makeRedirectUri({
    scheme: 'com.qwertyapp.clerkexpoquickstart',
    path: 'auth/callback'
  });

  /**
   * Enhanced token registration strategy using NotificationService
   * Eliminates code duplication and provides consistent token management
   * 
   * @param userId - The user ID to register token for
   * @param attemptNumber - Current attempt number for retry logic
   * @returns Promise<boolean> - Success status of token registration
   */
  const registerPushTokenForUser = async (
    userId: string, 
    attemptNumber: number = 1
  ): Promise<boolean> => {
    const maxAttempts = 3;
    const baseDelay = 1000; // 1 second base delay
    
    try {
      console.log(`[AUTH] Token registration attempt ${attemptNumber}/${maxAttempts} for user: ${userId}`);
      
      // Check if user is signing out to prevent unnecessary registration
      if (isGlobalSigningOut || isSigningOutState) {
        console.log('[AUTH] User is signing out, skipping token registration');
        return false;
      }

      // Use NotificationService for token registration (eliminates code duplication)
      const token = await NotificationService.registerForPushNotificationsAsync(userId, true);
      
      if (token) {
        console.log('[AUTH] Token registration successful via NotificationService');
        return true;
      } else {
        console.log(`[AUTH] Token registration failed on attempt ${attemptNumber}`);
        
        // Implement exponential backoff for retries
        if (attemptNumber < maxAttempts) {
          const delay = baseDelay * Math.pow(2, attemptNumber - 1);
          console.log(`[AUTH] Retrying token registration in ${delay}ms`);
          
          await new Promise(resolve => setTimeout(resolve, delay));
          return registerPushTokenForUser(userId, attemptNumber + 1);
        }
        
        return false;
      }
    } catch (error) {
      console.error(`[AUTH] Token registration error on attempt ${attemptNumber}:`, error);
      
      // Retry with exponential backoff for recoverable errors
      if (attemptNumber < maxAttempts) {
        const delay = baseDelay * Math.pow(2, attemptNumber - 1);
        console.log(`[AUTH] Retrying token registration after error in ${delay}ms`);
        
        await new Promise(resolve => setTimeout(resolve, delay));
        return registerPushTokenForUser(userId, attemptNumber + 1);
      }
      
      return false;
    }
  };

  /**
   * Optimized token verification with intelligent caching and error recovery
   * Uses NotificationService methods to eliminate code duplication
   * 
   * @param userId - The user ID to verify token for
   */
  const verifyTokenRegistration = async (userId: string): Promise<void> => {
    try {
      console.log('[AUTH] Starting periodic token verification for user:', userId);
      
      // Skip verification if user is signing out
      if (isGlobalSigningOut || isSigningOutState) {
        console.log('[AUTH] Skipping token verification - user signing out');
        return;
      }

      // Use NotificationService for token verification (consistent with service layer)
      const verification = await NotificationService.forceTokenVerification(userId);
      
      if (!verification.isValid) {
        console.log('[AUTH] Token verification failed, initiating registration');
        await registerPushTokenForUser(userId);
      } else if (verification.signedIn === false) {
        console.log('[AUTH] Token exists but marked as signed out, updating status');
        
        if (verification.token) {
          const success = await NotificationService.markTokenAsSignedIn(userId, verification.token);
          if (!success) {
            console.log('[AUTH] Failed to mark token as signed in, re-registering');
            await registerPushTokenForUser(userId);
          }
        }
      } else {
        console.log('[AUTH] Token verification successful');
      }
    } catch (error) {
      console.error('[AUTH] Error during token verification:', error);
      
      // Fallback: attempt registration after verification failure
      setTimeout(() => {
        if (!isGlobalSigningOut && !isSigningOutState) {
          registerPushTokenForUser(userId);
        }
      }, 5000);
    }
  };

  /**
   * Enhanced cleanup function for push token management
   * Delegates to NotificationService for consistent token cleanup
   */
  const cleanupPushToken = async (): Promise<void> => {
    try {
      if (!user?.id) {
        console.log('[AUTH] No user to clean up push token for');
        return;
      }

      console.log('[AUTH] Initiating push token cleanup via NotificationService');
      const success = await NotificationService.cleanupPushToken(user.id);

      if (success) {
        console.log('[AUTH] Push token cleanup completed successfully');
      } else {
        console.log('[AUTH] Push token cleanup encountered issues but completed');
      }
    } catch (error) {
      console.error('[AUTH] Push token cleanup error:', error);
      // Continue with sign out process even if token cleanup fails
    }
  };

  /**
   * Optimized local storage cleanup with error isolation
   * Cleans only auth-related data, preserving notification tokens
   */
  const cleanupLocalStorage = async (): Promise<void> => {
    try {
      console.log('[AUTH] Starting auth-related local storage cleanup');
      
      // Define auth-specific keys (excluding notification-related keys)
      const authKeys = [
        'supabase-auth-token',
        'lastActiveSession',
        'authSessionExpiry',
        'tempAuthData'
      ];

      // Clean up auth keys with error isolation
      const cleanupPromises = authKeys.map(async (key) => {
        try {
          await SecureStore.deleteItemAsync(key);
        } catch (error) {
          console.error(`[AUTH] Error deleting key ${key}:`, error);
          // Continue cleanup even if individual key deletion fails
        }
      });

      await Promise.all(cleanupPromises);
      console.log('[AUTH] Auth-related local storage cleanup completed');
    } catch (error) {
      console.error('[AUTH] Local storage cleanup error:', error);
    }
  };

  // Token verification effect with proper cleanup
  useEffect(() => {
    // Skip if not signed in or in guest mode
    if (!user?.id || isGuest) {
      return;
    }

    const verificationInterval = 12 * 60 * 60 * 1000; // 12 hours
    
    // Initial verification with delay to allow auth state to stabilize
    const initialTimeout = setTimeout(() => {
      verifyTokenRegistration(user.id);
    }, 2000);

    // Set up periodic verification
    tokenVerificationIntervalRef.current = setInterval(() => {
      verifyTokenRegistration(user.id);
    }, verificationInterval);

    // Cleanup function
    return () => {
      if (initialTimeout) {
        clearTimeout(initialTimeout);
      }
      if (tokenVerificationIntervalRef.current) {
        clearInterval(tokenVerificationIntervalRef.current);
        tokenVerificationIntervalRef.current = null;
      }
    };
  }, [user?.id, isGuest]);
  
  // Auth state management effect
  useEffect(() => {
    setIsLoaded(false);

    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, currentSession) => {
        console.log('[AUTH] Auth state change event:', event);

        if (currentSession) {
          setSession(currentSession);
          setUser(currentSession.user);

          // Get user profile from the users table
          if (currentSession.user && !isGuest) {
            await fetchUserProfile(currentSession.user.id);
          }
        } else if (event === 'SIGNED_OUT') {
          setSession(null);
          setUser(null);
          setProfile(null);
        }

        setIsLoaded(true);
      }
    );

    // Store subscription reference for cleanup
    authSubscriptionRef.current = subscription;

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
        console.error('[AUTH] Error loading session:', error);
      } finally {
        setIsLoaded(true);
      }
    };

    loadSession();

    // Cleanup function
    return () => {
      if (authSubscriptionRef.current) {
        authSubscriptionRef.current.unsubscribe();
        authSubscriptionRef.current = null;
      }
    };
  }, [isGuest]);

  /**
   * Enhanced OAuth user processing with improved error handling
   * 
   * @param session - The OAuth session data
   * @returns Promise<UserProfile | null> - The created or existing user profile
   */
  const processOAuthUser = async (session: Session): Promise<UserProfile | null> => {
    try {
      // Check if user exists in database
      const { data: existingUser, error: fetchError } = await supabase
        .from('users')
        .select('*')
        .eq('id', session.user.id)
        .single();

      if (fetchError && fetchError.code === 'PGRST116') {
        // User doesn't exist, create new user
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
          role: 'user',
        };

        // Use upsert for atomic operation
        const { data: upsertedUser, error: upsertError } = await supabase
          .from('users')
          .upsert([newUser], {
            onConflict: 'id',
            ignoreDuplicates: false
          })
          .select()
          .single();

        if (upsertError) {
          if (upsertError.code === '23505') {
            // Handle race condition - user was created by another process
            console.log('[AUTH] User already exists, retrieving existing record');
            const { data: existingUser, error: getError } = await supabase
              .from('users')
              .select('*')
              .eq('id', session.user.id)
              .single();

            if (getError) {
              console.error('[AUTH] Error retrieving existing user:', getError);
              return null;
            }
            return existingUser as UserProfile;
          } else {
            console.error('[AUTH] Error upserting user after OAuth:', upsertError);
            return null;
          }
        }

        // Update auth metadata with default role if needed
        if (!session.user.user_metadata.role) {
          await supabase.auth.updateUser({
            data: { role: 'user' }
          });
        }

        return upsertedUser as UserProfile;

      } else if (fetchError) {
        console.error('[AUTH] Error fetching user profile:', fetchError);
        return null;
      }

      // Update auth metadata if needed
      if (!session.user.user_metadata.role) {
        await supabase.auth.updateUser({
          data: { role: existingUser?.role || 'user' }
        });
      }

      return existingUser as UserProfile;
    } catch (error) {
      console.error('[AUTH] Error processing OAuth user:', error);
      return null;
    }
  };

  /**
   * Enhanced user profile fetching with comprehensive error handling
   * 
   * @param userId - The user ID to fetch profile for
   */
  const fetchUserProfile = async (userId: string): Promise<void> => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('[AUTH] Error fetching user profile:', error);

        // Handle user not found case
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
      console.error('[AUTH] Error in fetchUserProfile:', error);
    }
  };

  /**
   * Enhanced sign out process with comprehensive cleanup and error recovery
   */
  const signOut = async (): Promise<void> => {
    // Prevent multiple simultaneous sign out attempts
    if (isSigningOutState) {
      console.log('[AUTH] Sign out already in progress, ignoring duplicate request');
      return;
    }
  
    try {
      // Set all signing out states
      setIsSigningOutState(true);
      setIsSigningOut(true);
      setGlobalSigningOut(true);
  
      console.log('[AUTH] Starting comprehensive sign out process');

      // Clear verification interval immediately
      if (tokenVerificationIntervalRef.current) {
        clearInterval(tokenVerificationIntervalRef.current);
        tokenVerificationIntervalRef.current = null;
      }
  
      // Clean up push notification tokens
      if (user) {
        try {
          console.log('[AUTH] Cleaning up push notification tokens');
          
          // Mark all user tokens as signed out
          const { error: tokenUpdateError } = await supabase
            .from('user_push_tokens')
            .update({ 
              signed_in: false,
              last_updated: new Date().toISOString()
            })
            .eq('user_id', user.id);
            
          if (tokenUpdateError) {
            console.error('[AUTH] Error marking tokens as signed out:', tokenUpdateError);
          } else {
            console.log('[AUTH] Successfully marked all tokens as signed out');
          }

          // Clean up current device token
          await cleanupPushToken();
        } catch (tokenError) {
          console.error('[AUTH] Error during push token cleanup:', tokenError);
        }
      }
  
      // Execute Supabase sign out with retry logic
      let signOutSuccess = false;
      let signOutAttempt = 0;
      const maxAttempts = 3;
  
      while (!signOutSuccess && signOutAttempt < maxAttempts) {
        signOutAttempt++;
        try {
          console.log(`[AUTH] Supabase sign out attempt ${signOutAttempt}/${maxAttempts}`);
          const { error } = await supabase.auth.signOut();
  
          if (error) {
            console.error(`[AUTH] Sign out attempt ${signOutAttempt} failed:`, error);
            if (signOutAttempt < maxAttempts) {
              const delay = Math.pow(2, signOutAttempt) * 500; // Exponential backoff
              await new Promise(resolve => setTimeout(resolve, delay));
            }
          } else {
            signOutSuccess = true;
            console.log('[AUTH] Supabase sign out successful');
          }
        } catch (error) {
          console.error(`[AUTH] Sign out attempt ${signOutAttempt} error:`, error);
          if (signOutAttempt < maxAttempts) {
            const delay = Math.pow(2, signOutAttempt) * 500;
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }
      }
  
      // Clean up local storage
      await cleanupLocalStorage();
  
      // Reset auth context state
      setSession(null);
      setUser(null);
      setProfile(null);
      
      // UI stabilization delay
      await new Promise(resolve => setTimeout(resolve, 1500));
  
      // Safe navigation with error recovery
      requestAnimationFrame(() => {
        try {
          router.replace('/(auth)/sign-in');
        } catch (navError) {
          console.log('[AUTH] Primary navigation error, attempting fallback:', navError);
          requestAnimationFrame(() => {
            try {
              router.replace('/(auth)/sign-in');
            } catch (fallbackError) {
              console.error('[AUTH] Fallback navigation also failed:', fallbackError);
            }
          });
        }
      });
  
    } catch (error) {
      console.error('[AUTH] Sign out process error:', error);
  
      // Force state cleanup even on error
      setSession(null);
      setUser(null);
      setProfile(null);
  
      await new Promise(resolve => setTimeout(resolve, 500));
      
      requestAnimationFrame(() => {
        try {
          router.replace('/(auth)/sign-in');
        } catch (navError) {
          console.log('[AUTH] Error recovery navigation handled:', navError);
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
        console.log('[AUTH] Sign out process completed');
      }, 2000);
    }
  };

  /**
   * Enhanced sign in with streamlined token registration
   */
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
        
        console.log('[AUTH] Sign in successful, scheduling token registration');
        
        // Delayed token registration for auth state stabilization
        setTimeout(async () => {
          try {
            const success = await registerPushTokenForUser(data.user.id);
            if (success) {
              console.log('[AUTH] Token registration completed successfully');
            } else {
              console.log('[AUTH] Token registration completed with issues');
            }
          } catch (tokenError) {
            console.error('[AUTH] Token registration error during sign in:', tokenError);
          }
        }, 1000);
      }
      
      return { error: null };
    } catch (error: any) {
      console.error('[AUTH] Sign in error:', error);
      return { error };
    } finally {
      setIsSigningIn(false);
    }
  };

  /**
   * Enhanced Google sign in with streamlined token registration
   */
  const googleSignIn = async () => {
    try {
      setIsSigningIn(true);

      if (isGuest) {
        await clearGuestMode();
      }

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUri,
          skipBrowserRedirect: true,
        },
      });

      if (error) throw error;

      if (data?.url) {
        console.log('[AUTH] Opening Google auth session');

        const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUri);
        console.log('[AUTH] WebBrowser result:', result.type);

        if (result.type === 'success') {
          try {
            // Extract tokens from URL
            const url = new URL(result.url);
            const hashParams = new URLSearchParams(url.hash.substring(1));
            const accessToken = hashParams.get('access_token');

            if (accessToken) {
              // Set session manually
              const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
                access_token: accessToken,
                refresh_token: hashParams.get('refresh_token') || '',
              });

              if (sessionError) throw sessionError;

              if (sessionData.session) {
                setSession(sessionData.session);
                setUser(sessionData.session.user);

                const userProfile = await processOAuthUser(sessionData.session);
                if (userProfile) {
                  setProfile(userProfile);
                }

                console.log('[AUTH] Google sign in successful, scheduling token registration');
                
                // Delayed token registration
                setTimeout(async () => {
                  try {
                    await registerPushTokenForUser(sessionData.session.user.id);
                  } catch (tokenError) {
                    console.error('[AUTH] Token registration error during Google sign in:', tokenError);
                  }
                }, 1000);
                
                return { success: true, user: sessionData.session.user };
              }
            }
          } catch (extractError) {
            console.error('[AUTH] Error processing Google auth result:', extractError);
          }
        }
      }

      // Fallback session check
      try {
        const { data: currentSession } = await supabase.auth.getSession();
        if (currentSession?.session?.user) {
          console.log('[AUTH] Google sign in fallback path successful');
          setSession(currentSession.session);
          setUser(currentSession.session.user);
          
          setTimeout(async () => {
            try {
              await registerPushTokenForUser(currentSession.session.user.id);
            } catch (tokenError) {
              console.error('[AUTH] Token registration error during Google sign in fallback:', tokenError);
            }
          }, 1000);
          
          return { success: true, user: currentSession.session.user };
        }
      } catch (sessionCheckError) {
        console.error('[AUTH] Error checking session after Google auth:', sessionCheckError);
      }

      console.log('[AUTH] Google authentication failed');
      return { success: false };
    } catch (error) {
      console.error('[AUTH] Google sign in error:', error);
      return { success: false, error };
    } finally {
      setIsSigningIn(false);
    }
  };

  /**
   * Enhanced Apple sign in with streamlined token registration
   */
  const appleSignIn = async () => {
    try {
      setIsSigningIn(true);

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
          const { data: sessionData } = await supabase.auth.getSession();

          if (sessionData?.session) {
            const userProfile = await processOAuthUser(sessionData.session);

            if (userProfile) {
              setProfile(userProfile);
            }

            console.log('[AUTH] Apple sign in successful, scheduling token registration');
            
            setTimeout(async () => {
              try {
                await registerPushTokenForUser(sessionData.session.user.id);
              } catch (tokenError) {
                console.error('[AUTH] Token registration error during Apple sign in:', tokenError);
              }
            }, 1000);
          }
        }
      }
    } catch (error) {
      console.error('[AUTH] Apple sign in error:', error);
    } finally {
      setIsSigningIn(false);
    }
  };

  /**
   * Enhanced sign up with streamlined token registration
   */
  const signUp = async ({ email, password, name, role = 'user' }: SignUpCredentials) => {
    try {
      if (isGuest) {
        await clearGuestMode();
      }

      // Check if email exists
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

      // Proceed with signup
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
        // Handle specific error cases
        if (error.message.includes("Unable to validate email address") ||
            (error.message.includes("already exists") && !error.message.includes("already registered"))) {
          return {
            error: new Error('This email is already linked to a social account. Please sign in with Google or Apple.'),
            needsEmailVerification: false
          };
        }

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

      // Create user profile
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
          console.error('[AUTH] Error creating user profile:', upsertError);
        }

        // Register for push notifications if session exists
        if (data.session) {
          console.log('[AUTH] Sign up successful with session, scheduling token registration');
          
          setTimeout(async () => {
            try {
              await registerPushTokenForUser(data.user.id);
            } catch (tokenError) {
              console.error('[AUTH] Token registration error during sign up:', tokenError);
            }
          }, 1000);
        }
      }

      const needsEmailVerification = data.session === null;
      return { error: null, needsEmailVerification, email: email };
    } catch (error: any) {
      console.error('[AUTH] Sign up error:', error);

      // Improve error messaging
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

  /**
   * Enhanced password reset with comprehensive error handling
   */
  const resetPassword = async (email: string) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: redirectUri,
      });

      if (error) throw error;
      return { error: null };
    } catch (error: any) {
      console.error('[AUTH] Reset password error:', error);
      return { error };
    }
  };

  /**
   * Enhanced password update with verification
   */
  const updatePassword = async ({ currentPassword, newPassword }: { currentPassword: string, newPassword: string }) => {
    try {
      // Verify current password
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user?.email || '',
        password: currentPassword,
      });

      if (signInError) throw new Error('Current password is incorrect');

      // Update to new password
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;
      return { error: null };
    } catch (error: any) {
      console.error('[AUTH] Update password error:', error);
      return { error };
    }
  };

  /**
   * Enhanced OTP verification
   */
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
      console.error('[AUTH] OTP verification error:', error);
      return { error };
    }
  };

  /**
   * Enhanced session refresh with token status maintenance
   */
  const refreshSession = async () => {
    try {
      const { data, error } = await supabase.auth.refreshSession();
      if (error) throw error;
      
      if (data.session) {
        setSession(data.session);
        setUser(data.session.user);
        
        // Ensure token remains marked as signed in
        try {
          const pushToken = await SecureStore.getItemAsync('expoPushToken');
          if (pushToken) {
            await NotificationService.markTokenAsSignedIn(data.session.user.id, pushToken);
          }
        } catch (tokenError) {
          console.error('[AUTH] Error maintaining token status during refresh:', tokenError);
        }
      }
    } catch (error) {
      console.error('[AUTH] Session refresh error:', error);
    }
  };

  /**
   * Enhanced user profile update
   */
  const updateUserProfile = async (data: Partial<UserProfile>) => {
    try {
      if (!user) throw new Error('No user is signed in');

      // Update auth metadata if name is provided
      if (data.name) {
        const { error: authUpdateError } = await supabase.auth.updateUser({
          data: { name: data.name }
        });

        if (authUpdateError) {
          console.error('[AUTH] Error updating auth user metadata:', authUpdateError);
        }
      }

      // Update database profile
      const { error } = await supabase
        .from('users')
        .update(data)
        .eq('id', user.id);

      if (error) throw error;

      // Update local state
      if (profile) {
        setProfile({ ...profile, ...data });
      }

      return { error: null };
    } catch (error: any) {
      console.error('[AUTH] Update profile error:', error);
      return { error };
    }
  };

  /**
   * Enhanced user role update
   */
  const updateUserRole = async (userId: string, newRole: string) => {
    try {
      // Update auth metadata
      const { error: metadataError } = await supabase.auth.admin.updateUserById(
        userId,
        { user_metadata: { role: newRole } }
      );

      if (metadataError) {
        // Fallback to client-side update
        const { error: clientUpdateError } = await supabase.auth.updateUser({
          data: { role: newRole }
        });
        if (clientUpdateError) throw clientUpdateError;
      }

      // Update database
      const { error: dbError } = await supabase
        .from('users')
        .update({ role: newRole })
        .eq('id', userId);

      if (dbError) throw dbError;

      // Update local state if current user
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
      console.error('[AUTH] Error updating user role:', error);
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