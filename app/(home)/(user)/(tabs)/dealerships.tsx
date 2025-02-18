import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef
} from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  TextInput,
  FlatList,
  Alert,
  StatusBar,
  Modal,
  StyleSheet,
  TouchableWithoutFeedback,
  Dimensions,
  Platform,
  Animated,
  Easing,
  ActivityIndicator
} from 'react-native';
import { supabase } from '@/utils/supabase';
import { FontAwesome, Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/utils/ThemeContext';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RefreshControl } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useScrollToTop } from '@react-navigation/native';
import * as Location from 'expo-location';
import { BlurView } from 'expo-blur';

interface Dealership {
  id: number;
  name: string | null;     // name might be null in the database
  logo: string | null;     // same for logo
  total_cars?: number;
  location?: string | null;
  latitude: number | null;
  longitude: number | null;
  distance?: number;
}

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

// -----------------
// Sort Options
// -----------------
const SORT_OPTIONS = {
  AZ: 'a-z',
  ZA: 'z-a',
  RANDOM: 'random',
  NEAREST: 'nearest'
} as const;

type SortOption = (typeof SORT_OPTIONS)[keyof typeof SORT_OPTIONS];

// -------------------
// Sort Modal Component
// -------------------
const SortModal = ({
  visible,
  onClose,
  onSelect,
  currentSort,
  isDarkMode
}: {
  visible: boolean;
  onClose: () => void;
  onSelect: (sortValue: SortOption) => void;
  currentSort: SortOption;
  isDarkMode: boolean;
}) => {
  const animation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.timing(animation, {
        toValue: 1,
        duration: 300,
        easing: Easing.bezier(0.33, 1, 0.68, 1),
        useNativeDriver: true
      }).start();
    } else {
      Animated.timing(animation, {
        toValue: 0,
        duration: 200,
        easing: Easing.bezier(0.33, 1, 0.68, 1),
        useNativeDriver: true
      }).start();
    }
  }, [visible, animation]);

  const modalTranslateY = animation.interpolate({
    inputRange: [0, 1],
    outputRange: [SCREEN_HEIGHT, 0]
  });

  return (
    <Modal
      animationType="none"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        {/* Clicking outside the modal content to close */}
        <TouchableWithoutFeedback onPress={onClose}>
          <BlurView
            intensity={isDarkMode ? 50 : 80}
            tint={isDarkMode ? 'dark' : 'light'}
            style={StyleSheet.absoluteFill}
          />
        </TouchableWithoutFeedback>

        {/* Animated bottom sheet */}
        <Animated.View
          style={[
            styles.modalContent,
            {
              transform: [{ translateY: modalTranslateY }],
              backgroundColor: isDarkMode ? '#1A1A1A' : '#FFFFFF'
            }
          ]}
        >
          <View style={styles.modalHeader}>
            <View style={styles.dragIndicator} />
            <Text
              style={[
                styles.modalTitle,
                isDarkMode && styles.modalTitleDark
              ]}
            >
              Sort Dealerships
            </Text>
          </View>

          {Object.entries(SORT_OPTIONS).map(([key, value]) => (
            <TouchableOpacity
              key={value}
              style={[
                styles.option,
                currentSort === value && styles.selectedOption,
                isDarkMode && styles.optionDark
              ]}
              onPress={() => {
                onSelect(value as SortOption);
                onClose();
              }}
            >
              <Text
                style={[
                  styles.optionText,
                  currentSort === value && styles.selectedOptionText,
                  isDarkMode && styles.optionTextDark
                ]}
              >
                {key}
              </Text>
              {currentSort === value && <View style={styles.checkmark} />}
            </TouchableOpacity>
          ))}
        </Animated.View>
      </View>
    </Modal>
  );
};

