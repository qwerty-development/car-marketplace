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
  KeyboardAvoidingView,
  Platform,
  Alert,
  Dimensions,
  Pressable,
  ActivityIndicator,
  FlatList,
  TouchableWithoutFeedback,
  Keyboard,
} from "react-native";
import { useUser } from "@clerk/clerk-expo";
import {
  FontAwesome,
  Ionicons,
  MaterialCommunityIcons,
} from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system";
import { supabase } from "@/utils/supabase";
import { Buffer } from "buffer";
import DraggableFlatList from "react-native-draggable-flatlist";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useTheme } from "@/utils/ThemeContext";
import DateTimePicker from "@react-native-community/datetimepicker";
import { BlurView } from "expo-blur";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import DateTimePickerModal from "react-native-modal-datetime-picker";
import * as Haptics from "expo-haptics";
import Animated, {
  FadeIn,
  FadeOut,
  SlideInDown,
  SlideInUp,
  SlideOutDown,
  withSpring,
} from "react-native-reanimated";
import { format } from "date-fns";

const { width } = Dimensions.get("window");
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



export default function AddEditListing() {
  const { isDarkMode } = useTheme();
  const { user } = useUser();
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



  const handleGoBack = useCallback(() => {
    if (initialData) { // Editing
      if (hasChanges) {
        Alert.alert(
          "Discard Changes?",
          "You have unsaved changes. Are you sure you want to leave?",
          [
            { text: "Cancel", style: "cancel" },
            { text: "Discard", style: "destructive", onPress: () => router.back() },
            { text: "Save", onPress: handleSubmit } // Keep Save option
          ]
        );
      } else {
        router.back();
      }
    } else { // Adding
      if (hasChanges) {
          Alert.alert(
            "Discard Changes?",
            "You have unsaved changes.  Do you want to discard them?",
            [
              { text: "Stay", style: "cancel" }, // Changed "Cancel" to "Stay"
              { text: "Discard", style: "destructive", onPress: () => router.back() },
            ]
          );
      } else {
          router.back();
      }

    }
  }, [hasChanges, router, handleSubmit, initialData]);

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
        if (key === "make" && !value) {
          newData.model = null;
        }
        if (key === "color" && value === "Other" && customValue) {
          newData.color = customValue;
        }

        if (key === "mileage") {
          const parsedMileage = parseInt(value);
          newData[key] = isNaN(parsedMileage) ? 0 : parsedMileage;
        }
        return newData;
      });
      setHasChanges(true);
    },
    []
  );

  const handleImagePick = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Permission Denied",
        "Sorry, we need camera roll permissions to make this work!"
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      setIsUploading(true);
      try {
        await handleMultipleImageUpload(result.assets);
      } catch (error) {
        console.error("Error uploading images:", error);
        Alert.alert(
          "Upload Failed",
          "Failed to upload images. Please try again."
        );
      } finally {
        setIsUploading(false);
      }
    }
  }, [dealership]);

  const handleMultipleImageUpload = useCallback(
    async (assets: any[]) => {
      if (!dealership) return;

      const uploadPromises = assets.map(
        async (asset: { uri: string }, index: number) => {
          try {
            const fileName = `${Date.now()}_${Math.random()
              .toString(36)
              .substring(7)}_${index}.jpg`;
            const filePath = `${dealership.id}/${fileName}`;

            const base64 = await FileSystem.readAsStringAsync(asset.uri, {
              encoding: FileSystem.EncodingType.Base64,
            });

            const { data, error } = await supabase.storage
              .from("cars")
              .upload(filePath, Buffer.from(base64, "base64"), {
                contentType: "image/jpeg",
              });

            if (error) throw error;

            const { data: publicURLData } = supabase.storage
              .from("cars")
              .getPublicUrl(filePath);

            if (!publicURLData) throw new Error("Error getting public URL");

            return publicURLData.publicUrl;
          } catch (error) {
            console.error("Error uploading image:", error);
            return null;
          }
        }
      );

      const uploadedUrls = await Promise.all(uploadPromises);
      const successfulUploads = uploadedUrls.filter((url) => url !== null);

      setModalImages((prev: any) => [...successfulUploads, ...prev]);
      setFormData((prev: { images: any }) => ({
        ...prev,
        images: [...successfulUploads, ...(prev.images || [])],
      }));
      setHasChanges(true); // Mark changes as made
    },
    [dealership]
  );

  const handleImageRemove = useCallback(async (imageUrl: string) => {
    try {
      const urlParts = imageUrl.split("/");
      const filePath = urlParts.slice(urlParts.indexOf("cars") + 1).join("/");

      const { error } = await supabase.storage.from("cars").remove([filePath]);

      if (error) throw error;

      setModalImages((prevImages) =>
        prevImages.filter((url) => url !== imageUrl)
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

  const handleMarkAsSold = useCallback(async () => {
    if (!initialData || !dealership || !isSubscriptionValid()) {
      setShowSoldModal(false);
      return;
    }

    if (!soldInfo.price || !soldInfo.date || !soldInfo.buyer_name) {
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
          sold_price: parseInt(soldInfo.price),
          date_sold: soldInfo.date,
          buyer_name: soldInfo.buyer_name,
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
      Alert.alert("Error", "Failed to mark listing as sold. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, [initialData, dealership, isSubscriptionValid, soldInfo, router]);

  const SoldModal = () => {
    const inputStyle = `w-full px-4 py-3 rounded-xl border mb-4 ${
      isDarkMode
        ? "border-neutral-700 bg-neutral-800 text-white"
        : "border-neutral-200 bg-neutral-50 text-black"
    }`;

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
                  shadowOpacity: 0.25,
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
                    value={soldInfo.price}
                    onChangeText={(text) =>
                      setSoldInfo((prev) => ({ ...prev, price: text }))
                    }
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
                    value={soldInfo.buyer_name}
                    onChangeText={(text) =>
                      setSoldInfo((prev) => ({ ...prev, buyer_name: text }))
                    }
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
                    onPress={() => setShowDatePicker(true)}
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
                        color: soldInfo.date
                          ? isDarkMode
                            ? "#ffffff"
                            : "#000000"
                          : isDarkMode
                          ? "#9CA3AF"
                          : "#6B7280",
                        fontSize: 16,
                      }}
                    >
                      {soldInfo.date || "Select date"}
                    </Text>
                  </TouchableOpacity>
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
                    onPress={handleMarkAsSold}
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

        <DateTimePickerModal
          isVisible={showDatePicker}
          mode="date"
          date={soldInfo.date ? new Date(soldInfo.date) : new Date()}
          onConfirm={(date) => {
            setSoldInfo((prev) => ({
              ...prev,
              date: date.toISOString().split("T")[0],
            }));
            setShowDatePicker(false);
          }}
          onCancel={() => setShowDatePicker(false)}
        />
      </Modal>
    );
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
              : null,
            seller_name: allowedData.seller_name,
              source: allowedData.source,
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
            source
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
            status: "available",
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
          >            Transmission
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
            required
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
                  {formData.date_bought
                    ? format(new Date(formData.date_bought), "PPP")
                    : "Select purchase date"}
                </Text>
              </BlurView>
            </View>
          </TouchableOpacity>

          <DateTimePickerModal
            isVisible={showDatePicker}
            mode="date"
            date={
              formData.date_bought ? new Date(formData.date_bought) : new Date()
            }
            onConfirm={(selectedDate) => {
              handleInputChange("date_bought", selectedDate.toISOString());
              setShowDatePicker(false);
            }}
            onCancel={() => setShowDatePicker(false)}
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
                disabled={!hasChanges}  // Disable if no changes
                className={`flex-1 py-4 rounded-full items-center justify-center ml-2 ${
                  hasChanges ? 'bg-red' : isDarkMode?'bg-neutral-900' :'bg-neutral-400' // Change color based on hasChanges
                }`}
              >
              <Text className={` ${
                  hasChanges ? 'text-white' : isDarkMode?'text-neutral-600' :'text-neutral-100' // Change color based on hasChanges
                } font-medium`}>Update</Text>
            </TouchableOpacity>
          </View>
        ) : ( // Add Mode Button
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