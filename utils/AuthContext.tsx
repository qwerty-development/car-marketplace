// utils/AuthContext.tsx
import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from './supabase';
import * as SecureStore from 'expo-secure-store';
import { Alert } from 'react-native';
import { useGuestUser } from './GuestUserContext';
import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri } from 'expo-auth-session';
import * as Linking from 'expo-linking';
import { isSigningOut, setIsSigningOut } from '../app/(home)/_layout';
import { router } from 'expo-router';

interface AuthContextProps {
  session: Session | null;
  user: User | null;
  profile: UserProfile | null;
  isLoaded: boolean;
  isSignedIn: boolean;
  isSigningOut: boolean;  // New property to track sign-out state
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
  const { isGuest, clearGuestMode } = useGuestUser();

  // For OAuth redirects
  const redirectUri = makeRedirectUri({
    scheme: 'com.qwertyapp.clerkexpoquickstart',
    path: 'auth/callback'
  });

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

  // Modified processOAuthUser function to handle first-time OAuth sign-ins
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

  // Modified fetchUserProfile function with fallback to create user if not found
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

  // Token cleanup helper function
  const cleanupPushToken = async () => {
    try {
      // Get stored token
      const token = await SecureStore.getItemAsync('expoPushToken');

      if (token && user) {
        console.log('Found push token to clean up');

        // Attempt to delete from database
        const { error } = await supabase
          .from('user_push_tokens')
          .delete()
          .match({ user_id: user.id, token });

        if (error) {
          console.error('Error removing push token from database:', error);
        }

        // Remove from secure storage regardless of database success
        await SecureStore.deleteItemAsync('expoPushToken');
      }
    } catch (error) {
      console.error('Push token cleanup error:', error);
      // Continue with sign out even if cleanup fails
    }
  };

  // Local storage cleanup helper function
  const cleanupLocalStorage = async () => {
    try {
      console.log('Cleaning up local storage');
      // List of keys to clean up
      const keysToClean = [
        'supabase-auth-token',
        'expoPushToken',
        'lastActiveSession',
        // Add any other auth-related keys here
      ];

      // Delete all keys in parallel
      await Promise.all(
        keysToClean.map(key =>
          SecureStore.deleteItemAsync(key)
            .catch(error => console.error(`Error deleting ${key}:`, error))
        )
      );

      console.log('Local storage cleanup completed');
    } catch (error) {
      console.error('Local storage cleanup error:', error);
    }
  };

  // Enhanced signOut function with robust error handling and retries
  const signOut = async () => {
    // Prevent multiple sign out attempts
    if (isSigningOutState) {
      console.log('Sign out already in progress, ignoring duplicate request');
      return;
    }

    try {
      // Set signing out states
      setIsSigningOutState(true);
      setIsSigningOut(true);

      // First, route to sign-in screen immediately to prevent further interactions
      router.replace('/(auth)/sign-in');

      console.log('Starting comprehensive sign out process');

      // 1. Clean up push notification token if user exists
      if (user) {
        try {
          console.log('Cleaning up push notification tokens');
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

    } catch (error) {
      console.error('Sign out process error:', error);

      // Force clean up state even if there was an error
      setSession(null);
      setUser(null);
      setProfile(null);

      // Brute force approach - if all else fails, force navigation to sign-in
      router.replace('/(auth)/sign-in');
    } finally {
      // Always reset signing out state
      setIsSigningOutState(false);
      setIsSigningOut(false);
      console.log('Sign out process completed');
    }
  };

  // Modified appleSignIn method
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
          }
        }
      }
    } catch (error) {
      console.error('Apple sign in error:', error);
      Alert.alert('Authentication Error', 'Failed to sign in with Apple');
    }
  };

