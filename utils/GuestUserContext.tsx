// utils/GuestUserContext.tsx
import React, { createContext, useState, useContext, useEffect, useCallback, useMemo } from 'react';
import AsyncStorage from "@react-native-async-storage/async-storage";
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';
import { fireGuestStartOnce } from './safeMetaLogger';

interface GuestUserContextType {
  isGuest: boolean;
  guestId: string | null;
  setGuestMode: (isActive: boolean) => Promise<void>;
  clearGuestMode: () => Promise<void>;
}

const GuestUserContext = createContext<GuestUserContextType | undefined>(undefined);

export const GuestUserProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isGuest, setIsGuest] = useState<boolean>(false);
  const [guestId, setGuestId] = useState<string | null>(null);

  // Initialize the context by checking storage
  useEffect(() => {
    const initializeGuestState = async () => {
      try {
        const storedIsGuest = await AsyncStorage.getItem('isGuestUser');
        const storedGuestId = await AsyncStorage.getItem('guestUserId');

        if (storedIsGuest === 'true' && storedGuestId) {
          setIsGuest(true);
          setGuestId(storedGuestId);
          fireGuestStartOnce(storedGuestId);
        }
      } catch (error) {
        console.error('[GuestContext] Error loading guest state:', error);
      }
    };

    initializeGuestState();
  }, []);

  // SDK 54 FIX: Wrap functions in useCallback and memoize provider value to prevent
  // unnecessary re-renders of all consumers (AuthProvider, DeepLinkHandler, etc.)
  const setGuestMode = useCallback(async (isActive: boolean) => {
    try {
      const id = isActive ? (guestId || uuidv4()) : null;

      await AsyncStorage.setItem('isGuestUser', isActive ? 'true' : 'false');

      if (isActive && id) {
        await AsyncStorage.setItem('guestUserId', id);
      } else {
        await AsyncStorage.removeItem('guestUserId');
      }

      setIsGuest(isActive);
      setGuestId(id);

      // Only fire for a new guest session (id differs from existing guestId)
      if (isActive && id && id !== guestId) {
        fireGuestStartOnce(id);
      }
    } catch (error) {
      console.error('[GuestContext] Error setting guest mode:', error);
    }
  }, [guestId]);

  const clearGuestMode = useCallback(async () => {
    try {
      await AsyncStorage.removeItem('isGuestUser');
      await AsyncStorage.removeItem('guestUserId');
      setIsGuest(false);
      setGuestId(null);
    } catch (error) {
      console.error('Error clearing guest mode:', error);
    }
  }, []);

  const value = useMemo(() => ({
    isGuest, guestId, setGuestMode, clearGuestMode
  }), [isGuest, guestId, setGuestMode, clearGuestMode]);

  return (
    <GuestUserContext.Provider value={value}>
      {children}
    </GuestUserContext.Provider>
  );
};

export const useGuestUser = () => {
  const context = useContext(GuestUserContext);
  if (context === undefined) {
    // Return safe defaults instead of throwing during Expo Router's initial render
    return { isGuest: false, guestId: null, setGuestMode: async () => {}, clearGuestMode: async () => {} } as GuestUserContextType;
  }
  return context;
};
