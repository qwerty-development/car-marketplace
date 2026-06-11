import React, { useCallback, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  I18nManager,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/utils/ThemeContext';
import { useFavorites } from '@/utils/useFavorites';
import CarCard from '@/components/CarCard';
import { useAllFeaturedListings, FeaturedListing } from '@/hooks/useFeaturedListings';

/**
 * Full-screen list of every featured (boosted) sale listing, newest feature
 * first (get_featured_listings with p_random=false). Reuses CarCard and works
 * for guests — favoriting from the card goes through the guest-aware
 * favorites context.
 */
export default function FeaturedListingsScreen() {
  const { isDarkMode } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  // SDK 54: keep router in a ref for stable callbacks
  const routerRef = useRef(router);
  routerRef.current = router;
  const isRTL = I18nManager.isRTL;

  const { toggleFavorite, favoritesSet } = useFavorites();
  const { data: featured, isLoading, isError, refetch } = useAllFeaturedListings();

  const handleFavoritePress = useCallback(
    async (carId: string) => {
      await toggleFavorite(parseInt(carId, 10));
    },
    [toggleFavorite]
  );

  const handleBack = useCallback(() => {
    routerRef.current.back();
  }, []);

  const renderItem = useCallback(
    ({ item, index }: { item: FeaturedListing; index: number }) => (
      <CarCard
        car={item}
        index={index}
        onFavoritePress={handleFavoritePress}
        isFavorite={favoritesSet.has(Number(item.id))}
        isDealer={false}
      />
    ),
    [handleFavoritePress, favoritesSet]
  );

  const keyExtractor = useCallback(
    (item: FeaturedListing) => `featured-all-${item.id}`,
    []
  );

  return (
    <LinearGradient
      colors={isDarkMode ? ['#000000', '#1A1A1A'] : ['#FFFFFF', '#F5F5F5']}
      style={{ flex: 1 }}
    >
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        {/* Header */}
        <View style={[styles.header, isRTL && styles.headerRTL]}>
          <TouchableOpacity
            onPress={handleBack}
            style={styles.backButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons
              name={isRTL ? 'chevron-forward' : 'chevron-back'}
              size={26}
              color={isDarkMode ? '#FFFFFF' : '#000000'}
            />
          </TouchableOpacity>
          <View style={[styles.titleRow, isRTL && styles.headerRTL]}>
            <Ionicons
              name="trophy"
              size={20}
              color="#D55004"
              style={isRTL ? { marginLeft: 8 } : { marginRight: 8 }}
            />
            <Text
              style={[
                styles.title,
                { color: isDarkMode ? '#FFFFFF' : '#000000' },
              ]}
            >
              {t('featured.allFeatured')}
            </Text>
          </View>
          {/* Spacer to balance the back button */}
          <View style={styles.backButton} />
        </View>

        {isLoading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color="#D55004" />
          </View>
        ) : (
          <FlatList
            data={featured ?? []}
            renderItem={renderItem}
            keyExtractor={keyExtractor}
            showsVerticalScrollIndicator={false}
            removeClippedSubviews={true}
            maxToRenderPerBatch={5}
            windowSize={10}
            initialNumToRender={5}
            contentContainerStyle={{
              paddingBottom: 40,
              flexGrow: (featured?.length ?? 0) === 0 ? 1 : undefined,
            }}
            ListEmptyComponent={
              <View style={styles.center}>
                <Ionicons
                  name="trophy-outline"
                  size={56}
                  color={isDarkMode ? '#666' : '#ccc'}
                  style={{ marginBottom: 12 }}
                />
                <Text
                  style={[
                    styles.emptyText,
                    { color: isDarkMode ? '#FFFFFF' : '#000000' },
                  ]}
                >
                  {t('featured.empty')}
                </Text>
                {isError && (
                  <TouchableOpacity
                    onPress={() => refetch()}
                    style={styles.retryButton}
                  >
                    <Text style={styles.retryText}>{t('common.retry')}</Text>
                  </TouchableOpacity>
                )}
              </View>
            }
          />
        )}
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  headerRTL: {
    flexDirection: 'row-reverse',
  },
  backButton: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 14,
    backgroundColor: '#D55004',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
  },
  retryText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
});
