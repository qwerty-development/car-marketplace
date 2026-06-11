import { useEffect, useMemo, useRef } from 'react';
import type { ViewToken } from 'react-native';
import { supabase } from '@/utils/supabase';
import { useAuth } from '@/utils/AuthContext';
import { useGuestUser } from '@/utils/GuestUserContext';

export type ImpressionListingType = 'sale' | 'rent' | 'plate';

interface BufferedEvent {
  listing_type: ImpressionListingType;
  listing_id: number;
}

const FLUSH_INTERVAL_MS = 30000;
const FLUSH_BATCH_SIZE = 50;
const MAX_RPC_BATCH = 100;

// Module-level state: one buffer + per-session dedupe shared by all lists, so
// the same card seen in the banner and the feed counts once per session.
const seenThisSession = new Set<string>();
const buffer: BufferedEvent[] = [];
let flushTimer: ReturnType<typeof setInterval> | null = null;
let currentViewerId: string | null = null;
let flushing = false;

async function flush(): Promise<void> {
  if (flushing || buffer.length === 0) return;
  flushing = true;
  try {
    const batch = buffer.splice(0, MAX_RPC_BATCH);
    const { error } = await supabase.rpc('record_listing_impressions', {
      p_events: batch,
      p_viewer_id: currentViewerId,
    });
    if (error) {
      // Backend not migrated yet or transient failure — drop silently
      // (impressions are best-effort analytics, never user-facing).
      console.warn('record_listing_impressions failed (dropped):', error.message);
    }
  } catch (error) {
    console.warn('record_listing_impressions error (dropped):', error);
  } finally {
    flushing = false;
  }
}

function enqueue(type: ImpressionListingType, id: number) {
  const key = `${type}:${id}`;
  if (seenThisSession.has(key)) return;
  seenThisSession.add(key);
  buffer.push({ listing_type: type, listing_id: id });
  if (buffer.length >= FLUSH_BATCH_SIZE) {
    void flush();
  }
}

/**
 * Impression tracking for listing FlatLists (US-15): items visible >= 500ms
 * are buffered with per-session dedupe and flushed in batches (50 events or
 * every 30s) to the record_listing_impressions RPC. Works for guests too
 * (AsyncStorage guest UUID).
 *
 * Usage: spread the returned `viewabilityConfigCallbackPairs` onto the FlatList
 * and make sure each rendered item carries a numeric `id`.
 */
export function useImpressionTracker(listingType: ImpressionListingType = 'sale') {
  const { user } = useAuth();
  const { guestId } = useGuestUser();

  // Keep the module-level viewer id current (auth id wins over guest UUID)
  useEffect(() => {
    currentViewerId = user?.id ?? guestId ?? null;
  }, [user?.id, guestId]);

  // Global flush interval — started once, shared across screens
  useEffect(() => {
    if (!flushTimer) {
      flushTimer = setInterval(() => {
        void flush();
      }, FLUSH_INTERVAL_MS);
    }
    return () => {
      // Flush whatever is pending when a tracked screen unmounts
      void flush();
    };
  }, []);

  const listingTypeRef = useRef(listingType);
  listingTypeRef.current = listingType;

  // FlatList requires stable identities for viewability props
  const onViewableItemsChangedRef = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      for (const token of viewableItems) {
        const id = Number((token.item as any)?.id);
        if (token.isViewable && Number.isFinite(id) && id > 0) {
          enqueue(listingTypeRef.current, id);
        }
      }
    }
  );

  const viewabilityConfigCallbackPairs = useMemo(
    () => [
      {
        viewabilityConfig: {
          itemVisiblePercentThreshold: 50,
          minimumViewTime: 500,
        },
        onViewableItemsChanged: onViewableItemsChangedRef.current,
      },
    ],
    []
  );

  return { viewabilityConfigCallbackPairs };
}
