// utils/useFavorites.tsx
import React, { createContext, useState, useContext, useEffect } from 'react';
import { supabase } from '@/utils/supabase';
import { useAuth } from '@/utils/AuthContext';
import { useGuestUser } from '@/utils/GuestUserContext';
import { useRouter } from 'expo-router';
import AuthRequiredModal from '@/components/AuthRequiredModal';

interface FavoritesContextType {
  favorites: number[];
  toggleFavorite: (carId: number) => Promise<number>;
  isFavorite: (carId: number) => boolean;
}

const FavoritesContext = createContext<FavoritesContextType | undefined>(undefined);

export const FavoritesProvider: React.FC<{ children: React.ReactNode }> = ({
  children
}) => {
  const [favorites, setFavorites] = useState<number[]>([]);
  const { user } = useAuth();
  const { isGuest, guestId } = useGuestUser();
  const router = useRouter();
  const [showAuthModal, setShowAuthModal] = useState(false);

  useEffect(() => {
    // Fetch favorites only for authenticated users
    if (user && !isGuest) {
      fetchFavorites();
    }
  }, [user, isGuest]);

  const fetchFavorites = async () => {
    if (!user || isGuest) return;

    try {
      const { data, error } = await supabase
        .from('users')
        .select('favorite')
        .eq('id', user.id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // User doesn't exist yet, initialize with empty favorites
          setFavorites([]);
        } else {
          console.error('Error fetching favorites:', error);
        }
      } else {
        setFavorites(data?.favorite || []);
      }
    } catch (error) {
      console.error('Error fetching favorites:', error);
    }
  };

  const toggleFavorite = async (carId: number): Promise<number> => {
    // Check if user is a guest, and show auth prompt if they are
    if (isGuest) {
      setShowAuthModal(true);
      return 0;
    }

    // Proceed with favorite toggle for authenticated users
    if (!user) return 0;

    try {
      const { data, error } = await supabase.rpc('toggle_car_like', {
        car_id: carId,
        user_id: user.id
      });

      if (error) {
        console.error('Error toggling favorite:', error);
        return 0;
      }

      // Update local favorites
      const newFavorites = isFavorite(carId)
        ? favorites.filter(id => id !== carId)
        : [...favorites, carId];
      setFavorites(newFavorites);

      // Update user's favorites in the database
      const { error: updateError } = await supabase
        .from('users')
        .update({ favorite: newFavorites })
        .eq('id', user.id);

      if (updateError) {
        console.error('Error updating user favorites:', updateError);
      }

      return data as number;
    } catch (error) {
      console.error('Unexpected error in toggleFavorite:', error);
      return 0;
    }
  };

  const isFavorite = (carId: number) => favorites.includes(carId);

  return (
    <FavoritesContext.Provider
      value={{ favorites, toggleFavorite, isFavorite }}>
      {children}
      <AuthRequiredModal
        isVisible={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        featureName="add cars to favorites"
      />
    </FavoritesContext.Provider>
  );
};

export const useFavorites = () => {
  const context = useContext(FavoritesContext);
  if (context === undefined) {
    throw new Error('useFavorites must be used within a FavoritesProvider');
  }
  return context;
};