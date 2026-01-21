import React, {
  useState,
  useCallback,
  useEffect,
  memo,
  useRef,
  useMemo,
} from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  ScrollView,
  Platform,
  Alert,
  ActivityIndicator,
  FlatList,
  TouchableWithoutFeedback,
  Keyboard,
} from "react-native";
import {
  FontAwesome,
  Ionicons,
  MaterialCommunityIcons,
} from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system";
import { supabase } from "@/utils/supabase";
import { useTheme } from "@/utils/ThemeContext";
import { processImageToWebP, getWebPFileInfo } from "@/utils/imageProcessor";
import * as Sentry from '@sentry/react-native';
import { BlurView } from "expo-blur";
import DateTimePickerModal from "react-native-modal-datetime-picker";
import DateTimePicker from "@react-native-community/datetimepicker";
import ErrorBoundary from "react-native-error-boundary";
import { format } from "date-fns";
import { SafeAreaView } from "react-native-safe-area-context";
import KilometrageWithConverter from "@/components/convertMilesToKm";
import { TrimDropdown } from "@/components/TrimDropdown";
import {
  BrandSelector,
  EnhancedColorSelector,
  NeumorphicInput,
  SelectionCard,
  FuturisticGallery,
  SectionHeader,
  CONDITIONS,
  DRIVE_TRAINS,
  CATEGORIES,
  TRANSMISSIONS,
  VEHICLE_TYPES,
} from "@/components/ListingModal";
import { ModelDropdown } from "@/components/ModelDropdown";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
// CREDIT_DISABLED: import { useCredits } from "@/utils/CreditContext";
// CREDIT_DISABLED: import { PurchaseCreditsModal } from "@/components/PurchaseCreditsModal";

export const SOURCE_OPTIONS = [
  { value: "Company", label: "Company Source", icon: "🏢" }, // office
  { value: "GCC", label: "GCC", icon: "🌴" }, // Saudi as GCC proxy
  { value: "USA", label: "USA", icon: "🇺🇸" },
  { value: "Canada", label: "Canada", icon: "🇨🇦" },
  { value: "China", label: "China", icon: "🇨🇳" },
  { value: "Europe", label: "Europe", icon: "🇪🇺" }, // EU flag
];

const VEHICLE_FEATURES = [
  { id: "heated_seats", label: "Heated Seats", icon: "car-seat-heater" },
  { id: "keyless_entry", label: "Keyless Entry", icon: "key-wireless" },
  { id: "keyless_start", label: "Keyless Start", icon: "power" },
  { id: "power_mirrors", label: "Power Mirrors", icon: "car-side" },
  { id: "power_steering", label: "Power Steering", icon: "steering" },
  { id: "power_windows", label: "Power Windows", icon: "window-maximize" },
  { id: "backup_camera", label: "Backup Camera", icon: "camera" },
  { id: "bluetooth", label: "Bluetooth", icon: "bluetooth" },
  { id: "cruise_control", label: "Cruise Control", icon: "speedometer" },
  { id: "navigation", label: "Navigation System", icon: "map-marker" },
  { id: "sunroof", label: "Sunroof", icon: "weather-sunny" },
  { id: "leather_seats", label: "Leather Seats", icon: "car-seat" },
  { id: "third_row_seats", label: "Third Row Seats", icon: "seat-passenger" },
  { id: "parking_sensors", label: "Parking Sensors", icon: "parking" },
  { id: "lane_assist", label: "Lane Departure Warning", icon: "road-variant" },
  { id: "blind_spot", label: "Blind Spot Monitoring", icon: "eye-off" },
  { id: "apple_carplay", label: "Apple CarPlay", icon: "apple" },
  { id: "android_auto", label: "Android Auto", icon: "android" },
  { id: "premium_audio", label: "Premium Audio", icon: "speaker" },
  { id: "remote_start", label: "Remote Start", icon: "remote" },
];

const RENTAL_PERIODS = [
  { value: "hourly", label: "Hourly", icon: "clock-time-four" },
  { value: "daily", label: "Daily", icon: "calendar-today" },
  { value: "weekly", label: "Weekly", icon: "calendar-week" },
  { value: "monthly", label: "Monthly", icon: "clock-time-four" },
];

const FeatureItem = memo(({ feature, isSelected, onPress, isDarkMode, size = "normal" }: any) => (
  <TouchableOpacity
    onPress={onPress}
    className={`${size === "normal" ? "mr-3" : ""} ${
      isSelected ? "scale-105" : ""
    }`}
  >
    <BlurView
      intensity={isDarkMode ? 20 : 40}
      tint={isDarkMode ? "dark" : "light"}
      className={`rounded-2xl p-4 ${
        size === "normal"
          ? "w-[110px] h-[110px]"
          : "flex-row items-center p-4 mb-2"
      } justify-between items-center`}
    >
      <View
        className={`${
          size === "normal" ? "w-[40px] h-[40px]" : "w-12 h-12"
        } justify-center items-center mb-2`}
      >
        <MaterialCommunityIcons
          name={feature.icon}
          size={size === "normal" ? 30 : 24}
          color={isSelected ? "#D55004" : isDarkMode ? "#fff" : "#000"}
        />
      </View>
      <Text
        className={`${
          size === "normal" ? "text-center" : "flex-1 ml-3"
        } text-sm font-medium
        ${
          isSelected
            ? "text-red"
            : isDarkMode
            ? "text-white"
            : "text-black"
        }`}
        numberOfLines={2}
      >
        {feature.label}
      </Text>
      {isSelected && (
        <View
          className={`absolute top-2 right-2 bg-red rounded-full p-1 ${
            size === "normal" ? "" : "top-auto"
          }`}
        >
          <Ionicons name="checkmark" size={12} color="white" />
        </View>
      )}
    </BlurView>
  </TouchableOpacity>
));

const SoldModal = memo(({ 
  visible, 
  onClose, 
  isDarkMode, 
  viewMode, 
  ready, 
  t, 
  soldInfo, 
  onConfirm 
}: any) => {
  const [localPrice, setLocalPrice] = useState(soldInfo.price || "");
  const [localBuyerName, setLocalBuyerName] = useState(
    soldInfo.buyer_name || ""
  );
  const [localDate, setLocalDate] = useState(
    soldInfo.date || new Date().toISOString().split("T")[0]
  );
  const [showInlinePicker, setShowInlinePicker] = useState(false);

  // Sync local state with soldInfo when modal opens
  useEffect(() => {
    if (visible) {
      setLocalPrice(soldInfo.price || "");
      setLocalBuyerName(soldInfo.buyer_name || "");
      setLocalDate(soldInfo.date || new Date().toISOString().split("T")[0]);
    }
  }, [visible, soldInfo]);

  const handleDateChange = (
    event: any,
    selectedDate?: Date
  ) => {
    // Hide the picker first to prevent UI issues
    setShowInlinePicker(false);

    // Handle both Android and iOS patterns safely
    if (selectedDate instanceof Date) {
      try {
        setLocalDate(selectedDate.toISOString().split("T")[0]);
      } catch (error) {
        console.warn("Date formatting error:", error);
        setLocalDate(new Date().toISOString().split("T")[0]);
      }
    }
  };

  const handleConfirm = () => {
    if (viewMode !== 'rent') {
      if (!localPrice || !localBuyerName || !localDate) {
        Alert.alert(
          "Validation Error",
          "Please fill in all the required fields."
        );
        return;
      }
    }
    onConfirm({
      price: localPrice,
      buyer_name: localBuyerName,
      date: localDate,
    });
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      statusBarTranslucent={true}
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={{ flex: 1 }}>
          <BlurView
            intensity={isDarkMode ? 30 : 20}
            tint={isDarkMode ? "dark" : "light"}
            style={{
              flex: 1,
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <View
              style={{
                width: "90%",
                maxWidth: 400,
                borderRadius: 24,
                padding: 24,
                backgroundColor: isDarkMode ? "#171717" : "#ffffff",
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 2 },
                shadowRadius: 10,
                elevation: 5,
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 16,
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontSize: 20,
                      fontWeight: "bold",
                      color: isDarkMode ? "#ffffff" : "#000000",
                      marginBottom: 8,
                    }}
                  >
                    {viewMode === 'rent' 
                      ? (ready ? t('profile.inventory.mark_as_rented') : 'Mark as Rented')
                      : (ready ? t('car.mark_as_sold') : 'Mark as Sold')
                    }
                  </Text>
                  <View 
                    style={{ 
                      backgroundColor: viewMode === 'rent' ? '#3B82F6' : '#EF4444',
                      paddingHorizontal: 12,
                      paddingVertical: 4,
                      borderRadius: 12,
                      alignSelf: 'flex-start'
                    }}
                  >
                    <Text style={{ color: '#FFFFFF', fontSize: 11, fontWeight: 'bold', textTransform: 'uppercase' }}>
                      {viewMode === 'rent' 
                        ? (ready ? t('profile.inventory.for_rent') : 'FOR RENT')
                        : (ready ? t('profile.inventory.for_sale') : 'FOR SALE')
                      }
                    </Text>
                  </View>
                </View>
                <TouchableOpacity onPress={onClose}>
                  <Ionicons
                    name="close-circle"
                    size={24}
                    color={isDarkMode ? "#FFFFFF" : "#000000"}
                  />
                </TouchableOpacity>
              </View>

              {viewMode !== 'rent' && (
              <View style={{ marginBottom: 16 }}>
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: "500",
                    marginBottom: 8,
                    color: isDarkMode ? "#d4d4d4" : "#4b5563",
                  }}
                >
                  {ready ? t('car.selling_price') : 'Selling Price'}
                </Text>
                <TextInput
                  value={localPrice}
                  onChangeText={setLocalPrice}
                  placeholder={ready ? t('car.enter_selling_price') : 'Enter selling price'}
                  placeholderTextColor={isDarkMode ? "#9CA3AF" : "#6B7280"}
                  keyboardType="numeric"
                  style={{
                    height: 50,
                    paddingHorizontal: 16,
                    paddingVertical: 12,
                    borderWidth: 1,
                    borderColor: isDarkMode ? "#404040" : "#e5e7eb",
                    backgroundColor: isDarkMode ? "#262626" : "#f9fafb",
                    borderRadius: 12,
                    color: isDarkMode ? "#ffffff" : "#000000",
                    fontSize: 16,
                  }}
                />
              </View>
              )}

              {viewMode !== 'rent' && (
              <View style={{ marginBottom: 16 }}>
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: "500",
                    marginBottom: 8,
                    color: isDarkMode ? "#d4d4d4" : "#4b5563",
                  }}
                >
                  {ready ? t('profile.inventory.buyer_name') : 'Buyer Name'}
                </Text>
                <TextInput
                  value={localBuyerName}
                  onChangeText={setLocalBuyerName}
                  placeholder={ready ? t('car.enter_buyer_name') : 'Enter buyer name'}
                  placeholderTextColor={isDarkMode ? "#9CA3AF" : "#6B7280"}
                  style={{
                    height: 50,
                    paddingHorizontal: 16,
                    paddingVertical: 12,
                    borderWidth: 1,
                    borderColor: isDarkMode ? "#404040" : "#e5e7eb",
                    backgroundColor: isDarkMode ? "#262626" : "#f9fafb",
                    borderRadius: 12,
                    color: isDarkMode ? "#ffffff" : "#000000",
                    fontSize: 16,
                  }}
                />
              </View>
              )}

              {viewMode !== 'rent' && (
              <View style={{ marginBottom: 24 }}>
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: "500",
                    marginBottom: 8,
                    color: isDarkMode ? "#d4d4d4" : "#4b5563",
                  }}
                >
                  {ready ? t('car.sale_date') : 'Sale Date'}
                </Text>
                <TouchableOpacity
                  onPress={() => setShowInlinePicker(true)}
                  style={{
                    height: 50,
                    paddingHorizontal: 16,
                    paddingVertical: 12,
                    justifyContent: "center",
                    borderWidth: 1,
                    borderColor: isDarkMode ? "#404040" : "#e5e7eb",
                    backgroundColor: isDarkMode ? "#262626" : "#f9fafb",
                    borderRadius: 12,
                  }}
                >
                  <Text
                    style={{
                      color: localDate
                        ? isDarkMode ? "#ffffff" : "#000000"
                        : isDarkMode ? "#9CA3AF" : "#6B7280",
                      fontSize: 16,
                    }}
                  >
                    {localDate || "Select date"}
                  </Text>
                </TouchableOpacity>
                {showInlinePicker && (
                  <DateTimePicker
                    value={localDate ? new Date(localDate) : new Date()}
                    mode="date"
                    display="inline"
                    onChange={handleDateChange}
                    style={{ width: "100%" }}
                  />
                )}
              </View>
              )}

              {viewMode === 'rent' && (
                <View style={{ marginBottom: 24 }}>
                  <Text
                    style={{
                      fontSize: 14,
                      color: isDarkMode ? "#d4d4d4" : "#4b5563",
                      textAlign: 'center',
                      lineHeight: 22,
                    }}
                  >
                    Are you sure you want to mark this rental as rented? This will change the listing status to "Rented".
                  </Text>
                </View>
              )}

              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  marginTop: 8,
                }}
              >
                <TouchableOpacity
                  onPress={onClose}
                  style={{
                    flex: 1,
                    marginRight: 8,
                    height: 56,
                    justifyContent: "center",
                    alignItems: "center",
                    backgroundColor: isDarkMode ? "#404040" : "#d1d5db",
                    borderRadius: 12,
                  }}
                >
                  <Text
                    style={{
                      color: isDarkMode ? "#ffffff" : "#000000",
                      fontSize: 16,
                      fontWeight: "600",
                    }}
                  >
                    Cancel
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleConfirm}
                  style={{
                    flex: 1,
                    marginLeft: 8,
                    height: 56,
                    justifyContent: "center",
                    alignItems: "center",
                    backgroundColor: "#16a34a",
                    borderRadius: 12,
                  }}
                >
                  <Text
                    style={{
                      color: "#ffffff",
                      fontSize: 16,
                      fontWeight: "600",
                    }}
                  >
                    Confirm
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </BlurView>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
});

