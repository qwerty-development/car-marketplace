import { useEffect, useRef } from 'react';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import Toast from 'react-native-toast-message';

const FALLBACK_SLOW_GEN = ['2g', '3g', 'unknown'];
const SPEED_THRESHOLD = 1.5;            
const DEFAULT_COOLDOWN = 30_000;       

export const useSlowConnectionToast = (
  cooldownMs: number = DEFAULT_COOLDOWN
) => {
  const lastShown = useRef(0);

  /** Decide whether we consider this state “slow” */
  const isSlow = (state: NetInfoState): { slow: boolean; speed?: number } => {
    const { isConnected, isInternetReachable, type, details } = state;
    if (!isConnected || !isInternetReachable) return { slow: false };

    const downlink = (details as any)?.downlink;
    if (typeof downlink === 'number') {
      return { slow: downlink < SPEED_THRESHOLD, speed: downlink };
    }

    // 2) Fallback: cellular gen / expensive flag
    const slowFallback =
      (type === 'cellular' &&
        FALLBACK_SLOW_GEN.includes(details?.cellularGeneration as string)) ||
      details?.isConnectionExpensive;

    return { slow: !!slowFallback };
  };

  /** Show the toast (throttled) */
  const maybeWarn = (state: NetInfoState) => {
    const { slow, speed } = isSlow(state);
    if (!slow) return;

    const now = Date.now();
    if (now - lastShown.current < cooldownMs) return;

    Toast.show({
      type: 'info',
      text1: 'Slow connection detected',
      text2:
        speed !== undefined
          ? `Current speed ≈ ${speed.toFixed(1)} Mbps`
          : 'Some parts of Fleet may take a while…',
      visibilityTime: 4000,
      position: 'top',
    });
    lastShown.current = now;
  };

  useEffect(() => {
    // Initial probe
    NetInfo.fetch().then(maybeWarn).catch(() => {});

    // Subscribe to future changes
    const sub = NetInfo.addEventListener(maybeWarn);
    return () => sub();
  }, [cooldownMs]);
};
