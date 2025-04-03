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
} from "react-native";
import { supabase } from "@/utils/supabase";
import { FontAwesome, Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/utils/ThemeContext";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useScrollToTop } from "@react-navigation/native";
// import * as Location from "expo-location"; // REMOVED
import { BlurView } from "expo-blur";

// -------------------
// Types & Constants
// -------------------
interface Dealership {
  id: number;
  name: string | null;
  logo: string | null;
  total_cars?: number;
  location?: string | null;
  // latitude: number | null; // REMOVED
  // longitude: number | null; // REMOVED
  // distance?: number; // REMOVED
}

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

const SORT_OPTIONS = {
  ATOZ : "a-z",
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
              Sort Dealerships
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
                {key.replace('ATOZ', 'From A to Z').replace('ZTOA', 'From Z to A').replace('RANDOMIZED', 'Randomized')}
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
    <SafeAreaView style={{ backgroundColor: isDarkMode ? "black" : "white" }}>
      <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} />
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between", // Changed from marginLeft to proper justification
          alignItems: "center", // Added alignment
          paddingHorizontal: 24, // Changed from marginLeft to paddingHorizontal
          marginBottom: Platform.OS === "ios" ? -10 : 8,
        }}
      >
        <Text
          style={[
            { fontSize: 24, fontWeight: "bold" },
            { color: isDarkMode ? "white" : "black" },
          ]}
        >
          {title}
        </Text>
        {/* Right side placeholder to maintain consistency with Favorites */}
        <View style={{ width: 24 }} />
      </View>
    </SafeAreaView>
  );
});

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

                {/* Cars */}
                {item.total_cars !== undefined && (
                  <View style={cardStyles.infoRow}>
                    <Ionicons
                      name="car-outline"
                      size={14}
                      color={isDarkMode ? "#CCC" : "#666"}
                    />
                    <Text
                      style={[
                        cardStyles.infoText,
                        { color: isDarkMode ? "white" : "#444" },
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
});

// -------------------
// Main Dealership List Page
// -------------------
export default function DealershipListPage() {
  const { isDarkMode } = useTheme();
  const router = useRouter();

  const [dealerships, setDealerships] = useState<Dealership[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
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
      const { data, error } = await supabase
        .from("dealerships")
        .select("*, cars!inner(count)") // Using !inner to ensure we count all cars
        .eq('cars.status', 'available'); // Add filter for available cars only

      if (error) throw error;

      const rawDealers: any[] = data || [];
      const formattedData: Dealership[] = rawDealers.map((dealer) => ({
          id: dealer.id,
          name: dealer.name ?? null,
          logo: dealer.logo ?? null,
          location: dealer.location ?? null,
          total_cars: dealer.cars?.[0]?.count || 0,
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
          No dealerships found
        </Text>
        <Text
          style={[styles.emptySubText, { color: isDarkMode ? "#CCC" : "#555" }]}
        >
          Try adjusting your search
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
    <CustomHeader title="Dealerships" />
      <View style={{ paddingHorizontal: 16, paddingBottom: 12 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <View
            style={[
              {
                flex: 1,
                flexDirection: "row",
                alignItems: "center",
                borderWidth: 1,
                borderRadius: 999,
                paddingVertical: 4,
                paddingHorizontal: 8,
              },
              { borderColor: isDarkMode ? "#555" : "#ccc" },
            ]}
          >
            <FontAwesome
              name="search"
              size={20}
              color={isDarkMode ? "white" : "black"}
              style={{ marginLeft: 12 }}
            />
            <TextInput
              style={[
                { flex: 1, padding: 12, color: isDarkMode ? "white" : "black" },
              ]}
              placeholder="Search Dealerships..."
              placeholderTextColor={isDarkMode ? "lightgray" : "gray"}
              value={searchQuery}
              onChangeText={setSearchQuery}
              textAlignVertical="center"
            />
          </View>
          <TouchableOpacity
            onPress={() => setShowSortModal(true)}
            style={[
              {
                padding: 12,
                borderRadius: 999,
              },
            ]}
          >
            <FontAwesome
              name="sort"
              size={20}
              color={isDarkMode ? "white" : "black"}
            />
          </TouchableOpacity>
        </View>
      </View>
      {/* Main Content: Loading or List */}
      {isLoading ? (
        <View
          style={{ flex: 1, justifyContent: "center", alignItems: "center" }}
        >
          <Text style={{ color: isDarkMode ? "white" : "black" }}>
            Loading...
          </Text>
        </View>
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