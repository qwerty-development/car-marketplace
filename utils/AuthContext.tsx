// utils/AuthContext.tsx - FIXED VERSION
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

// CRITICAL FIX 1: Enhanced timeout configurations
const OPERATION_TIMEOUTS = {
  SIGN_IN: 10000, // 10 seconds
  SIGN_OUT: 8000, // 8 seconds
  PROFILE_FETCH: 5000, // 5 seconds
  TOKEN_REGISTRATION: 8000, // 8 seconds
  SESSION_LOAD: 10000, // 10 seconds
  OAUTH_PROCESS: 15000, // 15 seconds
} as const;

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
  forceProfileRefresh: () => Promise<void>;
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

// CRITICAL FIX 2: Timeout utility for async operations
const withTimeout = <T>(
  promise: Promise<T>,
  timeoutMs: number,
  operationName: string
): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error(`${operationName} operation timed out after ${timeoutMs}ms`)),
        timeoutMs
      )
    ),
  ]);
};

export const AuthProvider: React.FC<{children: React.ReactNode}> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isSigningOutState, setIsSigningOutState] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const { isGuest, clearGuestMode } = useGuestUser();

  // CRITICAL FIX 3: Enhanced cleanup management
  const tokenVerificationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const authSubscriptionRef = useRef<{ unsubscribe: () => void } | null>(null);
  const operationTimeoutsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const backgroundOperationsRef = useRef<Set<Promise<any>>>(new Set());

  // For OAuth redirects
  const redirectUri = makeRedirectUri({
    scheme: 'com.qwertyapp.clerkexpoquickstart',
    path: 'auth/callback'
  });

  // CRITICAL FIX 4: Enhanced cleanup function
  const cleanupOperation = (operationKey: string) => {
    const timeout = operationTimeoutsRef.current.get(operationKey);
    if (timeout) {
      clearTimeout(timeout);
      operationTimeoutsRef.current.delete(operationKey);
    }
  };

  const setOperationTimeout = (operationKey: string, timeoutMs: number, callback: () => void) => {
    cleanupOperation(operationKey);
    const timeout = setTimeout(callback, timeoutMs);
    operationTimeoutsRef.current.set(operationKey, timeout);
    return timeout;
  };

  /**
   * CRITICAL FIX 5: Enhanced token registration with timeout protection
   */
  const registerPushTokenForUser = async (
    userId: string, 
    attemptNumber: number = 1
  ): Promise<boolean> => {
    const maxAttempts = 3;
    const baseDelay = 1000;
    
    try {
      console.log(`[AUTH] Token registration attempt ${attemptNumber}/${maxAttempts} for user: ${userId}`);
      
      if (isGlobalSigningOut || isSigningOutState) {
        console.log('[AUTH] User is signing out, skipping token registration');
        return false;
      }

      // CRITICAL FIX 6: Add timeout to token registration
      const token = await withTimeout(
        NotificationService.registerForPushNotificationsAsync(userId, true),
        OPERATION_TIMEOUTS.TOKEN_REGISTRATION,
        'token registration'
      );
      
      if (token) {
        console.log('[AUTH] Token registration successful via NotificationService');
        return true;
      } else {
        console.log(`[AUTH] Token registration failed on attempt ${attemptNumber}`);
        
        if (attemptNumber < maxAttempts) {
          const delay = baseDelay * Math.pow(2, attemptNumber - 1);
          console.log(`[AUTH] Retrying token registration in ${delay}ms`);
          
          await new Promise(resolve => setTimeout(resolve, delay));
          return registerPushTokenForUser(userId, attemptNumber + 1);
        }
        
        return false;
      }
    } catch (error: any) {
      if (error.message.includes('timed out')) {
        console.warn(`[AUTH] Token registration timed out on attempt ${attemptNumber}`);
      } else {
        console.error(`[AUTH] Token registration error on attempt ${attemptNumber}:`, error);
      }
      
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
   * CRITICAL FIX 7: Non-blocking token verification with timeout
   */
  const verifyTokenRegistration = async (userId: string): Promise<void> => {
    try {
      console.log('[AUTH] Starting periodic token verification for user:', userId);
      
      if (isGlobalSigningOut || isSigningOutState) {
        console.log('[AUTH] Skipping token verification - user signing out');
        return;
      }

      // Add timeout to verification
      const verification = await withTimeout(
        NotificationService.forceTokenVerification(userId),
        3000, // 3 second timeout for verification
        'token verification'
      );
      
      if (!verification.isValid) {
        console.log('[AUTH] Token verification failed, scheduling background registration');
        
        // Schedule background registration without blocking
        const registrationPromise = registerPushTokenForUser(userId).catch(error => {
          console.warn('[AUTH] Background token registration failed:', error);
        });
        
        backgroundOperationsRef.current.add(registrationPromise);
      } else if (verification.signedIn === false) {
        console.log('[AUTH] Token exists but marked as signed out, updating status');
        
        if (verification.token) {
          const updatePromise = NotificationService.markTokenAsSignedIn(userId, verification.token).catch(error => {
            console.warn('[AUTH] Background token status update failed:', error);
          });
          
          backgroundOperationsRef.current.add(updatePromise);
        }
      } else {
        console.log('[AUTH] Token verification successful');
      }
    } catch (error: any) {
      if (error.message.includes('timed out')) {
        console.warn('[AUTH] Token verification timed out, scheduling background check');
      } else {
        console.error('[AUTH] Error during token verification:', error);
      }
      
      // Schedule fallback registration without blocking
      setTimeout(() => {
        if (!isGlobalSigningOut && !isSigningOutState) {
          const fallbackPromise = registerPushTokenForUser(userId).catch(error => {
            console.warn('[AUTH] Fallback token registration failed:', error);
          });
          backgroundOperationsRef.current.add(fallbackPromise);
        }
      }, 5000);
    }
  };

  /**
   * CRITICAL FIX 8: Enhanced cleanup function with timeout protection
   */
  const cleanupPushToken = async (): Promise<void> => {
    try {
      if (!user?.id) {
        console.log('[AUTH] No user to clean up push token for');
        return;
      }

      console.log('[AUTH] Initiating push token cleanup via NotificationService');
      
      // Add timeout to cleanup operation
      const success = await withTimeout(
        NotificationService.cleanupPushToken(user.id),
        3000, // 3 second timeout for cleanup
        'push token cleanup'
      );

      if (success) {
        console.log('[AUTH] Push token cleanup completed successfully');
      } else {
        console.log('[AUTH] Push token cleanup encountered issues but completed');
      }
    } catch (error: any) {
      if (error.message.includes('timed out')) {
        console.warn('[AUTH] Push token cleanup timed out');
      } else {
        console.error('[AUTH] Push token cleanup error:', error);
      }
      // Continue with sign out process even if token cleanup fails
    }
  };

  /**
   * CRITICAL FIX 9: Enhanced local storage cleanup with timeout
   */
  const cleanupLocalStorage = async (): Promise<void> => {
    try {
      console.log('[AUTH] Starting auth-related local storage cleanup');
      
      const authKeys = [
        'supabase-auth-token',
        'lastActiveSession',
        'authSessionExpiry',
        'tempAuthData'
      ];

      // Add timeout to storage cleanup
      const cleanupPromises = authKeys.map(async (key) => {
        try {
          return withTimeout(
            SecureStore.deleteItemAsync(key),
            1000, // 1 second timeout per key
            `storage cleanup for ${key}`
          );
        } catch (error) {
          console.warn(`[AUTH] Error deleting key ${key}:`, error);
        }
      });

      await withTimeout(
        Promise.allSettled(cleanupPromises),
        5000, // 5 second total timeout for storage cleanup
        'complete storage cleanup'
      );
      
      console.log('[AUTH] Auth-related local storage cleanup completed');
    } catch (error: any) {
      if (error.message.includes('timed out')) {
        console.warn('[AUTH] Local storage cleanup timed out');
      } else {
        console.error('[AUTH] Local storage cleanup error:', error);
      }
    }
  };

  // CRITICAL FIX 10: Token verification effect with proper cleanup and timeout
  useEffect(() => {
    if (!user?.id || isGuest) {
      return;
    }

    const verificationInterval = 12 * 60 * 60 * 1000; // 12 hours
    
    // Initial verification with delay and timeout
    const initialTimeout = setTimeout(() => {
      verifyTokenRegistration(user.id);
    }, 2000);

    // Set up periodic verification
    tokenVerificationIntervalRef.current = setInterval(() => {
      verifyTokenRegistration(user.id);
    }, verificationInterval);

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
  
  // CRITICAL FIX 11: Enhanced auth state management with timeout protection
  useEffect(() => {
    setIsLoaded(false);

    // Set timeout for session loading
    const sessionTimeout = setOperationTimeout('sessionLoad', OPERATION_TIMEOUTS.SESSION_LOAD, () => {
      console.warn('[AUTH] Session loading timed out, marking as loaded');
      setIsLoaded(true);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, currentSession) => {
        try {
          console.log('[AUTH] Auth state change event:', event);

          if (currentSession) {
            setSession(currentSession);
            setUser(currentSession.user);

            if (currentSession.user && !isGuest) {
              await fetchUserProfile(currentSession.user.id);
            }
          } else if (event === 'SIGNED_OUT') {
            setSession(null);
            setUser(null);
            setProfile(null);
          }

          // Clear the session timeout since we got a response
          cleanupOperation('sessionLoad');
          setIsLoaded(true);
        } catch (error) {
          console.error('[AUTH] Error in auth state change handler:', error);
          // Still mark as loaded to prevent infinite loading
          cleanupOperation('sessionLoad');
          setIsLoaded(true);
        }
      }
    );

    authSubscriptionRef.current = subscription;

    // Check for existing session on startup with timeout
    const loadSession = async () => {
      try {
        const sessionResult = await withTimeout(
          supabase.auth.getSession(),
          OPERATION_TIMEOUTS.SESSION_LOAD,
          'session load'
        );

        if (sessionResult?.data?.session) {
          setSession(sessionResult.data.session);
          setUser(sessionResult.data.session.user);

          if (sessionResult.data.session.user && !isGuest) {
            await fetchUserProfile(sessionResult.data.session.user.id);
          }
        }
      } catch (error: any) {
        if (error.message.includes('timed out')) {
          console.warn('[AUTH] Session load timed out');
        } else {
          console.error('[AUTH] Error loading session:', error);
        }
      } finally {
        cleanupOperation('sessionLoad');
        setIsLoaded(true);
      }
    };

    loadSession();

    return () => {
      if (authSubscriptionRef.current) {
        authSubscriptionRef.current.unsubscribe();
        authSubscriptionRef.current = null;
      }
      cleanupOperation('sessionLoad');
    };
  }, [isGuest]);

  /**
   * CRITICAL FIX 12: Enhanced OAuth user processing with timeout
   */
  const processOAuthUser = async (session: Session): Promise<UserProfile | null> => {
    try {
      const result = await withTimeout(
        supabase
          .from('users')
          .select('*')
          .eq('id', session.user.id)
          .single(),
        OPERATION_TIMEOUTS.PROFILE_FETCH,
        'OAuth user check'
      );

      const { data: existingUser, error: fetchError } = result;

      if (fetchError && fetchError.code === 'PGRST116') {
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

        const upsertResult = await withTimeout(
          supabase
            .from('users')
            .upsert([newUser], {
              onConflict: 'id',
              ignoreDuplicates: false
            })
            .select()
            .single(),
          OPERATION_TIMEOUTS.PROFILE_FETCH,
          'OAuth user creation'
        );

        const { data: upsertedUser, error: upsertError } = upsertResult;

        if (upsertError) {
          if (upsertError.code === '23505') {
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

      if (!session.user.user_metadata.role) {
        await supabase.auth.updateUser({
          data: { role: existingUser?.role || 'user' }
        });
      }

      return existingUser as UserProfile;
    } catch (error: any) {
      if (error.message.includes('timed out')) {
        console.warn('[AUTH] OAuth user processing timed out');
      } else {
        console.error('[AUTH] Error processing OAuth user:', error);
      }
      return null;
    }
  };

  /**
   * CRITICAL FIX 13: Enhanced user profile fetching with timeout
   */
  const fetchUserProfile = async (userId: string): Promise<void> => {
    try {
      const result = await withTimeout(
        supabase
          .from('users')
          .select('*')
          .eq('id', userId)
          .single(),
        OPERATION_TIMEOUTS.PROFILE_FETCH,
        'profile fetch'
      );

      const { data, error } = result;

      if (error) {
        console.error('[AUTH] Error fetching user profile:', error);

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
    } catch (error: any) {
      if (error.message.includes('timed out')) {
        console.warn('[AUTH] Profile fetch timed out');
      } else {
        console.error('[AUTH] Error in fetchUserProfile:', error);
      }
    }
  };

  /**
   * CRITICAL FIX 14: Enhanced sign out with comprehensive timeout protection
   */
  const signOut = async (): Promise<void> => {
    if (isSigningOutState) {
      console.log('[AUTH] Sign out already in progress, ignoring duplicate request');
      return;
    }
  
    try {
      setIsSigningOutState(true);
      setIsSigningOut(true);
      setGlobalSigningOut(true);
  
      console.log('[AUTH] Starting comprehensive sign out process');

      // Clear all operation timeouts
      operationTimeoutsRef.current.forEach(timeout => clearTimeout(timeout));
      operationTimeoutsRef.current.clear();

      // Clear verification interval immediately
      if (tokenVerificationIntervalRef.current) {
        clearInterval(tokenVerificationIntervalRef.current);
        tokenVerificationIntervalRef.current = null;
      }
  
      // Clean up push notification tokens with timeout
      if (user) {
        try {
          console.log('[AUTH] Cleaning up push notification tokens');
          
          const tokenUpdateResult = await withTimeout(
            supabase
              .from('user_push_tokens')
              .update({ 
                signed_in: false,
                last_updated: new Date().toISOString()
              })
              .eq('user_id', user.id),
            3000, // 3 second timeout
            'token status update'
          );
            
          if (tokenUpdateResult.error) {
            console.error('[AUTH] Error marking tokens as signed out:', tokenUpdateResult.error);
          } else {
            console.log('[AUTH] Successfully marked all tokens as signed out');
          }

          await cleanupPushToken();
        } catch (tokenError: any) {
          if (tokenError.message.includes('timed out')) {
            console.warn('[AUTH] Token cleanup timed out');
          } else {
            console.error('[AUTH] Error during push token cleanup:', tokenError);
          }
        }
      }
  
      // Execute Supabase sign out with timeout and retry logic
      let signOutSuccess = false;
      let signOutAttempt = 0;
      const maxAttempts = 3;
  
      while (!signOutSuccess && signOutAttempt < maxAttempts) {
        signOutAttempt++;
        try {
          console.log(`[AUTH] Supabase sign out attempt ${signOutAttempt}/${maxAttempts}`);
          
          const signOutResult = await withTimeout(
            supabase.auth.signOut(),
            OPERATION_TIMEOUTS.SIGN_OUT,
            'sign out'
          );

          if (signOutResult.error) {
            console.error(`[AUTH] Sign out attempt ${signOutAttempt} failed:`, signOutResult.error);
            if (signOutAttempt < maxAttempts) {
              const delay = Math.pow(2, signOutAttempt) * 500;
              await new Promise(resolve => setTimeout(resolve, delay));
            }
          } else {
            signOutSuccess = true;
            console.log('[AUTH] Supabase sign out successful');
          }
        } catch (error: any) {
          if (error.message.includes('timed out')) {
            console.warn(`[AUTH] Sign out attempt ${signOutAttempt} timed out`);
          } else {
            console.error(`[AUTH] Sign out attempt ${signOutAttempt} error:`, error);
          }
          
          if (signOutAttempt < maxAttempts) {
            const delay = Math.pow(2, signOutAttempt) * 500;
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }
      }
  
      // Clean up local storage with timeout
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

// Replace the googleSignIn method in your AuthContext.tsx with this BRUTE FORCE version:

// Replace the googleSignIn method in your AuthContext.tsx with this:

const googleSignIn = async () => {
  try {
    setIsSigningIn(true);

    if (isGuest) {
      await clearGuestMode();
    }

    console.log('[GOOGLE SIGNIN] Starting Google sign-in');

    // BRUTE FORCE: Use the scheme from app.json for better compatibility
    const bruteForceRedirectUri = makeRedirectUri({
      scheme: 'fleet', // From your app.json
      path: 'auth/callback'
    });

    console.log('[GOOGLE SIGNIN] Using redirect URI:', bruteForceRedirectUri);

    const oauthResult = await withTimeout(
      supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: bruteForceRedirectUri,
          skipBrowserRedirect: true,
        },
      }),
      OPERATION_TIMEOUTS.OAUTH_PROCESS,
      'Google OAuth initiation'
    );

    const { data, error } = oauthResult;

    if (error) throw error;

    if (data?.url) {
      console.log('[GOOGLE SIGNIN] Opening auth session with URL:', data.url);

      const browserResult = await withTimeout(
        WebBrowser.openAuthSessionAsync(data.url, bruteForceRedirectUri),
        OPERATION_TIMEOUTS.OAUTH_PROCESS,
        'Google OAuth browser session'
      );

      console.log('[GOOGLE SIGNIN] Browser result:', browserResult);

      if (browserResult.type === 'success') {
        console.log('[GOOGLE SIGNIN] Success! Processing URL:', browserResult.url);
        
        // BRUTE FORCE: Let the deep link handler process this
        // The URL will be caught by the deep link handler which will extract tokens
        console.log('[GOOGLE SIGNIN] OAuth successful, deep link handler will process the callback');
        
        return { success: true };
      } else if (browserResult.type === 'cancel') {
        console.log('[GOOGLE SIGNIN] User cancelled authentication');
        return { success: false, cancelled: true };
      }
    }

    // BRUTE FORCE: Fallback session check
    console.log('[GOOGLE SIGNIN] Attempting fallback session check');
    try {
      const { data: currentSession } = await supabase.auth.getSession();
      if (currentSession?.session?.user) {
        console.log('[GOOGLE SIGNIN] Fallback session found');
        setSession(currentSession.session);
        setUser(currentSession.session.user);
        
        // Register push token in background
        setTimeout(async () => {
          try {
            await registerPushTokenForUser(currentSession.session.user.id);
          } catch (tokenError) {
            console.error('[GOOGLE SIGNIN] Token registration error:', tokenError);
          }
        }, 1000);
        
        return { success: true, user: currentSession.session.user };
      }
    } catch (sessionCheckError) {
      console.error('[GOOGLE SIGNIN] Fallback session check error:', sessionCheckError);
    }

    console.log('[GOOGLE SIGNIN] Authentication failed');
    return { success: false };
  } catch (error: any) {
    if (error.message.includes('timed out')) {
      console.warn('[GOOGLE SIGNIN] Sign in timed out');
      return { success: false, error: new Error('Google sign in timed out') };
    } else {
      console.error('[GOOGLE SIGNIN] Sign in error:', error);
      return { success: false, error };
    }
  } finally {
    setIsSigningIn(false);
  }
};


  const appleSignIn = async () => {
    try {
      setIsSigningIn(true);

      if (isGuest) {
        await clearGuestMode();
      }

      const { data, error } = await withTimeout(
        supabase.auth.signInWithOAuth({
          provider: 'apple',
          options: {
            redirectTo: redirectUri,
            skipBrowserRedirect: true,
          },
        }),
        OPERATION_TIMEOUTS.OAUTH_PROCESS,
        'Apple OAuth'
      );

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
    } catch (error: any) {
      if (error.message.includes('timed out')) {
        console.warn('[AUTH] Apple sign in timed out');
      } else {
        console.error('[AUTH] Apple sign in error:', error);
      }
    } finally {
      setIsSigningIn(false);
    }
  };

  /**
   * Enhanced sign up with timeout protection
   */
  const signUp = async ({ email, password, name, role = 'user' }: SignUpCredentials) => {
    try {
      if (isGuest) {
        await clearGuestMode();
      }

      // Check if email exists with timeout
      const existingUserResult = await withTimeout(
        supabase
          .from('users')
          .select('email')
          .eq('email', email)
          .maybeSingle(),
        OPERATION_TIMEOUTS.PROFILE_FETCH,
        'email existence check'
      );

      const { data: existingUser, error: checkError } = existingUserResult;

      if (existingUser) {
        return {
          error: new Error('An account with this email already exists. Please sign in instead.'),
          needsEmailVerification: false
        };
      }

      // Proceed with signup
      const signUpResult = await withTimeout(
        supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              name: name,
              role: role,
            },
            emailRedirectTo: redirectUri,
          },
        }),
        OPERATION_TIMEOUTS.SIGN_IN,
        'sign up'
      );

      const { data, error } = signUpResult;

      if (error) {
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
        const upsertResult = await withTimeout(
          supabase.from('users').upsert([{
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
          }),
          OPERATION_TIMEOUTS.PROFILE_FETCH,
          'user profile creation'
        );

        if (upsertResult.error && upsertResult.error.code !== '23505') {
          console.error('[AUTH] Error creating user profile:', upsertResult.error);
        }

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
      if (error.message.includes('timed out')) {
        console.warn('[AUTH] Sign up timed out');
        return {
          error: new Error('Sign up timed out. Please try again.'),
          needsEmailVerification: false
        };
      } else {
        console.error('[AUTH] Sign up error:', error);

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
    }
  };

  /**
   * Enhanced password reset with timeout
   */
  const resetPassword = async (email: string) => {
    try {
      const result = await withTimeout(
        supabase.auth.resetPasswordForEmail(email, {
          redirectTo: redirectUri,
        }),
        OPERATION_TIMEOUTS.SIGN_IN,
        'password reset'
      );

      const { error } = result;

      if (error) throw error;
      return { error: null };
    } catch (error: any) {
      if (error.message.includes('timed out')) {
        console.warn('[AUTH] Password reset timed out');
        return { error: new Error('Password reset timed out. Please try again.') };
      } else {
        console.error('[AUTH] Reset password error:', error);
        return { error };
      }
    }
  };

  /**
   * Enhanced password update with timeout
   */
  const updatePassword = async ({ currentPassword, newPassword }: { currentPassword: string, newPassword: string }) => {
    try {
      // Verify current password
      const signInResult = await withTimeout(
        supabase.auth.signInWithPassword({
          email: user?.email || '',
          password: currentPassword,
        }),
        OPERATION_TIMEOUTS.SIGN_IN,
        'password verification'
      );

      if (signInResult.error) throw new Error('Current password is incorrect');

      // Update to new password
      const updateResult = await withTimeout(
        supabase.auth.updateUser({
          password: newPassword,
        }),
        OPERATION_TIMEOUTS.SIGN_IN,
        'password update'
      );

      if (updateResult.error) throw updateResult.error;
      return { error: null };
    } catch (error: any) {
      if (error.message.includes('timed out')) {
        console.warn('[AUTH] Password update timed out');
        return { error: new Error('Password update timed out. Please try again.') };
      } else {
        console.error('[AUTH] Update password error:', error);
        return { error };
      }
    }
  };

  /**
   * Enhanced OTP verification with timeout
   */
  const verifyOtp = async (email: string, token: string) => {
    try {
      const result = await withTimeout(
        supabase.auth.verifyOtp({
          email,
          token,
          type: 'signup',
        }),
        OPERATION_TIMEOUTS.SIGN_IN,
        'OTP verification'
      );

      const { data, error } = result;

      if (error) throw error;
      return { error: null, data };
    } catch (error: any) {
      if (error.message.includes('timed out')) {
        console.warn('[AUTH] OTP verification timed out');
        return { error: new Error('OTP verification timed out. Please try again.') };
      } else {
        console.error('[AUTH] OTP verification error:', error);
        return { error };
      }
    }
  };

  /**
   * Enhanced session refresh with timeout
   */
  const refreshSession = async () => {
    try {
      const result = await withTimeout(
        supabase.auth.refreshSession(),
        OPERATION_TIMEOUTS.SESSION_LOAD,
        'session refresh'
      );

      const { data, error } = result;
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
    } catch (error: any) {
      if (error.message.includes('timed out')) {
        console.warn('[AUTH] Session refresh timed out');
      } else {
        console.error('[AUTH] Session refresh error:', error);
      }
    }
  };

const updateUserProfile = async (data: Partial<UserProfile>) => {
  console.log('[AUTH] Starting profile update with data:', data);
  
  try {
    if (!user) {
      console.error('[AUTH] No user signed in for profile update');
      throw new Error('No user is signed in');
    }

    // STEP 1: Store original profile for rollback
    const originalProfile = profile ? { ...profile } : null;
    
    // STEP 2: Optimistically update local state first
    if (profile && data) {
      console.log('[AUTH] Optimistically updating local profile state');
      const updatedProfile = { ...profile, ...data };
      setProfile(updatedProfile);
    }

    // STEP 3: Update Supabase auth metadata (non-critical, can fail)
    if (data.name) {
      try {
        console.log('[AUTH] Updating auth user metadata');
        const authUpdateResult = await withTimeout(
          supabase.auth.updateUser({
            data: { name: data.name }
          }),
          OPERATION_TIMEOUTS.PROFILE_FETCH,
          'auth metadata update'
        );

        if (authUpdateResult.error) {
          console.warn('[AUTH] Auth metadata update failed (non-critical):', authUpdateResult.error);
          // Don't throw here - auth metadata failure is not critical
        } else {
          console.log('[AUTH] Auth metadata updated successfully');
        }
      } catch (authError: any) {
        console.warn('[AUTH] Auth metadata update error (non-critical):', authError);
        // Continue with database update even if auth metadata fails
      }
    }

    // STEP 4: Update database - THIS IS THE CRITICAL OPERATION
    console.log('[AUTH] Updating user profile in database');
    const updateResult = await withTimeout(
      supabase
        .from('users')
        .update(data)
        .eq('id', user.id)
        .select()
        .single(),
      OPERATION_TIMEOUTS.PROFILE_FETCH,
      'profile database update'
    );

    if (updateResult.error) {
      console.error('[AUTH] Database update failed:', updateResult.error);
      
      // ROLLBACK: Revert optimistic update
      if (originalProfile) {
        console.log('[AUTH] Rolling back optimistic update');
        setProfile(originalProfile);
      }
      
      throw updateResult.error;
    }

    // STEP 5: Verify database update and refresh from source
    console.log('[AUTH] Database update successful, verifying...');
    
    try {
      // Force refresh from database to ensure consistency
      const verifyResult = await withTimeout(
        supabase
          .from('users')
          .select('*')
          .eq('id', user.id)
          .single(),
        3000,
        'profile verification'
      );

      if (verifyResult.data) {
        console.log('[AUTH] Profile verification successful, updating state with fresh data');
        setProfile(verifyResult.data as UserProfile);
      } else {
        console.warn('[AUTH] Profile verification failed, keeping optimistic update');
        // Keep the optimistic update if verification fails
      }
    } catch (verifyError) {
      console.warn('[AUTH] Profile verification error (non-critical):', verifyError);
      // Keep the optimistic update if verification fails
    }

    console.log('[AUTH] Profile update completed successfully');
    return { error: null };

  } catch (error: any) {
    console.error('[AUTH] Profile update failed:', error);
    
    if (error.message.includes('timed out')) {
      console.warn('[AUTH] Profile update timed out');
      return { error: new Error('Profile update timed out. Please try again.') };
    } else {
      return { error };
    }
  }
};

const forceProfileRefresh = async () => {
  if (!user?.id) {
    console.warn('[AUTH] Cannot refresh profile - no user ID');
    return;
  }

  try {
    console.log('[AUTH] Force refreshing profile from database');
    
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .single();

    if (error) {
      console.error('[AUTH] Force refresh failed:', error);
      return;
    }

    if (data) {
      console.log('[AUTH] Force refresh successful, updating profile state');
      setProfile(data as UserProfile);
    }
  } catch (error) {
    console.error('[AUTH] Force refresh error:', error);
  }
};


// forceProfileRefresh: () => Promise<void>;
  const updateUserRole = async (userId: string, newRole: string) => {
    try {
      const metadataUpdateResult = await withTimeout(
        supabase.auth.admin.updateUserById(
          userId,
          { user_metadata: { role: newRole } }
        ),
        OPERATION_TIMEOUTS.PROFILE_FETCH,
        'role metadata update'
      );

      if (metadataUpdateResult.error) {
        const clientUpdateResult = await supabase.auth.updateUser({
          data: { role: newRole }
        });
        if (clientUpdateResult.error) throw clientUpdateResult.error;
      }

      const dbUpdateResult = await withTimeout(
        supabase
          .from('users')
          .update({ role: newRole })
          .eq('id', userId),
        OPERATION_TIMEOUTS.PROFILE_FETCH,
        'role database update'
      );

      if (dbUpdateResult.error) throw dbUpdateResult.error;

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
      if (error.message.includes('timed out')) {
        console.warn('[AUTH] Role update timed out');
        return { error: new Error('Role update timed out. Please try again.') };
      } else {
        console.error('[AUTH] Error updating user role:', error);
        return { error };
      }
    }
  };

  // CRITICAL FIX 17: Cleanup on unmount
  useEffect(() => {
    return () => {
      // Clear all timeouts
      operationTimeoutsRef.current.forEach(timeout => clearTimeout(timeout));
      operationTimeoutsRef.current.clear();
      
      // Clear intervals
      if (tokenVerificationIntervalRef.current) {
        clearInterval(tokenVerificationIntervalRef.current);
        tokenVerificationIntervalRef.current = null;
      }
      
      // Cancel background operations
      backgroundOperationsRef.current.clear();
    };
  }, []);

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
        signUp,
        signOut,
        resetPassword,
        updatePassword,
        verifyOtp,
        googleSignIn,
        appleSignIn,
        refreshSession,
        updateUserProfile,
        forceProfileRefresh,
        updateUserRole
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};