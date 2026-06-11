import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
  I18nManager,
  RefreshControl,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import Toast from 'react-native-toast-message';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/utils/supabase';
import { useTheme } from '@/utils/ThemeContext';
import { useAuth } from '@/utils/AuthContext';
import { useLanguage } from '@/utils/LanguageContext';

interface FeedRequest {
  id: number;
  make: string;
  model: string | null;
  year_min: number | null;
  year_max: number | null;
  budget_min: number | null;
  budget_max: number | null;
  notes: string | null;
  region: string;
  region_name_en: string;
  region_name_ar: string;
  created_at: string;
  expires_at: string;
  user_id: string;
  user_name: string | null;
  user_phone: string | null;
}

interface Region {
  code: string;
  name_en: string;
  name_ar: string;
  sort: number;
}

const fetchFeed = async (region: string | null): Promise<FeedRequest[]> => {
  const { data, error } = await supabase.rpc('get_car_requests_feed', {
    p_region: region,
    p_limit: 100,
    p_offset: 0,
  });
  if (error) throw error;
  return (data ?? []) as FeedRequest[];
};

const fetchRegions = async (): Promise<Region[]> => {
  const { data, error } = await supabase
    .from('regions')
    .select('*')
    .order('sort', { ascending: true });
  if (error) throw error;
  return (data ?? []) as Region[];
};

const formatRange = (min: number | null, max: number | null, prefix = ''): string | null => {
  if (min != null && max != null) return `${prefix}${min} - ${prefix}${max}`;
  if (min != null) return `≥ ${prefix}${min}`;
  if (max != null) return `≤ ${prefix}${max}`;
  return null;
};

const timeAgo = (iso: string, t: (k: string, o?: any) => string): string => {
  const hours = Math.floor((Date.now() - new Date(iso).getTime()) / 3600000);
  if (hours < 1) return t('requests.justNow');
  if (hours < 24) return t('requests.hoursAgo', { count: hours });
  return t('requests.daysAgo', { count: Math.floor(hours / 24) });
};

/**
 * Dealer car-requests feed (US-02): all active user buy-requests, newest first,
 * region filter, per-dealership dismiss (X), and contact via call / WhatsApp /
 * in-app chat. Every contact is logged via log_request_contact, which also
 * notifies the requester (US-03); chat returns the linked conversation id.
 */
