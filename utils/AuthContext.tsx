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
      setGlobalSigningOut(true);  // ADD THIS LINE
  
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
        setGlobalSigningOut(false);  // ADD THIS LINE
        console.log('Sign out process completed');
      }, 2000);  // CHANGE: Add delay to ensure all processes complete
    }
  };

// Enhancement 1: Improve signIn method to better handle token registration
// Location: Modify the signIn method inside AuthProvider component

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
      
      // Enhanced token handling with better recovery
      try {
        // Step 1: Get device token status
        let pushToken = await SecureStore.getItemAsync('expoPushToken');
        let tokenValidated = false;
        
        // Step 2: First, check if the token exists in database for this user
        if (pushToken) {
          // Verify if this token is correctly registered to this user
          const verification = await NotificationService.forceTokenVerification(data.user.id);
          
          if (verification.isValid) {
            console.log('Token exists and is valid, updating signed_in status if needed');
            
            // Update token status if needed
            if (verification.signedIn === false) {
              await NotificationService.markTokenAsSignedIn(data.user.id, pushToken);
            }
            
            tokenValidated = true;
          } else {
            console.log('Token exists but is not registered for this user, will register it');
            
            // Try to register the existing token to this user
            const success = await NotificationService.ensureValidTokenRegistration(data.user.id, pushToken);
            if (success) {
              console.log('Successfully registered existing token to this user');
              tokenValidated = true;
            } else {
              console.log('Failed to register existing token, will get new token');
            }
          }
        } else {
          console.log('No token in secure storage, will try to sync or register new token');
        }
        
        // Step 3: If we couldn't validate the existing token, try to sync from database
        if (!tokenValidated) {
          pushToken = await NotificationService.syncTokenFromDatabase(data.user.id);
          
          if (pushToken) {
            console.log('Successfully synced token from database');
            tokenValidated = true;
            
            // Make sure the token is marked as signed in
            await NotificationService.markTokenAsSignedIn(data.user.id, pushToken);
          } else {
            console.log('No token found in database, will register new token');
          }
        }
        
        // Step 4: If we still don't have a valid token, register a new one
        if (!tokenValidated) {
          console.log('Registering new push token for this user');
          await NotificationService.registerForPushNotificationsAsync(data.user.id, true);
        }
      } catch (tokenError) {
        console.error('Error handling push token during sign-in:', tokenError);
        // Still try a fresh registration as a fallback
        try {
          await NotificationService.registerForPushNotificationsAsync(data.user.id, true);
        } catch (e) {
          console.error('Final token registration attempt failed:', e);
        }
      }
    }

    // Wait for 1.5 seconds to show the loader
    await new Promise(resolve => setTimeout(resolve, 1500));
    
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

              // Step 7: Enhanced token registration
              try {
                // Check if we have an existing token
                let pushToken = await SecureStore.getItemAsync('expoPushToken');
                let tokenValidated = false;
                
                // First verify if token exists and is valid for this user
                if (pushToken) {
                  const verification = await NotificationService.forceTokenVerification(sessionData.session.user.id);
                  
                  if (verification.isValid) {
                    console.log('Token exists and is valid, updating status if needed');
                    
                    if (verification.signedIn === false) {
                      await NotificationService.markTokenAsSignedIn(sessionData.session.user.id, pushToken);
                    }
                    
                    tokenValidated = true;
                  } else {
                    console.log('Token exists but validation failed, will register it');
                    
                    // Try to register the existing token with this user
                    const success = await NotificationService.ensureValidTokenRegistration(
                      sessionData.session.user.id, 
                      pushToken
                    );
                    
                    if (success) {
                      console.log('Successfully registered existing token to this user');
                      tokenValidated = true;
                    }
                  }
                }
                
                // If we don't have a valid token yet, try to sync from database
                if (!tokenValidated) {
                  pushToken = await NotificationService.syncTokenFromDatabase(sessionData.session.user.id);
                  
                  if (pushToken) {
                    console.log('Successfully synced token from database');
                    await NotificationService.markTokenAsSignedIn(sessionData.session.user.id, pushToken);
                    tokenValidated = true;
                  }
                }
                
                // If we still don't have a valid token, register a new one
                if (!tokenValidated) {
                  console.log('No valid token found, registering new token');
                  await NotificationService.registerForPushNotificationsAsync(sessionData.session.user.id, true);
                }
              } catch (tokenError) {
                console.error('Error handling push token during Google sign-in:', tokenError);
                // Fallback to direct registration
                try {
                  await NotificationService.registerForPushNotificationsAsync(sessionData.session.user.id, true);
                } catch (e) {
                  console.error('Final token registration attempt failed:', e);
                }
              }
              
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
        
        // Enhanced token registration for fallback case
        try {
          const pushToken = await SecureStore.getItemAsync('expoPushToken');
          
          // If we have a token, ensure it's properly registered
          if (pushToken) {
            // First check if this token is registered for this user
            const verification = await NotificationService.forceTokenVerification(currentSession.session.user.id);
            
            if (verification.isValid) {
              await NotificationService.markTokenAsSignedIn(currentSession.session.user.id, pushToken);
            } else {
              // Try to register the token for this user
              const success = await NotificationService.ensureValidTokenRegistration(
                currentSession.session.user.id,
                pushToken
              );
              
              if (!success) {
                // If registration fails, try a fresh registration
                await NotificationService.registerForPushNotificationsAsync(currentSession.session.user.id, true);
              }
            }
          } else {
            // No token in storage, register a new one
            await NotificationService.registerForPushNotificationsAsync(currentSession.session.user.id, true);
          }
        } catch (tokenError) {
          console.error('Error handling token in fallback session case:', tokenError);
        }
        
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

