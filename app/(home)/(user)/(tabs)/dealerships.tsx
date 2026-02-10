import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
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
  RefreshControl,
  I18nManager,
} from "react-native";
import { supabase } from "@/utils/supabase";
import { FontAwesome, Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/utils/ThemeContext";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useScrollToTop } from "@react-navigation/native";
import DealershipSkeletonLoading from "../DealershipSkeletonLoading";
// import * as Location from "expo-location"; // REMOVED
import { BlurView } from "expo-blur";
import i18n from '@/utils/i18n';

// -------------------
// Types & Constants
// -------------------
interface Dealership {
  id: number;
  name: string | null;
  logo: string | null;
  total_cars_sale?: number;
  total_cars_rent?: number;
  total_number_plates?: number;
  location?: string | null;
}

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

const SORT_OPTIONS = {
  ATOZ: "a-z",
  ZTOA: "z-a",
  RANDOMIZED: "random",
  // NEAREST: "nearest", // REMOVED
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
  isDarkMode,
}: {
  visible: boolean;
  onClose: () => void;
  onSelect: (sort: SortOption) => void;
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
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(animation, {
        toValue: 0,
        duration: 200,
        easing: Easing.bezier(0.33, 1, 0.68, 1),
        useNativeDriver: true,
      }).start();
    }
  }, [visible, animation]);

  const modalTranslateY = animation.interpolate({
    inputRange: [0, 1],
    outputRange: [SCREEN_HEIGHT, 0],
  });

  return (
    <Modal
      animationType="none"
      transparent
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        {/* Dismiss modal if user taps outside */}
        <TouchableWithoutFeedback onPress={onClose}>
          <BlurView
            intensity={isDarkMode ? 50 : 80}
            tint={isDarkMode ? "dark" : "light"}
            style={StyleSheet.absoluteFill}
          />
        </TouchableWithoutFeedback>

        <Animated.View
          style={[
            styles.modalContent,
            {
              transform: [{ translateY: modalTranslateY }],
              backgroundColor: isDarkMode ? "#1A1A1A" : "#FFFFFF",
            },
          ]}
        >
          <View style={styles.modalHeader}>
            <View style={styles.dragIndicator} />
            <Text
              style={[styles.modalTitle, isDarkMode && styles.modalTitleDark]}
            >
              {i18n.t('dealership.sort_dealerships')}
            </Text>
          </View>

          {Object.entries(SORT_OPTIONS).map(([key, value]) => (
            <TouchableOpacity
              key={value}
              style={[
                styles.option,
                currentSort === value && styles.selectedOption,
                isDarkMode && styles.optionDark,
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
                  isDarkMode && styles.optionTextDark,
                ]}
              >
                {key
                  .replace('ATOZ', i18n.t('dealership.from_a_to_z'))
                  .replace('ZTOA', i18n.t('dealership.from_z_to_a'))
                  .replace('RANDOMIZED', i18n.t('dealership.randomized'))}
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
// Dealership Card Component (With Animation)
// -------------------
const DealershipCard = React.memo(
  ({
    item,
    onPress,
    isDarkMode,
    index,
  }: {
    item: Dealership;
    onPress: (dealership: Dealership) => void;
    isDarkMode: boolean;
    index: number;
  }) => {
    // Fade and slide-in animation
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(10)).current; // small upward slide

    useEffect(() => {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 400,
          delay: index * 70, // stagger effect
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 400,
          delay: index * 70,
          useNativeDriver: true,
        }),
      ]).start();
    }, [fadeAnim, slideAnim, index]);

    // Defensive checks
    const name = item.name || "Unnamed Dealership";
    const logo = item.logo
      ? { uri: item.logo }
      : require("@/assets/images/placeholder-logo.png"); // fallback logo image
    const locationText = item.location || "Unknown location";

    return (
      <Animated.View
        style={[
          cardStyles.container,
          {
            backgroundColor: isDarkMode ? "#222" : "#fff",
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        <TouchableOpacity onPress={() => onPress(item)} activeOpacity={0.9}>
          <LinearGradient
            colors={isDarkMode ? ["#000", "#1A1A1A"] : ["#fff", "#E0E0E0"]}
            style={cardStyles.gradient}
          >
            <View style={cardStyles.row}>
              <Image source={logo} style={cardStyles.logo} />
              <View style={cardStyles.content}>
                <Text
                  style={[
                    cardStyles.name,
                    { color: isDarkMode ? "white" : "black" },
                  ]}
                >
                  {name}
                </Text>

                {/* Location */}
                <View style={cardStyles.infoRow}>
                  <Ionicons
                    name="location-outline"
                    size={14}
                    color={isDarkMode ? "#CCC" : "#666"}
                  />
                  <Text
                    style={[
                      cardStyles.infoText,
                      { color: isDarkMode ? "white" : "#444" },
                    ]}
                  >
                    {locationText}
                  </Text>
                </View>

                {/* Stats Row - Icon-based display */}
                <View style={cardStyles.statsRow}>
                  {/* Cars for Sale */}
                  {(item.total_cars_sale ?? 0) > 0 && (
                    <View style={[cardStyles.statBadge, { backgroundColor: isDarkMode ? 'rgba(213, 80, 4, 0.15)' : 'rgba(213, 80, 4, 0.1)' }]}>
                      <Ionicons
                        name="car-sport-outline"
                        size={14}
                        color="#D55004"
                      />
                      <Text style={[cardStyles.statText, { color: '#D55004' }]}>
                        {item.total_cars_sale}
                      </Text>
                    </View>
                  )}
                  {/* Cars for Rent */}
                  {(item.total_cars_rent ?? 0) > 0 && (
                    <View style={[cardStyles.statBadge, { backgroundColor: isDarkMode ? 'rgba(59, 130, 246, 0.15)' : 'rgba(59, 130, 246, 0.1)' }]}>
                      <Ionicons
                        name="key-outline"
                        size={14}
                        color="#3B82F6"
                      />
                      <Text style={[cardStyles.statText, { color: '#3B82F6' }]}>
                        {item.total_cars_rent}
                      </Text>
                    </View>
                  )}
                  {/* Number Plates */}
                  {(item.total_number_plates ?? 0) > 0 && (
                    <View style={[cardStyles.statBadge, { backgroundColor: isDarkMode ? 'rgba(34, 197, 94, 0.15)' : 'rgba(34, 197, 94, 0.1)' }]}>
                      <Ionicons
                        name="document-text-outline"
                        size={14}
                        color="#22C55E"
                      />
                      <Text style={[cardStyles.statText, { color: '#22C55E' }]}>
                        {item.total_number_plates}
                      </Text>
                    </View>
                  )}
                  {/* Show 'No listings' if all counts are 0 */}
                  {(item.total_cars_sale ?? 0) === 0 && (item.total_cars_rent ?? 0) === 0 && (item.total_number_plates ?? 0) === 0 && (
                    <Text style={[cardStyles.infoText, { color: isDarkMode ? '#888' : '#999', fontStyle: 'italic' }]}>
                      {i18n.t('dealership.no_listings')}
                    </Text>
                  )}
                </View>
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
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  gradient: {
    padding: 16,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
  },
  logo: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#ccc",
  },
  content: {
    flex: 1,
    marginLeft: 16,
  },
  name: {
    fontSize: 18,
    fontWeight: "bold",
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  infoText: {
    fontSize: 14,
    marginLeft: 4,
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
    flexWrap: "wrap",
    gap: 8,
  },
  statBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    gap: 4,
  },
  statText: {
    fontSize: 13,
    fontWeight: "600",
  },
});

// -------------------
// Main Dealership List Page
// -------------------
export default function DealershipListPage() {
  const { isDarkMode } = useTheme();
  const router = useRouter();

  const [dealerships, setDealerships] = useState<Dealership[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const searchInputRef = useRef<TextInput>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const [sortBy, setSortBy] = useState<SortOption>(SORT_OPTIONS.RANDOMIZED);
  const [showSortModal, setShowSortModal] = useState(false);

  const [hasFetched, setHasFetched] = useState(false);
  // const [userLocation, setUserLocation] =
  //   useState<Location.LocationObject | null>(null); // REMOVED

  const scrollRef = useRef<FlatList<Dealership> | null>(null);
  useScrollToTop(scrollRef);

  const fetchDealerships = useCallback(async () => {
    if (!hasFetched) setIsLoading(true);
    try {
      // Step 1: Fetch all dealerships with active subscriptions
      const { data: dealershipsData, error: dealershipsError } = await supabase
        .from("dealerships")
        .select("id, name, logo, location")
        .gte("subscription_end_date", new Date().toISOString())
        .order("name");

      if (dealershipsError) throw dealershipsError;

      if (!dealershipsData || dealershipsData.length === 0) {
        setDealerships([]);
        return;
      }

      const dealershipIds = dealershipsData.map(d => d.id);

      // Step 2: Fetch counts for cars (sale)
      const { data: carsData, error: carsError } = await supabase
        .from("cars")
        .select("dealership_id")
        .eq('status', 'available')
        .in('dealership_id', dealershipIds);

      if (carsError) throw carsError;

      // Step 3: Fetch counts for cars_rent
      const { data: rentData, error: rentError } = await supabase
        .from("cars_rent")
        .select("dealership_id")
        .eq('status', 'available')
        .in('dealership_id', dealershipIds);

      if (rentError) throw rentError;

      // Step 4: Fetch counts for number_plates
      const { data: platesData, error: platesError } = await supabase
        .from("number_plates")
        .select("dealership_id")
        .eq('status', 'available')
        .in('dealership_id', dealershipIds);

      if (platesError) throw platesError;

      // Aggregate counts by dealership_id
      const carsCounts: Record<number, number> = {};
      const rentCounts: Record<number, number> = {};
      const platesCounts: Record<number, number> = {};

      (carsData || []).forEach((car: any) => {
        if (car.dealership_id) {
          carsCounts[car.dealership_id] = (carsCounts[car.dealership_id] || 0) + 1;
        }
      });

      (rentData || []).forEach((rent: any) => {
        if (rent.dealership_id) {
          rentCounts[rent.dealership_id] = (rentCounts[rent.dealership_id] || 0) + 1;
        }
      });

      (platesData || []).forEach((plate: any) => {
        if (plate.dealership_id) {
          platesCounts[plate.dealership_id] = (platesCounts[plate.dealership_id] || 0) + 1;
        }
      });

      // Combine all data
      const formattedData: Dealership[] = dealershipsData.map((dealer) => ({
        id: dealer.id,
        name: dealer.name ?? null,
        logo: dealer.logo ?? null,
        location: dealer.location ?? null,
        total_cars_sale: carsCounts[dealer.id] || 0,
        total_cars_rent: rentCounts[dealer.id] || 0,
        total_number_plates: platesCounts[dealer.id] || 0,
      }));

      setDealerships(formattedData);
    } catch (error) {
      console.error("Error fetching dealerships:", error);
      Alert.alert("Error", "Failed to fetch dealerships");
    } finally {
      if (!hasFetched) setIsLoading(false);
      setHasFetched(true);
    }
  }, [hasFetched]);// removed dependecy: userLocation, calculateDistance

  useEffect(() => {
    fetchDealerships();
  }, [fetchDealerships]);

  // -------------------
  // Sorting & Filtering
  // -------------------
  const sortedAndFilteredDealerships = useMemo(() => {
    // Filter
    const filtered = dealerships.filter((dealer) => {
      const dealerName = dealer.name || "";
      return dealerName.toLowerCase().includes(searchQuery.toLowerCase());
    });

    // Sort
    switch (sortBy) {
      case SORT_OPTIONS.ATOZ:
        return filtered.sort((a, b) => {
          const nameA = a.name || "";
          const nameB = b.name || "";
          return nameA.localeCompare(nameB);
        });
      case SORT_OPTIONS.ZTOA:
        return filtered.sort((a, b) => {
          const nameA = a.name || "";
          const nameB = b.name || "";
          return nameB.localeCompare(nameA);
        });
      case SORT_OPTIONS.RANDOMIZED:
        return filtered.sort(() => Math.random() - 0.5);
      default:
        return filtered;
    }
  }, [dealerships, searchQuery, sortBy]);

  // -------------------
  // Refresh
  // -------------------
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchDealerships();
    setRefreshing(false);
  }, [fetchDealerships]);

  // -------------------
  // Handle Card Press
  // -------------------
  const handleDealershipPress = useCallback(
    (dealership: Dealership) => {
      router.push({
        pathname: "/(home)/(user)/DealershipDetails",
        params: { dealershipId: dealership.id },
      });
    },
    [router]
  );

  // -------------------
  // Empty / Loading
  // -------------------
  const renderEmpty = useCallback(() => {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons
          name="business-outline"
          size={50}
          color={isDarkMode ? "#FFFFFF" : "#000000"}
        />
        <Text
          style={[styles.emptyText, { color: isDarkMode ? "white" : "black" }]}
        >
          {i18n.t('dealership.no_dealerships_found')}
        </Text>
        <Text
          style={[styles.emptySubText, { color: isDarkMode ? "#CCC" : "#555" }]}
        >
          {i18n.t('dealership.try_adjusting_search')}
        </Text>
      </View>
    );
  }, [isDarkMode]);

  // -------------------
  // Render
  // -------------------
  return (
    <View
      style={{ flex: 1, backgroundColor: isDarkMode ? "#000000" : "#FFFFFF" }}
    >
      <View style={{ paddingHorizontal: 24, paddingBottom: 12, paddingTop: 16 }}>
        {isSearching ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <View
              style={{
                flex: 1,
                flexDirection: 'row',
                alignItems: 'center',
                borderWidth: 1,
                borderRadius: 12,
                paddingHorizontal: 12,
                paddingVertical: 10,
                borderColor: isDarkMode ? '#374151' : '#E5E7EB',
                backgroundColor: isDarkMode ? '#1F2937' : '#FFFFFF',
              }}
            >
              <Ionicons
                name="search"
                size={18}
                color={isDarkMode ? '#9CA3AF' : '#6B7280'}
                style={{ marginRight: 8 }}
              />
              <TextInput
                ref={searchInputRef}
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder={i18n.t('dealership.search_dealerships')}
                placeholderTextColor={isDarkMode ? '#6B7280' : '#9CA3AF'}
                style={{
                  flex: 1,
                  fontSize: 15,
                  color: isDarkMode ? '#E5E7EB' : '#0F172A',
                }}
                returnKeyType="search"
              />
            </View>
            <TouchableOpacity
              onPress={() => {
                setSearchQuery('');
                setIsSearching(false);
              }}
              activeOpacity={0.7}
            >
              <Text
                style={{
                  fontSize: 15,
                  fontWeight: '600',
                  color: isDarkMode ? '#E5E7EB' : '#0F172A',
                }}
              >
                {i18n.t('common.cancel', 'Cancel')}
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text
              style={{
                fontSize: 24,
                fontWeight: 'bold',
                color: isDarkMode ? '#FFFFFF' : '#0F172A',
              }}
            >
              {i18n.t('dealership.dealerships')}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <TouchableOpacity
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 19,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: 1,
                  borderColor: isDarkMode ? '#374151' : '#E5E7EB',
                  backgroundColor: isDarkMode ? '#1F2937' : '#F3F4F6',
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.08,
                  shadowRadius: 3,
                  elevation: 3,
                }}
                activeOpacity={0.7}
                onPress={() => {
                  setIsSearching(true);
                  setTimeout(() => searchInputRef.current?.focus(), 100);
                }}
              >
                <Ionicons
                  name="search"
                  size={20}
                  color={isDarkMode ? '#9CA3AF' : '#6B7280'}
                />
              </TouchableOpacity>
              <TouchableOpacity
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 19,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: 1,
                  borderColor: isDarkMode ? '#374151' : '#E5E7EB',
                  backgroundColor: isDarkMode ? '#1F2937' : '#F3F4F6',
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.08,
                  shadowRadius: 3,
                  elevation: 3,
                }}
                activeOpacity={0.7}
                onPress={() => setShowSortModal(true)}
              >
                <Ionicons
                  name="swap-vertical"
                  size={20}
                  color={isDarkMode ? '#9CA3AF' : '#6B7280'}
                />
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>

      {/* Main Content: Loading or List */}
      {isLoading ? (
        <DealershipSkeletonLoading isDarkMode={isDarkMode} count={6} />
      ) : (
        <FlatList
          ref={scrollRef}
          data={sortedAndFilteredDealerships}
          renderItem={({ item, index }) => (
            <DealershipCard
              item={item}
              onPress={handleDealershipPress}
              isDarkMode={isDarkMode}
              index={index}
            />
          )}
          keyExtractor={(item) => `${item.id}`}
          ListEmptyComponent={renderEmpty}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={["#D55004"]}
              tintColor={isDarkMode ? "#FFFFFF" : "#000000"}
            />
          }
          contentContainerStyle={styles.flatListContent}
        />
      )}

      {/* Sort Modal */}
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
    justifyContent: "flex-end",
    backgroundColor: "transparent",
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: "80%",
    backgroundColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
  },
  modalHeader: {
    alignItems: "center",
    marginBottom: 20,
  },
  dragIndicator: {
    width: 40,
    height: 4,
    backgroundColor: "#E0E0E0",
    borderRadius: 2,
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
  },
  modalTitleDark: {
    color: "#fff",
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  optionDark: {
    backgroundColor: "rgba(255, 255, 255, 0.05)",
  },
  optionText: {
    fontSize: 16,
    color: "#333",
    flex: 1,
  },
  optionTextDark: {
    color: "#fff",
  },
  selectedOption: {
    backgroundColor: "rgba(213, 80, 4, 0.1)",
  },
  selectedOptionText: {
    color: "#D55004",
    fontWeight: "600",
  },
  checkmark: {
    width: 10,
    height: 10,
    backgroundColor: "#D55004",
    borderRadius: 50,
    marginLeft: 8,
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  searchInput: {
    flex: 1,
    padding: 8,
  },
  sortButton: {
    padding: 12,
    borderRadius: 999,
    justifyContent: "center",
    alignItems: "center",
  },
  flatListContent: {
    paddingVertical: 8,
    flexGrow: 1,
    paddingBottom: Platform.OS === "android" ? 70 : 64,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 20,
  },
  emptyText: {
    fontSize: 18,
    marginTop: 12,
    textAlign: "center",
  },
  emptySubText: {
    fontSize: 14,
    marginTop: 4,
    textAlign: "center",
  },
});