export default function DealerCarRequests() {
  const { isDarkMode } = useTheme();
  const { t } = useTranslation();
  const { language } = useLanguage();
  const { user } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const isRTL = I18nManager.isRTL;

  const [regionFilter, setRegionFilter] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [contactingId, setContactingId] = useState<number | null>(null);

  const feedKey = ['car_requests', 'feed', user?.id, regionFilter];
  const { data: requests, isLoading } = useQuery<FeedRequest[]>({
    queryKey: feedKey,
    queryFn: () => fetchFeed(regionFilter),
    enabled: !!user?.id,
  });

  const { data: regions } = useQuery<Region[]>({
    queryKey: ['regions'],
    queryFn: fetchRegions,
    staleTime: Infinity,
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ['car_requests', 'feed'] });
    setRefreshing(false);
  }, [queryClient]);

  const logContact = useCallback(
    async (requestId: number, channel: 'call' | 'whatsapp' | 'chat') => {
      const { data, error } = await supabase.rpc('log_request_contact', {
        p_request_id: requestId,
        p_channel: channel,
      });
      if (error) throw error;
      return data as { success: boolean; conversation_id?: number };
    },
    []
  );

  const handleDismiss = useCallback(
    async (request: FeedRequest) => {
      // Optimistic removal — dismissals are per-dealership and silent (US-02)
      queryClient.setQueryData<FeedRequest[]>(feedKey, (old) =>
        (old ?? []).filter((r) => r.id !== request.id)
      );
      try {
        const { error } = await supabase.rpc('dismiss_car_request', {
          p_request_id: request.id,
        });
        if (error) throw error;
      } catch (error) {
        console.error('dismiss_car_request failed:', error);
        queryClient.invalidateQueries({ queryKey: ['car_requests', 'feed'] });
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [queryClient, regionFilter, user?.id]
  );

  const handleCall = useCallback(
    async (request: FeedRequest) => {
      if (!request.user_phone) {
        Toast.show({ type: 'error', text1: t('requests.noPhone') });
        return;
      }
      try {
        await Linking.openURL(`tel:${request.user_phone}`);
        logContact(request.id, 'call').catch((e) =>
          console.warn('log call contact failed:', e)
        );
      } catch (error) {
        console.error('call failed:', error);
      }
    },
    [logContact, t]
  );

  const handleWhatsApp = useCallback(
    async (request: FeedRequest) => {
      if (!request.user_phone) {
        Toast.show({ type: 'error', text1: t('requests.noPhone') });
        return;
      }
      const digits = request.user_phone.replace(/[^0-9]/g, '');
      const text = encodeURIComponent(
        t('requests.whatsappGreeting', {
          make: request.make,
          model: request.model ?? '',
        })
      );
      try {
        await Linking.openURL(`https://wa.me/${digits}?text=${text}`);
        logContact(request.id, 'whatsapp').catch((e) =>
          console.warn('log whatsapp contact failed:', e)
        );
      } catch (error) {
        console.error('whatsapp failed:', error);
      }
    },
    [logContact, t]
  );

  const handleChat = useCallback(
    async (request: FeedRequest) => {
      if (contactingId !== null) return;
      setContactingId(request.id);
      try {
        const result = await logContact(request.id, 'chat');
        if (result?.conversation_id) {
          router.push(`/(home)/(dealer)/conversations/${result.conversation_id}` as any);
        } else {
          Toast.show({ type: 'error', text1: t('requests.chatFailed') });
        }
      } catch (error) {
        console.error('chat contact failed:', error);
        Toast.show({ type: 'error', text1: t('requests.chatFailed') });
      } finally {
        setContactingId(null);
      }
    },
    [contactingId, logContact, router, t]
  );

  const renderItem = useCallback(
    ({ item }: { item: FeedRequest }) => {
      const yearRange = formatRange(item.year_min, item.year_max);
      const budgetRange = formatRange(item.budget_min, item.budget_max, '$');
      const regionName = language === 'ar' ? item.region_name_ar : item.region_name_en;

      return (
        <View
          className={`mx-4 mb-3 rounded-2xl p-4 ${isDarkMode ? 'bg-neutral-800' : 'bg-neutral-100'}`}
        >
          {/* Title row + dismiss X (top right) */}
          <View
            className="items-start justify-between"
            style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}
          >
            <View className="flex-1">
              <Text
                className={`text-base font-bold ${isDarkMode ? 'text-white' : 'text-black'}`}
                style={{ textAlign: isRTL ? 'right' : 'left' }}
              >
                {item.make}
                {item.model ? ` ${item.model}` : ''}
              </Text>
              <Text
                className={`text-xs mt-0.5 ${isDarkMode ? 'text-neutral-400' : 'text-neutral-500'}`}
                style={{ textAlign: isRTL ? 'right' : 'left' }}
              >
                {item.user_name || t('requests.aUser')} · {timeAgo(item.created_at, t)}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => handleDismiss(item)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons
                name="close"
                size={20}
                color={isDarkMode ? '#9CA3AF' : '#6B7280'}
              />
            </TouchableOpacity>
          </View>

          {/* Details */}
          <View className="mt-2 gap-1">
            {yearRange && (
              <Text
                className={`text-sm ${isDarkMode ? 'text-neutral-300' : 'text-neutral-600'}`}
                style={{ textAlign: isRTL ? 'right' : 'left' }}
              >
                {t('requests.year')}: {yearRange}
              </Text>
            )}
            {budgetRange && (
              <Text
                className={`text-sm ${isDarkMode ? 'text-neutral-300' : 'text-neutral-600'}`}
                style={{ textAlign: isRTL ? 'right' : 'left' }}
              >
                {t('requests.budget')}: {budgetRange}
              </Text>
            )}
            <Text
              className={`text-sm ${isDarkMode ? 'text-neutral-300' : 'text-neutral-600'}`}
              style={{ textAlign: isRTL ? 'right' : 'left' }}
            >
              {t('requests.region')}: {regionName}
            </Text>
            {item.notes ? (
              <Text
                className={`text-sm italic ${isDarkMode ? 'text-neutral-400' : 'text-neutral-500'}`}
                style={{ textAlign: isRTL ? 'right' : 'left' }}
                numberOfLines={3}
              >
                {item.notes}
              </Text>
            ) : null}
          </View>

          {/* Contact actions */}
          <View
            className="mt-3 gap-2"
            style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}
          >
            <TouchableOpacity
              onPress={() => handleCall(item)}
              className="flex-1 bg-green-600 rounded-xl py-2.5 items-center"
              style={{ flexDirection: isRTL ? 'row-reverse' : 'row', justifyContent: 'center' }}
            >
              <Ionicons name="call" size={16} color="#fff" />
              <Text className="text-white text-sm font-bold mx-1">{t('requests.call')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => handleWhatsApp(item)}
              className="flex-1 bg-[#25D366] rounded-xl py-2.5 items-center"
              style={{ flexDirection: isRTL ? 'row-reverse' : 'row', justifyContent: 'center' }}
            >
              <Ionicons name="logo-whatsapp" size={16} color="#fff" />
              <Text className="text-white text-sm font-bold mx-1">{t('requests.whatsapp')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => handleChat(item)}
              disabled={contactingId !== null}
              className="flex-1 bg-red rounded-xl py-2.5 items-center"
              style={{
                flexDirection: isRTL ? 'row-reverse' : 'row',
                justifyContent: 'center',
                opacity: contactingId !== null && contactingId !== item.id ? 0.6 : 1,
              }}
            >
              {contactingId === item.id ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="chatbubble-ellipses" size={16} color="#fff" />
                  <Text className="text-white text-sm font-bold mx-1">{t('requests.chat')}</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      );
    },
    [isDarkMode, isRTL, language, t, handleDismiss, handleCall, handleWhatsApp, handleChat, contactingId]
  );

  return (
    <SafeAreaView className={`flex-1 ${isDarkMode ? 'bg-black' : 'bg-white'}`} edges={['top']}>
      {/* Header */}
      <View
        className="items-center justify-between px-4 py-3"
        style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons
            name={isRTL ? 'arrow-forward' : 'arrow-back'}
            size={24}
            color={isDarkMode ? '#fff' : '#000'}
          />
        </TouchableOpacity>
        <Text className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-black'}`}>
          {t('requests.feedTitle')}
        </Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Region filter chips */}
      <View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 8, gap: 8 }}
        >
          <TouchableOpacity
            onPress={() => setRegionFilter(null)}
            className={`rounded-full px-4 py-2 ${
              regionFilter === null
                ? 'bg-red'
                : isDarkMode
                ? 'bg-neutral-800'
                : 'bg-neutral-200'
            }`}
          >
            <Text
              className={`text-sm font-semibold ${
                regionFilter === null ? 'text-white' : isDarkMode ? 'text-white' : 'text-black'
              }`}
            >
              {t('requests.allRegions')}
            </Text>
          </TouchableOpacity>
          {(regions ?? [])
            .filter((r) => r.code !== 'all_lebanon')
            .map((r) => (
              <TouchableOpacity
                key={r.code}
                onPress={() => setRegionFilter(regionFilter === r.code ? null : r.code)}
                className={`rounded-full px-4 py-2 ${
                  regionFilter === r.code
                    ? 'bg-red'
                    : isDarkMode
                    ? 'bg-neutral-800'
                    : 'bg-neutral-200'
                }`}
              >
                <Text
                  className={`text-sm font-semibold ${
                    regionFilter === r.code
                      ? 'text-white'
                      : isDarkMode
                      ? 'text-white'
                      : 'text-black'
                  }`}
                >
                  {language === 'ar' ? r.name_ar : r.name_en}
                </Text>
              </TouchableOpacity>
            ))}
        </ScrollView>
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#D55004" />
        </View>
      ) : (
        <FlatList
          data={requests ?? []}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={{ paddingVertical: 8, paddingBottom: 40 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#D55004" />
          }
          ListEmptyComponent={
            <View className="items-center justify-center py-20 px-8">
              <Ionicons
                name="file-tray-outline"
                size={56}
                color={isDarkMode ? '#525252' : '#A3A3A3'}
              />
              <Text
                className={`text-center mt-4 text-base ${
                  isDarkMode ? 'text-neutral-400' : 'text-neutral-500'
                }`}
              >
                {t('requests.feedEmpty')}
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}
