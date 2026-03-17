import { useCallback, useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useSegments } from 'expo-router';
import { endSession, sendHeartbeat } from '@/utils/analytics';

const HEARTBEAT_INTERVAL_MS = 2 * 60 * 1000;

interface UseActivityTrackerOptions {
  enabled: boolean;
}

export function useActivityTracker({ enabled }: UseActivityTrackerOptions): void {
  const segments = useSegments();
  const segmentsRef = useRef(segments);
  const enabledRef = useRef(enabled);
  const appStateRef = useRef(AppState.currentState);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasActiveSessionRef = useRef(false);

  useEffect(() => {
    segmentsRef.current = segments;
  });

  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);

  const getCurrentPath = useCallback((): string => {
    const currentSegments = segmentsRef.current;
    if (!currentSegments) {
      return 'root';
    }
    const path = currentSegments.filter(Boolean).join('/');
    return path || 'root';
  }, []);

  const stopHeartbeat = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const stopSession = useCallback(() => {
    stopHeartbeat();
    if (hasActiveSessionRef.current) {
      endSession();
      hasActiveSessionRef.current = false;
    }
  }, [stopHeartbeat]);

  const startHeartbeat = useCallback(() => {
    stopHeartbeat();
    const path = getCurrentPath();
    sendHeartbeat(path);
    hasActiveSessionRef.current = true;

    intervalRef.current = setInterval(() => {
      sendHeartbeat(getCurrentPath());
    }, HEARTBEAT_INTERVAL_MS);
  }, [getCurrentPath, stopHeartbeat]);

  const segmentsKey = segments.join('/');

  useEffect(() => {
    if (!enabled) {
      stopSession();
      return;
    }

    if (appStateRef.current === 'active') {
      startHeartbeat();
    }

    return () => {
      stopHeartbeat();
    };
  }, [enabled, startHeartbeat, stopHeartbeat, stopSession]);

  useEffect(() => {
    if (!enabled || appStateRef.current !== 'active') {
      return;
    }
    sendHeartbeat(getCurrentPath());
    hasActiveSessionRef.current = true;
  }, [enabled, getCurrentPath, segmentsKey]);

  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      const previousState = appStateRef.current;
      appStateRef.current = nextAppState;

      if (
        previousState === 'active' &&
        (nextAppState === 'inactive' || nextAppState === 'background')
      ) {
        stopSession();
        return;
      }

      if (
        previousState !== 'active' &&
        nextAppState === 'active' &&
        enabledRef.current
      ) {
        startHeartbeat();
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription.remove();
      stopSession();
    };
  }, [startHeartbeat, stopSession]);
}
