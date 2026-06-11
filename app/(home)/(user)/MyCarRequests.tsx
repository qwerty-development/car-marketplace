import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  I18nManager,
  RefreshControl,
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
import CarRequestFormModal from '@/components/CarRequestFormModal';

interface CarRequest {
  id: number;
  make: string;
  model: string | null;
  year_min: number | null;
  year_max: number | null;
  budget_min: number | null;
  budget_max: number | null;
  notes: string | null;
  region: string;
  status: 'active' | 'expired' | 'removed';
  paid: boolean;
  created_at: string;
  expires_at: string;
}

const fetchMyRequests = async (): Promise<CarRequest[]> => {
  const { data, error } = await supabase
    .from('car_requests')
    .select('*')
    .neq('status', 'removed')
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data ?? []) as CarRequest[];
};

const formatRange = (
  min: number | null,
  max: number | null,
  prefix = ''
): string | null => {
  if (min != null && max != null) return `${prefix}${min} - ${prefix}${max}`;
  if (min != null) return `≥ ${prefix}${min}`;
  if (max != null) return `≤ ${prefix}${max}`;
  return null;
};

const daysLeft = (expiresAt: string): number =>
  Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86400000));

/**
 * "My Car Requests" (US-01): the user's submitted buy-requests with status and
 * 7-day expiry countdown, delete action, and the creation form entry point.
 */
export default function MyCarRequests() {
  const { isDarkMode } = useTheme();
  const { t } = useTranslation();
  const { user } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const isRTL = I18nManager.isRTL;

  const [formVisible, setFormVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const queryKey = ['car_requests', 'mine', user?.id];
  const { data: requests, isLoading } = useQuery<CarRequest[]>({
    queryKey,
    queryFn: fetchMyRequests,
    enabled: !!user?.id,
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ['car_requests'] });
    setRefreshing(false);
  }, [queryClient]);

  const handleDelete = useCallback(
    (request: CarRequest) => {
      Alert.alert(t('requests.deleteTitle'), t('requests.deleteConfirm'), [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('requests.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase.rpc('remove_car_request', {
                p_request_id: request.id,
              });
              if (error) throw error;
              queryClient.invalidateQueries({ queryKey: ['car_requests'] });
              Toast.show({ type: 'success', text1: t('requests.deleted') });
            } catch (error) {
              console.error('remove_car_request failed:', error);
              Toast.show({ type: 'error', text1: t('requests.deleteFailed') });
            }
          },
        },
      ]);
    },
    [t, queryClient]
  );

  const renderItem = useCallback(
    ({ item }: { item: CarRequest }) => {
      const yearRange = formatRange(item.year_min, item.year_max);
      const budgetRange = formatRange(item.budget_min, item.budget_max, '$');
      const isActive = item.status === 'active' && daysLeft(item.expires_at) > 0;
      const remaining = daysLeft(item.expires_at);

      return (
        <View
          className={`mx-4 mb-3 rounded-2xl p-4 ${isDarkMode ? 'bg-neutral-800' : 'bg-neutral-100'}`}
        >
          <View
            className="items-center justify-between"
            style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}
          >
            <Text
              className={`text-base font-bold flex-1 ${isDarkMode ? 'text-white' : 'text-black'}`}
              style={{ textAlign: isRTL ? 'right' : 'left' }}
              numberOfLines={1}
            >
              {item.make}
              {item.model ? ` ${item.model}` : ''}
            </Text>
            <View
              className={`rounded-full px-3 py-1 ${
                isActive ? 'bg-green-500/15' : 'bg-neutral-500/15'
              }`}
            >
              <Text
                className={`text-xs font-bold ${isActive ? 'text-green-600' : 'text-neutral-500'}`}
              >
                {isActive
                  ? t('requests.activeDaysLeft', { count: remaining })
                  : t('requests.expired')}
              </Text>
            </View>
          </View>

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
              {t('requests.region')}: {t(`requests.regions.${item.region}`, item.region)}
            </Text>
            {item.notes ? (
              <Text
                className={`text-sm italic ${isDarkMode ? 'text-neutral-400' : 'text-neutral-500'}`}
                style={{ textAlign: isRTL ? 'right' : 'left' }}
                numberOfLines={2}
              >
                {item.notes}
              </Text>
            ) : null}
          </View>

          {isActive && (
            <TouchableOpacity
              onPress={() => handleDelete(item)}
              className="mt-3 self-end"
              style={{ alignSelf: isRTL ? 'flex-start' : 'flex-end' }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <View
                className="items-center"
                style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}
              >
                <Ionicons name="trash-outline" size={16} color="#EF4444" />
                <Text className="text-red-500 text-sm font-semibold mx-1">
                  {t('requests.delete')}
                </Text>
              </View>
            </TouchableOpacity>
          )}
        </View>
      );
    },
    [isDarkMode, isRTL, t, handleDelete]
  );

  return (
    <SafeAreaView
      className={`flex-1 ${isDarkMode ? 'bg-black' : 'bg-white'}`}
      edges={['top']}
    >
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
          {t('requests.myRequests')}
        </Text>
        <View style={{ width: 24 }} />
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
          contentContainerStyle={{ paddingVertical: 8, paddingBottom: 120 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#D55004"
            />
          }
          ListEmptyComponent={
            <View className="items-center justify-center py-20 px-8">
              <Ionicons
                name="search-circle-outline"
                size={56}
                color={isDarkMode ? '#525252' : '#A3A3A3'}
              />
              <Text
                className={`text-center mt-4 text-base ${
                  isDarkMode ? 'text-neutral-400' : 'text-neutral-500'
                }`}
              >
                {t('requests.emptyState')}
              </Text>
            </View>
          }
        />
      )}

      {/* New request CTA */}
      <View className="absolute bottom-8 left-0 right-0 px-6">
        <TouchableOpacity
          onPress={() => setFormVisible(true)}
          className="bg-red py-4 rounded-2xl items-center"
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            justifyContent: 'center',
          }}
        >
          <Ionicons name="add" size={20} color="#fff" />
          <Text className="text-white font-bold text-base mx-1">
            {t('requests.newRequest')}
          </Text>
        </TouchableOpacity>
        <Text
          className={`text-xs text-center mt-2 ${
            isDarkMode ? 'text-neutral-500' : 'text-neutral-400'
          }`}
        >
          {t('requests.freeQuotaNote')}
        </Text>
      </View>

      <CarRequestFormModal
        visible={formVisible}
        onClose={() => setFormVisible(false)}
        onSubmitted={() => queryClient.invalidateQueries({ queryKey: ['car_requests'] })}
      />
    </SafeAreaView>
  );
}
