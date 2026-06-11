import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  I18nManager,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Toast from 'react-native-toast-message';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/utils/supabase';
import { useTheme } from '@/utils/ThemeContext';
import { useAuth } from '@/utils/AuthContext';
import { useLanguage } from '@/utils/LanguageContext';
import {
  useWalletPurchase,
  fetchActivePackages,
  PricingPackage,
} from '@/hooks/useWalletPurchase';

type ItemType = 'listing' | 'featured_ad' | 'car_request';

interface WalletItem {
  id: number;
  item_type: ItemType;
  status: 'active' | 'consumed' | 'expired' | 'revoked' | 'refunded';
  unit_price_usd: number;
  expires_at: string;
  consumed_at: string | null;
  consumed_listing_type: string | null;
  consumed_listing_id: number | null;
  source: 'online_purchase' | 'admin_grant' | 'admin_refund';
  created_at: string;
}

interface WalletData {
  summary?: Partial<Record<ItemType, { active: number; next_expiry: string | null }>>;
  items?: WalletItem[];
}

interface OwnedCounts {
  activeListings: number;
  activeFeatured: number;
}

const fetchWallet = async (): Promise<WalletData> => {
  const { data, error } = await supabase.rpc('get_my_wallet');
  if (error) throw error;
  return (data ?? {}) as WalletData;
};

const ITEM_ICONS: Record<ItemType, keyof typeof Ionicons.glyphMap> = {
  listing: 'pricetag',
  featured_ad: 'trophy',
  car_request: 'search-circle',
};

const STATUS_COLORS: Record<WalletItem['status'], string> = {
  active: '#22C55E',
  consumed: '#3B82F6',
  expired: '#9CA3AF',
  revoked: '#EF4444',
  refunded: '#F59E0B',
};

/**
 * Wallet screen content shared by user and dealer (US-08/09/10/11):
 * remaining items per type, owned active/featured listing counts, the item
 * list (type + status + expiry labels), and online package purchase.
 * Dealer extras: offline subscription info header.
 */
