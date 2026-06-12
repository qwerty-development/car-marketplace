import React from 'react';
import { View, Text, I18nManager } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/utils/supabase';
import { useTheme } from '@/utils/ThemeContext';

interface TrendingRow {
  week_start: string;
  rank: number;
  make: string;
  model: string;
  event_count: number;
}

/**
 * "Trending this week" (US-17): the top 2 most-viewed make+model combinations
 * across the whole app over the trailing 7 days, rebuilt weekly by the
 * refresh_market_trending cron — market insight for dealers, no specific
 * listing exposed. Renders nothing until data exists (early weeks can be
 * sparse per client note).
 */
export default function TrendingSection() {
  const { isDarkMode } = useTheme();
  const { t } = useTranslation();
  const isRTL = I18nManager.isRTL;

  const { data: rows } = useQuery<TrendingRow[]>({
    queryKey: ['market_trending'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('market_trending')
        .select('*')
        .order('rank', { ascending: true })
        .limit(2);
      if (error) throw error;
      return (data ?? []) as TrendingRow[];
    },
  });

  if (!rows || rows.length === 0) return null;

  return (
    <View
      className={`mx-4 mb-3 rounded-2xl p-4 ${isDarkMode ? 'bg-neutral-900' : 'bg-orange-50'}`}
      style={{
        borderWidth: 1,
        borderColor: isDarkMode ? 'rgba(213, 80, 4, 0.3)' : 'rgba(213, 80, 4, 0.2)',
      }}
    >
      <View
        className="items-center mb-2"
        style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}
      >
        <Ionicons
          name="flame"
          size={18}
          color="#D55004"
          style={isRTL ? { marginLeft: 6 } : { marginRight: 6 }}
        />
        <Text className={`text-base font-bold ${isDarkMode ? 'text-white' : 'text-black'}`}>
          {t('trending.title')}
        </Text>
      </View>
      {rows.map((row) => (
        <View
          key={`${row.week_start}-${row.rank}`}
          className="items-center py-1.5"
          style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}
        >
          <View
            className="rounded-full items-center justify-center"
            style={{
              width: 22,
              height: 22,
              backgroundColor: row.rank === 1 ? '#D55004' : 'rgba(213, 80, 4, 0.25)',
            }}
          >
            <Text
              style={{
                color: row.rank === 1 ? '#fff' : '#D55004',
                fontSize: 11,
                fontWeight: '800',
              }}
            >
              {row.rank}
            </Text>
          </View>
          <Text
            className={`flex-1 text-sm font-semibold ${isDarkMode ? 'text-white' : 'text-black'}`}
            style={isRTL ? { marginRight: 10, textAlign: 'right' } : { marginLeft: 10 }}
            numberOfLines={1}
          >
            {[row.make, row.model].filter(Boolean).join(' ')}
          </Text>
          <View
            className="items-center"
            style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}
          >
            <Ionicons
              name="eye-outline"
              size={13}
              color={isDarkMode ? '#9CA3AF' : '#6B7280'}
            />
            <Text
              className={`text-xs mx-1 ${isDarkMode ? 'text-neutral-400' : 'text-neutral-500'}`}
            >
              {t('trending.views', { count: row.event_count })}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}