// Enhancement 3: Improve appleSignIn method with better token handling
// Location: Modify the appleSignIn method inside AuthProvider component

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

          // Enhanced token handling with better recovery
          try {
            // Step 1: Check if we have an existing token
            let pushToken = await SecureStore.getItemAsync('expoPushToken');
            let tokenValidated = false;
            
            // Step 2: Verify if token exists and is valid for this user
            if (pushToken) {
              const verification = await NotificationService.forceTokenVerification(sessionData.session.user.id);
              
              if (verification.isValid) {
                console.log('Token exists and is valid for Apple sign-in, updating status if needed');
                
                // Update signed_in status if needed
                if (verification.signedIn === false) {
                  await NotificationService.markTokenAsSignedIn(sessionData.session.user.id, pushToken);
                }
                
                tokenValidated = true;
              } else {
                console.log('Token exists but validation failed for Apple sign-in');
                
                // Try to register the existing token with this user
                const success = await NotificationService.ensureValidTokenRegistration(
                  sessionData.session.user.id,
                  pushToken
                );
                
                if (success) {
                  console.log('Successfully registered existing token to this user (Apple sign-in)');
                  tokenValidated = true;
                }
              }
            }
            
            // Step 3: If we don't have a valid token, try to sync from database
            if (!tokenValidated) {
              pushToken = await NotificationService.syncTokenFromDatabase(sessionData.session.user.id);
              
              if (pushToken) {
                console.log('Successfully synced token from database for Apple sign-in');
                await NotificationService.markTokenAsSignedIn(sessionData.session.user.id, pushToken);
                tokenValidated = true;
              } else {
                console.log('No token found in database for Apple sign-in');
              }
            }
            
            // Step 4: If we still don't have a valid token, register a new one
            if (!tokenValidated) {
              console.log('Registering new push token for Apple sign-in');
              await NotificationService.registerForPushNotificationsAsync(sessionData.session.user.id, true);
            }
          } catch (tokenError) {
            console.error('Error handling push token during Apple sign-in:', tokenError);
            // Fallback to direct registration
            try {
              await NotificationService.registerForPushNotificationsAsync(sessionData.session.user.id, true);
            } catch (e) {
              console.error('Final token registration attempt failed for Apple sign-in:', e);
            }
          }
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
        try {
          await NotificationService.registerForPushNotificationsAsync(data.user.id, true);
        } catch (notificationError) {
          console.error('Error registering for push notifications during signup:', notificationError);
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