// -------------------
// Custom Header Component
// -------------------
const CustomHeader = React.memo(({ title }: { title: string }) => {
  const { isDarkMode } = useTheme();
  return (
    <SafeAreaView style={{ backgroundColor: isDarkMode ? 'black' : 'white' }}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <View
        style={{
          flexDirection: 'row',
          marginLeft: 24,
          marginBottom: Platform.OS === 'ios' ? -20 : 8
        }}
      >
        <Text
          style={[
            { fontSize: 24, fontWeight: 'bold' },
            { color: isDarkMode ? 'white' : 'black' }
          ]}
        >
          {title}
        </Text>
      </View>
    </SafeAreaView>
  );
});

// -------------------
// Dealership Card (with fade/slide animation)
// -------------------
const DealershipCard = React.memo(
  ({
    item,
    onPress,
    isDarkMode,
    index
  }: {
    item: Dealership;
    onPress: (dealer: Dealership) => void;
    isDarkMode: boolean;
    index: number;
  }) => {
    // A small fade/slide animation per item
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const translateY = useRef(new Animated.Value(15)).current;

    useEffect(() => {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 350,
          delay: index * 75, // stagger the animation slightly
          useNativeDriver: true
        }),
        Animated.timing(translateY, {
          toValue: 0,
          duration: 350,
          delay: index * 75,
          useNativeDriver: true
        })
      ]).start();
    }, [fadeAnim, translateY, index]);

    // Fallback values if any data is null
    const dealerName = item.name ?? 'Unknown Dealer';
    const dealerLogo = item.logo ?? ''; // or a placeholder URI if you have one
    const locationText = item.location ?? 'Unknown Location';
    const distanceText =
      item.distance !== undefined
        ? `• ${item.distance.toFixed(1)} km away`
        : '';

    return (
      <Animated.View
        style={{
          opacity: fadeAnim,
          transform: [{ translateY }]
        }}
      >
        <TouchableOpacity
          style={[
            cardStyles.container,
            { backgroundColor: isDarkMode ? '#222222' : '#FFFFFF' }
          ]}
          onPress={() => onPress(item)}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={
              isDarkMode ? ['#000000', '#1A1A1A'] : ['#FFFFFF', '#E0E0E0']
            }
            style={cardStyles.gradient}
          >
            <View style={cardStyles.row}>
              <View style={cardStyles.content}>
                <Text
                  style={[
                    cardStyles.name,
                    { color: isDarkMode ? 'white' : 'black' }
                  ]}
                >
                  {dealerName}
                </Text>
                {item.location && (
                  <View style={cardStyles.infoRow}>
                    <Ionicons
                      name="location-outline"
                      size={14}
                      color={isDarkMode ? '#CCC' : '#666'}
                    />
                    <Text
                      style={[
                        cardStyles.infoText,
                        { color: isDarkMode ? 'white' : '#444' }
                      ]}
                    >
                      {locationText} {distanceText}
                    </Text>
                  </View>
                )}
                {item.total_cars !== undefined && (
                  <View style={cardStyles.infoRow}>
                    <Ionicons
                      name="car-outline"
                      size={14}
                      color={isDarkMode ? '#CCC' : '#666'}
                    />
                    <Text
                      style={[
                        cardStyles.infoText,
                        { color: isDarkMode ? 'white' : '#444' }
                      ]}
                    >
                      {item.total_cars} vehicles available
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </LinearGradient>
        </TouchableOpacity>
      </Animated.View>
    );
  }
);

const cardStyles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5
  },
  gradient: {
    padding: 16
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  logo: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#ccc'
  },
  content: {
    flex: 1,
    marginLeft: 16
  },
  name: {
    fontSize: 18,
    fontWeight: 'bold'
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4
  },
  infoText: {
    fontSize: 14,
    marginLeft: 4
  }
});

