import { supabase } from '@/utils/supabase';

type EventType = 'impression' | 'click';
type ViewerType = 'user' | 'guest';

interface ViewerInfo {
  viewerId: string;
  viewerType: ViewerType;
}

/**
 * Resolves the viewer identity from auth user or guest context.
 * Returns null if neither is available (tracking should be skipped).
 */
export function getViewerInfo(
  userId: string | undefined | null,
  guestId: string | undefined | null
): ViewerInfo | null {
  if (userId) {
    return { viewerId: userId, viewerType: 'user' };
  }
  if (guestId) {
    return { viewerId: guestId, viewerType: 'guest' };
  }
  return null;
}

/**
 * Track a banner event (impression or click) via SECURITY DEFINER RPC.
 * Fire-and-forget — never throws, never blocks UI.
 */
export function trackBannerEvent(
  bannerId: string | number,
  viewer: ViewerInfo,
  eventType: EventType
): void {
  (async () => {
    try {
      const { error } = await supabase.rpc('track_banner_event', {
        p_banner_id: Number(bannerId),
        p_viewer_id: viewer.viewerId,
        p_viewer_type: viewer.viewerType,
        p_event_type: eventType,
      });
      if (error) {
        console.debug('[BannerAnalytics] track_banner_event failed:', error.message);
      }
    } catch {
      // Silently fail — analytics must never break the UI
    }
  })();
}

/**
 * Track an ad banner event (impression or click) via SECURITY DEFINER RPC.
 * Fire-and-forget — never throws, never blocks UI.
 */
export function trackAdBannerEvent(
  adBannerId: number,
  viewer: ViewerInfo,
  eventType: EventType
): void {
  (async () => {
    try {
      const { error } = await supabase.rpc('track_ad_banner_event', {
        p_ad_banner_id: adBannerId,
        p_viewer_id: viewer.viewerId,
        p_viewer_type: viewer.viewerType,
        p_event_type: eventType,
      });
      if (error) {
        console.debug('[BannerAnalytics] track_ad_banner_event failed:', error.message);
      }
    } catch {
      // Silently fail — analytics must never break the UI
    }
  })();
}
