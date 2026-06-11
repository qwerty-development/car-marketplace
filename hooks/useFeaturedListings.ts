import { useEffect } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/utils/supabase';

/**
 * Featured Ads (Phase 1) — data hooks.
 *
 * The 5 random featured listings are fetched ONCE PER APP ENTRY and the SAME 5
 * are reused for both the home banner carousel and the top-of-feed pinning:
 *  - stable query key ['featured', 'sale', 'entry'] + staleTime: Infinity, so
 *    navigating around never refetches (a new random set would "shuffle" the UI)
 *  - a module-level flag guards a single invalidation per JS session (cold start)
 *  - an AppState listener treats background -> active as a new "app entry" and
 *    invalidates once, which refetches the active observers only.
 */

export const FEATURED_ENTRY_KEY = ['featured', 'sale', 'entry'] as const;
export const FEATURED_ALL_KEY = ['featured', 'sale', 'all'] as const;

export interface FeaturedListing {
  id: number;
  make: string;
  model: string;
  year: number;
  price: number;
  mileage: number;
  category: string;
  condition?: string;
  transmission?: string;
  images: string[];
  status: string;
  user_id?: string | null;
  dealership_id?: number | null;
  is_boosted?: boolean;
  boost_priority?: number | null;
  boost_end_date?: string | null;
  expire_at?: string | null;
  views?: number;
  likes?: number;
  // Flattened by the get_featured_listings RPC
  dealership_name: string | null;
  dealership_logo: string | null;
  dealership_phone: string | null;
  dealership_location: string | null;
  dealership_latitude: number | null;
  dealership_longitude: number | null;
  // Added client-side to match the home feed Car shape
  seller_type?: 'user' | 'dealer';
  seller_name?: string | null;
  [key: string]: any;
}

export interface FeaturedEntryData {
  items: FeaturedListing[];
  total: number;
}

// Once-per-app-entry guards (module scope survives navigation, resets on cold start)
let entryInvalidatedThisSession = false;
let lastAppState: AppStateStatus = AppState.currentState;

const mapFeaturedRow = (row: any): FeaturedListing => {
  const isDealer = !!row.dealership_id;
  return {
    ...row,
    seller_type: isDealer ? 'dealer' : 'user',
    seller_name: isDealer ? row.dealership_name : null,
  };
};

const fetchFeaturedEntry = async (): Promise<FeaturedEntryData> => {
  const { data, error } = await supabase.rpc('get_featured_listings', {
    p_listing_type: 'sale',
    p_limit: 5,
    p_random: true,
  });
  if (error) throw error;

  const items = (Array.isArray(data) ? data : []).map(mapFeaturedRow);

  // Cheap head count so the banner knows whether "View all" should show.
  let total = items.length;
  try {
    const { count } = await supabase
      .from('cars')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'available')
      .eq('is_boosted', true)
      .gt('boost_end_date', new Date().toISOString());
    if (typeof count === 'number') total = count;
  } catch {
    // Non-critical — fall back to items.length
  }

  return { items, total };
};

const fetchAllFeatured = async (): Promise<FeaturedListing[]> => {
  const { data, error } = await supabase.rpc('get_featured_listings', {
    p_listing_type: 'sale',
    p_limit: 100,
    p_random: false,
  });
  if (error) throw error;
  return (Array.isArray(data) ? data : []).map(mapFeaturedRow);
};

/**
 * The 5 random featured listings for the current app entry (banner + pinning).
 * Works for guests (RPC is granted to anon).
 */
export function useFeaturedListings() {
  const queryClient = useQueryClient();

  useEffect(() => {
    // Cold start: one targeted invalidation per JS session in case stale data
    // is still in the cache (e.g. fast refresh in dev).
    if (!entryInvalidatedThisSession) {
      entryInvalidatedThisSession = true;
      if (queryClient.getQueryState(FEATURED_ENTRY_KEY)?.dataUpdatedAt) {
        queryClient.invalidateQueries({ queryKey: FEATURED_ENTRY_KEY });
      }
    }

    // Foreground after background = a new "app entry" → refresh the random 5.
    const sub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active' && /background|inactive/.test(lastAppState)) {
        queryClient.invalidateQueries({ queryKey: FEATURED_ENTRY_KEY });
      }
      lastAppState = nextState;
    });
    return () => sub.remove();
  }, [queryClient]);

  return useQuery<FeaturedEntryData>({
    queryKey: FEATURED_ENTRY_KEY,
    queryFn: fetchFeaturedEntry,
    staleTime: Infinity,
    gcTime: Infinity,
  });
}

/**
 * Full featured list, newest feature first ("View all" screen). Refreshed via a
 * targeted invalidation on mount (global config disables refetchOnMount).
 */
export function useAllFeaturedListings() {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (queryClient.getQueryState(FEATURED_ALL_KEY)?.dataUpdatedAt) {
      queryClient.invalidateQueries({ queryKey: FEATURED_ALL_KEY });
    }
  }, [queryClient]);

  return useQuery<FeaturedListing[]>({
    queryKey: FEATURED_ALL_KEY,
    queryFn: fetchAllFeatured,
  });
}

/** Invalidate every featured-ads related query (entry + view-all). */
export function invalidateFeaturedQueries(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ['featured'] });
}
