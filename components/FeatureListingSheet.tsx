import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  Pressable,
  I18nManager,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as WebBrowser from 'expo-web-browser';
import Toast from 'react-native-toast-message';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/utils/supabase';
import { useTheme } from '@/utils/ThemeContext';
import { useAuth } from '@/utils/AuthContext';
import { useLanguage } from '@/utils/LanguageContext';

export type FeatureListingType = 'sale' | 'rent' | 'plate';

interface FeatureListingSheetProps {
  visible: boolean;
  onClose: () => void;
  listingType: FeatureListingType;
  listingId: number | string;
  onSuccess?: () => void;
}

interface PricingPackage {
  id: number;
  code: string;
  name: string;
  name_ar: string | null;
  contents: Record<string, number>;
  price_usd: number;
  compare_at_price_usd: number | null;
  audience: 'user' | 'dealer' | 'all';
  item_validity_days: number;
}

interface WalletSummary {
  summary?: {
    featured_ad?: { active: number; next_expiry: string | null };
    [key: string]: any;
  };
  items?: any[];
}

const POLL_INTERVAL_MS = 3000;
const POLL_MAX_ATTEMPTS = 20; // ~60s

const fetchWallet = async (): Promise<WalletSummary> => {
  const { data, error } = await supabase.rpc('get_my_wallet');
  if (error) throw error;
  return (data ?? {}) as WalletSummary;
};

const fetchPackages = async (): Promise<PricingPackage[]> => {
  const { data, error } = await supabase
    .from('pricing_packages')
    .select('*')
    .eq('active', true)
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return (data ?? []) as PricingPackage[];
};

/**
 * Bottom sheet for featuring a listing (8 days boost):
 *  1. If the wallet has an active featured_ad item → confirm consumes it via
 *     apply_featured_ad RPC.
 *  2. Otherwise (or on reason 'no_item') shows purchasable featured_ad
 *     packages → Whish checkout in the system browser → polls
 *     wallet-purchase-status → on 'paid' auto-applies the feature.
 * Auth-gated: only listing owners ever see the entry buttons; renders nothing
 * for signed-out users.
 */
