import React, { useCallback, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  I18nManager,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/utils/ThemeContext';
import CompactCarCard from '@/components/CompactCarCard';
import { useFeaturedListings, FeaturedListing } from '@/hooks/useFeaturedListings';

/**
 * Horizontal "Featured" carousel for the user home feed.
 * Renders the same 5 random featured cars fetched once per app entry
 * (see useFeaturedListings). Hides itself when there is nothing featured.
 * Guest-safe: browsing featured cars requires no auth.
 */
function FeaturedCarousel() {
  const { isDarkMode } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  // SDK 54: useRouter returns a new ref every render — keep a stable ref for callbacks
  const routerRef = useRef(router);
  routerRef.current = router;
  const isRTL = I18nManager.isRTL;

  const { data } = useFeaturedListings();
  const items = data?.items ?? [];
  const total = data?.total ?? 0;

  const handleCardPress = useCallback((car: FeaturedListing) => {
    routerRef.current.push({
      pathname: '/(home)/(user)/CarDetails',
      params: { carId: car.id },
    });
  }, []);

  const handleViewAll = useCallback(() => {
    routerRef.current.push('/(home)/(user)/FeaturedListings');
  }, []);

  const renderItem = useCallback(
    ({ item }: { item: FeaturedListing }) => (
      <CompactCarCard
        car={item as any}
        isDarkMode={isDarkMode}
        onPress={() => handleCardPress(item)}
      />
    ),
    [isDarkMode, handleCardPress]
  );

  const keyExtractor = useCallback(
    (item: FeaturedListing) => `featured-${item.id}`,
    []
  );

  if (items.length === 0) return null;

  return (
    <View style={styles.container}>
      <View style={[styles.header, isRTL && styles.headerRTL]}>
        <View style={[styles.titleRow, isRTL && styles.headerRTL]}>
          <Ionicons
            name="trophy"
            size={18}
            color="#D55004"
            style={isRTL ? styles.iconRTL : styles.icon}
          />
          <Text
            style={[styles.title, { color: isDarkMode ? '#FFFFFF' : '#000000' }]}
          >
            {t('featured.title')}
          </Text>
        </View>
        {total > items.length && (
          <TouchableOpacity
            onPress={handleViewAll}
            style={[styles.viewAllButton, isRTL && styles.headerRTL]}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.viewAllText}>{t('featured.viewAll')}</Text>
            <Ionicons
              name={isRTL ? 'chevron-back' : 'chevron-forward'}
              size={16}
              color="#D55004"
            />
          </TouchableOpacity>
        )}
      </View>
      <FlatList
        horizontal
        data={items}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        inverted={false}
        removeClippedSubviews={true}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 8,
    marginBottom: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  headerRTL: {
    flexDirection: 'row-reverse',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  icon: {
    marginRight: 6,
  },
  iconRTL: {
    marginLeft: 6,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
  },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  viewAllText: {
    color: '#D55004',
    fontSize: 14,
    fontWeight: '600',
    marginHorizontal: 2,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 6,
  },
});

export default React.memo(FeaturedCarousel);
