// utils/GuestUserContext.tsx
import React, { createContext, useState, useContext, useEffect } from 'react';
import AsyncStorage from "@react-native-async-storage/async-storage";
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';

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
        }
      } catch (error) {
        console.error('Error loading guest state:', error);
      }
    };

    initializeGuestState();
  }, []);

  const setGuestMode = async (isActive: boolean) => {
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
    } catch (error) {
      console.error('Error setting guest mode:', error);
    }
  };

  const clearGuestMode = async () => {
    try {
      await AsyncStorage.removeItem('isGuestUser');
      await AsyncStorage.removeItem('guestUserId');
      setIsGuest(false);
      setGuestId(null);
    } catch (error) {
      console.error('Error clearing guest mode:', error);
    }
  };

  return (
    <GuestUserContext.Provider value={{ isGuest, guestId, setGuestMode, clearGuestMode }}>
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