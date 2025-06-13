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
import * as ImageManipulator from 'expo-image-manipulator';
import { useTheme } from "@/utils/ThemeContext";
import { BlurView } from "expo-blur";
import DateTimePickerModal from "react-native-modal-datetime-picker";
import DateTimePicker from "@react-native-community/datetimepicker";
import ErrorBoundary from 'react-native-error-boundary';
import { format } from "date-fns";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  BrandSelector,
  ModelDropdown,
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
import { useLocalSearchParams, useRouter } from "expo-router";

const SOURCE_OPTIONS = [
  { value: 'Company', label: 'Company Source', icon: 'office-building' },
  { value: 'GCC', label: 'GCC', icon: 'map-marker' },
  { value: 'USA', label: 'US', icon: 'flag' },
  { value: 'Canada', label: 'Canada', icon: 'flag' },
  { value: 'Europe', label: 'Europe', icon: 'earth' }
];
const VEHICLE_FEATURES = [
  { id: 'heated_seats', label: 'Heated Seats', icon: 'car-seat-heater' },
  { id: 'keyless_entry', label: 'Keyless Entry', icon: 'key-wireless' },
  { id: 'keyless_start', label: 'Keyless Start', icon: 'power' },
  { id: 'power_mirrors', label: 'Power Mirrors', icon: 'car-side' },
  { id: 'power_steering', label: 'Power Steering', icon: 'steering' },
  { id: 'power_windows', label: 'Power Windows', icon: 'window-maximize' },
  { id: 'backup_camera', label: 'Backup Camera', icon: 'camera' },
  { id: 'bluetooth', label: 'Bluetooth', icon: 'bluetooth' },
  { id: 'cruise_control', label: 'Cruise Control', icon: 'speedometer' },
  { id: 'navigation', label: 'Navigation System', icon: 'map-marker' },
  { id: 'sunroof', label: 'Sunroof', icon: 'weather-sunny' },
  { id: 'leather_seats', label: 'Leather Seats', icon: 'car-seat' },
  { id: 'third_row_seats', label: 'Third Row Seats', icon: 'seat-passenger' },
  { id: 'parking_sensors', label: 'Parking Sensors', icon: 'parking' },
  { id: 'lane_assist', label: 'Lane Departure Warning', icon: 'road-variant' },
  { id: 'blind_spot', label: 'Blind Spot Monitoring', icon: 'eye-off' },
  { id: 'apple_carplay', label: 'Apple CarPlay', icon: 'apple' },
  { id: 'android_auto', label: 'Android Auto', icon: 'android' },
  { id: 'premium_audio', label: 'Premium Audio', icon: 'speaker' },
  { id: 'remote_start', label: 'Remote Start', icon: 'remote' },
];

/**
 * Translates technical database and API errors into user-friendly messages
 */
const getErrorMessage = (error: any, context: string = '') => {
  const errorMessage = error?.message || error?.toString() || 'Unknown error';
  const lowerMessage = errorMessage.toLowerCase();

  // Database validation errors
  if (lowerMessage.includes('invalid input syntax for type bigint')) {
    return 'Please enter valid numbers for price, year, and mileage fields. Make sure there are no letters or special characters.';
  }

  if (lowerMessage.includes('invalid input syntax for type integer')) {
    return 'Please enter valid whole numbers for numeric fields like year and mileage.';
  }

  if (lowerMessage.includes('value too long')) {
    return 'Some of your text entries are too long. Please shorten your description or other text fields.';
  }

  if (lowerMessage.includes('duplicate key value')) {
    return 'This listing already exists. Please check if you\'ve already added this vehicle.';
  }

  if (lowerMessage.includes('foreign key constraint')) {
    return 'There was an issue linking this listing to your dealership. Please try again or contact support.';
  }

  // Network and connection errors
  if (lowerMessage.includes('network') || lowerMessage.includes('fetch')) {
    return 'Connection problem. Please check your internet connection and try again.';
  }

  if (lowerMessage.includes('timeout')) {
    return 'The request took too long. Please check your connection and try again.';
  }

  // Authentication and authorization errors
  if (lowerMessage.includes('unauthorized') || lowerMessage.includes('forbidden')) {
    return 'You don\'t have permission to perform this action. Please check your account status.';
  }

  if (lowerMessage.includes('subscription')) {
    return 'Your subscription has expired or is invalid. Please renew your subscription to continue.';
  }

  // File upload errors
  if (lowerMessage.includes('file') && lowerMessage.includes('size')) {
    return 'One or more images are too large. Please choose smaller images or compress them.';
  }

  if (lowerMessage.includes('image') && context.includes('upload')) {
    return 'Failed to upload images. Please try with different images or check your connection.';
  }

  // Validation errors
  if (lowerMessage.includes('required') || lowerMessage.includes('missing')) {
    return 'Please fill in all required fields before submitting.';
  }

  if (lowerMessage.includes('invalid') && lowerMessage.includes('email')) {
    return 'Please enter a valid email address.';
  }

  if (lowerMessage.includes('invalid') && lowerMessage.includes('phone')) {
    return 'Please enter a valid phone number.';
  }

  // Storage errors
  if (lowerMessage.includes('storage') || lowerMessage.includes('bucket')) {
    return 'File storage error. Please try uploading your images again.';
  }

  // Context-specific errors
  switch (context) {
    case 'submit':
      return 'Failed to save your listing. Please check all fields and try again.';
    case 'upload':
      return 'Failed to upload images. Please try with smaller images or check your connection.';
    case 'delete':
      return 'Failed to delete the listing. Please try again or contact support.';
    case 'fetch':
      return 'Failed to load data. Please refresh the page and try again.';
    case 'sold':
      return 'Failed to mark as sold. Please check the selling price and buyer information.';
    default:
      return 'Something went wrong. Please check your information and try again, or contact support if the problem continues.';
  }
};