// -------------------
// Main Dealership List Page
// -------------------
export default function DealershipListPage() {
  const { isDarkMode } = useTheme();
  const router = useRouter();
  const scrollRef = useRef<FlatList<Dealership> | null>(null);

  const [dealerships, setDealerships] = useState<Dealership[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [sortBy, setSortBy] = useState<SortOption>(SORT_OPTIONS.RANDOM);
  const [showSortModal, setShowSortModal] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);
  const [userLocation, setUserLocation] = useState<Location.LocationObject | null>(
    null
  );

  useScrollToTop(scrollRef);

  // -------------------
  // Location & Distance
  // -------------------
  const getUserLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission denied', 'Unable to access location');
        return;
      }
      const location = await Location.getCurrentPositionAsync({});
      setUserLocation(location);
    } catch (error) {
      console.error('Error getting location:', error);
    }
  };

  useEffect(() => {
    getUserLocation();
  }, []);

  const calculateDistance = (
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ) => {
    if (
      lat1 == null ||
      lon1 == null ||
      lat2 == null ||
      lon2 == null
    ) {
      return undefined; // can't calculate if any are null
    }
    const R = 6371; // Earth's radius in km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  // -------------------
  // Fetch Dealerships
  // -------------------
  const fetchDealerships = useCallback(async () => {
    // Show loading only if we haven't fetched before.
    if (!hasFetched) setIsLoading(true);

    try {
      const { data, error } = await supabase
        .from('dealerships')
        .select('*, cars(count)');

      if (error) throw error;

      // Defensive approach: If data is null, fallback to empty array
      const safeData: Dealership[] = (data ?? []).map((dealer: any) => {
        const distance = userLocation
          ? calculateDistance(
              userLocation?.coords?.latitude,
              userLocation?.coords?.longitude,
              dealer.latitude,
              dealer.longitude
            )
          : undefined;

        return {
          id: dealer.id,
          name: dealer.name ?? null,
          logo: dealer.logo ?? null,
          total_cars: dealer.cars?.[0]?.count || 0,
          location: dealer.location ?? null,
          latitude: dealer.latitude ?? null,
          longitude: dealer.longitude ?? null,
          distance
        };
      });

      setDealerships(safeData);
    } catch (error) {
      console.error('Error fetching dealerships:', error);
      Alert.alert('Error', 'Failed to fetch dealerships');
    } finally {
      if (!hasFetched) setIsLoading(false);
      setHasFetched(true);
    }
  }, [userLocation, hasFetched]);

  useEffect(() => {
    fetchDealerships();
  }, [fetchDealerships]);

  // -------------------
  // Sorting & Filtering
  // -------------------
  const sortedAndFilteredDealerships = useMemo(() => {
    const filtered = dealerships.filter((dealer) => {
      // Fallback for null name
      const dealerName = dealer.name ?? '';
      return dealerName.toLowerCase().includes(searchQuery.toLowerCase());
    });

    switch (sortBy) {
      case SORT_OPTIONS.AZ:
        return filtered.sort((a, b) => {
          const nameA = (a.name ?? '').toLowerCase();
          const nameB = (b.name ?? '').toLowerCase();
          return nameA.localeCompare(nameB);
        });
      case SORT_OPTIONS.ZA:
        return filtered.sort((a, b) => {
          const nameA = (a.name ?? '').toLowerCase();
          const nameB = (b.name ?? '').toLowerCase();
          return nameB.localeCompare(nameA);
        });
      case SORT_OPTIONS.RANDOM:
        // Shuffle array by random sort
        return filtered.sort(() => Math.random() - 0.5);
      case SORT_OPTIONS.NEAREST:
        return filtered.sort((a, b) => {
          const distA = a.distance ?? Number.MAX_VALUE;
          const distB = b.distance ?? Number.MAX_VALUE;
          return distA - distB;
        });
      default:
        return filtered;
    }
  }, [dealerships, searchQuery, sortBy]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchDealerships();
    setRefreshing(false);
  }, [fetchDealerships]);

  const handleDealershipPress = useCallback(
    (dealership: Dealership) => {
      router.push({
        pathname: '/(home)/(user)/DealershipDetails',
        params: { dealershipId: dealership.id }
      });
    },
    [router]
  );

  // If list is empty after filtering
  const renderEmpty = useCallback(() => {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons
          name="business-outline"
          size={50}
          color={isDarkMode ? '#FFFFFF' : '#000000'}
        />
        <Text
          style={[
            styles.emptyText,
            { color: isDarkMode ? 'white' : 'black' }
          ]}
        >
          No dealerships found
        </Text>
        <Text
          style={[
            styles.emptySubText,
            { color: isDarkMode ? '#CCC' : '#555' }
          ]}
        >
          Try adjusting your search
        </Text>
      </View>
    );
  }, [isDarkMode]);

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: isDarkMode ? 'black' : 'white'
      }}
    >
      <CustomHeader title="Dealerships" />

      {/* Search Container */}
      <View style={styles.searchContainer}>
        <View style={styles.searchRow}>
          <FontAwesome
            name="search"
            size={20}
            color={isDarkMode ? 'white' : 'black'}
            style={{ marginLeft: 12, marginRight: 8 }}
          />
          <TextInput
            style={[
              styles.searchInput,
              { color: isDarkMode ? 'white' : 'black' }
            ]}
            placeholder="Search Dealerships..."
            placeholderTextColor={isDarkMode ? 'lightgray' : 'gray'}
            value={searchQuery}
            onChangeText={setSearchQuery}
            textAlignVertical="center"
          />
          <TouchableOpacity
            onPress={() => setShowSortModal(true)}
            style={[
              styles.sortButton,
              {
                backgroundColor: isDarkMode ? 'black' : 'white',
                marginLeft: 8
              }
            ]}
          >
            <FontAwesome
              name="sort"
              size={20}
              color={isDarkMode ? 'white' : 'black'}
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* Main Content */}
      {isLoading ? (
        // Show a loading spinner on initial fetch
        <View style={styles.loadingContainer}>
          <ActivityIndicator
            size="large"
            color="#D55004"
            style={{ marginBottom: 12 }}
          />
          <Text style={{ color: isDarkMode ? 'white' : 'black' }}>
            Loading...
          </Text>
        </View>
      ) : (
        <FlatList
          ref={scrollRef}
          data={sortedAndFilteredDealerships}
          keyExtractor={(item) => `${item.id}`}
          renderItem={({ item, index }) => (
            <DealershipCard
              item={item}
              onPress={handleDealershipPress}
              isDarkMode={isDarkMode}
              index={index}
            />
          )}
          ListEmptyComponent={renderEmpty}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={['#D55004']}
              tintColor={isDarkMode ? '#FFFFFF' : '#000000'}
            />
          }
          contentContainerStyle={styles.flatListContent}
        />
      )}

      <SortModal
        visible={showSortModal}
        onClose={() => setShowSortModal(false)}
        onSelect={setSortBy}
        currentSort={sortBy}
        isDarkMode={isDarkMode}
      />
    </View>
  );
}

