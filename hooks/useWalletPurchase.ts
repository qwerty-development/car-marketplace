import { useCallback, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import * as WebBrowser from 'expo-web-browser';
import { supabase } from '@/utils/supabase';

export interface PricingPackage {
  id: number;
  code: string;
  name: string;
  name_ar: string | null;
  description: string | null;
  description_ar: string | null;
  contents: Record<string, number>;
  price_usd: number;
  compare_at_price_usd: number | null;
  audience: 'user' | 'dealer' | 'all';
  item_validity_days: number;
  sort_order: number;
}

export type PurchaseOutcome = 'paid' | 'pending' | 'failed';

const POLL_INTERVAL_MS = 3000;
const POLL_MAX_ATTEMPTS = 20; // ~60s

export const fetchActivePackages = async (): Promise<PricingPackage[]> => {
  const { data, error } = await supabase
    .from('pricing_packages')
    .select('*')
    .eq('active', true)
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return (data ?? []) as PricingPackage[];
};

/** Filters packages to those granting a given wallet item type for a role. */
export const packagesForItemType = (
  packages: PricingPackage[] | undefined,
  itemType: 'listing' | 'featured_ad' | 'car_request',
  role: 'user' | 'dealer'
): PricingPackage[] =>
  (packages ?? []).filter(
    (pkg) =>
      pkg.contents &&
      typeof pkg.contents === 'object' &&
      Number((pkg.contents as any)[itemType]) > 0 &&
      (pkg.audience === 'all' || pkg.audience === role)
  );

/**
 * Shared Whish wallet-package checkout flow:
 *   wallet-purchase edge fn → system browser → poll wallet-purchase-status.
 * Resolves to the final outcome; invalidates the wallet query on 'paid'.
 */
export function useWalletPurchase() {
  const queryClient = useQueryClient();
  const [purchasingPkgId, setPurchasingPkgId] = useState<number | null>(null);
  const [polling, setPolling] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const pollPurchaseStatus = useCallback(
    async (externalId: number): Promise<PurchaseOutcome | 'pending'> => {
      for (let attempt = 0; attempt < POLL_MAX_ATTEMPTS; attempt++) {
        if (!mountedRef.current) return 'pending';
        try {
          const { data, error } = await supabase.functions.invoke(
            'wallet-purchase-status',
            { body: { externalId } }
          );
          if (!error && data?.status && data.status !== 'pending') {
            return data.status === 'paid' ? 'paid' : 'failed';
          }
        } catch {
          // transient network error — keep polling
        }
        await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
      }
      return 'pending';
    },
    []
  );

  const purchasePackage = useCallback(
    async (packageId: number): Promise<PurchaseOutcome> => {
      if (purchasingPkgId !== null) return 'pending';
      setPurchasingPkgId(packageId);
      try {
        const { data, error } = await supabase.functions.invoke('wallet-purchase', {
          body: { packageId },
        });
        if (error || !data?.collectUrl || !data?.externalId) {
          throw error ?? new Error('wallet-purchase returned no collectUrl');
        }

        // Whish checkout in the system browser; resolves when dismissed.
        await WebBrowser.openBrowserAsync(String(data.collectUrl));

        if (!mountedRef.current) return 'pending';
        setPolling(true);
        const status = await pollPurchaseStatus(Number(data.externalId));

        if (status === 'paid' || status === 'pending') {
          queryClient.invalidateQueries({ queryKey: ['wallet'] });
        }
        return status;
      } catch (error) {
        console.error('wallet purchase failed:', error);
        return 'failed';
      } finally {
        if (mountedRef.current) {
          setPolling(false);
          setPurchasingPkgId(null);
        }
      }
    },
    [purchasingPkgId, pollPurchaseStatus, queryClient]
  );

  return { purchasePackage, purchasingPkgId, polling };
}