/**
 * Validates and sanitizes form data before submission
 */
const validateAndSanitizeFormData = (data: any) => {
  const errors: string[] = [];
  const sanitizedData = { ...data };

  // Required fields validation
  const requiredFields = [
    { key: 'make', label: 'Vehicle Brand' },
    { key: 'model', label: 'Vehicle Model' },
    { key: 'year', label: 'Year' },
    { key: 'price', label: 'Price' },
    { key: 'condition', label: 'Condition' },
    { key: 'transmission', label: 'Transmission' },
    { key: 'mileage', label: 'Mileage' },
    { key: 'drivetrain', label: 'Drive Train' },
    { key: 'type', label: 'Fuel Type' },
    { key: 'category', label: 'Category' },
  ];

  requiredFields.forEach(field => {
    if (!data[field.key] || data[field.key] === '') {
      errors.push(`${field.label} is required`);
    }
  });

  // Numeric field validation and sanitization
  const numericFields = [
    { key: 'year', label: 'Year', min: 1900, max: new Date().getFullYear() + 2 },
    { key: 'price', label: 'Price', min: 1, max: 10000000 },
    { key: 'mileage', label: 'Mileage', min: 0, max: 1000000 },
    { key: 'bought_price', label: 'Purchase Price', min: 0, max: 10000000, optional: true },
  ];

  numericFields.forEach(field => {
    const value = data[field.key];
    
    if (field.optional && (!value || value === '')) {
      sanitizedData[field.key] = null;
      return;
    }

    if (!field.optional && (!value || value === '')) {
      errors.push(`${field.label} is required`);
      return;
    }

    // Convert to number and validate
    const numValue = typeof value === 'string' ? parseInt(value.replace(/[^0-9]/g, '')) : value;
    
    if (isNaN(numValue)) {
      errors.push(`${field.label} must be a valid number`);
    } else if (numValue < field.min || numValue > field.max) {
      errors.push(`${field.label} must be between ${field.min.toLocaleString()} and ${field.max.toLocaleString()}`);
    } else {
      sanitizedData[field.key] = numValue;
    }
  });

  // Text field validation
  if (data.description && data.description.length > 2000) {
    errors.push('Description must be less than 2000 characters');
  }

  if (data.seller_name && data.seller_name.length > 100) {
    errors.push('Seller name must be less than 100 characters');
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitizedData
  };
};

/**
 * Validates numeric input in real-time
 */
const validateNumericInput = (value: string, fieldName: string, min: number, max: number) => {
  if (!value || value.trim() === '') return null;
  
  const cleanValue = value.replace(/[^0-9]/g, '');
  const numValue = parseInt(cleanValue);
  
  if (cleanValue !== value) {
    return `${fieldName} should only contain numbers`;
  }
  
  if (isNaN(numValue)) {
    return `Please enter a valid ${fieldName.toLowerCase()}`;
  }
  
  if (numValue < min || numValue > max) {
    return `${fieldName} should be between ${min.toLocaleString()} and ${max.toLocaleString()}`;
  }
  
  return null;
};

