// utils/useFavorites.tsx
import React, {
  createContext,
  useState,
  useContext,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from 'react';
import { supabase } from '@/utils/supabase';
import { useAuth } from '@/utils/AuthContext';
import { useGuestUser } from '@/utils/GuestUserContext';
import { useRouter } from 'expo-router';
import AuthRequiredModal from '@/components/AuthRequiredModal';

interface FavoritesContextType {
  favorites: number[];
  favoritesSet: Set<number>;
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

  // Identity-stable Set for O(1) membership checks. Recreated only when the
  // favorites array changes. Consumers use `favoritesSet.has(id)` to keep
  // React.memo(CarCard) equal across renders.
  const favoritesSet = useMemo(() => new Set(favorites), [favorites]);

  // Keep the latest favorites in a ref so callbacks below stay reference-stable.
  const favoritesRef = useRef(favorites);
  useEffect(() => {
    favoritesRef.current = favorites;
  }, [favorites]);

  const fetchFavorites = useCallback(async () => {
    if (!user || isGuest) return;

    try {
      const { data, error } = await supabase
        .from('users')
        .select('favorite')
        .eq('id', user.id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
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
  }, [user, isGuest]);

  useEffect(() => {
    if (user && !isGuest) {
      fetchFavorites();
    }
  }, [user, isGuest, fetchFavorites]);

  const isFavorite = useCallback(
    (carId: number) => favoritesRef.current.includes(carId),
    []
  );

  const toggleFavorite = useCallback(
    async (carId: number): Promise<number> => {
      if (isGuest) {
        setShowAuthModal(true);
        return 0;
      }

      if (!user) return 0;

      const current = favoritesRef.current;
      const actionIsUnlike = current.includes(carId);

      try {
        const { data, error } = await supabase.rpc('toggle_car_like', {
          car_id: carId,
          p_user_id: user.id,
        });

        if (error) {
          console.error('Error toggling favorite:', error);
          return 0;
        }

        const newFavorites = actionIsUnlike
          ? current.filter((id) => id !== carId)
          : [...current, carId];
        setFavorites(newFavorites);

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
    },
    [user, isGuest]
  );

  const value = useMemo(
    () => ({ favorites, favoritesSet, toggleFavorite, isFavorite }),
    [favorites, favoritesSet, toggleFavorite, isFavorite]
  );

  return (
    <FavoritesContext.Provider value={value}>
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
