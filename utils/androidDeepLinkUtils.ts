/**
 * Android Deep Link Utilities
 * Provides reliable deep link handling for Android devices
 */

export interface DeepLinkConfig {
  scheme: string;
  host: string;
  appStoreUrl: string;
  playStoreUrl: string;
}

export const DEEP_LINK_CONFIG: DeepLinkConfig = {
  scheme: 'fleet',
  host: 'www.fleetapp.me',
  appStoreUrl: 'https://apps.apple.com/app/6742141291',
  playStoreUrl: 'https://play.google.com/store/apps/details?id=com.qwertyapp.clerkexpoquickstart'
};

/**
 * Detects the platform and mobile status
 */
export function detectPlatform(): {
  platform: 'ios' | 'android' | 'unknown';
  isMobile: boolean;
} {
  if (typeof window === 'undefined') {
    return { platform: 'unknown', isMobile: false };
  }

  const userAgent = navigator.userAgent.toLowerCase();
  
  // Android detection
  const isAndroid = /android/i.test(userAgent);
  
  // iOS detection
  const isIOS = /iphone|ipad|ipod/i.test(userAgent) && !window.MSStream;
  
  // Mobile detection
  const isMobile = /mobile|android|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent);

  return {
    platform: isAndroid ? 'android' : isIOS ? 'ios' : 'unknown',
    isMobile
  };
}

/**
 * Attempts to open the app using Android App Links
 */
export async function attemptAndroidAppLaunch(
  deepLink: string
): Promise<boolean> {
  return new Promise((resolve) => {
    let hasAppOpened = false;
    const startTime = Date.now();
    
    // Set up visibility change listener
    const handleVisibilityChange = () => {
      if (document.hidden && !hasAppOpened) {
        hasAppOpened = true;
        resolve(true);
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Attempt to open the app
    window.location.href = deepLink;
    
    // Check after timeout
    setTimeout(() => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      
      const timeElapsed = Date.now() - startTime;
      // If more than 2.5 seconds elapsed or page is hidden, app likely opened
      if (timeElapsed > 2500 || document.hidden) {
        resolve(true);
      } else {
        resolve(false);
      }
    }, 3000);
  });
}

/**
 * Gets the appropriate deep link URL
 */
export function getDeepLink(type: 'car' | 'clip', id: string): string {
  return `${DEEP_LINK_CONFIG.scheme}://${type}s/${id}`;
}

/**
 * Gets the web URL for sharing
 */
export function getWebUrl(type: 'car' | 'clip', id: string): string {
  return `https://${DEEP_LINK_CONFIG.host}/${type}s/${id}`;
}