// utils/AuthContext.tsx - HOOK STABILITY FIXED VERSION
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

  // CRITICAL FIX 3: Stable refs for cleanup management
  const isMountedRef = useRef(true);
  const authInitializedRef = useRef(false);
  const tokenVerificationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const authSubscriptionRef = useRef<{ unsubscribe: () => void } | null>(null);
  const operationTimeoutsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const backgroundOperationsRef = useRef<Set<Promise<any>>>(new Set());

  // For OAuth redirects
  const redirectUri = makeRedirectUri({
    scheme: 'com.qwertyapp.clerkexpoquickstart',
    path: 'auth/callback'
  });

  // CRITICAL FIX 4: Component mount tracking
  useEffect(() => {
    isMountedRef.current = true;
    
    return () => {
      isMountedRef.current = false;
      console.log('[AUTH] AuthProvider unmounting');
    };
  }, []);

  // CRITICAL FIX 5: Enhanced cleanup function
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
   * CRITICAL FIX 6: Enhanced token registration with timeout protection
   */
  const registerPushTokenForUser = async (
    userId: string, 
    attemptNumber: number = 1
  ): Promise<boolean> => {
    const maxAttempts = 3;
    const baseDelay = 1000;
    
    try {
      console.log(`[AUTH] Token registration attempt ${attemptNumber}/${maxAttempts} for user: ${userId}`);
      
      if (isGlobalSigningOut || isSigningOutState || !isMountedRef.current) {
        console.log('[AUTH] User is signing out or component unmounted, skipping token registration');
        return false;
      }

      // CRITICAL FIX 7: Add timeout to token registration
      const token = await withTimeout(
        NotificationService.registerForPushNotificationsAsync(userId, true),
        OPERATION_TIMEOUTS.TOKEN_REGISTRATION,
        'token registration'
      );
      
      if (token && isMountedRef.current) {
        console.log('[AUTH] Token registration successful via NotificationService');
        return true;
      } else {
        console.log(`[AUTH] Token registration failed on attempt ${attemptNumber}`);
        
        if (attemptNumber < maxAttempts && isMountedRef.current) {
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
      
      if (attemptNumber < maxAttempts && isMountedRef.current) {
        const delay = baseDelay * Math.pow(2, attemptNumber - 1);
        console.log(`[AUTH] Retrying token registration after error in ${delay}ms`);
        
        await new Promise(resolve => setTimeout(resolve, delay));
        return registerPushTokenForUser(userId, attemptNumber + 1);
      }
      
      return false;
    }
  };

  /**
   * CRITICAL FIX 8: Stable token verification function
   */
  const setupTokenVerification = (userId: string) => {
    if (!userId || isGuest || !isMountedRef.current) {
      return;
    }

    // Clear any existing verification
    if (tokenVerificationIntervalRef.current) {
      clearInterval(tokenVerificationIntervalRef.current);
      tokenVerificationIntervalRef.current = null;
    }

    console.log('[AUTH] Setting up token verification for user:', userId);

    const verifyToken = async () => {
      if (!isMountedRef.current || isGlobalSigningOut || isSigningOutState) {
        console.log('[AUTH] Skipping token verification - component unmounted or signing out');
        return;
      }

      try {
        const verification = await withTimeout(
          NotificationService.forceTokenVerification(userId),
          3000,
          'token verification'
        );
        
        if (!verification.isValid && isMountedRef.current) {
          console.log('[AUTH] Token verification failed, scheduling background registration');
          
          const registrationPromise = registerPushTokenForUser(userId).catch(error => {
            console.warn('[AUTH] Background token registration failed:', error);
          });
          
          backgroundOperationsRef.current.add(registrationPromise);
        } else if (verification.signedIn === false && verification.token && isMountedRef.current) {
          console.log('[AUTH] Token exists but marked as signed out, updating status');
          
          const updatePromise = NotificationService.markTokenAsSignedIn(userId, verification.token).catch(error => {
            console.warn('[AUTH] Background token status update failed:', error);
          });
          
          backgroundOperationsRef.current.add(updatePromise);
        }
      } catch (error: any) {
        if (error.message.includes('timed out')) {
          console.warn('[AUTH] Token verification timed out');
        } else {
          console.error('[AUTH] Error during token verification:', error);
        }
      }
    };

    // Initial verification with delay
    setTimeout(() => {
      if (isMountedRef.current) {
        verifyToken();
      }
    }, 2000);

    // Set up periodic verification
    tokenVerificationIntervalRef.current = setInterval(() => {
      if (isMountedRef.current) {
        verifyToken();
      }
    }, 12 * 60 * 60 * 1000); // 12 hours
  };

  /**
   * CRITICAL FIX 9: Enhanced cleanup function with timeout protection
   */
  const cleanupPushToken = async (): Promise<void> => {
    try {
      if (!user?.id) {
        console.log('[AUTH] No user to clean up push token for');
        return;
      }

      console.log('[AUTH] Initiating push token cleanup via NotificationService');
      
      const success = await withTimeout(
        NotificationService.cleanupPushToken(user.id),
        3000,
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
    }
  };

  /**
   * CRITICAL FIX 10: Enhanced local storage cleanup with timeout
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

      const cleanupPromises = authKeys.map(async (key) => {
        try {
          return withTimeout(
            SecureStore.deleteItemAsync(key),
            1000,
            `storage cleanup for ${key}`
          );
        } catch (error) {
          console.warn(`[AUTH] Error deleting key ${key}:`, error);
        }
      });

      await withTimeout(
        Promise.allSettled(cleanupPromises),
        5000,
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

  // CRITICAL FIX 11: STABLE auth state management effect (NO DEPENDENCIES)
  useEffect(() => {
    console.log('[AUTH] Initializing auth state management');
    setIsLoaded(false);
    authInitializedRef.current = false;

    // Set timeout for session loading
    const sessionTimeout = setOperationTimeout('sessionLoad', OPERATION_TIMEOUTS.SESSION_LOAD, () => {
      console.warn('[AUTH] Session loading timed out, marking as loaded');
      if (isMountedRef.current) {
        setIsLoaded(true);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, currentSession) => {
        if (!isMountedRef.current) return;
        
        try {
          console.log('[AUTH] Auth state change event:', event);

          if (currentSession) {
            setSession(currentSession);
            setUser(currentSession.user);

            // Only fetch profile for non-guest users
            if (currentSession.user) {
              // Check if this is a guest user by checking the context separately
              // We'll handle guest detection in a separate effect
              await fetchUserProfile(currentSession.user.id);
            }
          } else if (event === 'SIGNED_OUT') {
            setSession(null);
            setUser(null);
            setProfile(null);
          }

          cleanupOperation('sessionLoad');
          if (isMountedRef.current) {
            setIsLoaded(true);
            authInitializedRef.current = true;
          }
        } catch (error) {
          console.error('[AUTH] Error in auth state change handler:', error);
          cleanupOperation('sessionLoad');
          if (isMountedRef.current) {
            setIsLoaded(true);
            authInitializedRef.current = true;
          }
        }
      }
    );

    authSubscriptionRef.current = subscription;

    // Check for existing session on startup
    const loadSession = async () => {
      try {
        const sessionResult = await withTimeout(
          supabase.auth.getSession(),
          OPERATION_TIMEOUTS.SESSION_LOAD,
          'session load'
        );

        if (sessionResult?.data?.session && isMountedRef.current) {
          setSession(sessionResult.data.session);
          setUser(sessionResult.data.session.user);

          if (sessionResult.data.session.user) {
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
        if (isMountedRef.current) {
          setIsLoaded(true);
          authInitializedRef.current = true;
        }
      }
    };

    loadSession();

    return () => {
      console.log('[AUTH] Cleaning up auth state management');
      if (authSubscriptionRef.current) {
        authSubscriptionRef.current.unsubscribe();
        authSubscriptionRef.current = null;
      }
      cleanupOperation('sessionLoad');
    };
  }, []); // CRITICAL: Empty dependency array for stability

  // CRITICAL FIX 12: Separate stable effect for token verification setup
  useEffect(() => {
    // Only set up token verification when we have a user and auth is initialized
    if (user?.id && !isGuest && authInitializedRef.current && isMountedRef.current) {
      console.log('[AUTH] Setting up token verification for authenticated user');
      setupTokenVerification(user.id);
    } else {
      // Clean up token verification when no user
      if (tokenVerificationIntervalRef.current) {
        clearInterval(tokenVerificationIntervalRef.current);
        tokenVerificationIntervalRef.current = null;
      }
    }

    return () => {
      if (tokenVerificationIntervalRef.current) {
        clearInterval(tokenVerificationIntervalRef.current);
        tokenVerificationIntervalRef.current = null;
      }
    };
  }, [user?.id, isGuest]); // Minimal, stable dependencies

  /**
   * CRITICAL FIX 13: Enhanced OAuth user processing with timeout
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
   * CRITICAL FIX 14: Enhanced user profile fetching with timeout
   */
  const fetchUserProfile = async (userId: string): Promise<void> => {
    if (!isMountedRef.current) return;
    
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
          if (sessionData?.session && isMountedRef.current) {
            const createdProfile = await processOAuthUser(sessionData.session);
            if (createdProfile && isMountedRef.current) {
              setProfile(createdProfile);
              return;
            }
          }
        }
        return;
      }

      if (data && isMountedRef.current) {
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
   * CRITICAL FIX 15: Enhanced sign out with comprehensive timeout protection
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
            3000,
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
      if (isMountedRef.current) {
        setSession(null);
        setUser(null);
        setProfile(null);
      }
      
      // UI stabilization delay
      await new Promise(resolve => setTimeout(resolve, 1500));
  
      // Safe navigation with error recovery
      if (isMountedRef.current) {
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
      }
  
    } catch (error) {
      console.error('[AUTH] Sign out process error:', error);
  
      // Force state cleanup even on error
      if (isMountedRef.current) {
        setSession(null);
        setUser(null);
        setProfile(null);
      }

      await new Promise(resolve => setTimeout(resolve, 500));
      
      if (isMountedRef.current) {
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
      }
    } finally {
      // Reset signing out states with delay
      setTimeout(() => {
        if (isMountedRef.current) {
          setIsSigningOutState(false);
          setIsSigningOut(false);
          setGlobalSigningOut(false);
          console.log('[AUTH] Sign out process completed');
        }
      }, 2000);
    }
  };

  /**
   * CRITICAL FIX 16: Enhanced sign in with timeout protection
   */
  const signIn = async ({ email, password }: SignInCredentials) => {
    try {
      setIsSigningIn(true);
      
      if (isGuest) {
        await clearGuestMode();
      }

      const result = await withTimeout(
        supabase.auth.signInWithPassword({
          email,
          password,
        }),
        OPERATION_TIMEOUTS.SIGN_IN,
        'sign in'
      );

      const { data, error } = result;

      if (error) throw error;

      if (data.user && isMountedRef.current) {
        await fetchUserProfile(data.user.id);
        
        console.log('[AUTH] Sign in successful, scheduling token registration');
        
        // Schedule background token registration
        setTimeout(async () => {
          if (isMountedRef.current) {
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
          }
        }, 1000);
      }
      
      return { error: null };
    } catch (error: any) {
      if (error.message.includes('timed out')) {
        console.warn('[AUTH] Sign in timed out');
        return { error: new Error('Sign in timed out. Please try again.') };
      } else {
        console.error('[AUTH] Sign in error:', error);
        return { error };
      }
    } finally {
      if (isMountedRef.current) {
        setIsSigningIn(false);
      }
    }
  };

  /**
   * CRITICAL FIX 17: Enhanced Google sign in with timeout protection
   */
  const googleSignIn = async () => {
    try {
      setIsSigningIn(true);

      if (isGuest) {
        await clearGuestMode();
      }

      const oauthResult = await withTimeout(
        supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: redirectUri,
            skipBrowserRedirect: true,
          },
        }),
        OPERATION_TIMEOUTS.OAUTH_PROCESS,
        'Google OAuth initiation'
      );

      const { data, error } = oauthResult;

      if (error) throw error;

      if (data?.url) {
        console.log('[AUTH] Opening Google auth session');

        const browserResult = await withTimeout(
          WebBrowser.openAuthSessionAsync(data.url, redirectUri),
          OPERATION_TIMEOUTS.OAUTH_PROCESS,
          'Google OAuth browser session'
        );

        console.log('[AUTH] WebBrowser result:', browserResult.type);

        if (browserResult.type === 'success') {
          try {
            const url = new URL(browserResult.url);
            const hashParams = new URLSearchParams(url.hash.substring(1));
            const accessToken = hashParams.get('access_token');

            if (accessToken) {
              const sessionResult = await withTimeout(
                supabase.auth.setSession({
                  access_token: accessToken,
                  refresh_token: hashParams.get('refresh_token') || '',
                }),
                OPERATION_TIMEOUTS.SIGN_IN,
                'Google OAuth session setup'
              );

              const { data: sessionData, error: sessionError } = sessionResult;

              if (sessionError) throw sessionError;

              if (sessionData.session && isMountedRef.current) {
                setSession(sessionData.session);
                setUser(sessionData.session.user);

                const userProfile = await processOAuthUser(sessionData.session);
                if (userProfile && isMountedRef.current) {
                  setProfile(userProfile);
                }

                console.log('[AUTH] Google sign in successful, scheduling token registration');
                
                setTimeout(async () => {
                  if (isMountedRef.current) {
                    try {
                      await registerPushTokenForUser(sessionData.session.user.id);
                    } catch (tokenError) {
                      console.error('[AUTH] Token registration error during Google sign in:', tokenError);
                    }
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
        if (currentSession?.session?.user && isMountedRef.current) {
          console.log('[AUTH] Google sign in fallback path successful');
          setSession(currentSession.session);
          setUser(currentSession.session.user);
          
          setTimeout(async () => {
            if (isMountedRef.current) {
              try {
                await registerPushTokenForUser(currentSession.session.user.id);
              } catch (tokenError) {
                console.error('[AUTH] Token registration error during Google sign in fallback:', tokenError);
              }
            }
          }, 1000);
          
          return { success: true, user: currentSession.session.user };
        }
      } catch (sessionCheckError) {
        console.error('[AUTH] Error checking session after Google auth:', sessionCheckError);
      }

      console.log('[AUTH] Google authentication failed');
      return { success: false };
    } catch (error: any) {
      if (error.message.includes('timed out')) {
        console.warn('[AUTH] Google sign in timed out');
        return { success: false, error: new Error('Google sign in timed out') };
      } else {
        console.error('[AUTH] Google sign in error:', error);
        return { success: false, error };
      }
    } finally {
      if (isMountedRef.current) {
        setIsSigningIn(false);
      }
    }
  };

  /**
   * Enhanced Apple sign in with timeout protection
   */
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

          if (sessionData?.session && isMountedRef.current) {
            const userProfile = await processOAuthUser(sessionData.session);

            if (userProfile && isMountedRef.current) {
              setProfile(userProfile);
            }

            console.log('[AUTH] Apple sign in successful, scheduling token registration');
            
            setTimeout(async () => {
              if (isMountedRef.current) {
                try {
                  await registerPushTokenForUser(sessionData.session.user.id);
                } catch (tokenError) {
                  console.error('[AUTH] Token registration error during Apple sign in:', tokenError);
                }
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
      if (isMountedRef.current) {
        setIsSigningIn(false);
      }
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
      if (data.user && isMountedRef.current) {
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
            if (isMountedRef.current) {
              try {
                await registerPushTokenForUser(data.user.id);
              } catch (tokenError) {
                console.error('[AUTH] Token registration error during sign up:', tokenError);
              }
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
      
      if (data.session && isMountedRef.current) {
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
      if (profile && data && isMountedRef.current) {
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
          } else {
            console.log('[AUTH] Auth metadata updated successfully');
          }
        } catch (authError: any) {
          console.warn('[AUTH] Auth metadata update error (non-critical):', authError);
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
        if (originalProfile && isMountedRef.current) {
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

        if (verifyResult.data && isMountedRef.current) {
          console.log('[AUTH] Profile verification successful, updating state with fresh data');
          setProfile(verifyResult.data as UserProfile);
        } else {
          console.warn('[AUTH] Profile verification failed, keeping optimistic update');
        }
      } catch (verifyError) {
        console.warn('[AUTH] Profile verification error (non-critical):', verifyError);
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
    if (!user?.id || !isMountedRef.current) {
      console.warn('[AUTH] Cannot refresh profile - no user ID or component unmounted');
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

      if (data && isMountedRef.current) {
        console.log('[AUTH] Force refresh successful, updating profile state');
        setProfile(data as UserProfile);
      }
    } catch (error) {
      console.error('[AUTH] Force refresh error:', error);
    }
  };

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

      if (user && userId === user.id && isMountedRef.current) {
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

  // CRITICAL FIX 18: Final cleanup on unmount
  useEffect(() => {
    return () => {
      console.log('[AUTH] AuthProvider final cleanup');
      
      // Clear all timeouts
      operationTimeoutsRef.current.forEach(timeout => clearTimeout(timeout));
      operationTimeoutsRef.current.clear();
      
      // Clear intervals
      if (tokenVerificationIntervalRef.current) {
        clearInterval(tokenVerificationIntervalRef.current);
        tokenVerificationIntervalRef.current = null;
      }
      
      // Clear auth subscription
      if (authSubscriptionRef.current) {
        authSubscriptionRef.current.unsubscribe();
        authSubscriptionRef.current = null;
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
        forceProfileRefresh,
        updateUserRole
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};