const FeatureSelector = memo(
  ({ selectedFeatures = [], onFeatureToggle, isDarkMode }: any) => {
    const [showAllFeatures, setShowAllFeatures] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [currentPage, setCurrentPage] = useState(0);
    const [hasMore, setHasMore] = useState(true);
    const PAGE_SIZE = 20;

    const filteredFeatures = useMemo(
      () =>
        VEHICLE_FEATURES.filter((feature) =>
          feature.label.toLowerCase().includes(searchQuery.toLowerCase().trim())
        ),
      [searchQuery]
    );

    const paginatedFeatures = useMemo(() => {
      const start = currentPage * PAGE_SIZE;
      const end = start + PAGE_SIZE;
      return filteredFeatures.slice(0, end);
    }, [filteredFeatures, currentPage]);

    const loadMore = useCallback(() => {
      if ((currentPage + 1) * PAGE_SIZE < filteredFeatures.length) {
        setCurrentPage((prev) => prev + 1);
        setHasMore(true);
      } else {
        setHasMore(false);
      }
    }, [currentPage, filteredFeatures.length]);

    useEffect(() => {
      setCurrentPage(0);
      setHasMore(true);
    }, [searchQuery]);

    const FeatureItem = useCallback(
      ({ feature, isSelected, onPress, size = 'normal' }: any) => (
        <TouchableOpacity
          onPress={onPress}
          className={`${size === 'normal' ? 'mr-3' : ''} ${
            isSelected ? 'scale-105' : ''
          }`}
        >
          <BlurView
            intensity={isDarkMode ? 20 : 40}
            tint={isDarkMode ? 'dark' : 'light'}
            className={`rounded-2xl p-4 ${
              size === 'normal'
                ? 'w-[110px] h-[110px]'
                : 'flex-row items-center p-4 mb-2'
            } justify-between items-center`}
          >
            <View
              className={`${
                size === 'normal' ? 'w-[40px] h-[40px]' : 'w-12 h-12'
              } justify-center items-center mb-2`}
            >
              <MaterialCommunityIcons
                name={feature.icon}
                size={size === 'normal' ? 30 : 24}
                color={isSelected ? '#D55004' : isDarkMode ? '#fff' : '#000'}
              />
            </View>
            <Text
              className={`${
                size === 'normal' ? 'text-center' : 'flex-1 ml-3'
              } text-sm font-medium
              ${isSelected ? 'text-red' : isDarkMode ? 'text-white' : 'text-black'}`}
              numberOfLines={2}
            >
              {feature.label}
            </Text>
            {isSelected && (
              <View
                className={`absolute top-2 right-2 bg-red rounded-full p-1 ${
                  size === 'normal' ? '' : 'top-auto'
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
        <View className="flex-row items-center justify-between mb-4">
          <Text
            className={`text-lg font-bold ${
              isDarkMode ? 'text-white' : 'text-black'
            }`}
          >
            {selectedFeatures.length > 0
              ? `${selectedFeatures.length} Selected Features`
              : 'Select Features'}
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

        {selectedFeatures.length > 0 && (
          <View className="mb-3">
            <Text className={`text-sm ${isDarkMode ? 'text-neutral-400' : 'text-neutral-600'}`}>
              {selectedFeatures.length} feature{selectedFeatures.length !== 1 ? 's' : ''} selected
            </Text>
          </View>
        )}

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

        <Modal
          visible={showAllFeatures}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setShowAllFeatures(false)}
        >
          <BlurView
            intensity={isDarkMode ? 20 : 40}
            tint={isDarkMode ? 'dark' : 'light'}
            className="flex-1"
          >
            <TouchableOpacity
              className="flex-1"
              onPress={() => setShowAllFeatures(false)}
            />
            <View
              className={`h-[85%] rounded-t-3xl ${
                isDarkMode ? 'bg-black' : 'bg-white'
              }`}
            >
              <View className="p-4">
                <View className="items-center mb-2">
                  <View className="w-16 h-1 rounded-full bg-gray-300" />
                </View>

                <View className="flex-row justify-between items-center mb-4">
                  <Text
                    className={`text-xl font-bold ${
                      isDarkMode ? 'text-white' : 'text-black'
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
                      color={isDarkMode ? 'white' : 'black'}
                    />
                  </TouchableOpacity>
                </View>

                <View
                  className={`flex-row items-center rounded-full border border-[#ccc] dark:border-[#555] px-4 h-12 mb-4`}
                >
                  <FontAwesome
                    name="search"
                    size={20}
                    color={isDarkMode ? 'white' : 'black'}
                  />
                  <TextInput
                    textAlignVertical="center"
                    className={`flex-1 px-3 h-full ${
                      isDarkMode ? 'text-white' : 'text-black'
                    }`}
                    style={{ textAlignVertical: 'center' }}
                    placeholder="Search features..."
                    placeholderTextColor={isDarkMode ? 'lightgray' : 'gray'}
                    value={searchQuery}
                    onChangeText={(text) => {
                      setSearchQuery(text);
                      setCurrentPage(0);
                    }}
                  />
                  {searchQuery ? (
                    <TouchableOpacity
                      onPress={() => {
                        setSearchQuery('');
                        setCurrentPage(0);
                      }}
                    >
                      <Ionicons
                        name="close-circle"
                        size={20}
                        color={isDarkMode ? 'white' : 'black'}
                      />
                    </TouchableOpacity>
                  ) : null}
                </View>

                {selectedFeatures.length > 0 && (
                  <View
                    className={`mb-4 p-3 rounded-xl ${
                      isDarkMode ? 'bg-neutral-800' : 'bg-neutral-200'
                    }`}
                  >
                    <Text
                      className={`text-center ${
                        isDarkMode ? 'text-white' : 'text-black'
                      }`}
                    >
                      {selectedFeatures.length} feature{selectedFeatures.length !== 1 ? 's' : ''} selected
                    </Text>
                  </View>
                )}

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
    features: []
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
    const validation = validateAndSanitizeFormData(data);
    
    if (!validation.isValid) {
      Alert.alert(
        "Please Fix These Issues",
        validation.errors.join('\n• '),
        [{ text: "OK" }]
      );
      return { isValid: false };
    }
    
    // Check images
    if (!modalImages || modalImages.length === 0) {
      Alert.alert(
        "Images Required",
        "Please add at least one image of your vehicle.",
        [{ text: "OK" }]
      );
      return { isValid: false };
    }
    
    return { isValid: true, sanitizedData: validation.sanitizedData };
  };

  const handleSubmit = useCallback(() => {
    const validation = validateFormData(formData);
    if (!validation.isValid) return;

    if (!dealership || !isSubscriptionValid()) {
      Alert.alert(
        "Subscription Issue",
        "Your subscription has expired or is invalid. Please renew your subscription to continue adding or editing listings.",
        [{ text: "OK" }]
      );
      return;
    }

    const submitListing = async () => {
      try {
        setIsLoading(true);

        const dataToSubmit = validation.sanitizedData;

        if (initialData?.id) {
          // Update existing listing
          const {
            id, listed_at, date_modified, views, likes, viewed_users, liked_users,
            sold_price, date_sold, buyer_name, status, dealership_name,
            dealership_logo, dealership_phone, dealership_location,
            dealership_latitude, dealership_longitude, ...allowedData
          } = dataToSubmit;

          const dataToUpdate = {
            make: allowedData.make,
            model: allowedData.model,
            price: allowedData.price,
            year: allowedData.year,
            description: allowedData.description || '',
            images: modalImages,
            condition: allowedData.condition,
            transmission: allowedData.transmission,
            color: allowedData.color,
            mileage: allowedData.mileage,
            drivetrain: allowedData.drivetrain,
            type: allowedData.type,
            category: allowedData.category,
            bought_price: allowedData.bought_price || null,
            date_bought: allowedData.date_bought
              ? new Date(allowedData.date_bought).toISOString()
              : null,
            seller_name: allowedData.seller_name || null,
            source: allowedData.source,
            features: dataToSubmit.features || [],
            dealership_id: dealership.id,
          };

          const { error } = await supabase
            .from("cars")
            .update(dataToUpdate)
            .eq("id", initialData.id)
            .eq("dealership_id", dealership.id);

          if (error) throw error;

          Alert.alert(
            "Success! 🎉", 
            "Your vehicle listing has been updated successfully.",
            [{ text: "OK", onPress: () => router.back() }]
          );
        } else {
          // Create new listing
          const {
            dealership_name, dealership_logo, dealership_phone, dealership_location,
            dealership_latitude, dealership_longitude, ...allowedData
          } = dataToSubmit;

          const newListingData = {
            make: allowedData.make,
            model: allowedData.model,
            price: allowedData.price,
            year: allowedData.year,
            description: allowedData.description || '',
            images: modalImages,
            condition: allowedData.condition,
            transmission: allowedData.transmission,
            color: allowedData.color,
            mileage: allowedData.mileage,
            drivetrain: allowedData.drivetrain,
            type: allowedData.type,
            category: allowedData.category,
            bought_price: allowedData.bought_price || null,
            date_bought: allowedData.date_bought
              ? new Date(allowedData.date_bought).toISOString()
              : new Date().toISOString(),
            seller_name: allowedData.seller_name || null,
            dealership_id: dealership.id,
            source: allowedData.source,
            features: dataToSubmit.features || [],
            status: "pending",
            views: 0,
            likes: 0,
            viewed_users: [],
            liked_users: [],
          };

          const { error } = await supabase
            .from("cars")
            .insert(newListingData);

          if (error) throw error;

          Alert.alert(
            "Success! 🎉", 
            "Your new vehicle listing has been created successfully and is now pending approval.",
            [{ text: "OK", onPress: () => router.back() }]
          );
        }
      } catch (error: any) {
        console.error("Error submitting listing:", error);
        const friendlyMessage = getErrorMessage(error, 'submit');
        
        Alert.alert(
          "Couldn't Save Listing",
          friendlyMessage,
          [
            { text: "OK" },
            { 
              text: "Try Again", 
              onPress: () => {
                setTimeout(() => handleSubmit(), 1000);
              }
            }
          ]
        );
      } finally {
        setIsLoading(false);
        setHasChanges(false);
      }
    };

    submitListing();
  }, [formData, modalImages, initialData, dealership, router, isSubscriptionValid]);

  const handleGoBack = useCallback(() => {
    if (initialData) {
      if (hasChanges) {
        Alert.alert(
          "Discard Changes?",
          "You have unsaved changes. Are you sure you want to leave?",
          [
            { text: "Cancel", style: "cancel" },
            { text: "Discard", style: "destructive", onPress: () => router.back() },
            { text: "Save", onPress: handleSubmit }
          ]
        );
      } else {
        router.back();
      }
    } else {
      if (hasChanges) {
        Alert.alert(
          "Discard Changes?",
          "You have unsaved changes. Do you want to discard them?",
          [
            { text: "Stay", style: "cancel" },
            { text: "Discard", style: "destructive", onPress: () => router.back() },
          ]
        );
      } else {
        router.back();
      }
    }
  }, [hasChanges, router, handleSubmit, initialData]);

  // Enhanced handleInputChange with real-time validation
  const handleInputChange = useCallback(
    (key: string, value: any, customValue?: any) => {
      setFormData((prev: any) => {
        const newData = { ...prev, [key]: value };
        
        if (key === "make" && !value) {
          newData.model = null;
        }
        
        if (key === "color" && value === "Other" && customValue) {
          newData.color = customValue;
        }

        // Real-time numeric validation with user feedback
        if (key === "year") {
          const error = validateNumericInput(value, "Year", 1900, new Date().getFullYear() + 2);
          if (error && value) {
            setTimeout(() => {
              Alert.alert("Invalid Year", error, [{ text: "OK" }]);
            }, 100);
          }
          const parsedYear = parseInt(value.replace(/[^0-9]/g, ''));
          newData[key] = isNaN(parsedYear) ? '' : parsedYear.toString();
        }
        
        else if (key === "price") {
          const error = validateNumericInput(value, "Price", 1, 10000000);
          if (error && value) {
            setTimeout(() => {
              Alert.alert("Invalid Price", error, [{ text: "OK" }]);
            }, 100);
          }
          const parsedPrice = parseInt(value.replace(/[^0-9]/g, ''));
          newData[key] = isNaN(parsedPrice) ? '' : parsedPrice.toString();
        }
        
        else if (key === "mileage") {
          const error = validateNumericInput(value, "Mileage", 0, 1000000);
          if (error && value) {
            setTimeout(() => {
              Alert.alert("Invalid Mileage", error, [{ text: "OK" }]);
            }, 100);
          }
          const parsedMileage = parseInt(value.replace(/[^0-9]/g, ''));
          newData[key] = isNaN(parsedMileage) ? 0 : parsedMileage;
        }
        
        else if (key === "bought_price") {
          if (value && value.trim() !== '') {
            const error = validateNumericInput(value, "Purchase Price", 0, 10000000);
            if (error) {
              setTimeout(() => {
                Alert.alert("Invalid Purchase Price", error, [{ text: "OK" }]);
              }, 100);
            }
            const parsedPrice = parseInt(value.replace(/[^0-9]/g, ''));
            newData[key] = isNaN(parsedPrice) ? '' : parsedPrice.toString();
          } else {
            newData[key] = value;
          }
        }

        return newData;
      });
      setHasChanges(true);
    },
    []
  );

  // Fetch dealership and car data if editing
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
          setInitialData(carData);
          setFormData({
            ...carData,
            date_bought: carData.date_bought
              ? new Date(carData.date_bought)
              : new Date(),
            features: carData.features || [],
          });

          setModalImages(carData.images || []);
        }
      } catch (error) {
        console.error("Error fetching data:", error);
        const friendlyMessage = getErrorMessage(error, 'fetch');
        
        Alert.alert(
          "Couldn't Load Data",
          friendlyMessage,
          [
            { text: "Retry", onPress: () => fetchData() },
            { text: "Go Back", onPress: () => router.back() }
          ]
        );
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [params.dealershipId, params.listingId]);

  /**
   * Processes and optimizes images with precise dimension control while preserving aspect ratio
   */
  const processImage = async (uri: string): Promise<string> => {
    if (!uri) {
      console.warn("processImage: No URI provided.");
      return "";
    }

    try {
      const fileInfo = await FileSystem.getInfoAsync(uri);
      if (!fileInfo.exists) throw new Error("File does not exist");

      console.log(`Original file size: ${(fileInfo.size / (1024 * 1024)).toFixed(2)}MB`);

      const isLikelyiOSPhoto =
        uri.includes('HEIC') ||
        uri.includes('IMG_') ||
        uri.includes('DCIM') ||
        uri.endsWith('.HEIC') ||
        uri.endsWith('.heic') ||
        fileInfo.size > 3 * 1024 * 1024;

      const imageMeta = await ImageManipulator.manipulateAsync(uri, []);
      const originalWidth = imageMeta.width;
      const originalHeight = imageMeta.height;

      if (!originalWidth || !originalHeight) {
        throw new Error("Unable to determine original image dimensions");
      }

      console.log(`Original dimensions: ${originalWidth}×${originalHeight}`);

      const MAX_WIDTH = 1280;
      const MAX_HEIGHT = 1280;
      const aspectRatio = originalWidth / originalHeight;

      let targetWidth = originalWidth;
      let targetHeight = originalHeight;

      if (originalWidth > MAX_WIDTH || originalHeight > MAX_HEIGHT) {
        if (aspectRatio > 1) {
          targetWidth = MAX_WIDTH;
          targetHeight = Math.round(MAX_WIDTH / aspectRatio);
        } else {
          targetHeight = MAX_HEIGHT;
          targetWidth = Math.round(MAX_HEIGHT * aspectRatio);
        }
      }

      console.log(`Target dimensions: ${targetWidth}×${targetHeight}`);

      let compressionLevel = 0.7;

      if (fileInfo.size > 10 * 1024 * 1024) {
        compressionLevel = 0.5;
      } else if (fileInfo.size > 5 * 1024 * 1024 || isLikelyiOSPhoto) {
        compressionLevel = 0.6;
      }

      const firstPass = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: targetWidth, height: targetHeight } }],
        {
          compress: compressionLevel,
          format: ImageManipulator.SaveFormat.JPEG,
          exif: false
        }
      );

      if (!firstPass.uri) {
        throw new Error("First-pass image processing failed: no URI returned");
      }

      let finalResult = firstPass;

      if (isLikelyiOSPhoto) {
        try {
          console.log("Applying second-pass optimization for iOS photo");
          finalResult = await ImageManipulator.manipulateAsync(
            firstPass.uri,
            [],
            {
              compress: compressionLevel,
              format: ImageManipulator.SaveFormat.JPEG,
              base64: false
            }
          );

          if (!finalResult.uri) {
            console.warn("Second-pass processing failed, using first-pass result");
            finalResult = firstPass;
          }
        } catch (secondPassError) {
          console.warn("Error in second-pass processing:", secondPassError);
          finalResult = firstPass;
        }
      }

      const processedInfo = await FileSystem.getInfoAsync(finalResult.uri);
      if (processedInfo.exists && processedInfo.size) {
        console.log(`Processed image size: ${(processedInfo.size / (1024 * 1024)).toFixed(2)}MB`);

        if (fileInfo.size) {
          const ratio = (processedInfo.size / fileInfo.size * 100).toFixed(1);
          console.log(`Compression ratio: ${ratio}% of original`);
        }
      }

      return finalResult.uri;
    } catch (error) {
      console.error('processImage error:', error);
      return uri;
    }
  };

  /**
   * Enhanced batch uploading of multiple images with better error handling
   */
  const handleMultipleImageUpload = useCallback(
    async (assets: any[]) => {
      if (!dealership?.id) {
        Alert.alert(
          "Setup Issue",
          "Your dealership information is not properly configured. Please contact support."
        );
        return;
      }

      if (!assets?.length) {
        Alert.alert(
          "No Images Selected",
          "Please select at least one image to upload."
        );
        return;
      }

      setIsUploading(true);

      try {
        const batchSize = Platform.OS === 'android' ? 2 : 3;
        console.log(`Processing ${assets.length} images in batches of ${batchSize}`);

        const results = [];
        let progressCounter = 0;
        const totalImages = assets.length;

        for (let i = 0; i < assets.length; i += batchSize) {
          const batch = assets.slice(i, i + batchSize);

          const batchPromises = batch.map(async (asset: { uri: string }, batchIndex: number) => {
            const index = i + batchIndex;
            const imageNumber = index + 1;

            try {
              console.log(`Processing image ${imageNumber}/${totalImages}`);
              const processedUri = await processImage(asset.uri);

              if (!processedUri) {
                throw new Error(`Failed to process image ${imageNumber}`);
              }

              const processedFileInfo = await FileSystem.getInfoAsync(processedUri);
              if (!processedFileInfo.exists || !processedFileInfo.size) {
                throw new Error(`Processed file is invalid for image ${imageNumber}`);
              }

              const timestamp = Date.now();
              const randomId = Math.floor(Math.random() * 1000000);
              const fileName = `${timestamp}_${randomId}_${index}.jpg`;
              const filePath = `${dealership.id}/${fileName}`;

              console.log(`Uploading image ${imageNumber}/${totalImages}`);

              const base64Content = await FileSystem.readAsStringAsync(processedUri, {
                encoding: FileSystem.EncodingType.Base64,
              });

              if (!base64Content || base64Content.length === 0) {
                throw new Error(`Image ${imageNumber} appears to be empty or corrupted`);
              }

              const fileBuffer = Buffer.from(base64Content, "base64");

              const uploadOptions = {
                contentType: "image/jpeg",
                cacheControl: "3600",
                upsert: false
              };

              const uploadPromise = supabase.storage
                .from("cars")
                .upload(filePath, fileBuffer, uploadOptions);

              const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error(`Upload timed out for image ${imageNumber}`)), 30000)
              );

              const { error: uploadError } = await Promise.race([uploadPromise, timeoutPromise]) as any;

              if (uploadError) {
                throw new Error(`Upload failed for image ${imageNumber}: ${uploadError.message}`);
              }

              const { data: publicURLData } = supabase.storage
                .from("cars")
                .getPublicUrl(filePath);

              if (!publicURLData?.publicUrl) {
                throw new Error(`Failed to get URL for image ${imageNumber}`);
              }

              progressCounter++;
              console.log(`Upload progress: ${progressCounter}/${totalImages}`);

              return publicURLData.publicUrl;

            } catch (error) {
              console.error(`Error uploading image ${imageNumber}/${totalImages}:`, error);
              return null;
            }
          });

          const batchResults = await Promise.all(batchPromises);
          results.push(...batchResults);

          if (i + batchSize < assets.length) {
            const pauseDuration = Platform.OS === 'android' ? 500 : 200;
            await new Promise(resolve => setTimeout(resolve, pauseDuration));
          }
        }

        const successfulUploads = results.filter(url => url !== null);

        if (successfulUploads.length === 0) {
          throw new Error("No images were successfully uploaded");
        }

        if (successfulUploads.length < totalImages) {
          const failedCount = totalImages - successfulUploads.length;
          
          Alert.alert(
            "Partial Upload Success",
            `${successfulUploads.length} of ${totalImages} images uploaded successfully. ${failedCount} images failed to upload. You can try uploading the failed images again.`,
            [{ text: "Continue", style: "default" }]
          );
        }

        setModalImages((prevImages: any) => [...successfulUploads, ...prevImages]);
        setFormData((prevData: { images: any; }) => ({
          ...prevData,
          images: [...successfulUploads, ...(prevData.images || [])],
        }));
        setHasChanges(true);

        return successfulUploads;

      } catch (error) {
        console.error('Critical error in batch upload process:', error);
        const friendlyMessage = getErrorMessage(error, 'upload');
        
        Alert.alert(
          "Upload Failed",
          friendlyMessage,
          [{ text: "OK" }]
        );
        return [];
      } finally {
        setIsUploading(false);
      }
    },
    [dealership, processImage, setModalImages, setFormData, setHasChanges, setIsUploading]
  );

  /**
   * Enhanced image selection with better error handling
   */
  const handleImagePick = useCallback(async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permission Needed",
          "We need access to your photo library to add images to your listing. Please enable photo library access in your device settings.",
          [
            { text: "Cancel" },
            { text: "Open Settings", onPress: () => {
              // You might want to implement opening settings here
            }}
          ]
        );
        return;
      }

      const MAX_IMAGES = 10;
      if (modalImages.length >= MAX_IMAGES) {
        Alert.alert(
          "Maximum Images Reached",
          `You can add up to ${MAX_IMAGES} images per listing. Please remove some images first if you want to add new ones.`
        );
        return;
      }

      const remainingSlots = MAX_IMAGES - modalImages.length;
      const maxSelection = Platform.OS === 'android'
        ? Math.min(remainingSlots, 3)
        : Math.min(remainingSlots, 5);

      console.log(`Opening image picker for ${maxSelection} images`);

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: maxSelection > 1,
        selectionLimit: maxSelection,
        quality: Platform.OS === 'android' ? 0.7 : 0.8,
        exif: false,
        base64: false,
        allowsEditing: false,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      // Pre-analyze selected images
      let totalSize = 0;
      let largeImageCount = 0;
      const LARGE_IMAGE_THRESHOLD = 5 * 1024 * 1024; // 5MB

      for (const asset of result.assets) {
        try {
          const fileInfo = await FileSystem.getInfoAsync(asset.uri);
          if (fileInfo.exists && fileInfo.size) {
            totalSize += fileInfo.size;
            if (fileInfo.size > LARGE_IMAGE_THRESHOLD) {
              largeImageCount++;
            }
          }
        } catch (error) {
          console.warn('Could not analyze image size:', error);
        }
      }

      if (totalSize > 25 * 1024 * 1024 || largeImageCount > 2) {
        Alert.alert(
          "Large Images Detected",
          "Some of your selected images are very large, which may take longer to upload. We'll automatically optimize them for you, but the upload might take a while.",
          [
            { text: "Cancel", style: "cancel" },
            {
              text: "Continue",
              onPress: () => {
                setIsUploading(true);
                handleMultipleImageUpload(result.assets)
                  .finally(() => setIsUploading(false));
              }
            }
          ]
        );
        return;
      }

      setIsUploading(true);
      try {
        await handleMultipleImageUpload(result.assets);
      } catch (error) {
        const friendlyMessage = getErrorMessage(error, 'upload');
        Alert.alert(
          "Upload Failed",
          friendlyMessage,
          [{ text: "OK" }]
        );
      } finally {
        setIsUploading(false);
      }
    } catch (error) {
      console.error("Error in image picker:", error);
      const friendlyMessage = Platform.OS === 'android'
        ? "Couldn't open image picker. Try restarting the app or selecting fewer images."
        : "Couldn't open image picker. Please try again.";
      
      Alert.alert(
        "Couldn't Access Photos",
        friendlyMessage,
        [{ text: "OK" }]
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
      setHasChanges(true);
    } catch (error) {
      console.error("Error removing image:", error);
      const friendlyMessage = getErrorMessage(error, 'delete');
      
      Alert.alert(
        "Couldn't Remove Image",
        friendlyMessage,
        [{ text: "OK" }]
      );
    }
  }, []);

  const handleImageReorder = useCallback((newOrder: string[]) => {
    setModalImages(newOrder);
    setFormData((prev: any) => ({
      ...prev,
      images: newOrder,
    }));
    setHasChanges(true);
  }, []);

  const handleDeleteConfirmation = useCallback(() => {
    if (!dealership || !isSubscriptionValid()) {
      Alert.alert(
        "Subscription Issue",
        "Your subscription has expired or is invalid. Please renew to perform this action."
      );
      return;
    }

    Alert.alert(
      "Delete Listing",
      "Are you sure you want to permanently delete this listing? This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          onPress: async () => {
            try {
              if (!initialData?.id || !dealership?.id) {
                Alert.alert(
                  "Error",
                  "Cannot delete: missing required information. Please try again."
                );
                return;
              }

              setIsLoading(true);

              const { error } = await supabase
                .from("cars")
                .delete()
                .eq("id", initialData.id)
                .eq("dealership_id", dealership.id);

              if (error) throw error;

              Alert.alert(
                "Deleted Successfully", 
                "The listing has been permanently removed.",
                [{ text: "OK", onPress: () => router.back() }]
              );
            } catch (error: any) {
              console.error("Error deleting listing:", error);
              const friendlyMessage = getErrorMessage(error, 'delete');
              
              Alert.alert(
                "Couldn't Delete Listing",
                friendlyMessage,
                [{ text: "OK" }]
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

      // Validate sold data
      const errors: string[] = [];
      
      if (!soldData.price || soldData.price.trim() === '') {
        errors.push('Selling price is required');
      } else {
        const price = parseInt(soldData.price.replace(/[^0-9]/g, ''));
        if (isNaN(price) || price <= 0) {
          errors.push('Please enter a valid selling price');
        }
      }

      if (!soldData.buyer_name || soldData.buyer_name.trim() === '') {
        errors.push('Buyer name is required');
      } else if (soldData.buyer_name.length > 100) {
        errors.push('Buyer name is too long');
      }

      if (!soldData.date) {
        errors.push('Sale date is required');
      }

      if (errors.length > 0) {
        Alert.alert(
          "Please Fix These Issues",
          errors.join('\n• '),
          [{ text: "OK" }]
        );
        return;
      }

      try {
        setIsLoading(true);

        const { error } = await supabase
          .from("cars")
          .update({
            status: "sold",
            sold_price: parseInt(soldData.price.replace(/[^0-9]/g, '')),
            date_sold: soldData.date,
            buyer_name: soldData.buyer_name.trim(),
          })
          .eq("id", initialData.id)
          .eq("dealership_id", dealership.id);

        if (error) throw error;

        setShowSoldModal(false);
        Alert.alert(
          "Sold! 🎉", 
          "The listing has been successfully marked as sold.",
          [{ text: "OK", onPress: () => router.back() }]
        );
      } catch (error) {
        console.error("Error marking as sold:", error);
        const friendlyMessage = getErrorMessage(error, 'sold');
        
        Alert.alert(
          "Couldn't Mark as Sold",
          friendlyMessage,
          [{ text: "OK" }]
        );
      } finally {
        setIsLoading(false);
      }
    },
    [initialData, dealership, isSubscriptionValid, soldInfo, router]
  );

  const SoldModal = () => {
    const [localPrice, setLocalPrice] = useState(soldInfo.price || "");
    const [localBuyerName, setLocalBuyerName] = useState(soldInfo.buyer_name || "");
    const [localDate, setLocalDate] = useState(soldInfo.date || new Date().toISOString().split("T")[0]);
    const [showInlinePicker, setShowInlinePicker] = useState(false);

    useEffect(() => {
      if (showSoldModal) {
        setLocalPrice(soldInfo.price || "");
        setLocalBuyerName(soldInfo.buyer_name || "");
        setLocalDate(soldInfo.date || new Date().toISOString().split("T")[0]);
      }
    }, [showSoldModal, soldInfo]);

    const handleDateChange = (event: any, selectedDate: { toISOString: () => string; }) => {
      setShowInlinePicker(false);

      if (selectedDate) {
        try {
          setLocalDate(selectedDate.toISOString().split("T")[0]);
        } catch (error) {
          console.warn("Date formatting error:", error);
          setLocalDate(new Date().toISOString().split("T")[0]);
        }
      }
    };

    const handleConfirm = () => {
      if (!localPrice || !localBuyerName || !localDate) {
        Alert.alert("Validation Error", "Please fill in all the required fields.");
        return;
      }
      handleMarkAsSold({ price: localPrice, buyer_name: localBuyerName, date: localDate });
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
                alignItems: "center"
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
                  elevation: 5
                }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 24
                  }}
                >
                  <Text
                    style={{
                      fontSize: 20,
                      fontWeight: "bold",
                      color: isDarkMode ? "#ffffff" : "#000000"
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

                <View style={{ marginBottom: 16 }}>
                  <Text
                    style={{
                      fontSize: 14,
                      fontWeight: "500",
                      marginBottom: 8,
                      color: isDarkMode ? "#d4d4d4" : "#4b5563"
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
                      fontSize: 16
                    }}
                  />
                </View>

                <View style={{ marginBottom: 16 }}>
                  <Text
                    style={{
                      fontSize: 14,
                      fontWeight: "500",
                      marginBottom: 8,
                      color: isDarkMode ? "#d4d4d4" : "#4b5563"
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
                      fontSize: 16
                    }}
                  />
                </View>

                <View style={{ marginBottom: 24 }}>
                  <Text
                    style={{
                      fontSize: 14,
                      fontWeight: "500",
                      marginBottom: 8,
                      color: isDarkMode ? "#d4d4d4" : "#4b5563"
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
                      borderRadius: 12
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
                        fontSize: 16
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

                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    marginTop: 8
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
                      borderRadius: 12
                    }}
                  >
                    <Text
                      style={{
                        color: isDarkMode ? "#ffffff" : "#000000",
                        fontSize: 16,
                        fontWeight: "600"
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
                      borderRadius: 12
                    }}
                  >
                    <Text
                      style={{
                        color: "#ffffff",
                        fontSize: 16,
                        fontWeight: "600"
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
          className={`text-xl font-bold ${
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
        {!initialData && <View className="w-10 h-10"/>}
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
          <BrandSelector
            selectedBrand={formData.make}
            onSelectBrand={(make: any) => {
              handleInputChange("make", make);
              handleInputChange("model", "");
            }}
            isDarkMode={isDarkMode}
          />

          {formData.make && (
            <ModelDropdown
              make={formData.make}
              value={formData.model}
              onChange={(model: any) => handleInputChange("model", model)}
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
                icon={source.icon}
                isSelected={formData.source === source.value}
                onSelect={() => handleInputChange("source", source.value)}
                isDarkMode={isDarkMode}
              />
            ))}
          </ScrollView>
        </View>

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

          <NeumorphicInput
            label="Mileage"
            value={formData.mileage}
            onChangeText={(text: any) => handleInputChange("mileage", text)}
            placeholder="Enter vehicle mileage"
            keyboardType="numeric"
            icon="speedometer"
            suffix="km"
            required
            isDarkMode={isDarkMode}
          />

          <Text
            className={`text-sm font-medium mb-3 ${
              isDarkMode ? "text-neutral-300" : "text-neutral-700"
            }`}
          >
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
            onFeatureToggle={(featureId:any) => {
              setFormData((prev:any) => {
                const currentFeatures = prev.features || [];
                let updatedFeatures;

                if (currentFeatures.includes(featureId)) {
                  updatedFeatures = currentFeatures.filter((id: any) => id !== featureId);
                } else {
                  updatedFeatures = [...currentFeatures, featureId];
                }

                setHasChanges(true);
                return { ...prev, features: updatedFeatures };
              });
            }}
            isDarkMode={isDarkMode}
          />
        </View>

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
              formData.date_bought && !isNaN(new Date(formData.date_bought).getTime())
                ? new Date(formData.date_bought)
                : new Date()
            }
            onConfirm={(selectedDate) => {
              try {
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

      <View
        className={`p-4 -mb-2 ${
          isDarkMode ? "bg-black" : "bg-neutral-100"
        } border-t ${isDarkMode ? "border-neutral-800" : "border-neutral-200"}`}
      >
        {initialData ? (
          <View className="flex-row justify-between">
            <TouchableOpacity
              onPress={() => (initialData?.status === 'available' ? setShowSoldModal(true) : null)}
              disabled={initialData?.status === 'sold'}
              className={`flex-1 py-4 rounded-full items-center justify-center mr-2 ${
                initialData?.status === 'sold' ? 'bg-orange-600 opacity-50' : 'bg-green-600'
              }`}
            >
              <Text className="text-white font-medium">
                {initialData?.status === 'sold' ? 'Sold' : 'Mark as Sold'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleSubmit}
              disabled={!hasChanges}
              className={`flex-1 py-4 rounded-full items-center justify-center ml-2 ${
                hasChanges ? 'bg-red' : isDarkMode?'bg-neutral-900' :'bg-neutral-400'
              }`}
            >
              <Text className={` ${
                  hasChanges ? 'text-white' : isDarkMode?'text-neutral-600' :'text-neutral-100'
                } font-medium`}>Update</Text>
            </TouchableOpacity>
          </View>
        ) : (
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