export default function WalletView({ role }: { role: 'user' | 'dealer' }) {
  const { isDarkMode } = useTheme();
  const { t } = useTranslation();
  const { language } = useLanguage();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isRTL = I18nManager.isRTL;
  const { purchasePackage, purchasingPkgId, polling } = useWalletPurchase();
  const [refreshing, setRefreshing] = useState(false);

  const walletKey = ['wallet', user?.id];
  const { data: wallet, isLoading } = useQuery<WalletData>({
    queryKey: walletKey,
    queryFn: fetchWallet,
    enabled: !!user?.id,
  });

  const { data: packages } = useQuery<PricingPackage[]>({
    queryKey: ['pricing_packages'],
    queryFn: fetchActivePackages,
    enabled: !!user?.id,
  });

  // Owned listing counts (US-08): active listings + currently featured ones
  const { data: owned } = useQuery<OwnedCounts>({
    queryKey: ['wallet', 'owned_counts', user?.id, role],
    queryFn: async () => {
      if (role === 'dealer') {
        const { data: dealership } = await supabase
          .from('dealerships')
          .select('id')
          .eq('user_id', user!.id)
          .maybeSingle();
        if (!dealership?.id) return { activeListings: 0, activeFeatured: 0 };
        const [sale, rent] = await Promise.all([
          supabase
            .from('cars')
            .select('id, is_boosted, boost_end_date')
            .eq('dealership_id', dealership.id)
            .eq('status', 'available'),
          supabase
            .from('cars_rent')
            .select('id, is_boosted, boost_end_date')
            .eq('dealership_id', dealership.id)
            .eq('status', 'available'),
        ]);
        const rows = [...(sale.data ?? []), ...(rent.data ?? [])];
        return {
          activeListings: rows.length,
          activeFeatured: rows.filter(
            (r: any) => r.is_boosted && r.boost_end_date && new Date(r.boost_end_date) > new Date()
          ).length,
        };
      }
      const { data: cars } = await supabase
        .from('cars')
        .select('id, is_boosted, boost_end_date')
        .eq('user_id', user!.id)
        .eq('status', 'available');
      const rows = cars ?? [];
      return {
        activeListings: rows.length,
        activeFeatured: rows.filter(
          (r: any) => r.is_boosted && r.boost_end_date && new Date(r.boost_end_date) > new Date()
        ).length,
      };
    },
    enabled: !!user?.id,
  });

  // Dealer subscription header (US-10)
  const { data: subscription } = useQuery<{ subscription_end_date: string | null } | null>({
    queryKey: ['wallet', 'subscription', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('dealerships')
        .select('subscription_end_date')
        .eq('user_id', user!.id)
        .maybeSingle();
      return data ?? null;
    },
    enabled: !!user?.id && role === 'dealer',
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ['wallet'] });
    setRefreshing(false);
  }, [queryClient]);

  const handleBuy = useCallback(
    async (pkg: PricingPackage) => {
      const outcome = await purchasePackage(pkg.id);
      if (outcome === 'paid') {
        Toast.show({ type: 'success', text1: t('wallet.purchaseSuccess') });
      } else if (outcome === 'pending') {
        Toast.show({ type: 'info', text1: t('wallet.paymentPending') });
      } else {
        Toast.show({ type: 'error', text1: t('wallet.paymentFailed') });
      }
    },
    [purchasePackage, t]
  );

  const rolePackages = useMemo(
    () =>
      (packages ?? []).filter((pkg) => pkg.audience === 'all' || pkg.audience === role),
    [packages, role]
  );

  const items = wallet?.items ?? [];
  const summary = wallet?.summary ?? {};
  const busy = purchasingPkgId !== null || polling;
  const textAlign = isRTL ? ('right' as const) : ('left' as const);

  const formatDate = useCallback(
    (iso: string | null | undefined): string => {
      if (!iso) return '—';
      return new Date(iso).toLocaleDateString(language === 'ar' ? 'ar' : 'en', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    },
    [language]
  );

  if (!user?.id) return null;

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" color="#D55004" />
      </View>
    );
  }

  const summaryCard = (type: ItemType) => {
    const entry = summary[type];
    return (
      <View
        key={type}
        className={`flex-1 rounded-2xl p-3 ${isDarkMode ? 'bg-neutral-800' : 'bg-neutral-100'}`}
      >
        <Ionicons name={ITEM_ICONS[type]} size={20} color="#D55004" />
        <Text
          className={`text-2xl font-bold mt-1 ${isDarkMode ? 'text-white' : 'text-black'}`}
        >
          {entry?.active ?? 0}
        </Text>
        <Text
          className={`text-xs ${isDarkMode ? 'text-neutral-400' : 'text-neutral-500'}`}
          numberOfLines={2}
        >
          {t(`wallet.itemTypes.${type}`)}
        </Text>
        {entry?.next_expiry ? (
          <Text className={`text-[10px] mt-1 ${isDarkMode ? 'text-neutral-500' : 'text-neutral-400'}`}>
            {t('wallet.nextExpiry', { date: formatDate(entry.next_expiry) })}
          </Text>
        ) : null}
      </View>
    );
  };

  return (
    <ScrollView
      className="flex-1"
      contentContainerStyle={{ paddingBottom: 60 }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#D55004" />
      }
    >
      {/* Dealer subscription header */}
      {role === 'dealer' && (
        <View
          className={`mx-4 mt-2 rounded-2xl p-4 ${isDarkMode ? 'bg-neutral-800' : 'bg-orange-50'}`}
          style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center' }}
        >
          <Ionicons
            name="ribbon"
            size={22}
            color="#D55004"
            style={isRTL ? { marginLeft: 10 } : { marginRight: 10 }}
          />
          <View className="flex-1">
            <Text
              className={`font-semibold ${isDarkMode ? 'text-white' : 'text-black'}`}
              style={{ textAlign }}
            >
              {t('wallet.subscription')}
            </Text>
            <Text
              className={`text-sm mt-0.5 ${isDarkMode ? 'text-neutral-300' : 'text-neutral-600'}`}
              style={{ textAlign }}
            >
              {subscription?.subscription_end_date
                ? t('wallet.subscriptionUntil', {
                    date: formatDate(subscription.subscription_end_date),
                  })
                : t('wallet.noSubscription')}
            </Text>
          </View>
        </View>
      )}

      {/* Remaining wallet items */}
      <Text
        className={`mx-4 mt-4 mb-2 text-base font-bold ${isDarkMode ? 'text-white' : 'text-black'}`}
        style={{ textAlign }}
      >
        {t('wallet.remaining')}
      </Text>
      <View className="mx-4 gap-3" style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}>
        {(['listing', 'featured_ad', 'car_request'] as ItemType[]).map(summaryCard)}
      </View>

      {/* Owned listings overview (US-08) */}
      <View className="mx-4 mt-3 gap-3" style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}>
        <View
          className={`flex-1 rounded-2xl p-3 ${isDarkMode ? 'bg-neutral-800' : 'bg-neutral-100'}`}
        >
          <Text className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-black'}`}>
            {owned?.activeListings ?? 0}
          </Text>
          <Text className={`text-xs ${isDarkMode ? 'text-neutral-400' : 'text-neutral-500'}`}>
            {t('wallet.activeListings')}
          </Text>
        </View>
        <View
          className={`flex-1 rounded-2xl p-3 ${isDarkMode ? 'bg-neutral-800' : 'bg-neutral-100'}`}
        >
          <Text className="text-2xl font-bold text-red">{owned?.activeFeatured ?? 0}</Text>
          <Text className={`text-xs ${isDarkMode ? 'text-neutral-400' : 'text-neutral-500'}`}>
            {t('wallet.activeFeatured')}
          </Text>
        </View>
      </View>

      {/* Buy packages (US-09 / US-11) */}
      <Text
        className={`mx-4 mt-6 mb-2 text-base font-bold ${isDarkMode ? 'text-white' : 'text-black'}`}
        style={{ textAlign }}
      >
        {t('wallet.buyMore')}
      </Text>
      {polling ? (
        <View className="py-8 items-center">
          <ActivityIndicator size="large" color="#D55004" />
          <Text className={`mt-3 text-sm ${isDarkMode ? 'text-neutral-300' : 'text-neutral-600'}`}>
            {t('wallet.paymentPending')}
          </Text>
        </View>
      ) : rolePackages.length === 0 ? (
        <Text className={`mx-4 py-4 ${isDarkMode ? 'text-neutral-400' : 'text-neutral-500'}`}>
          {t('wallet.noPackages')}
        </Text>
      ) : (
        rolePackages.map((pkg) => (
          <TouchableOpacity
            key={pkg.id}
            onPress={() => handleBuy(pkg)}
            disabled={busy}
            className={`mx-4 rounded-2xl border p-4 mb-3 ${
              isDarkMode ? 'border-neutral-700 bg-neutral-800' : 'border-neutral-200 bg-neutral-50'
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
                style={{ textAlign }}
              >
                {language === 'ar' && pkg.name_ar ? pkg.name_ar : pkg.name}
              </Text>
              <View className="items-center mt-1" style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}>
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
                <Text className={`text-xs mx-1 ${isDarkMode ? 'text-neutral-500' : 'text-neutral-400'}`}>
                  · {t('wallet.validityDays', { count: pkg.item_validity_days })}
                </Text>
              </View>
            </View>
            {purchasingPkgId === pkg.id ? (
              <ActivityIndicator size="small" color="#D55004" />
            ) : (
              <View className="bg-red rounded-full px-4 py-2">
                <Text className="text-white text-sm font-bold">{t('wallet.buy')}</Text>
              </View>
            )}
          </TouchableOpacity>
        ))
      )}

      {/* Item history */}
      <Text
        className={`mx-4 mt-6 mb-2 text-base font-bold ${isDarkMode ? 'text-white' : 'text-black'}`}
        style={{ textAlign }}
      >
        {t('wallet.items')}
      </Text>
      {items.length === 0 ? (
        <Text className={`mx-4 py-4 ${isDarkMode ? 'text-neutral-400' : 'text-neutral-500'}`}>
          {t('wallet.noItems')}
        </Text>
      ) : (
        items.map((item) => (
          <View
            key={item.id}
            className={`mx-4 rounded-xl p-3 mb-2 ${isDarkMode ? 'bg-neutral-800' : 'bg-neutral-100'}`}
            style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center' }}
          >
            <View
              className="rounded-full p-2"
              style={{ backgroundColor: 'rgba(213, 80, 4, 0.12)' }}
            >
              <Ionicons name={ITEM_ICONS[item.item_type]} size={18} color="#D55004" />
            </View>
            <View className={`flex-1 ${isRTL ? 'mr-3' : 'ml-3'}`}>
              <Text
                className={`text-sm font-semibold ${isDarkMode ? 'text-white' : 'text-black'}`}
                style={{ textAlign }}
              >
                {t(`wallet.itemTypes.${item.item_type}`)}
                {item.unit_price_usd > 0 ? ` · $${Number(item.unit_price_usd).toFixed(2)}` : ''}
              </Text>
              <Text
                className={`text-xs mt-0.5 ${isDarkMode ? 'text-neutral-400' : 'text-neutral-500'}`}
                style={{ textAlign }}
              >
                {t(`wallet.sources.${item.source}`)} ·{' '}
                {item.status === 'active'
                  ? t('wallet.expiresOn', { date: formatDate(item.expires_at) })
                  : formatDate(item.consumed_at ?? item.expires_at)}
              </Text>
            </View>
            <View
              className="rounded-full px-2.5 py-1"
              style={{ backgroundColor: `${STATUS_COLORS[item.status]}22` }}
            >
              <Text
                className="text-xs font-bold"
                style={{ color: STATUS_COLORS[item.status] }}
              >
                {t(`wallet.statuses.${item.status}`)}
              </Text>
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );
}