export default function FeatureListingSheet({
  visible,
  onClose,
  listingType,
  listingId,
  onSuccess,
}: FeatureListingSheetProps) {
  const { isDarkMode } = useTheme();
  const { t } = useTranslation();
  const { language } = useLanguage();
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();
  const isRTL = I18nManager.isRTL;

  const [showPackages, setShowPackages] = useState(false);
  const [applying, setApplying] = useState(false);
  const [purchasingPkgId, setPurchasingPkgId] = useState<number | null>(null);
  const [polling, setPolling] = useState(false);
  const mountedRef = useRef(true);
  const prevVisibleRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const walletKey = ['wallet', user?.id];

  const { data: wallet, isLoading: walletLoading } = useQuery<WalletSummary>({
    queryKey: walletKey,
    queryFn: fetchWallet,
    enabled: visible && !!user?.id,
  });

  const { data: packages, isLoading: packagesLoading } = useQuery<PricingPackage[]>({
    queryKey: ['pricing_packages'],
    queryFn: fetchPackages,
    enabled: visible && !!user?.id,
  });

  // Refresh the wallet each time the sheet opens (targeted invalidation —
  // global config disables refetchOnMount).
  useEffect(() => {
    if (visible && !prevVisibleRef.current) {
      setShowPackages(false);
      if (queryClient.getQueryState(walletKey)?.dataUpdatedAt) {
        queryClient.invalidateQueries({ queryKey: walletKey });
      }
    }
    prevVisibleRef.current = visible;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, user?.id]);

  const availableCount = wallet?.summary?.featured_ad?.active ?? 0;

  const role = profile?.role === 'dealer' ? 'dealer' : 'user';
  const featuredPackages = (packages ?? []).filter(
    (pkg) =>
      pkg.contents &&
      typeof pkg.contents === 'object' &&
      Number((pkg.contents as any).featured_ad) > 0 &&
      (pkg.audience === 'all' || pkg.audience === role)
  );

  /** Runs apply_featured_ad; returns true on success. */
  const applyFeature = useCallback(async (): Promise<boolean> => {
    const { data, error } = await supabase.rpc('apply_featured_ad', {
      p_listing_type: listingType,
      p_listing_id: Number(listingId),
    });
    if (error) throw error;

    if (data?.success) {
      Toast.show({ type: 'success', text1: t('featured.applied') });
      queryClient.invalidateQueries({ queryKey: ['featured'] });
      queryClient.invalidateQueries({ queryKey: ['wallet'] });
      onSuccess?.();
      onClose();
      return true;
    }

    switch (data?.reason) {
      case 'no_item':
        setShowPackages(true);
        break;
      case 'not_owner':
        Toast.show({ type: 'error', text1: t('featured.notOwner') });
        break;
      case 'listing_not_active':
        Toast.show({ type: 'error', text1: t('featured.listingNotActive') });
        break;
      case 'not_found':
        Toast.show({ type: 'error', text1: t('featured.notFound') });
        break;
      default:
        Toast.show({ type: 'error', text1: t('featured.applyFailed') });
    }
    return false;
  }, [listingType, listingId, t, queryClient, onSuccess, onClose]);

  const handleApply = useCallback(async () => {
    if (applying) return;
    setApplying(true);
    try {
      await applyFeature();
    } catch (error) {
      console.error('apply_featured_ad failed:', error);
      Toast.show({ type: 'error', text1: t('featured.applyFailed') });
    } finally {
      if (mountedRef.current) setApplying(false);
    }
  }, [applying, applyFeature, t]);

  const pollPurchaseStatus = useCallback(
    async (externalId: number): Promise<string> => {
      for (let attempt = 0; attempt < POLL_MAX_ATTEMPTS; attempt++) {
        if (!mountedRef.current) return 'pending';
        try {
          const { data, error } = await supabase.functions.invoke(
            'wallet-purchase-status',
            { body: { externalId } }
          );
          if (!error && data?.status && data.status !== 'pending') {
            return String(data.status);
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

  const handleBuyPackage = useCallback(
    async (pkg: PricingPackage) => {
      if (purchasingPkgId !== null || applying) return;
      setPurchasingPkgId(pkg.id);
      try {
        const { data, error } = await supabase.functions.invoke('wallet-purchase', {
          body: { packageId: pkg.id },
        });
        if (error || !data?.collectUrl || !data?.externalId) {
          throw error ?? new Error('wallet-purchase returned no collectUrl');
        }

        // Whish checkout in the system browser; resolves when dismissed.
        await WebBrowser.openBrowserAsync(String(data.collectUrl));

        if (!mountedRef.current) return;
        setPolling(true);
        const status = await pollPurchaseStatus(Number(data.externalId));
        if (!mountedRef.current) return;
        setPolling(false);

        if (status === 'paid') {
          queryClient.invalidateQueries({ queryKey: ['wallet'] });
          Toast.show({ type: 'success', text1: t('featured.purchaseSuccess') });
          // Auto-apply the freshly purchased item to this listing.
          setApplying(true);
          try {
            await applyFeature();
          } finally {
            if (mountedRef.current) setApplying(false);
          }
        } else if (status === 'pending') {
          queryClient.invalidateQueries({ queryKey: ['wallet'] });
          Toast.show({ type: 'info', text1: t('featured.paymentPending') });
        } else {
          Toast.show({ type: 'error', text1: t('featured.paymentFailed') });
        }
      } catch (error) {
        console.error('wallet-purchase failed:', error);
        Toast.show({ type: 'error', text1: t('featured.purchaseFailed') });
      } finally {
        if (mountedRef.current) {
          setPolling(false);
          setPurchasingPkgId(null);
        }
      }
    },
    [purchasingPkgId, applying, pollPurchaseStatus, queryClient, t, applyFeature]
  );

  // Guests / signed-out users never reach this sheet (entry buttons are
  // owner-only), but guard anyway.
  if (!user?.id) return null;

  const busy = applying || purchasingPkgId !== null || polling;
  const showPackagesView = showPackages || (!walletLoading && availableCount === 0);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={busy ? undefined : onClose}
    >
      <View className="flex-1 justify-end">
        {/* Backdrop */}
        <Pressable
          className="absolute inset-0 bg-black/50"
          onPress={busy ? undefined : onClose}
        />

        <View
          className={`rounded-t-3xl ${isDarkMode ? 'bg-neutral-900' : 'bg-white'} px-5 pt-5 pb-8`}
        >
          {/* Header */}
          <View
            className="items-center justify-between mb-4"
            style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}
          >
            <View
              className="items-center"
              style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}
            >
              <Ionicons
                name="trophy"
                size={22}
                color="#D55004"
                style={isRTL ? { marginLeft: 8 } : { marginRight: 8 }}
              />
              <Text
                className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-black'}`}
              >
                {t('featured.featureListing')}
              </Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              disabled={busy}
              className="p-1"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons
                name="close"
                size={24}
                color={isDarkMode ? '#FFFFFF' : '#000000'}
              />
            </TouchableOpacity>
          </View>

          {/* Duration info */}
          <View
            className={`rounded-2xl p-4 mb-4 ${isDarkMode ? 'bg-neutral-800' : 'bg-orange-50'}`}
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              alignItems: 'center',
            }}
          >
            <Ionicons
              name="flash"
              size={20}
              color="#D55004"
              style={isRTL ? { marginLeft: 10 } : { marginRight: 10 }}
            />
            <Text
              className={`flex-1 text-sm ${isDarkMode ? 'text-neutral-200' : 'text-neutral-800'}`}
              style={{ textAlign: isRTL ? 'right' : 'left' }}
            >
              {t('featured.duration8Days')}
            </Text>
          </View>

          {/* Body */}
          {walletLoading || (showPackagesView && packagesLoading) ? (
            <View className="py-8 items-center">
              <ActivityIndicator size="large" color="#D55004" />
            </View>
          ) : polling ? (
            <View className="py-8 items-center">
              <ActivityIndicator size="large" color="#D55004" />
              <Text
                className={`mt-4 text-sm ${isDarkMode ? 'text-neutral-300' : 'text-neutral-600'}`}
              >
                {t('featured.paymentPending')}
              </Text>
            </View>
          ) : !showPackagesView ? (
            // Wallet has an available featured_ad item
            <>
              <View
                className="items-center mb-5"
                style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}
              >
                <Ionicons
                  name="wallet-outline"
                  size={18}
                  color={isDarkMode ? '#9CA3AF' : '#6B7280'}
                  style={isRTL ? { marginLeft: 8 } : { marginRight: 8 }}
                />
                <Text
                  className={`text-sm ${isDarkMode ? 'text-neutral-300' : 'text-neutral-600'}`}
                >
                  {t('featured.availableInWallet', { count: availableCount })}
                </Text>
              </View>
              <TouchableOpacity
                onPress={handleApply}
                disabled={busy}
                className="bg-red py-4 rounded-xl items-center"
                style={{ opacity: busy ? 0.6 : 1 }}
              >
                {applying ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text className="text-white font-bold text-base">
                    {t('featured.useFromWallet')}
                  </Text>
                )}
              </TouchableOpacity>
            </>
          ) : (
            // No wallet item — show purchasable packages
            <>
              <Text
                className={`text-sm mb-3 ${isDarkMode ? 'text-neutral-300' : 'text-neutral-600'}`}
                style={{ textAlign: isRTL ? 'right' : 'left' }}
              >
                {t('featured.choosePackage')}
              </Text>
              {featuredPackages.length === 0 ? (
                <Text
                  className={`text-center py-6 ${isDarkMode ? 'text-neutral-400' : 'text-neutral-500'}`}
                >
                  {t('featured.noPackages')}
                </Text>
              ) : (
                featuredPackages.map((pkg) => (
                  <TouchableOpacity
                    key={pkg.id}
                    onPress={() => handleBuyPackage(pkg)}
                    disabled={busy}
                    className={`rounded-2xl border p-4 mb-3 ${
                      isDarkMode
                        ? 'border-neutral-700 bg-neutral-800'
                        : 'border-neutral-200 bg-neutral-50'
                    }`}
                    style={{
                      flexDirection: isRTL ? 'row-reverse' : 'row',
                      alignItems: 'center',
                      opacity: busy && purchasingPkgId !== pkg.id ? 0.5 : 1,
                    }}
                  >
                    <View className="flex-1">
                      <Text
                        className={`text-base font-semibold ${isDarkMode ? 'text-white' : 'text-black'}`}
                        style={{ textAlign: isRTL ? 'right' : 'left' }}
                      >
                        {language === 'ar' && pkg.name_ar ? pkg.name_ar : pkg.name}
                      </Text>
                      <View
                        className="items-center mt-1"
                        style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}
                      >
                        <Text className="text-red font-bold text-base">
                          ${Number(pkg.price_usd).toFixed(2)}
                        </Text>
                        {pkg.compare_at_price_usd != null &&
                          Number(pkg.compare_at_price_usd) > Number(pkg.price_usd) && (
                            <Text
                              className={`text-xs mx-2 ${isDarkMode ? 'text-neutral-400' : 'text-neutral-500'}`}
                              style={{ textDecorationLine: 'line-through' }}
                            >
                              ${Number(pkg.compare_at_price_usd).toFixed(2)}
                            </Text>
                          )}
                      </View>
                    </View>
                    {purchasingPkgId === pkg.id ? (
                      <ActivityIndicator size="small" color="#D55004" />
                    ) : (
                      <View className="bg-red rounded-full px-4 py-2">
                        <Text className="text-white text-sm font-bold">
                          {t('featured.buyPackage')}
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>
                ))
              )}
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}
