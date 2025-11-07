import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ActivityIndicator,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/utils/ThemeContext';
import { supabase } from '@/utils/supabase';
import { useTranslation } from 'react-i18next';

interface BoostInsightsData {
  total_boosted_cars: number;
  active_boosts: number;
  total_impressions: number;
  total_clicks: number;
  total_interactions: number;
  avg_ctr: number;
  total_credits_spent: number;
}

interface BoostInsightsWidgetProps {
  dealershipId: number;
}

export const BoostInsightsWidget: React.FC<BoostInsightsWidgetProps> = ({ dealershipId }) => {
  const { isDarkMode } = useTheme();
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(true);
  const [insights, setInsights] = useState<BoostInsightsData | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    fetchBoostInsights();
  }, [dealershipId]);

  const fetchBoostInsights = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .rpc('get_dealership_boost_summary', {
          p_dealership_id: dealershipId
        });

      if (error) throw error;

      if (data && data.length > 0) {
        setInsights(data[0]);
      }
    } catch (error) {
      console.error('Error fetching boost insights:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: isDarkMode ? '#1F1F1F' : '#F9FAFB' }]}>
        <ActivityIndicator size="small" color="#D55004" />
        <Text style={[styles.loadingText, { color: isDarkMode ? '#9CA3AF' : '#6B7280' }]}>
          Loading boost insights...
        </Text>
      </View>
    );
  }

  if (!insights || insights.active_boosts === 0) {
    return null; // Don't show widget if no active boosts
  }

  return (
    <View style={styles.widgetContainer}>
      <TouchableOpacity
        onPress={() => setIsExpanded(!isExpanded)}
        activeOpacity={0.8}
      >
        <LinearGradient
          colors={['#D55004', '#FF6B1A']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.headerGradient}
        >
          <View style={styles.headerContent}>
            <View style={styles.headerLeft}>
              <Ionicons name="rocket" size={24} color="white" />
              <Text style={styles.headerTitle}>Boost Performance</Text>
            </View>
            <Ionicons
              name={isExpanded ? 'chevron-up' : 'chevron-down'}
              size={20}
              color="white"
            />
          </View>
        </LinearGradient>
      </TouchableOpacity>

      {isExpanded && (
        <View style={[styles.statsContainer, { backgroundColor: isDarkMode ? '#1F1F1F' : '#FFFFFF' }]}>
          {/* Active Boosts */}
          <View style={styles.statRow}>
            <View style={styles.statItem}>
              <Ionicons name="trophy" size={20} color="#D55004" />
              <Text style={[styles.statLabel, { color: isDarkMode ? '#9CA3AF' : '#6B7280' }]}>
                Active Boosts
              </Text>
              <Text style={[styles.statValue, { color: isDarkMode ? '#FFFFFF' : '#000000' }]}>
                {insights.active_boosts}
              </Text>
            </View>
            <View style={styles.statItem}>
              <Ionicons name="eye" size={20} color="#0891B2" />
              <Text style={[styles.statLabel, { color: isDarkMode ? '#9CA3AF' : '#6B7280' }]}>
                Impressions
              </Text>
              <Text style={[styles.statValue, { color: isDarkMode ? '#FFFFFF' : '#000000' }]}>
                {insights.total_impressions.toLocaleString()}
              </Text>
            </View>
          </View>

          {/* Clicks and CTR */}
          <View style={styles.statRow}>
            <View style={styles.statItem}>
              <Ionicons name="hand-left" size={20} color="#9333EA" />
              <Text style={[styles.statLabel, { color: isDarkMode ? '#9CA3AF' : '#6B7280' }]}>
                Clicks
              </Text>
              <Text style={[styles.statValue, { color: isDarkMode ? '#FFFFFF' : '#000000' }]}>
                {insights.total_clicks.toLocaleString()}
              </Text>
            </View>
            <View style={styles.statItem}>
              <Ionicons name="trending-up" size={20} color="#059669" />
              <Text style={[styles.statLabel, { color: isDarkMode ? '#9CA3AF' : '#6B7280' }]}>
                Click Rate
              </Text>
              <Text style={[styles.statValue, { color: isDarkMode ? '#FFFFFF' : '#000000' }]}>
                {insights.avg_ctr.toFixed(1)}%
              </Text>
            </View>
          </View>

          {/* Interactions and Credits */}
          <View style={styles.statRow}>
            <View style={styles.statItem}>
              <Ionicons name="chatbubbles" size={20} color="#EA580C" />
              <Text style={[styles.statLabel, { color: isDarkMode ? '#9CA3AF' : '#6B7280' }]}>
                Interactions
              </Text>
              <Text style={[styles.statValue, { color: isDarkMode ? '#FFFFFF' : '#000000' }]}>
                {insights.total_interactions.toLocaleString()}
              </Text>
            </View>
            <View style={styles.statItem}>
              <Ionicons name="diamond" size={20} color="#F59E0B" />
              <Text style={[styles.statLabel, { color: isDarkMode ? '#9CA3AF' : '#6B7280' }]}>
                Credits Spent
              </Text>
              <Text style={[styles.statValue, { color: isDarkMode ? '#FFFFFF' : '#000000' }]}>
                {insights.total_credits_spent}
              </Text>
            </View>
          </View>

          {/* Performance Summary */}
          <View style={[styles.summaryBox, {
            backgroundColor: isDarkMode ? '#111111' : '#F9FAFB',
            borderColor: isDarkMode ? '#2D2D2D' : '#E5E7EB'
          }]}>
            <Ionicons name="information-circle" size={18} color="#D55004" />
            <Text style={[styles.summaryText, { color: isDarkMode ? '#D1D5DB' : '#4B5563' }]}>
              {insights.avg_ctr >= 5
                ? '🎉 Excellent performance! Your boosted listings are getting great engagement.'
                : insights.avg_ctr >= 2
                ? '👍 Good performance. Keep optimizing your listings for better results.'
                : '💡 Consider improving listing quality and photos to boost engagement.'}
            </Text>
          </View>

          {/* Refresh Button */}
          <TouchableOpacity
            style={styles.refreshButton}
            onPress={fetchBoostInsights}
          >
            <Ionicons name="refresh" size={16} color="#D55004" />
            <Text style={styles.refreshText}>Refresh Stats</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  widgetContainer: {
    marginHorizontal: 16,
    marginVertical: 12,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    marginHorizontal: 16,
    marginVertical: 12,
  },
  loadingText: {
    marginLeft: 12,
    fontSize: 14,
    fontWeight: '500',
  },
  headerGradient: {
    padding: 16,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 10,
  },
  statsContainer: {
    padding: 16,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    marginHorizontal: 4,
  },
  statLabel: {
    fontSize: 12,
    marginTop: 6,
    marginBottom: 4,
    textAlign: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  summaryBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 8,
    marginBottom: 12,
  },
  summaryText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    marginLeft: 8,
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  refreshText: {
    color: '#D55004',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
});