const googleSignIn = async () => {
  // Guard against multiple simultaneous sign-in attempts
  if (isSigningOutState) {
    console.warn('Sign-out in progress, cannot initiate sign-in');
    return { success: false, error: new Error('Sign-out in progress') };
  }

  // State management for the UI
  const [isInProgress, setIsInProgress] = useState(false);
  let authCancelled = false;
  let authTimeoutId: NodeJS.Timeout | null = null;

  try {
    // Set in-progress state for UI feedback
    setIsInProgress(true);

    // Clear guest mode if applicable
    if (isGuest) {
      await clearGuestMode();
    }

    // Configure timeout to prevent hanging operations
    const authTimeout = new Promise<{ success: false, error: Error }>((_, reject) => {
      authTimeoutId = setTimeout(() => {
        if (!authCancelled) {
          authCancelled = true;
          reject({
            success: false,
            error: new Error('Google sign-in timed out')
          });
        }
      }, 60000); // 60-second timeout
    });

    // Step 1: Initiate OAuth flow with retry logic
    let oauthData = null;
    let oauthError = null;
    let retryCount = 0;
    const maxRetries = 3;

    while (retryCount < maxRetries && !oauthData && !authCancelled) {
      try {
        console.log(`Initiating OAuth flow (attempt ${retryCount + 1}/${maxRetries})`);

        const { data, error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: redirectUri,
            skipBrowserRedirect: true,
            queryParams: {
              // Force re-consent to avoid cached credentials issues
              prompt: retryCount > 0 ? 'consent' : 'select_account',
              // Add timestamp to prevent caching issues
              t: Date.now().toString()
            },
          },
        });

        if (error) {
          console.error(`OAuth flow error (attempt ${retryCount + 1}):`, error);
          oauthError = error;
          retryCount++;

          // Exponential backoff
          if (retryCount < maxRetries) {
            const delay = Math.min(1000 * Math.pow(2, retryCount) + Math.random() * 1000, 10000);
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        } else {
          oauthData = data;
        }
      } catch (e) {
        console.error(`Exception in OAuth flow (attempt ${retryCount + 1}):`, e);
        oauthError = e;
        retryCount++;

        // Exponential backoff
        if (retryCount < maxRetries && !authCancelled) {
          const delay = Math.min(1000 * Math.pow(2, retryCount) + Math.random() * 1000, 10000);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    // If all retries failed, throw the last error
    if (!oauthData) {
      throw oauthError || new Error('Failed to initiate Google sign-in after multiple attempts');
    }

    if (!oauthData.url) {
      throw new Error('No authorization URL returned from Supabase');
    }

    console.log("Opening auth session with URL:", oauthData.url);

    // Step 2: Open browser for authentication (with timeout protection)
    const browserPromise = WebBrowser.openAuthSessionAsync(
      oauthData.url,
      redirectUri,
      {
        showInRecents: true,
        // Force ephemeral session on iOS to prevent cookie-related issues

      }
    );

    // Use Promise.race to handle timeout
    const result = await Promise.race([
      browserPromise,
      authTimeout
    ]) as WebBrowser.WebBrowserAuthSessionResult;

    // Clear timeout if browser responded
    if (authTimeoutId) {
      clearTimeout(authTimeoutId);
      authTimeoutId = null;
    }

    console.log("WebBrowser result type:", result.type);

    // Handle user cancellation explicitly
    if (result.type === 'cancel' || result.type === 'dismiss') {
      console.log("User cancelled sign-in process");
      return { success: false, cancelled: true };
    }

    if (result.type !== 'success' || !result.url) {
      throw new Error(`Browser auth failed: ${result.type}`);
    }

    // Step 3: Multi-approach token handling - try several methods to extract and validate token
    let sessionData = null;
    let sessionError = null;

    // Method 1: Extract from URL hash or query params
    try {
      console.log("Attempting token extraction from URL");
      const url = new URL(result.url);

      // Check for tokens in hash fragment (most common)
      let accessToken = null;
      let refreshToken = null;

      if (url.hash) {
        const hashParams = new URLSearchParams(url.hash.substring(1));
        accessToken = hashParams.get('access_token');
        refreshToken = hashParams.get('refresh_token');
      }

      // Fallback: Check for tokens in query parameters
      if (!accessToken && url.searchParams.has('access_token')) {
        accessToken = url.searchParams.get('access_token');
        refreshToken = url.searchParams.get('refresh_token');
      }

      console.log("Extracted tokens:", accessToken ? "Access token found" : "No access token",
                                       refreshToken ? "/ Refresh token found" : "/ No refresh token");

      if (accessToken) {
        // Method 1: Use setSession with extracted tokens
        const { data, error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken || '',
        });

        if (error) {
          console.error("Manual setSession error:", error);
          throw error;
        }

        if (data?.session) {
          sessionData = data;
          console.log("Successfully set session using extracted tokens");
        } else {
          console.error("setSession succeeded but no session data returned");
        }
      }
    } catch (extractError) {
      console.error("Error processing authentication result:", extractError);
      sessionError = extractError;
    }

    // Method 2: If token extraction failed, try getting session directly
    if (!sessionData) {
      try {
        console.log("Token extraction failed, attempting to get current session");
        const { data, error } = await supabase.auth.getSession();

        if (error) {
          console.error("Error getting current session:", error);
          throw error;
        }

        if (data?.session) {
          sessionData = data;
          console.log("Successfully retrieved session directly");
        } else {
          console.warn("getSession succeeded but returned no session");
        }
      } catch (getSessionError) {
        console.error("Error getting current session:", getSessionError);
        sessionError = sessionError || getSessionError;
      }
    }

    // Method 3: If all else failed, try exchange code flow if present
    if (!sessionData && result.url.includes('code=')) {
      try {
        console.log("Attempting to exchange authorization code");
        // This approach is more complex and depends on your Supabase configuration
        // Implement as needed based on your specific setup
      } catch (codeExchangeError) {
        console.error("Error exchanging authorization code:", codeExchangeError);
        sessionError = sessionError || codeExchangeError;
      }
    }

    // If we have session data, update application state
    if (sessionData?.session) {
      // Step 5: Update application state
      setSession(sessionData.session);
      setUser(sessionData.session.user);

      // Step 6: Process user profile
      console.log("Processing user profile");
      const userProfile = await processOAuthUser(sessionData.session);
      if (userProfile) {
        setProfile(userProfile);
        console.log("User profile processed successfully");
      } else {
        console.warn("Failed to process user profile");
      }

      console.log("Authentication successful");
      return { success: true, user: sessionData.session.user };
    }

    // If we got here with no session data, try one final fallback
    console.log("Final fallback: checking session after short delay");
    await new Promise(resolve => setTimeout(resolve, 1000)); // Small delay to allow auth to complete

    const { data: finalSessionCheck } = await supabase.auth.getSession();
    if (finalSessionCheck?.session) {
      setSession(finalSessionCheck.session);
      setUser(finalSessionCheck.session.user);

      const userProfile = await processOAuthUser(finalSessionCheck.session);
      if (userProfile) {
        setProfile(userProfile);
      }

      return { success: true, user: finalSessionCheck.session.user };
    }

    // If we still have no session, authentication failed
    throw sessionError || new Error("Failed to authenticate after multiple approaches");

  } catch (error) {
    console.error('Google sign in error:', error);

    // Clear any timeout if still active
    if (authTimeoutId) {
      clearTimeout(authTimeoutId);
    }

    // Clean up any partial authentication state
    try {
      await supabase.auth.signOut({ scope: 'local' });
    } catch (cleanupError) {
      console.error("Error cleaning up after failed sign-in:", cleanupError);
    }

    // Provide user feedback
    Alert.alert(
      'Authentication Error',
      'Could not sign in with Google. Please try again later.'
    );

    return { success: false, error };
  } finally {
    // Always reset progress state
    setIsInProgress(false);
  }
};

  const signIn = async ({ email, password }: SignInCredentials) => {
    try {
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
      }

      return { error: null };
    } catch (error: any) {
      console.error('Sign in error:', error);
      return { error };
    }
  };

// If the admin API approach doesn't work, use this simplified approach for the signUp function
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
        isSignedIn: !!user,
        isSigningOut: isSigningOutState,
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