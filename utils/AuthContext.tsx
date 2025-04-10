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
import { useNotifications } from '@/hooks/useNotifications';

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
  const { cleanupPushToken } = useNotifications();

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
    try {
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

                // Step 7: Return explicit success with user data
                console.log("Authentication successful, returning success=true");
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
      Alert.alert('Authentication Error', 'Failed to sign in with Google');
      return { success: false, error };
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