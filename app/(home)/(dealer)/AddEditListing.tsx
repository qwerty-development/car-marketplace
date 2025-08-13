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
import { Buffer } from "buffer";
import * as ImageManipulator from "expo-image-manipulator";
import { useTheme } from "@/utils/ThemeContext";
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

const FeatureSelector = memo(
  ({ selectedFeatures = [], onFeatureToggle, isDarkMode }: any) => {
    // State Management
    const [showAllFeatures, setShowAllFeatures] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [currentPage, setCurrentPage] = useState(0);
    const [hasMore, setHasMore] = useState(true);
    const PAGE_SIZE = 20;

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

    // Render feature item component
    const FeatureItem = useCallback(
      ({ feature, isSelected, onPress, size = "normal" }: any) => (
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
      ),
      [isDarkMode]
    );

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
              ? `${selectedFeatures.length} Selected Features`
              : "Select Features"}
          </Text>
          <TouchableOpacity
            onPress={() => {
              setShowAllFeatures(true);
              setCurrentPage(0);
              setHasMore(true);
            }}
            className="ml-auto bg-red px-3 py-1 rounded-full"
          >
            <Text className="text-white">View All</Text>
          </TouchableOpacity>
        </View>

        {/* Selected Features Count Badge */}
        {selectedFeatures.length > 0 && (
          <View className="mb-3">
            <Text
              className={`text-sm ${
                isDarkMode ? "text-neutral-400" : "text-neutral-600"
              }`}
            >
              {selectedFeatures.length} feature
              {selectedFeatures.length !== 1 ? "s" : ""} selected
            </Text>
          </View>
        )}

        {/* Horizontal Scrollable List - Show selected features first, then others */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="mb-6"
          contentContainerStyle={{ paddingRight: 20 }}
        >
          {VEHICLE_FEATURES.map((feature) => (
            <FeatureItem
              key={feature.id}
              feature={feature}
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
  const { isDarkMode } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{
    dealershipId: string;
    listingId?: string;
  }>();

  const [dealership, setDealership] = useState<any>(null);
  const [initialData, setInitialData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [formData, setFormData] = useState<any>({
    bought_price: null,
    date_bought: new Date(),
    seller_name: null,
    features: [],
    trim: null,
    make: null,
    model: null,
  });

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [modalImages, setModalImages] = useState<string[]>([]);
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
    const requiredFields = [
      "make",
      "model",
      "price",
      "year",
      "condition",
      "transmission",
      "mileage",
      "drivetrain",
      "type",
      "category",
    ];

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
    if (!dealership || !isSubscriptionValid()) {
      Alert.alert(
        "Subscription Error",
        "Your subscription is not valid or has expired."
      );
      return;
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

          const dataToUpdate = {
            make: allowedData.make,
            model: allowedData.model,
            trim: allowedData.trim,
            price: allowedData.price,
            year: allowedData.year,
            description: allowedData.description,
            images: modalImages,
            condition: allowedData.condition,
            transmission: allowedData.transmission,
            color: allowedData.color,
            mileage: allowedData.mileage,
            drivetrain: allowedData.drivetrain,
            type: allowedData.type,
            category: allowedData.category,
            bought_price: allowedData.bought_price
              ? allowedData.bought_price
              : 0,
            date_bought: allowedData.date_bought
              ? new Date(allowedData.date_bought).toISOString()
              : null,
            seller_name: allowedData.seller_name
              ? allowedData.seller_name
              : "NA",
            source: allowedData.source,
            features: formData.features || [],
            dealership_id: dealership.id,
          };

          const { data, error } = await supabase
            .from("cars")
            .update(dataToUpdate)
            .eq("id", initialData.id)
            .eq("dealership_id", dealership.id)
            .select(
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

          Alert.alert("Success", "Listing updated successfully", [
            { text: "OK", onPress: () => router.back() },
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

          const newListingData = {
            make: allowedData.make,
            model: allowedData.model,
            trim: allowedData.trim,
            price: allowedData.price,
            year: allowedData.year,
            description: allowedData.description,
            images: modalImages,
            condition: allowedData.condition,
            transmission: allowedData.transmission,
            color: allowedData.color,
            mileage: allowedData.mileage,
            drivetrain: allowedData.drivetrain,
            type: allowedData.type,
            category: allowedData.category,
            bought_price: allowedData.bought_price,
            date_bought: allowedData.date_bought
              ? new Date(allowedData.date_bought).toISOString()
              : new Date().toISOString(),
            seller_name: allowedData.seller_name,
            dealership_id: dealership.id,
            source: allowedData.source,
            features: formData.features || [],
            status: "pending",
            views: 0,
            likes: 0,
            viewed_users: [],
            liked_users: [],
          };

          const { data, error } = await supabase
            .from("cars")
            .insert(newListingData)
            .select()
            .single();

          if (error) throw error;

          Alert.alert("Success", "New listing created successfully", [
            { text: "OK", onPress: () => router.back() },
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
        if (params.dealershipId) {
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
          const { data: carData, error: carError } = await supabase
            .from("cars")
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
   * Processes and optimizes images with precise dimension control while preserving aspect ratio
   *
   * @param uri Source image URI
   * @returns Processed image URI or original URI on failure
   */
  const processImage = async (uri: string): Promise<string> => {
    if (!uri) {
      console.warn("processImage: No URI provided.");
      return "";
    }

    try {
      // Step 1: Get file information and analyze source characteristics
      const fileInfo = await FileSystem.getInfoAsync(uri);
      if (!fileInfo.exists) throw new Error("File does not exist");

      console.log(
        `Original file size: ${(fileInfo.size / (1024 * 1024)).toFixed(2)}MB`
      );

      // Step 2: Detect iOS photos (typically larger with more metadata)
      const isLikelyiOSPhoto =
        uri.includes("HEIC") ||
        uri.includes("IMG_") ||
        uri.includes("DCIM") ||
        uri.endsWith(".HEIC") ||
        uri.endsWith(".heic") ||
        fileInfo.size > 3 * 1024 * 1024;

      // Step 3: Get original image dimensions
      const imageMeta = await ImageManipulator.manipulateAsync(uri, []);
      const originalWidth = imageMeta.width;
      const originalHeight = imageMeta.height;

      if (!originalWidth || !originalHeight) {
        throw new Error("Unable to determine original image dimensions");
      }

      console.log(`Original dimensions: ${originalWidth}×${originalHeight}`);

      // Step 4: Calculate target dimensions while preserving aspect ratio (tighter cap for better compression)
      const MAX_WIDTH = 1080;
      const MAX_HEIGHT = 1080;
      const aspectRatio = originalWidth / originalHeight;

      let targetWidth = originalWidth;
      let targetHeight = originalHeight;

      if (originalWidth > MAX_WIDTH || originalHeight > MAX_HEIGHT) {
        if (aspectRatio > 1) {
          // Landscape orientation
          targetWidth = MAX_WIDTH;
          targetHeight = Math.round(MAX_WIDTH / aspectRatio);
        } else {
          // Portrait orientation
          targetHeight = MAX_HEIGHT;
          targetWidth = Math.round(MAX_HEIGHT * aspectRatio);
        }
      }

      console.log(`Target dimensions: ${targetWidth}×${targetHeight}`);

      // Step 5: Determine optimal compression level based on file size (more aggressive)
      let compressionLevel = 0.6; // Default compression

      if (fileInfo.size > 10 * 1024 * 1024) {
        compressionLevel = 0.4; // Aggressive compression for very large images
      } else if (fileInfo.size > 5 * 1024 * 1024 || isLikelyiOSPhoto) {
        compressionLevel = 0.5; // Stronger compression for large images and iOS photos
      }

      // Step 6: First-pass optimization with exact dimension control
      const targetFormat = Platform.OS === "android"
        ? ImageManipulator.SaveFormat.WEBP
        : ImageManipulator.SaveFormat.JPEG;
      const firstPass = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: targetWidth, height: targetHeight } }],
        {
          compress: compressionLevel,
          format: targetFormat,
        }
      );

      if (!firstPass.uri) {
        throw new Error("First-pass image processing failed: no URI returned");
      }

      // Step 7: For iOS photos, apply second-pass to normalize format issues
      let finalResult = firstPass;

      if (isLikelyiOSPhoto) {
        try {
          console.log("Applying second-pass optimization for iOS photo");
          finalResult = await ImageManipulator.manipulateAsync(
            firstPass.uri,
            [], // No transformations, just re-encode
            {
              compress: compressionLevel,
              format: targetFormat,
              base64: false,
            }
          );

          if (!finalResult.uri) {
            console.warn(
              "Second-pass processing failed, using first-pass result"
            );
            finalResult = firstPass; // Fallback to first pass
          }
        } catch (secondPassError) {
          console.warn("Error in second-pass processing:", secondPassError);
          finalResult = firstPass; // Fallback to first pass
        }
      }

      // Step 8: Verify final file size and report compression metrics
      const processedInfo = await FileSystem.getInfoAsync(finalResult.uri);
      if (processedInfo.exists && processedInfo.size) {
        console.log(
          `Processed image size: ${(processedInfo.size / (1024 * 1024)).toFixed(
            2
          )}MB`
        );

        // Calculate and log compression ratio
        if (fileInfo.size) {
          const ratio = ((processedInfo.size / fileInfo.size) * 100).toFixed(1);
          console.log(`Compression ratio: ${ratio}% of original`);
        }
      }

      return finalResult.uri;
    } catch (error) {
      console.error("processImage error:", error);
      // Return original URI as fallback
      return uri;
    }
  };

  const handleMultipleImageUpload = useCallback(
    async (assets: any[]) => {
      if (!dealership?.id) {
        console.error("No dealership ID available for upload");
        return;
      }

      if (!assets?.length) {
        console.warn("No assets provided for upload");
        return;
      }

      setIsUploading(true);

      try {
        // STEP 1: Configure batch processing parameters with platform optimization
        const batchSize = Platform.OS === "android" ? 2 : 3;
        console.log(
          `Processing ${assets.length} images in batches of ${batchSize}`
        );

        const results: {
          url: string | null;
          uploaded: boolean;
          error?: string;
        }[] = [];
        let progressCounter = 0;
        const totalImages = assets.length;

        // STEP 2: Process images in batches to prevent memory issues
        for (let i = 0; i < assets.length; i += batchSize) {
          const batchNumber = Math.floor(i / batchSize) + 1;
          const totalBatches = Math.ceil(assets.length / batchSize);
          console.log(`Processing batch ${batchNumber} of ${totalBatches}`);

          const batch = assets.slice(i, i + batchSize);

          // STEP 3: Process all images in current batch concurrently
          const batchPromises = batch.map(
            async (asset: { uri: string }, batchIndex: number) => {
              const index = i + batchIndex;
              const imageNumber = index + 1;
              let uploadSuccessful = false;
              let publicUrl: string | null = null;
              let errorMessage = "";

              try {
                // STEP 3.1: Process and optimize image
                console.log(`Processing image ${imageNumber}/${totalImages}`);
                const processedUri = await processImage(asset.uri);

                if (!processedUri) {
                  console.error(`Failed to process image ${imageNumber}`);
                  return {
                    url: null,
                    uploaded: false,
                    error: "Image processing failed",
                  };
                }

                // STEP 3.2: Validate processed file exists
                const processedFileInfo = await FileSystem.getInfoAsync(
                  processedUri
                );
                if (!processedFileInfo.exists || !processedFileInfo.size) {
                  console.error(
                    `Processed file invalid for image ${imageNumber}`
                  );
                  return {
                    url: null,
                    uploaded: false,
                    error: "Processed file is invalid",
                  };
                }

                console.log(
                  `Processed file size: ${(
                    processedFileInfo.size /
                    (1024 * 1024)
                  ).toFixed(2)}MB`
                );

                // STEP 3.3: Generate unique filename with high entropy
                const timestamp = Date.now();
                const randomId = Math.floor(Math.random() * 1000000);
                const fileName = `${timestamp}_${randomId}_${index}.jpg`;
                const filePath = `${dealership.id}/${fileName}`;

                // STEP 3.4: UPLOAD LOGIC - The critical part
                console.log(`Uploading image ${imageNumber}/${totalImages}`);

                // Read file content as base64 for reliable uploads
                const base64Content = await FileSystem.readAsStringAsync(
                  processedUri,
                  {
                    encoding: FileSystem.EncodingType.Base64,
                  }
                );

                if (!base64Content || base64Content.length === 0) {
                  throw new Error(
                    `Empty file content for image ${imageNumber}`
                  );
                }

                // Convert base64 to Buffer for Supabase upload
                const fileBuffer = Buffer.from(base64Content, "base64");

                // Upload configuration
                const uploadOptions = {
                  contentType: "image/jpeg",
                  cacheControl: "3600", // 1 hour cache
                  upsert: false, // Prevent accidental overwrites
                };

                // Execute upload with timeout protection
                const uploadPromise = supabase.storage
                  .from("cars")
                  .upload(filePath, fileBuffer, uploadOptions);

                // Add timeout protection for upload operation
                const timeoutPromise = new Promise((_, reject) =>
                  setTimeout(
                    () =>
                      reject(
                        new Error(`Upload timeout for image ${imageNumber}`)
                      ),
                    30000
                  )
                );

                const { error: uploadError } = (await Promise.race([
                  uploadPromise,
                  timeoutPromise,
                ])) as any;

                if (uploadError) {
                  throw new Error(
                    `Upload failed for image ${imageNumber}: ${uploadError.message}`
                  );
                }

                // STEP 3.5: Retrieve public URL - THIS IS WHERE SUCCESS IS DETERMINED
                const { data: publicURLData } = supabase.storage
                  .from("cars")
                  .getPublicUrl(filePath);

                if (!publicURLData?.publicUrl) {
                  throw new Error(
                    `Failed to retrieve public URL for image ${imageNumber}`
                  );
                }

                // AT THIS POINT, UPLOAD IS SUCCESSFUL
                uploadSuccessful = true;
                publicUrl = publicURLData.publicUrl;

                // STEP 3.6: OPTIONAL validation - DON'T FAIL UPLOAD IF THIS FAILS
                try {
                  console.log(
                    `Validating accessibility for image ${imageNumber}`
                  );
                  const controller = new AbortController();
                  const timeoutId = setTimeout(() => controller.abort(), 5000);
                  try {
                    const response = await fetch(publicURLData.publicUrl, (
                      {
                        method: "HEAD",
                      } as any
                    ));
                    if (!response.ok) {
                      console.warn(
                        `Validation warning for image ${imageNumber}: HTTP ${response.status} (upload still successful)`
                      );
                    } else {
                      console.log(`Image ${imageNumber} validation successful`);
                    }
                  } finally {
                    clearTimeout(timeoutId);
                  }
                } catch (validationError) {
                  // CRITICAL: Don't fail the upload because validation failed
                  console.warn(
                    `Validation failed for image ${imageNumber} (upload still successful):`,
                    validationError
                  );
                }

                // STEP 3.7: Update progress counter
                progressCounter++;
                console.log(
                  `Upload progress: ${progressCounter}/${totalImages} - URL: ${publicUrl}`
                );

                return {
                  url: publicUrl,
                  uploaded: true,
                };
              } catch (error) {
                console.error(
                  `Error uploading image ${imageNumber}/${totalImages}:`,
                  error
                );

                // Enhanced error logging for debugging
                if (error instanceof Error) {
                  console.error(`Error details: ${error.message}`);
                  errorMessage = error.message;
                }

                // IMPORTANT: If upload was successful but validation failed, still count as success
                if (uploadSuccessful && publicUrl) {
                  console.log(
                    `Image ${imageNumber} upload succeeded despite validation error`
                  );
                  return {
                    url: publicUrl,
                    uploaded: true,
                    error: `Validation warning: ${errorMessage}`,
                  };
                }

                return {
                  url: null,
                  uploaded: false,
                  error: errorMessage || "Unknown error",
                };
              }
            }
          );

          // STEP 4: Wait for all images in current batch to complete
          const batchResults = await Promise.all(batchPromises);
          results.push(...batchResults);

          // STEP 5: Memory management - pause between batches
          if (i + batchSize < assets.length) {
            const pauseDuration = Platform.OS === "android" ? 500 : 200;
            console.log(
              `Pausing ${pauseDuration}ms between batches for memory management`
            );
            await new Promise((resolve) => setTimeout(resolve, pauseDuration));
          }
        }

        // STEP 6: Process and validate results - IMPROVED LOGIC
        const successfulUploads = results
          .filter((result) => result.uploaded && result.url)
          .map((result) => result.url!);

        const actualFailures = results.filter((result) => !result.uploaded);
        const validationWarnings = results.filter(
          (result) => result.uploaded && result.error
        );

        console.log(`Upload summary:
        - Total images: ${totalImages}
        - Successful uploads: ${successfulUploads.length}
        - Actual failures: ${actualFailures.length}
        - Validation warnings: ${validationWarnings.length}
      `);

        // STEP 7: Handle different scenarios
        if (successfulUploads.length === 0) {
          throw new Error("No images were successfully uploaded");
        }

        // Show appropriate user feedback
        if (actualFailures.length > 0) {
          console.warn(
            `Upload completed with ${actualFailures.length} actual failures out of ${totalImages} total images`
          );

          Alert.alert(
            "Partial Upload Success",
            `${successfulUploads.length} of ${totalImages} images uploaded successfully. ${actualFailures.length} images failed to upload.`,
            [{ text: "Continue", style: "default" }]
          );
        } else if (validationWarnings.length > 0) {
          console.log(
            `All uploads successful with ${validationWarnings.length} validation warnings`
          );
          // Don't show alert for validation warnings - uploads were successful
        } else {
          console.log("All uploads completed successfully");
          // Optionally show success message
          // Alert.alert("Success", "All images uploaded successfully");
        }

        console.log(
          `Upload batch complete: ${successfulUploads.length}/${totalImages} images successful`
        );

        // STEP 8: Update state with successful uploads only
        setModalImages((prevImages: any) => [
          ...successfulUploads,
          ...prevImages,
        ]);
        setFormData((prevData: { images: any }) => ({
          ...prevData,
          images: [...successfulUploads, ...(prevData.images || [])],
        }));
        setHasChanges(true);

        return successfulUploads;
      } catch (error) {
        console.error("Critical error in batch upload process:", error);

        Alert.alert(
          "Upload Failed",
          `Failed to upload images: ${
            error instanceof Error ? error.message : "Unknown error"
          }. Please try again with fewer or smaller images.`
        );
        return [];
      } finally {
        setIsUploading(false);
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

      // Set stricter limits for Android due to memory constraints
      const maxSelection =
        Platform.OS === "android"
          ? Math.min(remainingSlots, 10) // Max 3 at once for Android
          : Math.min(remainingSlots, 10); // Max 5 at once for iOS

      console.log(
        `Image picker configured for ${maxSelection} images (${remainingSlots} slots available)`
      );

      // Step 4: Launch image picker with optimized configuration
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: maxSelection > 1,
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

      // Step 6: Pre-analyze selected images for potential issues
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

      // Step 7: Warn about potential issues with very large images
      if (totalSize > 25 * 1024 * 1024 || largeImageCount > 2) {
        Alert.alert(
          "Large Images Detected",
          "Some selected images are very large, which may cause slower uploads. Images will be optimized automatically.",
          [
            { text: "Cancel", style: "cancel" },
            {
              text: "Proceed Anyway",
              onPress: () => {
                setIsUploading(true);
                handleMultipleImageUpload(result.assets).finally(() =>
                  setIsUploading(false)
                );
              },
            },
          ],
          { cancelable: true }
        );
        return;
      }

      // Step 8: Standard upload flow for normal-sized images
      setIsUploading(true);
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

  const handleDeleteConfirmation = useCallback(() => {
    if (!dealership || !isSubscriptionValid()) {
      Alert.alert(
        "Subscription Error",
        "Your subscription is not valid or has expired."
      );
      return;
    }

    Alert.alert(
      "Delete Listing",
      "Are you sure you want to delete this listing? This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          onPress: async () => {
            try {
              if (
                !initialData ||
                !initialData.id ||
                !dealership ||
                !dealership.id
              ) {
                console.error("Missing data for deletion:", {
                  initialData: !!initialData,
                  listingId: initialData?.id,
                  dealership: !!dealership,
                  dealershipId: dealership?.id,
                });
                Alert.alert(
                  "Error",
                  "Unable to delete: missing required information"
                );
                return;
              }

              setIsLoading(true);

              console.log(
                `Deleting listing ID ${initialData.id} from dealership ${dealership.id}`
              );

              const { error } = await supabase
                .from("cars")
                .delete()
                .eq("id", initialData.id)
                .eq("dealership_id", dealership.id);

              if (error) {
                console.error("Supabase deletion error:", error);
                throw error;
              }

              console.log("Deletion successful");
              Alert.alert("Success", "Listing deleted successfully", [
                { text: "OK", onPress: () => router.back() },
              ]);
            } catch (error: any) {
              console.error("Error deleting listing:", error);
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
  }, [initialData, dealership, isSubscriptionValid, router]);

  const handleMarkAsSold = useCallback(
    async (soldData = soldInfo) => {
      if (!initialData || !dealership || !isSubscriptionValid()) {
        setShowSoldModal(false);
        return;
      }

      if (!soldData.price || !soldData.date || !soldData.buyer_name) {
        Alert.alert(
          "Validation Error",
          "Please fill in all the required fields."
        );
        return;
      }

      try {
        setIsLoading(true);

        const { error } = await supabase
          .from("cars")
          .update({
            status: "sold",
            sold_price: parseInt(soldData.price),
            date_sold: soldData.date,
            buyer_name: soldData.buyer_name,
          })
          .eq("id", initialData.id)
          .eq("dealership_id", dealership.id);

        if (error) throw error;

        setShowSoldModal(false);
        Alert.alert("Success", "Listing marked as sold successfully", [
          { text: "OK", onPress: () => router.back() },
        ]);
      } catch (error) {
        console.error("Error marking as sold:", error);
        Alert.alert(
          "Error",
          "Failed to mark listing as sold. Please try again."
        );
      } finally {
        setIsLoading(false);
      }
    },
    [initialData, dealership, isSubscriptionValid, soldInfo, router]
  );

  const SoldModal = () => {
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
      if (showSoldModal) {
        setLocalPrice(soldInfo.price || "");
        setLocalBuyerName(soldInfo.buyer_name || "");
        setLocalDate(soldInfo.date || new Date().toISOString().split("T")[0]);
      }
    }, [showSoldModal, soldInfo]);

    const handleDateChange = (
      event: any,
      selectedDate?: Date
    ) => {
      // Hide the picker first to prevent UI issues
      setShowInlinePicker(false);

      // Handle both Android and iOS patterns safely
      // On Android, cancelled = undefined selectedDate
      // On iOS, we get an event.type
      if (selectedDate instanceof Date) {
        try {
          // Add safety checks before using date methods
          setLocalDate(selectedDate.toISOString().split("T")[0]);
        } catch (error) {
          console.warn("Date formatting error:", error);
          // Fallback to current date
          setLocalDate(new Date().toISOString().split("T")[0]);
        }
      }
    };

    const handleConfirm = () => {
      if (!localPrice || !localBuyerName || !localDate) {
        Alert.alert(
          "Validation Error",
          "Please fill in all the required fields."
        );
        return;
      }
      // Pass local values directly to the mark-as-sold function
      handleMarkAsSold({
        price: localPrice,
        buyer_name: localBuyerName,
        date: localDate,
      });
    };

    return (
      <Modal
        visible={showSoldModal}
        transparent={true}
        animationType="slide"
        statusBarTranslucent={true}
        onRequestClose={() => setShowSoldModal(false)}
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
                {/* Header */}
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 24,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 20,
                      fontWeight: "bold",
                      color: isDarkMode ? "#ffffff" : "#000000",
                    }}
                  >
                    Mark as Sold
                  </Text>
                  <TouchableOpacity onPress={() => setShowSoldModal(false)}>
                    <Ionicons
                      name="close-circle"
                      size={24}
                      color={isDarkMode ? "#FFFFFF" : "#000000"}
                    />
                  </TouchableOpacity>
                </View>

                {/* Selling Price */}
                <View style={{ marginBottom: 16 }}>
                  <Text
                    style={{
                      fontSize: 14,
                      fontWeight: "500",
                      marginBottom: 8,
                      color: isDarkMode ? "#d4d4d4" : "#4b5563",
                    }}
                  >
                    Selling Price
                  </Text>
                  <TextInput
                    value={localPrice}
                    onChangeText={setLocalPrice}
                    placeholder="Enter selling price"
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

                {/* Buyer Name */}
                <View style={{ marginBottom: 16 }}>
                  <Text
                    style={{
                      fontSize: 14,
                      fontWeight: "500",
                      marginBottom: 8,
                      color: isDarkMode ? "#d4d4d4" : "#4b5563",
                    }}
                  >
                    Buyer Name
                  </Text>
                  <TextInput
                    value={localBuyerName}
                    onChangeText={setLocalBuyerName}
                    placeholder="Enter buyer name"
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

                {/* Sale Date */}
                <View style={{ marginBottom: 24 }}>
                  <Text
                    style={{
                      fontSize: 14,
                      fontWeight: "500",
                      marginBottom: 8,
                      color: isDarkMode ? "#d4d4d4" : "#4b5563",
                    }}
                  >
                    Sale Date
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
                          ? isDarkMode
                            ? "#ffffff"
                            : "#000000"
                          : isDarkMode
                          ? "#9CA3AF"
                          : "#6B7280",
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

                {/* Action Buttons */}
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    marginTop: 8,
                  }}
                >
                  <TouchableOpacity
                    onPress={() => setShowSoldModal(false)}
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
  };

  if (isLoading) {
    return (
      <View className="flex-1 justify-center items-center">
        <ActivityIndicator size="large" color="#D55004" />
      </View>
    );
  }

  return (
    <SafeAreaView className={`flex-1 ${isDarkMode ? "bg-black" : "bg-white"}`}>
      <View className="flex-row items-center justify-between px-6 py-4">
        <TouchableOpacity onPress={handleGoBack} className="p-2">
          <Ionicons
            name="arrow-back"
            size={24}
            color={isDarkMode ? "#fff" : "#000"}
          />
        </TouchableOpacity>
        <Text
          className={`text-xl  font-bold ${
            isDarkMode ? "text-white" : "text-black"
          }`}
        >
          {initialData ? "Edit Vehicle" : "Add Vehicle"}
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

      <ScrollView className="flex-1 px-6" showsVerticalScrollIndicator={false}>
        <View className="py-4">
          <SectionHeader
            title="Vehicle Images"
            subtitle="Add up to 10 high-quality photos of your vehicle"
            isDarkMode={isDarkMode}
          />
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
            title="Vehicle Brand & Model"
            subtitle="Select your vehicle's make and model"
            isDarkMode={isDarkMode}
          />
          <Text
            className={`text-sm font-medium mb-3 ${
              isDarkMode ? "text-neutral-300" : "text-neutral-700"
            }`}
          >
            Brand
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
                  Selected: {formData.make}
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
              label="Year"
              value={formData.year}
              onChangeText={(text: any) => handleInputChange("year", text)}
              placeholder="Enter vehicle year"
              keyboardType="numeric"
              required
              icon="calendar"
              isDarkMode={isDarkMode}
            />

            <NeumorphicInput
              label="Price"
              value={formData.price}
              onChangeText={(text: any) => handleInputChange("price", text)}
              placeholder="Enter vehicle price"
              keyboardType="numeric"
              required
              isDarkMode={isDarkMode}
              icon="cash"
            />
          </View>
        </View>

        <View className="mb-8">
          <SectionHeader
            title="Vehicle Color"
            subtitle="Select the exterior color"
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
            title="Vehicle Classification"
            subtitle="Select your vehicle's category and type"
            isDarkMode={isDarkMode}
          />

          <Text
            className={`text-sm font-medium mb-3 ${
              isDarkMode ? "text-neutral-300" : "text-neutral-700"
            }`}
          >
            Category
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            className="mb-6"
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
            Fuel Type
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            className="mb-6"
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

        <View className="mb-8">
          <SectionHeader
            title="Vehicle Source"
            subtitle="Select where the vehicle was sourced from"
            isDarkMode={isDarkMode}
          />

          <Text
            className={`text-sm font-medium mb-3 ${
              isDarkMode ? "text-neutral-300" : "text-neutral-700"
            }`}
          >
            Source
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            className="mb-6"
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
        {/* Add this after the technical specifications section */}
        <View className="mb-8">
          <SectionHeader
            title="Vehicle Description"
            subtitle="Add details about the vehicle's history and features"
            isDarkMode={isDarkMode}
          />

          <Text
            className={`text-sm font-medium mb-2 ${
              isDarkMode ? "text-neutral-300" : "text-neutral-700"
            }`}
          >
            Description
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
                placeholder="Enter details about the vehicle, its history, features, etc."
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
            title="Technical Specifications"
            subtitle="Detailed technical information"
            isDarkMode={isDarkMode}
          />

          <KilometrageWithConverter
            value={formData.mileage}
            onChangeText={(text) => handleInputChange("mileage", text)}
            isDarkMode={isDarkMode}
            placeholder="Enter vehicle kilometrage"
          />

          <Text
            className={`text-sm font-medium mb-3 ${
              isDarkMode ? "text-neutral-300" : "text-neutral-700"
            }`}
          >
            {" "}
            Transmission
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
            Drive Train
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            className="mb-6"
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

          <Text
            className={`text-sm font-medium mb-3 ${
              isDarkMode ? "text-neutral-300" : "text-neutral-700"
            }`}
          >
            Condition
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
        </View>

        <View className="mb-8">
          <SectionHeader
            title="Vehicle Features"
            subtitle="Select additional features and options available in this vehicle"
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
          />
        </View>

        {/* Purchase Information */}
        <View className="mb-8">
          <SectionHeader
            title="Purchase Information"
            subtitle="Details about vehicle acquisition"
            isDarkMode={isDarkMode}
          />

          <NeumorphicInput
            label="Purchase Price"
            value={formData.bought_price}
            onChangeText={(text: any) =>
              handleInputChange("bought_price", text)
            }
            placeholder="Enter purchase price"
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
            label="Bought From"
            value={formData.seller_name}
            onChangeText={(text: any) => handleInputChange("seller_name", text)}
            placeholder="Enter bought from name"
            icon="account"
            isDarkMode={isDarkMode}
          />
        </View>
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
              onPress={() =>
                initialData?.status === "available"
                  ? setShowSoldModal(true)
                  : null
              }
              disabled={initialData?.status === "sold"}
              className={`flex-1 py-4 rounded-full items-center justify-center mr-2 ${
                initialData?.status === "sold"
                  ? "bg-orange-600 opacity-50"
                  : "bg-green-600"
              }`}
            >
              <Text className="text-white font-medium">
                {initialData?.status === "sold" ? "Sold" : "Mark as Sold"}
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
                Update
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          // Add Mode Button
          <TouchableOpacity
            onPress={handleSubmit}
            className="w-full py-4 rounded-full bg-red items-center justify-center"
          >
            <Text className="text-white font-medium">Publish</Text>
          </TouchableOpacity>
        )}
      </View>

      <SoldModal />
    </SafeAreaView>
  );
}