const FeatureSelector = memo(
  ({ selectedFeatures = [], onFeatureToggle, isDarkMode, ready, t }: any) => {
    // State Management
    const [showAllFeatures, setShowAllFeatures] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [currentPage, setCurrentPage] = useState(0);
    const [hasMore, setHasMore] = useState(true);
    const PAGE_SIZE = 20;

      // Whether all features are currently selected
      const allSelected = useMemo(() => {
        return (
          Array.isArray(selectedFeatures) &&
          selectedFeatures.length === VEHICLE_FEATURES.length
        );
      }, [selectedFeatures]);

      // Toggle select all / deselect all using the provided onFeatureToggle
      const handleSelectAllToggle = useCallback(() => {
        try {
          if (allSelected) {
            // Deselect every currently selected feature
            (selectedFeatures || []).forEach((fid: string) => {
              onFeatureToggle(fid);
            });
          } else {
            // Select any feature that is not yet selected
            VEHICLE_FEATURES.forEach((f) => {
              if (!selectedFeatures.includes(f.id)) {
                onFeatureToggle(f.id);
              }
            });
          }
        } catch (err) {
          console.warn('Error toggling select all features', err);
        }
      }, [allSelected, onFeatureToggle, selectedFeatures]);

    // Filter features based on search query
    const filteredFeatures = useMemo(
      () =>
        VEHICLE_FEATURES.filter((feature) =>
          feature.label.toLowerCase().includes(searchQuery.toLowerCase().trim())
        ),
      [searchQuery]
    );

    // Get paginated features for the modal
    const paginatedFeatures = useMemo(() => {
      const start = currentPage * PAGE_SIZE;
      const end = start + PAGE_SIZE;
      return filteredFeatures.slice(0, end);
    }, [filteredFeatures, currentPage]);

    // Load more function for pagination
    const loadMore = useCallback(() => {
      if ((currentPage + 1) * PAGE_SIZE < filteredFeatures.length) {
        setCurrentPage((prev) => prev + 1);
        setHasMore(true);
      } else {
        setHasMore(false);
      }
    }, [currentPage, filteredFeatures.length]);

    // Reset pagination when search query changes
    useEffect(() => {
      setCurrentPage(0);
      setHasMore(true);
    }, [searchQuery]);

    return (
      <View>
        {/* Header */}
        <View className="flex-row items-center justify-between mb-4">
          <Text
            className={`text-lg font-bold ${
              isDarkMode ? "text-white" : "text-black"
            }`}
          >
            {selectedFeatures.length > 0
              ? (ready ? t('car.selected_features_count', { count: selectedFeatures.length }) : `${selectedFeatures.length} Selected Features`)
              : (ready ? t('car.select_features') : 'Select Features')}
          </Text>

          <View className="flex-row items-center ml-auto space-x-2">
            <TouchableOpacity
              onPress={handleSelectAllToggle}
              className={`px-3 py-1 rounded-full border ${
                allSelected ? 'border-neutral-300' : 'border-transparent'
              } bg-transparent`}
            >
              <Text className={`${isDarkMode ? 'text-white' : 'text-black'}`}>
                {allSelected ? (ready ? t('car.deselect_all') : 'Deselect All') : (ready ? t('car.select_all') : 'Select All')}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                setShowAllFeatures(true);
                setCurrentPage(0);
                setHasMore(true);
              }}
              className="bg-red px-3 py-1 rounded-full"
            >
              <Text className="text-white">{ready ? t('common.view_all') : 'View All'}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Selected Features Count Badge */}
        {selectedFeatures.length > 0 && (
          <View className="mb-3">
            <Text
              className={`text-sm ${
                isDarkMode ? "text-neutral-400" : "text-neutral-600"
              }`}
            >
              {ready ? t('car.features_count', { count: selectedFeatures.length }) : `${selectedFeatures.length} feature${selectedFeatures.length !== 1 ? "s" : ""}`} {ready ? t('car.selected').toLowerCase() : 'selected'}
            </Text>
          </View>
        )}

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="mb-6"
          contentContainerStyle={{ paddingRight: 20 }}
          keyboardShouldPersistTaps="handled"
        >
          {VEHICLE_FEATURES.map((feature) => (
            <FeatureItem
              key={feature.id}
              feature={feature}
              isDarkMode={isDarkMode}
              isSelected={selectedFeatures.includes(feature.id)}
              onPress={() => onFeatureToggle(feature.id)}
            />
          ))}
        </ScrollView>

        {/* All Features Modal with Pagination */}
        <Modal
          visible={showAllFeatures}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setShowAllFeatures(false)}
        >
          <BlurView
            intensity={isDarkMode ? 20 : 40}
            tint={isDarkMode ? "dark" : "light"}
            className="flex-1"
          >
            <TouchableOpacity
              className="flex-1"
              onPress={() => setShowAllFeatures(false)}
            />
            <View
              className={`h-[85%] rounded-t-3xl ${
                isDarkMode ? "bg-black" : "bg-white"
              }`}
            >
              <View className="p-4">
                {/* Modal Header */}
                <View className="items-center mb-2">
                  <View className="w-16 h-1 rounded-full bg-gray-300" />
                </View>

                <View className="flex-row justify-between items-center mb-4">
                  <Text
                    className={`text-xl font-bold ${
                      isDarkMode ? "text-white" : "text-black"
                    }`}
                  >
                    All Features ({filteredFeatures.length})
                  </Text>
                  <TouchableOpacity
                    onPress={() => setShowAllFeatures(false)}
                    className="p-2"
                  >
                    <Ionicons
                      name="close"
                      size={24}
                      color={isDarkMode ? "white" : "black"}
                    />
                  </TouchableOpacity>
                </View>

                {/* Search Bar */}
                <View
                  className={`flex-row items-center rounded-full border border-[#ccc] dark:border-[#555] px-4 h-12 mb-4`}
                >
                  <FontAwesome
                    name="search"
                    size={20}
                    color={isDarkMode ? "white" : "black"}
                  />
                  <TextInput
                    textAlignVertical="center"
                    className={`flex-1 px-3 h-full ${
                      isDarkMode ? "text-white" : "text-black"
                    }`}
                    style={{ textAlignVertical: "center" }}
                    placeholder="Search features..."
                    placeholderTextColor={isDarkMode ? "lightgray" : "gray"}
                    value={searchQuery}
                    onChangeText={(text) => {
                      setSearchQuery(text);
                      setCurrentPage(0);
                    }}
                  />
                  {searchQuery ? (
                    <TouchableOpacity
                      onPress={() => {
                        setSearchQuery("");
                        setCurrentPage(0);
                      }}
                    >
                      <Ionicons
                        name="close-circle"
                        size={20}
                        color={isDarkMode ? "white" : "black"}
                      />
                    </TouchableOpacity>
                  ) : null}
                </View>

                {/* Selected Count Badge */}
                {selectedFeatures.length > 0 && (
                  <View
                    className={`mb-4 p-3 rounded-xl ${
                      isDarkMode ? "bg-neutral-800" : "bg-neutral-200"
                    }`}
                  >
                    <Text
                      className={`text-center ${
                        isDarkMode ? "text-white" : "text-black"
                      }`}
                    >
                      {selectedFeatures.length} feature
                      {selectedFeatures.length !== 1 ? "s" : ""} selected
                    </Text>
                  </View>
                )}

                {/* Features List with Infinite Scroll */}
                <FlatList
                  data={paginatedFeatures}
                  renderItem={({ item: feature }) => (
                    <FeatureItem
                      key={feature.id}
                      feature={feature}
                      isSelected={selectedFeatures.includes(feature.id)}
                      onPress={() => {
                        onFeatureToggle(feature.id);
                      }}
                      size="large"
                    />
                  )}
                  keyExtractor={(item) => item.id}
                  onEndReached={loadMore}
                  onEndReachedThreshold={0.5}
                  keyboardShouldPersistTaps="handled"
                  ListFooterComponent={() =>
                    hasMore ? (
                      <View className="py-4">
                        <ActivityIndicator size="small" color="#D55004" />
                      </View>
                    ) : (
                      <View className="h-32" />
                    )
                  }
                />
              </View>
            </View>
          </BlurView>
        </Modal>
      </View>
    );
  }
);