// -------------------
// Styles
// -------------------
const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'transparent'
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '80%',
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: 20
  },
  dragIndicator: {
    width: 40,
    height: 4,
    backgroundColor: '#E0E0E0',
    borderRadius: 2,
    marginBottom: 16
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333'
  },
  modalTitleDark: {
    color: '#FFFFFF'
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 8
  },
  optionDark: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)'
  },
  optionText: {
    fontSize: 16,
    color: '#333333',
    flex: 1
  },
  optionTextDark: {
    color: '#FFFFFF'
  },
  selectedOption: {
    backgroundColor: 'rgba(213, 80, 4, 0.1)'
  },
  selectedOptionText: {
    color: '#D55004',
    fontWeight: '600'
  },
  checkmark: {
    width: 10,
    height: 10,
    backgroundColor: '#D55004',
    borderRadius: 50,
    marginLeft: 8
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingBottom: 12
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  searchInput: {
    flex: 1,
    padding: 8
  },
  sortButton: {
    padding: 12,
    borderRadius: 999,
    justifyContent: 'center',
    alignItems: 'center'
  },
  flatListContent: {
    paddingVertical: 8,
    flexGrow: 1,
    paddingBottom: Platform.OS === 'android' ? 70 : 64
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20
  },
  emptyText: {
    fontSize: 18,
    marginTop: 12,
    textAlign: 'center'
  },
  emptySubText: {
    fontSize: 14,
    marginTop: 4,
    textAlign: 'center'
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  }
});
