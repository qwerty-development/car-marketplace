/**
 * Cache Statistics Panel
 * 
 * Displays real-time cache performance metrics including:
 * - Cache hits/misses
 * - Egress saved
 * - Hit rate
 * - Query times
 * - Memory usage
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/utils/ThemeContext';
import { cacheLogger } from '@/utils/cacheLogger';
import { getCacheStats } from '@/utils/supabaseCache';

interface CacheStatsPanelProps {
  visible?: boolean;
  onToggle?: () => void;
}

export default function CacheStatsPanel({ visible: controlledVisible, onToggle }: CacheStatsPanelProps) {
  const { isDarkMode } = useTheme();
  const [internalVisible, setInternalVisible] = useState(false);
  const [stats, setStats] = useState(cacheLogger.getFormattedStats());
  const [cacheInfo, setCacheInfo] = useState({ memoryEntries: 0, persistentEntries: 0, memorySize: 0 });
  const [slideAnim] = useState(new Animated.Value(-300));

  const visible = controlledVisible !== undefined ? controlledVisible : internalVisible;
  const toggleVisible = () => {
    const newVisible = !visible;
    if (controlledVisible === undefined) {
      setInternalVisible(newVisible);
    }
    onToggle?.();
    
    Animated.spring(slideAnim, {
      toValue: newVisible ? 0 : -300,
      useNativeDriver: true,
      tension: 50,
      friction: 8,
    }).start();
  };

  useEffect(() => {
    // Update stats every second
    const interval = setInterval(() => {
      setStats(cacheLogger.getFormattedStats());
      getCacheStats().then(setCacheInfo).catch(console.error);
    }, 1000);

    // Initial animation
    Animated.spring(slideAnim, {
      toValue: visible ? 0 : -300,
      useNativeDriver: true,
      tension: 50,
      friction: 8,
    }).start();

    return () => clearInterval(interval);
  }, [visible, slideAnim]);

  const getHitRateColor = (hitRate: number) => {
    if (hitRate >= 80) return '#4CAF50'; // Green
    if (hitRate >= 50) return '#FF9800'; // Orange
    return '#F44336'; // Red
  };

  const StatRow = ({ label, value, icon, color }: { label: string; value: string; icon: string; color?: string }) => (
    <View style={[styles.statRow, { borderBottomColor: isDarkMode ? '#333' : '#E0E0E0' }]}>
      <View style={styles.statLeft}>
        <Ionicons name={icon as any} size={18} color={color || (isDarkMode ? '#FFF' : '#000')} />
        <Text style={[styles.statLabel, { color: isDarkMode ? '#CCC' : '#666' }]}>{label}</Text>
      </View>
      <Text style={[styles.statValue, { color: isDarkMode ? '#FFF' : '#000' }]}>{value}</Text>
    </View>
  );

  if (!visible) {
    return (
      <TouchableOpacity
        style={[styles.toggleButton, { backgroundColor: isDarkMode ? '#1A1A1A' : '#FFF' }]}
        onPress={toggleVisible}
      >
        <Ionicons name="stats-chart" size={20} color={isDarkMode ? '#FFF' : '#000'} />
        <Text style={[styles.toggleText, { color: isDarkMode ? '#FFF' : '#000' }]}>Cache Stats</Text>
      </TouchableOpacity>
    );
  }

  return (
    <>
      <Animated.View
        style={[
          styles.panel,
          {
            backgroundColor: isDarkMode ? '#1A1A1A' : '#FFF',
            borderColor: isDarkMode ? '#333' : '#E0E0E0',
            transform: [{ translateX: slideAnim }],
          },
        ]}
      >
        <View style={[styles.header, { borderBottomColor: isDarkMode ? '#333' : '#E0E0E0' }]}>
          <View style={styles.headerLeft}>
            <Ionicons name="stats-chart" size={24} color="#D55004" />
            <Text style={[styles.headerTitle, { color: isDarkMode ? '#FFF' : '#000' }]}>Cache Performance</Text>
          </View>
          <TouchableOpacity onPress={toggleVisible} style={styles.closeButton}>
            <Ionicons name="close" size={24} color={isDarkMode ? '#FFF' : '#000'} />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Hit Rate */}
          <View style={[styles.section, { backgroundColor: isDarkMode ? '#222' : '#F5F5F5' }]}>
            <Text style={[styles.sectionTitle, { color: isDarkMode ? '#FFF' : '#000' }]}>Hit Rate</Text>
            <View style={styles.hitRateContainer}>
              <Text
                style={[
                  styles.hitRateValue,
                  { color: getHitRateColor(stats.hitRate) },
                ]}
              >
                {stats.hitRate.toFixed(1)}%
              </Text>
              <View style={styles.hitRateBar}>
                <View
                  style={[
                    styles.hitRateFill,
                    {
                      width: `${stats.hitRate}%`,
                      backgroundColor: getHitRateColor(stats.hitRate),
                    },
                  ]}
                />
              </View>
            </View>
          </View>

          {/* Query Stats */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: isDarkMode ? '#FFF' : '#000' }]}>Query Statistics</Text>
            <StatRow label="Total Queries" value={stats.totalQueries.toString()} icon="list" />
            <StatRow
              label="Cache Hits"
              value={stats.cacheHits.toString()}
              icon="checkmark-circle"
              color="#4CAF50"
            />
            <StatRow
              label="Cache Misses"
              value={stats.cacheMisses.toString()}
              icon="close-circle"
              color="#F44336"
            />
          </View>

          {/* Egress Savings */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: isDarkMode ? '#FFF' : '#000' }]}>Egress Savings</Text>
            <StatRow
              label="Data Saved"
              value={stats.egressSavedFormatted}
              icon="download-outline"
              color="#4CAF50"
            />
            <StatRow
              label="Total Data"
              value={stats.totalDataSizeFormatted}
              icon="cloud-download"
            />
            <StatRow
              label="Cached Data"
              value={stats.cachedDataSizeFormatted}
              icon="save-outline"
            />
            {stats.totalDataSize > 0 && (
              <View style={styles.savingsPercentage}>
                <Text style={[styles.savingsText, { color: isDarkMode ? '#CCC' : '#666' }]}>
                  Savings: {((stats.egressSaved / stats.totalDataSize) * 100).toFixed(1)}%
                </Text>
              </View>
            )}
          </View>

          {/* Performance */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: isDarkMode ? '#FFF' : '#000' }]}>Performance</Text>
            <StatRow label="Avg Query Time" value={`${stats.avgQueryTime}ms`} icon="time-outline" />
            <StatRow label="Avg Cached Time" value={`${stats.avgCachedTime}ms`} icon="flash-outline" />
            <StatRow
              label="Speedup"
              value={`${stats.speedup}x`}
              icon="rocket-outline"
              color="#4CAF50"
            />
          </View>

          {/* Cache Storage */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: isDarkMode ? '#FFF' : '#000' }]}>Cache Storage</Text>
            <StatRow
              label="Memory Entries"
              value={cacheInfo.memoryEntries.toString()}
              icon="cube-outline"
            />
            <StatRow
              label="Persistent Entries"
              value={cacheInfo.persistentEntries.toString()}
              icon="hardware-chip-outline"
            />
          </View>

          {/* Reset Button */}
          <TouchableOpacity
            style={[styles.resetButton, { backgroundColor: '#D55004' }]}
            onPress={() => {
              cacheLogger.reset();
              setStats(cacheLogger.getFormattedStats());
            }}
          >
            <Ionicons name="refresh" size={18} color="#FFF" />
            <Text style={styles.resetButtonText}>Reset Stats</Text>
          </TouchableOpacity>
        </ScrollView>
      </Animated.View>

      {/* Overlay */}
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={toggleVisible}
      />
    </>
  );
}

const styles = StyleSheet.create({
  toggleButton: {
    position: 'absolute',
    top: 100,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    zIndex: 1000,
  },
  toggleText: {
    marginLeft: 6,
    fontSize: 12,
    fontWeight: '600',
  },
  panel: {
    position: 'absolute',
    top: 100,
    right: 0,
    width: 300,
    maxHeight: '80%',
    borderWidth: 1,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: -2, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 10,
    zIndex: 1001,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    zIndex: 1000,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    marginLeft: 8,
    fontSize: 18,
    fontWeight: 'bold',
  },
  closeButton: {
    padding: 4,
  },
  content: {
    maxHeight: 500,
  },
  section: {
    padding: 16,
    borderRadius: 8,
    margin: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  statLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  statLabel: {
    marginLeft: 8,
    fontSize: 14,
  },
  statValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  hitRateContainer: {
    alignItems: 'center',
    marginTop: 8,
  },
  hitRateValue: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  hitRateBar: {
    width: '100%',
    height: 8,
    backgroundColor: '#E0E0E0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  hitRateFill: {
    height: '100%',
    borderRadius: 4,
  },
  savingsPercentage: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  savingsText: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  resetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    margin: 16,
    borderRadius: 8,
  },
  resetButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
});