export default function AddEditListing() {
  const { t, ready } = useTranslation();
  const { isDarkMode } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{
    dealershipId?: string;
    listingId?: string;
    userId?: string;
    mode?: 'sale' | 'rent';
    vehicleCategory?: string;
  }>();

  const [dealership, setDealership] = useState<any>(null);
  const isUserMode = !!params.userId; // Determine if we're in user mode
  const viewMode = params.mode || 'sale'; // Default to 'sale' if not specified
  const [initialData, setInitialData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  // CREDIT_DISABLED: Credit system
  // const { creditBalance, deductCredits } = useCredits();
  // const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [formData, setFormData] = useState<any>({
    // Common fields
    features: [],
    trim: null,
    make: null,
    model: null,
    category: params.vehicleCategory || null, // Pre-set category from modal selection
    // Mode-specific fields
    ...(viewMode === 'sale' && {
      bought_price: null,
      date_bought: new Date(),
      seller_name: null,
      source: null,
      mileage: null,
      condition: null,
    }),
    ...(viewMode === 'rent' && {
      rental_period: 'daily', // Default rental period for rent mode
    }),
  });

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [modalImages, setModalImages] = useState<string[]>([]);
  const [uploadProgress, setUploadProgress] = useState<{
    current: number;
    total: number;
    currentImageName: string;
    completedImages: string[];
  }>({
    current: 0,
    total: 0,
    currentImageName: '',
    completedImages: []
  });
  const [showSoldModal, setShowSoldModal] = useState(false);
  const [soldInfo, setSoldInfo] = useState({
    price: "",
    date: new Date().toISOString().split("T")[0],
    buyer_name: "",
  });
  const [hasChanges, setHasChanges] = useState(false);
  const isSubscriptionValid = useCallback(() => {
    if (!dealership) return false;
    const subscriptionEndDate = dealership.subscription_end_date;
    if (!subscriptionEndDate) return false;
    const endDate = new Date(subscriptionEndDate);
    const now = new Date();
    return endDate >= now;
  }, [dealership]);

  const validateFormData = (data: any) => {
    // Base required fields for both modes
    const baseRequiredFields = [
      "make",
      "model",
      "price",
      "year",
      "transmission",
      "drivetrain",
      "type",
      "category",
    ];

    // Add mode-specific required fields
    const requiredFields = viewMode === 'rent'
      ? [...baseRequiredFields, "rental_period"] // For rent: need rental_period, no mileage/condition
      : [...baseRequiredFields, "condition", "mileage"]; // For sale: need condition and mileage

    const missingFields = requiredFields.filter((field) => {
      if (field === "mileage") {
        return (
          data[field] === null ||
          data[field] === undefined ||
          data[field] === ""
        );
      }
      return !data[field];
    });

    if (missingFields.length > 0) {
      Alert.alert(
        "Missing Fields",
        `Please fill in: ${missingFields.join(", ")}`
      );
      return false;
    }

    return true;
  };
  const extractTrimValue = (trimData: any): string | null => {
    console.log(
      "🔍 Extracting trim value from:",
      trimData,
      "Type:",
      typeof trimData
    );

    if (!trimData) {
      console.log("✅ Trim is null/undefined, returning null");
      return null;
    }

    // If it's already a string, return it (handle JSON strings)
    if (typeof trimData === "string") {
      // Check if it's a JSON string
      if (trimData.startsWith("[") || trimData.startsWith("{")) {
        try {
          const parsed = JSON.parse(trimData);
          console.log("🔧 Parsed JSON trim:", parsed);
          // If it's an array, take the first element
          if (Array.isArray(parsed) && parsed.length > 0) {
            console.log(
              "✅ Returning first element from JSON array:",
              parsed[0]
            );
            return typeof parsed[0] === "string" ? parsed[0] : null;
          }
          console.log("⚠️ JSON parsed but not a valid array, returning null");
          return null;
        } catch (error) {
          console.log(
            "⚠️ JSON parsing failed, treating as regular string:",
            trimData
          );
          // If parsing fails, treat as regular string
          return trimData.trim().length > 0 ? trimData.trim() : null;
        }
      }
      console.log("✅ Regular string trim:", trimData);
      return trimData.trim().length > 0 ? trimData.trim() : null;
    }

    // If it's an array, take the first element
    if (Array.isArray(trimData) && trimData.length > 0) {
      const firstTrim = trimData[0];
      if (typeof firstTrim === "string" && firstTrim.trim().length > 0) {
        console.log("✅ Returning first element from array:", firstTrim);
        return firstTrim.trim();
      }
    }

    console.log("⚠️ Unknown trim format, returning null");
    return null;
  };

  const handleSubmit = useCallback(() => {
    if (!validateFormData(formData)) return;

    // For user mode: skip dealership/subscription check
    if (!isUserMode) {
      if (!dealership || !isSubscriptionValid()) {
        Alert.alert(
          "Subscription Error",
          "Your subscription is not valid or has expired."
        );
        return;
      }
    } else {
      // For user mode: ensure we have a userId
      if (!params.userId) {
        Alert.alert("Error", "User authentication required");
        return;
      }

      /* CREDIT_DISABLED: Credit check for new listings
      // Only check for sale mode (not rent mode)
      if (!initialData && viewMode === 'sale') {
        const POST_LISTING_COST = 10;
        if (creditBalance < POST_LISTING_COST) {
          Alert.alert(
            "Insufficient Credits",
            `You need ${POST_LISTING_COST} credits to post a listing, but you only have ${creditBalance}. Would you like to purchase more credits?`,
            [
              { text: "Cancel", style: "cancel" },
              {
                text: "Buy Credits",
                onPress: () => setShowPurchaseModal(true),
              },
            ]
          );
          return;
        }
      }
      */
    }

    const submitListing = async () => {
      try {
        setIsLoading(true);

        if (initialData?.id) {
          const {
            id,
            listed_at,
            date_modified,
            views,
            likes,
            viewed_users,
            liked_users,
            sold_price,
            date_sold,
            buyer_name,
            status,
            dealership_name,
            dealership_logo,
            dealership_phone,
            dealership_location,
            dealership_latitude,
            dealership_longitude,
            ...allowedData
          } = formData;

          // Build base data (common fields for both modes)
          const baseData = {
            make: allowedData.make,
            model: allowedData.model,
            trim: allowedData.trim,
            price: allowedData.price,
            year: allowedData.year,
            description: allowedData.description,
            images: modalImages,
            transmission: allowedData.transmission,
            color: allowedData.color,
            drivetrain: allowedData.drivetrain,
            type: allowedData.type,
            category: allowedData.category,
            features: formData.features || [],
            // Set either dealership_id or user_id based on mode
            // Note: cars_rent only supports dealership_id (no user_id column)
            ...(viewMode === 'rent'
              ? { dealership_id: dealership.id }
              : isUserMode
              ? { user_id: params.userId, dealership_id: null }
              : { dealership_id: dealership.id, user_id: null }
            ),
          };

          // Add mode-specific fields
          const dataToUpdate = viewMode === 'rent'
            ? {
                ...baseData,
                rental_period: allowedData.rental_period || 'daily',
                // Don't include mileage, condition, source, or purchase info for rent mode
              }
            : {
                ...baseData,
                condition: allowedData.condition,
                mileage: allowedData.mileage,
                bought_price: allowedData.bought_price ? allowedData.bought_price : 0,
                date_bought: allowedData.date_bought ? new Date(allowedData.date_bought).toISOString() : null,
                seller_name: allowedData.seller_name ? allowedData.seller_name : "NA",
                source: allowedData.source,
                // Don't include rental_period for sale mode
              };

          // Determine table name based on mode
          const tableName = viewMode === 'rent' ? 'cars_rent' : 'cars';

          const updateQuery = supabase
            .from(tableName)
            .update(dataToUpdate)
            .eq("id", initialData.id);

          // Add appropriate ownership check based on mode
          // cars_rent only has dealership_id
          const finalQuery = (viewMode === 'rent' || !isUserMode)
            ? updateQuery.eq("dealership_id", dealership.id)
            : updateQuery.eq("user_id", params.userId);

          const { data, error } = await finalQuery.select(
              `
id,
listed_at,
make,
model,
trim,
price,
year,
description,
images,
sold_price,
date_sold,
status,
dealership_id,
date_modified,
views,
likes,
condition,
transmission,
color,
mileage,
drivetrain,
viewed_users,
liked_users,
type,
category,
bought_price,
date_bought,
seller_name,
buyer_name,
source,
features
`
            )
            .single();

          if (error) throw error;

          Alert.alert(ready ? t('common.success') : 'Success', ready ? t('car.listing_updated_successfully') : 'Listing updated successfully', [
            { text: ready ? t('common.ok') : 'OK', onPress: () => router.back() },
          ]);
        } else {
          const {
            dealership_name,
            dealership_logo,
            dealership_phone,
            dealership_location,
            dealership_latitude,
            dealership_longitude,
            ...allowedData
          } = formData;

          // Build base listing data (common fields for both modes)
          const baseListingData = {
            make: allowedData.make,
            model: allowedData.model,
            trim: allowedData.trim,
            price: allowedData.price,
            year: allowedData.year,
            description: allowedData.description,
            images: modalImages,
            transmission: allowedData.transmission,
            color: allowedData.color,
            drivetrain: allowedData.drivetrain,
            type: allowedData.type,
            category: allowedData.category,
            features: formData.features || [],
            status: "pending", // Both users and dealers start with pending (awaiting admin approval)
            views: 0,
            likes: 0,
            viewed_users: [],
            liked_users: [],
            // Set either dealership_id or user_id based on mode
            // Note: cars_rent only supports dealership_id (no user_id column)
            ...(viewMode === 'rent'
              ? { dealership_id: dealership.id }
              : isUserMode
              ? { user_id: params.userId, dealership_id: null }
              : { dealership_id: dealership.id, user_id: null }
            ),
          };

          // Add mode-specific fields
          const newListingData = viewMode === 'rent'
            ? {
                ...baseListingData,
                rental_period: allowedData.rental_period || 'daily',
                // Don't include mileage, condition, source, or purchase info for rent mode
              }
            : {
                ...baseListingData,
                condition: allowedData.condition,
                mileage: allowedData.mileage,
                bought_price: allowedData.bought_price,
                date_bought: allowedData.date_bought
                  ? new Date(allowedData.date_bought).toISOString()
                  : new Date().toISOString(),
                seller_name: allowedData.seller_name,
                source: allowedData.source,
                // Don't include rental_period for sale mode
              };

          // Determine table name based on mode
          const tableName = viewMode === 'rent' ? 'cars_rent' : 'cars';

          const { data, error } = await supabase
            .from(tableName)
            .insert(newListingData)
            .select()
            .single();

          if (error) throw error;

          /* CREDIT_DISABLED: Deduct credits for user mode posts
          if (isUserMode && viewMode === 'sale' && data?.id) {
            try {
              const response = await fetch(
                'https://auth.fleetapp.me/functions/v1/credit-operations',
                {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    apikey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
                    Authorization: `Bearer ${process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!}`,
                  },
                  body: JSON.stringify({
                    operation: 'post_listing',
                    userId: params.userId,
                    carId: data.id,
                  }),
                }
              );

              const creditData = await response.json();

              if (!response.ok) {
                console.error('Credit deduction failed:', creditData.error);
                // Don't throw - listing is already created, just log the error
              }
            } catch (creditError) {
              console.error('Error deducting credits:', creditError);
              // Don't throw - listing is already created
            }
          }
          */

          Alert.alert(ready ? t('common.success') : 'Success', ready ? t('car.listing_created_successfully') : 'New listing created successfully', [
            { text: ready ? t('common.ok') : 'OK', onPress: () => router.back() },
          ]);
        }
      } catch (error: any) {
        console.error("Error submitting listing:", error);
        Alert.alert(
          "Error",
          error?.message || "Failed to submit listing. Please try again."
        );
      } finally {
        setIsLoading(false);
        setHasChanges(false);
      }
    };

    submitListing();
  }, [
    formData,
    modalImages,
    initialData,
    dealership,
    router,
    isSubscriptionValid,
    validateFormData,
  ]);

  const handleGoBack = useCallback(() => {
    if (initialData) {
      // Editing
      if (hasChanges) {
        Alert.alert(
          "Discard Changes?",
          "You have unsaved changes. Are you sure you want to leave?",
          [
            { text: "Cancel", style: "cancel" },
            {
              text: "Discard",
              style: "destructive",
              onPress: () => router.back(),
            },
            { text: "Save", onPress: handleSubmit }, // Keep Save option
          ]
        );
      } else {
        router.back();
      }
    } else {
      // Adding
      if (hasChanges) {
        Alert.alert(
          "Discard Changes?",
          "You have unsaved changes.  Do you want to discard them?",
          [
            { text: "Stay", style: "cancel" }, // Changed "Cancel" to "Stay"
            {
              text: "Discard",
              style: "destructive",
              onPress: () => router.back(),
            },
          ]
        );
      } else {
        router.back();
      }
    }
  }, [hasChanges, router, handleSubmit, initialData]);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        // Only fetch dealership data if in dealer mode
        if (params.dealershipId && !isUserMode) {
          const { data: dealershipData, error: dealershipError } =
            await supabase
              .from("dealerships")
              .select("*")
              .eq("id", params.dealershipId)
              .single();

          if (dealershipError) throw dealershipError;
          setDealership(dealershipData);
        }

        if (params.listingId) {
          // Determine table name based on mode
          const tableName = viewMode === 'rent' ? 'cars_rent' : 'cars';

          const { data: carData, error: carError } = await supabase
            .from(tableName)
            .select("*")
            .eq("id", params.listingId)
            .single();

          if (carError) throw carError;

          console.log("📊 Raw car data from database:", carData);

          setInitialData(carData);

          const extractedTrim = extractTrimValue(carData.trim);
          console.log("🎯 Final extracted trim value:", extractedTrim);

          setFormData({
            ...carData,
            date_bought: carData.date_bought
              ? new Date(carData.date_bought)
              : new Date(),
            features: carData.features || [],
            trim: extractedTrim, // Use the safely extracted trim value
          });

          setModalImages(carData.images || []);
        }
      } catch (error) {
        console.error("Error fetching data:", error);
        Alert.alert("Error", "Failed to load data");
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [params.dealershipId, params.listingId]);

  const handleInputChange = useCallback(
    (key: string, value: any, customValue?: any) => {
      setFormData((prev: any) => {
        const newData = { ...prev, [key]: value };

        // Reset dependent fields when parent fields change
        if (key === "make" && !value) {
          newData.model = null;
          newData.trim = null;
        }
        if (key === "make" && value !== prev.make) {
          newData.trim = null;
        }
        if (key === "model" && value !== prev.model) {
          newData.trim = null; // Reset trim when model changes
        }

        // Handle custom color input
        if (key === "color" && value === "Other" && customValue) {
          newData.color = customValue;
        }

        // Handle mileage parsing
        if (key === "mileage") {
          const parsedMileage = parseInt(value);
          newData[key] = isNaN(parsedMileage) ? 0 : parsedMileage;
        }

        // Ensure trim is always a string or null (never an array)
        if (key === "trim") {
          if (typeof value === "string") {
            newData[key] = value;
          } else if (Array.isArray(value) && value.length > 0) {
            newData[key] = value[0]; // Take first element if array
          } else {
            newData[key] = null;
          }
        }

        return newData;
      });
      setHasChanges(true);
    },
    []
  );
  /**
   * Processes and optimizes images - now using centralized utility
   * Converts all images to WebP format for both iOS and Android
   *
   * @param uri Source image URI
   * @returns Processed image URI or original URI on failure
   */
  const processImage = processImageToWebP;

  const handleMultipleImageUpload = useCallback(
    async (assets: any[]) => {
      // Check for either dealership ID or user ID based on mode
      if (!isUserMode && !dealership?.id) {
        console.error("No dealership ID available for upload");
        return;
      }

      if (isUserMode && !params.userId) {
        console.error("No user ID available for upload");
        return;
      }

      if (!assets?.length) {
        console.warn("No assets provided for upload");
        return;
      }

      // Note: isUploading is already set to true in handleImagePick
      
      // Update progress tracking with actual upload start
      setUploadProgress(prev => ({
        ...prev,
        currentImageName: 'Starting upload...'
      }));

      try {
        const totalImages = assets.length;
        const successfulUploads: string[] = [];
        const failedUploads: { index: number; error: string }[] = [];

        console.log(`Processing ${totalImages} images one by one for better progress tracking`);

        // Process images one by one
        for (let i = 0; i < assets.length; i++) {
          const asset = assets[i];
          const imageNumber = i + 1;
          const imageName = `Image ${imageNumber}`;
          let processedUri: string | null = null; // Declare outside try block
          
          // Update progress for current image
          setUploadProgress(prev => ({
            ...prev,
            current: i,
            currentImageName: `Processing ${imageName}...`
          }));

          console.log(`Processing ${imageName} (${imageNumber}/${totalImages})`);

          try {
            // Process and optimize image
            processedUri = await processImage(asset.uri);

            if (!processedUri) {
              console.error(`Failed to process ${imageName}`);
              failedUploads.push({ index: i, error: "Image processing failed" });
              continue;
            }

            // Validate processed file exists
            const processedFileInfo = await FileSystem.getInfoAsync(processedUri);
            if (!processedFileInfo.exists || !processedFileInfo.size) {
              console.error(`Processed file invalid for ${imageName}`);
              failedUploads.push({ index: i, error: "Processed file is invalid" });
              continue;
            }

            console.log(
              `Processed file size: ${(processedFileInfo.size / (1024 * 1024)).toFixed(2)}MB`
            );

            // Generate unique filename - all images are now WebP
            const timestamp = Date.now();
            const randomId = Math.floor(Math.random() * 1000000);
            const { extension, contentType } = getWebPFileInfo();
            const fileName = `${timestamp}_${randomId}_${i}.${extension}`;
            // Use user_id or dealership_id for the folder path
            const folderId = isUserMode ? `user_${params.userId}` : dealership.id;
            // Add cars_for_rent subfolder if in rent mode
            const folderPath = viewMode === 'rent' ? `${folderId}/cars_for_rent` : folderId;
            const filePath = `${folderPath}/${fileName}`;

            // Upload image
            console.log(`Uploading ${imageName} (${imageNumber}/${totalImages})`);
            
            // Update progress to show uploading
            setUploadProgress(prev => ({
              ...prev,
              currentImageName: `Uploading ${imageName}...`
            }));

            // Read file as binary data for proper upload
            const fileData = await FileSystem.readAsStringAsync(processedUri, {
              encoding: FileSystem.EncodingType.Base64,
            });

            // Decode base64 to ArrayBuffer for React Native
            const binaryString = atob(fileData);
            const bytes = new Uint8Array(binaryString.length);
            for (let j = 0; j < binaryString.length; j++) {
              bytes[j] = binaryString.charCodeAt(j);
            }

            const uploadOptions = {
              contentType,
              cacheControl: "3600",
              upsert: false,
            };

            const uploadPromise = supabase.storage
              .from("cars")
              .upload(
                filePath,
                bytes.buffer,
                uploadOptions
              );

            const timeoutPromise = new Promise((_, reject) =>
              setTimeout(
                () => reject(new Error(`Upload timeout for ${imageName}`)),
                30000
              )
            );

            const { error: uploadError } = (await Promise.race([
              uploadPromise,
              timeoutPromise,
            ])) as any;

            if (uploadError) {
              throw new Error(`Upload failed: ${uploadError.message}`);
            }

            // Get public URL
            const { data: publicURLData } = supabase.storage
              .from("cars")
              .getPublicUrl(filePath);

            if (!publicURLData?.publicUrl) {
              throw new Error(`Failed to retrieve public URL for ${imageName}`);
            }

            const publicUrl = publicURLData.publicUrl;
            successfulUploads.push(publicUrl);

            // Add image to gallery immediately
            setModalImages(prevImages => [...prevImages, publicUrl]);
            setFormData((prev: any) => ({
              ...prev,
              images: [...(prev.images || []), publicUrl]
            }));

            // Update progress with completed image
            setUploadProgress((prev: any) => ({
              ...prev,
              current: imageNumber,
              completedImages: [...prev.completedImages, publicUrl]
            }));

            console.log(`✅ ${imageName} uploaded successfully`);

          } catch (error: any) {
            console.error(`❌ Error uploading ${imageName}:`, error.message);
            failedUploads.push({ index: i, error: error.message });
          } finally {
            // Cleanup processed file to free memory
            try {
              if (processedUri && processedUri !== asset.uri) {
                await FileSystem.deleteAsync(processedUri, { idempotent: true });
              }
            } catch (cleanupError) {
              console.warn(`Failed to cleanup processed file for ${imageName}:`, cleanupError);
            }
          }

          // Small delay between uploads to prevent overwhelming the system
          if (i < assets.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 200));
          }
        }

        // Handle results
        if (successfulUploads.length === 0) {
          throw new Error("No images were successfully uploaded");
        }

        if (failedUploads.length > 0) {
          console.warn(
            `Upload completed with ${failedUploads.length} failures out of ${totalImages} total images`
          );

          Alert.alert(
            "Partial Upload Success",
            `${successfulUploads.length} of ${totalImages} images uploaded successfully. ${failedUploads.length} images failed to upload.`,
            [{ text: "Continue", style: "default" }]
          );
        } else {
          console.log("All uploads completed successfully");
        }

        setHasChanges(true);
        return successfulUploads;

      } catch (error) {
        console.error("Critical error in upload process:", error);

        Alert.alert(
          "Upload Failed",
          `Failed to upload images: ${
            error instanceof Error ? error.message : "Unknown error"
          }. Please try again with fewer or smaller images.`
        );
        return [];
      } finally {
        setIsUploading(false);
        // Reset progress
        setUploadProgress({
          current: 0,
          total: 0,
          currentImageName: '',
          completedImages: []
        });
      }
    },
    [
      dealership,
      processImage,
      setModalImages,
      setFormData,
      setHasChanges,
      setIsUploading,
    ]
  );

  /**
   * Handles image selection from device library with memory-efficient configuration
   */
  const handleImagePick = useCallback(async () => {
    try {
      // Step 1: Request and verify permissions
      const { status } =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permission Denied",
          "Sorry, we need camera roll permissions to make this work!"
        );
        return;
      }

      // Step 2: Enforce maximum image limit
      const MAX_IMAGES = 10;
      if (modalImages.length >= MAX_IMAGES) {
        Alert.alert(
          "Maximum Images",
          `You can upload a maximum of ${MAX_IMAGES} images per listing.`
        );
        return;
      }

      // Step 3: Calculate available slots and platform-specific limits
      const remainingSlots = MAX_IMAGES - modalImages.length;

      // Set limits for image selection - Android can now handle up to 10 images
      const maxSelection = Math.min(remainingSlots, 10); // Max 10 at once for both platforms

      console.log(
        `Image picker configured for ${maxSelection} images (${remainingSlots} slots available)`
      );

      // Step 4: Launch image picker with optimized configuration
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: maxSelection > 1,
        // Android can now handle up to 10 images with proper memory management
        selectionLimit: maxSelection,
        quality: Platform.OS === "android" ? 0.7 : 0.8, // Lower initial quality on Android
        exif: false, // Skip EXIF data to reduce memory usage
        base64: false, // Skip base64 encoding in picker
        allowsEditing: false, // Disable editing to prevent memory issues
      });

      // Step 5: Handle selection result
      if (result.canceled || !result.assets || result.assets.length === 0) {
        console.log("Image picker canceled or no assets selected");
        return;
      }

      // Step 6: Show loader immediately when images are selected
      setIsUploading(true);
      
      // Initialize progress tracking immediately
      setUploadProgress({
        current: 0,
        total: result.assets.length,
        currentImageName: 'Preparing images...',
        completedImages: []
      });

      // Step 7: Pre-analyze selected images for potential issues (in background)
      let totalSize = 0;
      let largeImageCount = 0;
      const LARGE_IMAGE_THRESHOLD = 5 * 1024 * 1024; // 5MB

      for (const asset of result.assets) {
        const fileInfo = await FileSystem.getInfoAsync(asset.uri);
        if (fileInfo.exists && fileInfo.size) {
          totalSize += fileInfo.size;
          if (fileInfo.size > LARGE_IMAGE_THRESHOLD) {
            largeImageCount++;
          }
        }
      }

      console.log(
        `Selected ${result.assets.length} images, total size: ${(
          totalSize /
          (1024 * 1024)
        ).toFixed(2)}MB`
      );

      // Step 8: Warn about potential issues with very large images
      if (totalSize > 25 * 1024 * 1024 || largeImageCount > 2) {
        Alert.alert(
          "Large Images Detected",
          "Some selected images are very large, which may cause slower uploads. Images will be optimized automatically.",
          [
            { text: "Cancel", style: "cancel", onPress: () => {
              setIsUploading(false);
              setUploadProgress({
                current: 0,
                total: 0,
                currentImageName: '',
                completedImages: []
              });
            }},
            {
              text: "Proceed Anyway",
              onPress: () => {
                handleMultipleImageUpload(result.assets);
              },
            },
          ],
          { cancelable: true }
        );
        return;
      }

      // Step 9: Start upload process
      try {
        await handleMultipleImageUpload(result.assets);
      } catch (error) {
        console.error("Error uploading images:", error);
        Alert.alert(
          "Upload Failed",
          "Failed to upload images. Please try again with fewer or smaller images."
        );
      } finally {
        setIsUploading(false);
      }
    } catch (error) {
      console.error("Error in image picker:", error);
      Alert.alert(
        "Error",
        Platform.OS === "android"
          ? "Failed to open image picker. Try selecting fewer images or restart the app."
          : "Failed to open image picker. Please try again."
      );
    }
  }, [modalImages.length, handleMultipleImageUpload]);

  const handleImageRemove = useCallback(async (imageUrl: string) => {
    try {
      const urlParts = imageUrl.split("/");
      const filePath = urlParts.slice(urlParts.indexOf("cars") + 1).join("/");

      const { error } = await supabase.storage.from("cars").remove([filePath]);

      if (error) throw error;

      setModalImages((prevImages: any[]) =>
        prevImages.filter((url: string) => url !== imageUrl)
      );
      setFormData((prev: { images: any[] }) => ({
        ...prev,
        images: prev.images?.filter((url: string) => url !== imageUrl) || [],
      }));
      setHasChanges(true); // Mark changes as made
    } catch (error) {
      console.error("Error removing image:", error);
      Alert.alert("Error", "Failed to remove image. Please try again.");
    }
  }, []);

  const handleImageReorder = useCallback((newOrder: string[]) => {
    setModalImages(newOrder);
    setFormData((prev: any) => ({
      ...prev,
      images: newOrder,
    }));
    setHasChanges(true); // Mark changes as made
  }, []);

  const resolveStoragePathFromUrl = useCallback((publicUrl: string, bucket: string): string | null => {
    try {
      const { pathname } = new URL(publicUrl);
      const decodedPath = decodeURIComponent(pathname);
      const bucketPath = `/storage/v1/object/public/${bucket}/`;
      if (!decodedPath.startsWith(bucketPath)) {
        return null;
      }
      return decodedPath.slice(bucketPath.length);
    } catch (error) {
      return null;
    }
  }, []);

  const handleDeleteConfirmation = useCallback(() => {
    // Check permissions based on mode
    if (!isUserMode) {
      if (!dealership || !isSubscriptionValid()) {
        Alert.alert(
          "Subscription Error",
          "Your subscription is not valid or has expired."
        );
        return;
      }
    } else {
      if (!params.userId) {
        Alert.alert("Error", "User authentication required");
        return;
      }
    }

    Alert.alert(
      "Delete Listing",
      "Are you sure you want to delete this listing? It will be hidden from all users but conversations will be preserved.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          onPress: async () => {
            try {
              if (!initialData || !initialData.id) {
                Alert.alert(
                  "Error",
                  "Unable to delete: missing required information"
                );
                return;
              }

              setIsLoading(true);

              // Determine table name based on mode
              const tableName = viewMode === 'rent' ? 'cars_rent' : 'cars';

              // Soft delete: update status to 'deleted' instead of hard delete
              // The database trigger will automatically set deleted_at and deleted_by
              // Images are kept in storage for now (can be cleaned up later if needed)
              let updateQuery = supabase
                .from(tableName)
                .update({ status: 'deleted' })
                .eq("id", initialData.id);

              // For rent mode, always use dealership_id (cars_rent has no user_id column)
              // For sale mode, use user_id for users, dealership_id for dealers
              const finalQuery = (viewMode === 'rent' || !isUserMode)
                ? updateQuery.eq("dealership_id", dealership.id)
                : updateQuery.eq("user_id", params.userId);

              const { error } = await finalQuery;

              if (error) {
                console.error("Supabase deletion error:", error);
                throw error;
              }

              Alert.alert("Success", "Listing deleted successfully", [
                { text: "OK", onPress: () => router.back() },
              ]);
            } catch (error: any) {
              console.error("Error deleting listing:", error);
              
              // Capture error to Sentry with context
              Sentry.captureException(error, {
                tags: {
                  action: 'delete_listing',
                  view_mode: viewMode,
                  user_mode: isUserMode ? 'user' : 'dealer',
                },
                contexts: {
                  listing: {
                    listing_id: initialData?.id,
                    table_name: tableName,
                    dealership_id: dealership?.id,
                    user_id: params?.userId,
                  },
                },
              });
              
              Alert.alert(
                "Error",
                `Failed to delete listing. Please try again. (${error.message})`
              );
            } finally {
              setIsLoading(false);
            }
          },
          style: "destructive",
        },
      ]
    );
  }, [initialData, dealership, isSubscriptionValid, isUserMode, params.userId, router]);

  const handleMarkAsSold = useCallback(
    async (soldData = soldInfo) => {
      if (!initialData) {
        setShowSoldModal(false);
        return;
      }

      // Check permissions based on mode
      if (!isUserMode) {
        if (!dealership || !isSubscriptionValid()) {
          setShowSoldModal(false);
          Alert.alert("Subscription Error", "Your subscription is not valid.");
          return;
        }
      } else {
        if (!params.userId) {
          setShowSoldModal(false);
          Alert.alert("Error", "User authentication required");
          return;
        }
      }

      // For rent mode, we only need to update status (no buyer info in cars_rent table)
      // For sale mode, require all fields
      if (viewMode !== 'rent') {
        if (!soldData.price || !soldData.date || !soldData.buyer_name) {
          Alert.alert(
            "Validation Error",
            "Please fill in all the required fields."
          );
          return;
        }
      }

      try {
        setIsLoading(true);

        // Determine table name and status based on mode
        const tableName = viewMode === 'rent' ? 'cars_rent' : 'cars';
        const statusValue = viewMode === 'rent' ? 'rented' : 'sold';

        // Build update data based on mode
        // cars_rent table doesn't have sold_price, date_sold, or buyer_name columns
        const updateData = viewMode === 'rent'
          ? { status: statusValue }
          : {
              status: statusValue,
              sold_price: parseInt(soldData.price),
              date_sold: soldData.date,
              buyer_name: soldData.buyer_name,
            };

        const updateQuery = supabase
          .from(tableName)
          .update(updateData)
          .eq("id", initialData.id);

        // For cars_rent, always use dealership_id (no user_id column)
        const finalQuery = (viewMode === 'rent' || !isUserMode)
          ? updateQuery.eq("dealership_id", dealership.id)
          : updateQuery.eq("user_id", params.userId);

        const { error } = await finalQuery;

        if (error) throw error;

        setShowSoldModal(false);
        const successMessage = viewMode === 'rent' 
          ? 'Listing marked as rented successfully' 
          : 'Listing marked as sold successfully';
        Alert.alert("Success", successMessage, [
          { text: "OK", onPress: () => router.back() },
        ]);
      } catch (error) {
        console.error("Error marking as sold:", error);
        
        // Capture error to Sentry with context for debugging client-specific issues
        Sentry.captureException(error, {
          tags: {
            action: 'mark_as_sold',
            view_mode: viewMode,
            user_mode: isUserMode ? 'user' : 'dealer',
          },
          contexts: {
            listing: {
              listing_id: initialData?.id,
              table_name: viewMode === 'rent' ? 'cars_rent' : 'cars',
              status_to_set: viewMode === 'rent' ? 'rented' : 'sold',
              dealership_id: dealership?.id,
              user_id: params?.userId,
            },
            sold_info: {
              has_price: !!soldData?.price,
              has_date: !!soldData?.date,
              has_buyer_name: !!soldData?.buyer_name,
            },
          },
        });
        
        Alert.alert(
          "Error",
          "Failed to mark listing as sold. Please try again."
        );
      } finally {
        setIsLoading(false);
      }
    },
    [initialData, dealership, isSubscriptionValid, soldInfo, isUserMode, params.userId, router]
  );

  const handleUnmarkRented = useCallback(async () => {
    if (!initialData) return;

    // Check permissions
    if (!isUserMode) {
      if (!dealership || !isSubscriptionValid()) {
        Alert.alert("Subscription Error", "Your subscription is not valid.");
        return;
      }
    } else {
      if (!params.userId) {
        Alert.alert("Error", "User authentication required");
        return;
      }
    }

    Alert.alert(
      "Unmark as Rented",
      "Are you sure you want to mark this rental as available again?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Yes, Make Available",
          onPress: async () => {
            try {
              setIsLoading(true);

              const tableName = viewMode === 'rent' ? 'cars_rent' : 'cars';

              const updateQuery = supabase
                .from(tableName)
                .update({ status: 'available' })
                .eq("id", initialData.id);

              const finalQuery = (viewMode === 'rent' || !isUserMode)
                ? updateQuery.eq("dealership_id", dealership.id)
                : updateQuery.eq("user_id", params.userId);

              const { error } = await finalQuery;

              if (error) throw error;

              Alert.alert("Success", "Listing is now available for rent again", [
                { text: "OK", onPress: () => router.back() },
              ]);
            } catch (error) {
              console.error("Error unmarking as rented:", error);
              
              // Capture error to Sentry with context
              Sentry.captureException(error, {
                tags: {
                  action: 'unmark_rented',
                  view_mode: viewMode,
                  user_mode: isUserMode ? 'user' : 'dealer',
                },
                contexts: {
                  listing: {
                    listing_id: initialData?.id,
                    table_name: tableName,
                    current_status: initialData?.status,
                    target_status: 'available',
                    dealership_id: dealership?.id,
                    user_id: params?.userId,
                  },
                },
              });
              
              Alert.alert(
                "Error",
                "Failed to update listing status. Please try again."
              );
            } finally {
              setIsLoading(false);
            }
          },
        },
      ]
    );
  }, [initialData, dealership, isSubscriptionValid, isUserMode, params.userId, router, viewMode]);


  if (isLoading || !ready) {
    return (
      <View className="flex-1 justify-center items-center">
        <ActivityIndicator size="large" color="#D55004" />
      </View>
    );
  }

  return (
    <SafeAreaView className={`flex-1 ${isDarkMode ? "bg-black" : "bg-white"}`}>
      <View className="px-6 py-4">
        {/* Top Bar with Back and Delete */}
        <View className="flex-row items-center justify-between mb-1">
          <TouchableOpacity onPress={handleGoBack} className="p-2">
            <Ionicons
              name="arrow-back"
              size={24}
              color={isDarkMode ? "#fff" : "#000"}
            />
          </TouchableOpacity>
          <Text
            className={`text-xl font-bold ${
              isDarkMode ? "text-white" : "text-black"
            }`}
          >
            {initialData ? (ready ? t('common.edit_vehicle') : 'Edit Vehicle') : (ready ? t('common.add_vehicle') : 'Add Vehicle')}
          </Text>
          {initialData && (
            <TouchableOpacity onPress={handleDeleteConfirmation} className="p-2">
              <Ionicons
                name="trash-bin-outline"
                size={24}
                color={isDarkMode ? "red" : "red"}
              />
            </TouchableOpacity>
          )}
          {!initialData && <View className="w-10 h-10" />}
        </View>

        {/* Mode Indicator Badge */}
        <View className="flex-row items-center justify-center mb-1">
          <View 
            style={{ 
              backgroundColor: viewMode === 'rent' ? '#3B82F6' : '#EF4444',
              paddingHorizontal: 16,
              paddingVertical: 8,
              borderRadius: 20
            }}
          >
            <Text className="text-white text-sm font-bold uppercase tracking-wide">
              {viewMode === 'rent' 
                ? (ready ? t('profile.inventory.for_rent') : 'FOR RENT')
                : (ready ? t('profile.inventory.for_sale') : 'FOR SALE')
              }
            </Text>
          </View>
        </View>
      </View>

      <ScrollView 
        className="flex-1 px-6" 
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View className="py-4">
          <SectionHeader
            title={ready ? t('car.vehicle_images') : 'Vehicle Images'}
            subtitle={ready ? t('common.add_vehicle_photos_subtitle') : 'Add up to 10 high-quality photos of your vehicle'}
            isDarkMode={isDarkMode}
          />
          
          {/* Upload Progress Indicator */}
          {isUploading && uploadProgress.total > 0 && (
            <View className="mb-4 p-4 bg-gray-100 dark:bg-gray-800 rounded-xl">
              <View className="flex-row items-center justify-between mb-2">
                <Text className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {ready ? t('car.uploading_images') : 'Uploading Images'}
                </Text>
                <Text className="text-sm text-gray-500 dark:text-gray-400">
                  {uploadProgress.current} of {uploadProgress.total}
                </Text>
              </View>
              
              {/* Progress Bar */}
              <View className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mb-2">
                <View 
                  className="bg-orange-500 h-2 rounded-full transition-all duration-300"
                  style={{ 
                    width: `${(uploadProgress.current / uploadProgress.total) * 100}%` 
                  }}
                />
              </View>
              
              {/* Current Image Name */}
              {uploadProgress.currentImageName && (
                <Text className="text-xs text-gray-600 dark:text-gray-400">
                  Currently uploading: {uploadProgress.currentImageName}
                </Text>
              )}
              
              {/* Completed Images Count */}
              {uploadProgress.completedImages.length > 0 && (
                <Text className="text-xs text-green-600 dark:text-green-400 mt-1">
                  ✅ {uploadProgress.completedImages.length} images uploaded successfully
                </Text>
              )}
            </View>
          )}
          
          <FuturisticGallery
            images={modalImages}
            onAdd={handleImagePick}
            onRemove={handleImageRemove}
            onReorder={handleImageReorder}
            isDarkMode={isDarkMode}
            isUploading={isUploading}
          />
        </View>

        <View className="mb-8">
          <SectionHeader
            title={ready ? t('common.vehicle_brand_model') : 'Vehicle Brand & Model'}
            subtitle={ready ? t('common.select_vehicle_make_model') : "Select your vehicle's make and model"}
            isDarkMode={isDarkMode}
          />
          <Text
            className={`text-sm font-medium mb-3 ${
              isDarkMode ? "text-neutral-300" : "text-neutral-700"
            }`}
          >
            {ready ? t('car.brand') : 'Brand'}
          </Text>
          {/* Selected Make Display */}
          <BrandSelector
            selectedBrand={formData.make}
            onSelectBrand={(make: any) => {
              handleInputChange("make", make);
              handleInputChange("model", "");
            }}
            isDarkMode={isDarkMode}
          />
          {formData.make && (
            <View
              className={`mb-3 p-3 rounded-xl border ${
                isDarkMode
                  ? "bg-neutral-800 border-neutral-700"
                  : "bg-neutral-100 border-neutral-300"
              }`}
            >
              <View className="flex-row items-center">
                <MaterialCommunityIcons
                  name="check-circle"
                  size={20}
                  color="#16a34a"
                />
                <Text
                  className={`ml-2 font-medium ${
                    isDarkMode ? "text-white" : "text-black"
                  }`}
                >
                  {ready ? t('car.selected') : 'Selected'}: {formData.make}
                </Text>
                <TouchableOpacity
                  onPress={() => {
                    handleInputChange("make", "");
                    handleInputChange("model", "");
                  }}
                  className="ml-auto p-1"
                >
                  <Ionicons
                    name="close-circle"
                    size={20}
                    color={isDarkMode ? "#ef4444" : "#dc2626"}
                  />
                </TouchableOpacity>
              </View>
            </View>
          )}
          {formData.make && (
            <ModelDropdown
              make={formData.make}
              value={formData.model}
              onChange={(model: any) => handleInputChange("model", model)}
              isDarkMode={isDarkMode}
            />
          )}
          {formData.make &&
            formData.model &&
            typeof formData.make === "string" &&
            typeof formData.model === "string" &&
            formData.make.length > 0 &&
            formData.model.length > 0 && (
              <TrimDropdown
                make={formData.make}
                model={formData.model}
                value={formData.trim}
                onChange={(trim: any) => handleInputChange("trim", trim)}
                isDarkMode={isDarkMode}
              />
            )}
          <View className="n">
            <NeumorphicInput
              label={ready ? t('common.year') : 'Year'}
              value={formData.year}
              onChangeText={(text: any) => handleInputChange("year", text)}
              placeholder={ready ? t('car.enter_vehicle_year') : 'Enter vehicle year'}
              keyboardType="numeric"
              required
              icon="calendar"
              isDarkMode={isDarkMode}
            />

            <NeumorphicInput
              label={
                viewMode === 'rent'
                  ? (ready ? t('profile.inventory.rental_price') : 'Rental Price')
                  : (ready ? t('common.price') : 'Price')
              }
              value={formData.price}
              onChangeText={(text: any) => handleInputChange("price", text)}
              placeholder={
                viewMode === 'rent'
                  ? (ready ? t('profile.inventory.enter_rental_price') : 'Enter rental rate')
                  : (ready ? t('car.enter_vehicle_price') : 'Enter vehicle price')
              }
              keyboardType="numeric"
              required
              isDarkMode={isDarkMode}
              icon="cash"
            />
          </View>
        </View>

        <View className="mb-8">
          <SectionHeader
            title={ready ? t('common.vehicle_color') : 'Vehicle Color'}
            subtitle={ready ? t('common.select_exterior_color') : 'Select the exterior color'}
            isDarkMode={isDarkMode}
          />
          <EnhancedColorSelector
            value={formData.color}
            onChange={(color: any) => handleInputChange("color", color)}
            isDarkMode={isDarkMode}
          />
        </View>

        <View className="mb-8">
          <SectionHeader
            title={ready ? t('common.vehicle_classification') : 'Vehicle Classification'}
            subtitle={ready ? t('common.select_vehicle_category_type') : "Select your vehicle's category and type"}
            isDarkMode={isDarkMode}
          />

          <Text
            className={`text-sm font-medium mb-3 ${
              isDarkMode ? "text-neutral-300" : "text-neutral-700"
            }`}
          >
            {ready ? t('car.category') : 'Category'}
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            className="mb-6"
            keyboardShouldPersistTaps="handled"
          >
            {CATEGORIES.map((cat) => (
              <SelectionCard
                key={cat.value}
                label={cat.label}
                icon={cat.icon}
                isSelected={formData.category === cat.value}
                onSelect={() => handleInputChange("category", cat.value)}
                isDarkMode={isDarkMode}
              />
            ))}
          </ScrollView>

          <Text
            className={`text-sm font-medium mb-3 ${
              isDarkMode ? "text-neutral-300" : "text-neutral-700"
            }`}
          >
            {ready ? t('car.fuel_type') : 'Fuel Type'}
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            className="mb-6"
            keyboardShouldPersistTaps="handled"
          >
            {VEHICLE_TYPES.map((type) => (
              <SelectionCard
                key={type.value}
                label={type.label}
                icon={type.icon}
                isSelected={formData.type === type.value}
                onSelect={() => handleInputChange("type", type.value)}
                isDarkMode={isDarkMode}
              />
            ))}
          </ScrollView>
        </View>

        {/* Show Vehicle Source only for Sale mode AND Dealer mode */}
        {viewMode === 'sale' && !isUserMode && (
          <View className="mb-8">
            <SectionHeader
              title={ready ? t('car.vehicle_source') : 'Vehicle Source'}
              subtitle={ready ? t('car.source_subtitle') : 'Select where the vehicle was sourced from'}
              isDarkMode={isDarkMode}
            />

            <Text
              className={`text-sm font-medium mb-3 ${
                isDarkMode ? "text-neutral-300" : "text-neutral-700"
              }`}
            >
              {ready ? t('car.source') : 'Source'}
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              className="mb-3"
              keyboardShouldPersistTaps="handled"
            >
              {SOURCE_OPTIONS.map((source) => (
                <SelectionCard
                  key={source.value}
                  label={source.label}
                  isEmoji={true}
                  icon={source.icon}
                  isSelected={formData.source === source.value}
                  onSelect={() => handleInputChange("source", source.value)}
                  isDarkMode={isDarkMode}
                />
              ))}
            </ScrollView>
          </View>
        )}
        {/* Add this after the technical specifications section */}
        <View className="mb-8">
          <SectionHeader
            title={ready ? t('car.vehicle_description') : 'Vehicle Description'}
            subtitle={ready ? t('car.description_subtitle') : "Add details about the vehicle's history and features"}
            isDarkMode={isDarkMode}
          />

          <Text
            className={`text-sm font-medium mb-2 ${
              isDarkMode ? "text-neutral-300" : "text-neutral-700"
            }`}
          >
            {ready ? t('car.description') : 'Description'}
          </Text>
          <View
            className={`rounded-2xl overflow-hidden ${
              isDarkMode ? "bg-[#1c1c1c]" : "bg-[#f5f5f5]"
            }`}
          >
            <BlurView
              intensity={isDarkMode ? 20 : 40}
              tint={isDarkMode ? "dark" : "light"}
              className="p-4"
            >
              <TextInput
                multiline
                numberOfLines={6}
                textAlignVertical="top"
                value={formData.description}
                onChangeText={(text) => handleInputChange("description", text)}
                placeholder={ready ? t('car.enter_details') : 'Enter details about the vehicle, its history, features, etc.'}
                placeholderTextColor={isDarkMode ? "#9CA3AF" : "#6B7280"}
                className={`w-full text-base ${
                  isDarkMode ? "text-white" : "text-black"
                }`}
                style={{ height: 120 }}
              />
            </BlurView>
          </View>
        </View>

        <View className="mb-8">
          <SectionHeader
            title={ready ? t('car.technical_specifications') : 'Technical Specifications'}
            subtitle={ready ? t('car.detailed_technical_information') : 'Detailed technical information'}
            isDarkMode={isDarkMode}
          />

          {/* Show Mileage only for Sale mode */}
          {viewMode === 'sale' && (
            <KilometrageWithConverter
              value={formData.mileage}
              onChangeText={(text) => handleInputChange("mileage", text)}
              isDarkMode={isDarkMode}
              placeholder="Enter vehicle kilometrage"
            />
          )}

          {/* Show Rental Period only for Rent mode */}
          {viewMode === 'rent' && (
            <>
              <Text
                className={`text-sm font-medium mb-3 ${
                  isDarkMode ? "text-neutral-300" : "text-neutral-700"
                }`}
              >
                {ready ? t('profile.inventory.rental_period') : 'Rental Period'}
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                className="mb-3"
                keyboardShouldPersistTaps="handled"
              >
                {RENTAL_PERIODS.map((period) => (
                  <SelectionCard
                    key={period.value}
                    label={period.label}
                    icon={period.icon}
                    isSelected={formData.rental_period === period.value}
                    onSelect={() => handleInputChange("rental_period", period.value)}
                    isDarkMode={isDarkMode}
                  />
                ))}
              </ScrollView>
            </>
          )}

          <Text
            className={`text-sm font-medium mb-3 ${
              isDarkMode ? "text-neutral-300" : "text-neutral-700"
            }`}
          >
            {ready ? t('car.transmission') : 'Transmission'}
          </Text>
          <View className="flex-row mb-6">
            {TRANSMISSIONS.map((trans) => (
              <SelectionCard
                key={trans.value}
                label={trans.label}
                icon={trans.icon}
                isSelected={formData.transmission === trans.value}
                onSelect={() => handleInputChange("transmission", trans.value)}
                isDarkMode={isDarkMode}
              />
            ))}
          </View>

          <Text
            className={`text-sm font-medium mb-3 ${
              isDarkMode ? "text-neutral-300" : "text-neutral-700"
            }`}
          >
            {ready ? t('car.drive_train') : 'Drive Train'}
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            className="mb-6"
            keyboardShouldPersistTaps="handled"
          >
            {DRIVE_TRAINS.map((drive) => (
              <SelectionCard
                key={drive.value}
                label={drive.label}
                icon={drive.icon}
                isSelected={formData.drivetrain === drive.value}
                onSelect={() => handleInputChange("drivetrain", drive.value)}
                isDarkMode={isDarkMode}
              />
            ))}
          </ScrollView>

          {/* Show Condition only for Sale mode */}
          {viewMode === 'sale' && (
            <>
              <Text
                className={`text-sm font-medium mb-3 ${
                  isDarkMode ? "text-neutral-300" : "text-neutral-700"
                }`}
              >
                {ready ? t('car.condition') : 'Condition'}
              </Text>
              <View className="flex-row mb-6">
                {CONDITIONS.map((cond) => (
                  <SelectionCard
                    key={cond.value}
                    label={cond.label}
                    icon={cond.icon}
                    isSelected={formData.condition === cond.value}
                    onSelect={() => handleInputChange("condition", cond.value)}
                    isDarkMode={isDarkMode}
                  />
                ))}
              </View>
            </>
          )}
        </View>

        <View className="mb-8">
          <SectionHeader
            title={ready ? t('car.features') : 'Vehicle Features'}
            subtitle={ready ? t('car.select_additional_features') : 'Select additional features and options available in this vehicle'}
            isDarkMode={isDarkMode}
          />

          <FeatureSelector
            selectedFeatures={formData.features || []}
            onFeatureToggle={(featureId: any) => {
              setFormData((prev: any) => {
                const currentFeatures = prev.features || [];
                let updatedFeatures;

                if (currentFeatures.includes(featureId)) {
                  // Remove feature if already selected
                  updatedFeatures = currentFeatures.filter(
                    (id: any) => id !== featureId
                  );
                } else {
                  // Add feature if not selected
                  updatedFeatures = [...currentFeatures, featureId];
                }

                setHasChanges(true);
                return { ...prev, features: updatedFeatures };
              });
            }}
            isDarkMode={isDarkMode}
            ready={ready}
            t={t}
          />
        </View>

        {/* Show Purchase Information only for Sale mode AND Dealer mode */}
        {viewMode === 'sale' && !isUserMode && (
          <View className="mb-8">
            <SectionHeader
              title={ready ? t('car.purchase_information') : 'Purchase Information'}
              subtitle={ready ? t('car.purchase_info_subtitle') : 'Details about vehicle acquisition'}
              isDarkMode={isDarkMode}
            />

            <NeumorphicInput
              label={ready ? t('car.purchase_price') : 'Purchase Price'}
              value={formData.bought_price}
              onChangeText={(text: any) =>
                handleInputChange("bought_price", text)
              }
              placeholder={ready ? t('car.enter_purchase_price') : 'Enter purchase price'}
              keyboardType="numeric"
              icon="cash-multiple"
              prefix="$"
              isDarkMode={isDarkMode}
            />

            {/* Date Picker Implementation */}
            <TouchableOpacity
              onPress={() => setShowDatePicker(true)}
              className="mb-6"
            >
              <Text
                className={`text-sm font-medium mb-2 ${
                  isDarkMode ? "text-neutral-300" : "text-neutral-700"
                }`}
              >
                Purchase Date
              </Text>
              <View
                className={`rounded-2xl overflow-hidden ${
                  isDarkMode ? "bg-[#1c1c1c]" : "bg-[#f5f5f5]"
                }`}
              >
                <BlurView
                  intensity={isDarkMode ? 20 : 40}
                  tint={isDarkMode ? "dark" : "light"}
                  className="flex-row items-center p-4"
                >
                  <MaterialCommunityIcons
                    name="calendar"
                    size={24}
                    color={isDarkMode ? "#fff" : "#000"}
                  />
                  <Text
                    className={`ml-3 text-base ${
                      isDarkMode ? "text-white" : "text-black"
                    }`}
                  >
                    {formData.date_bought ? (
                      <Text
                        className={`ml-3 text-base ${
                          isDarkMode ? "text-white" : "text-black"
                        }`}
                      >
                        {(() => {
                          try {
                            const dateObj = new Date(formData.date_bought);
                            return !isNaN(dateObj.getTime())
                              ? format(dateObj, "PPP")
                              : "Select purchase date";
                          } catch (error) {
                            console.warn("Date display error:", error);
                            return "Select purchase date";
                          }
                        })()}
                      </Text>
                    ) : (
                      <Text
                        className={`ml-3 text-base ${
                          isDarkMode ? "text-neutral-400" : "text-neutral-500"
                        }`}
                      >
                        Select purchase date
                      </Text>
                    )}
                  </Text>
                </BlurView>
              </View>
            </TouchableOpacity>

            <DateTimePickerModal
              isVisible={showDatePicker}
              mode="date"
              date={
                formData.date_bought &&
                !isNaN(new Date(formData.date_bought).getTime())
                  ? new Date(formData.date_bought)
                  : new Date()
              }
              onConfirm={(selectedDate) => {
                try {
                  // Add safety check before calling toISOString
                  if (selectedDate && !isNaN(selectedDate.getTime())) {
                    handleInputChange("date_bought", selectedDate.toISOString());
                  } else {
                    handleInputChange("date_bought", new Date().toISOString());
                  }
                } catch (error) {
                  console.warn("Date handling error:", error);
                  handleInputChange("date_bought", new Date().toISOString());
                }
                setShowDatePicker(false);
              }}
              onCancel={() => setShowDatePicker(false)}
              isDarkModeEnabled={isDarkMode}
              cancelButtonTestID="cancel-button"
              confirmButtonTestID="confirm-button"
            />

            <NeumorphicInput
              label={ready ? t('car.bought_from') : 'Bought From'}
              value={formData.seller_name}
              onChangeText={(text: any) => handleInputChange("seller_name", text)}
              placeholder={ready ? t('car.enter_bought_from_name') : 'Enter bought from name'}
              icon="account"
              isDarkMode={isDarkMode}
            />
          </View>
        )}
      </ScrollView>

      {/* Pinned Buttons - Conditional Rendering */}
      <View
        className={`p-4 -mb-2 ${
          isDarkMode ? "bg-black" : "bg-neutral-100"
        } border-t ${isDarkMode ? "border-neutral-800" : "border-neutral-200"}`}
      >
        {initialData ? ( // Edit Mode Buttons
          <View className="flex-row justify-between">
            <TouchableOpacity
              onPress={() => {
                if (initialData?.status === "available") {
                  setShowSoldModal(true);
                } else if (viewMode === 'rent' && initialData?.status === "rented") {
                  handleUnmarkRented();
                }
              }}
              disabled={viewMode !== 'rent' && initialData?.status === "sold"}
              className={`flex-1 py-4 rounded-full items-center justify-center mr-2 ${
                initialData?.status === "available"
                  ? "bg-green-600"
                  : viewMode === 'rent' && initialData?.status === "rented"
                  ? "bg-blue-600"
                  : "bg-orange-600 opacity-50"
              }`}
            >
              <Text className="text-white font-medium">
                {viewMode === 'rent'
                  ? (initialData?.status === "rented" ? "Mark as Available" : "Mark as Rented")
                  : (initialData?.status === "sold" ? "Sold" : "Mark as Sold")
                }
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleSubmit}
              disabled={!hasChanges} // Disable if no changes
              className={`flex-1 py-4 rounded-full items-center justify-center ml-2 ${
                hasChanges
                  ? "bg-red"
                  : isDarkMode
                  ? "bg-neutral-900"
                  : "bg-neutral-400" // Change color based on hasChanges
              }`}
            >
              <Text
                className={` ${
                  hasChanges
                    ? "text-white"
                    : isDarkMode
                    ? "text-neutral-600"
                    : "text-neutral-100" // Change color based on hasChanges
                } font-medium`}
              >
{ready ? t('common.update') : 'Update'}
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          // Add Mode Button
          <TouchableOpacity
            onPress={handleSubmit}
            className="w-full py-4 rounded-full bg-red items-center justify-center"
          >
            <Text className="text-white font-medium">{ready ? t('common.publish') : 'Publish'}</Text>
          </TouchableOpacity>
        )}
      </View>

      <SoldModal
        visible={showSoldModal}
        onClose={() => setShowSoldModal(false)}
        isDarkMode={isDarkMode}
        viewMode={viewMode}
        ready={ready}
        t={t}
        soldInfo={soldInfo}
        onConfirm={handleMarkAsSold}
      />

      {/* CREDIT_DISABLED: Purchase Credits Modal
      <PurchaseCreditsModal
        visible={showPurchaseModal}
        onClose={() => setShowPurchaseModal(false)}
        isDarkMode={isDarkMode}
        onSuccess={() => {
          setShowPurchaseModal(false);
          // Optionally refresh balance or show a message
        }}
      />
      */}
    </SafeAreaView>
  );
}
