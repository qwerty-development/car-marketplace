import "react-native-get-random-values";
import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  ScrollView,
  ActivityIndicator,
  Alert,
  Modal,
  RefreshControl,
  Platform,
} from "react-native";
import { supabase } from "@/utils/supabase";
import { useUser, useAuth } from "@clerk/clerk-expo";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system";
import * as Location from "expo-location";
import MapView, { Marker } from "react-native-maps";
import { GooglePlacesAutocomplete } from "react-native-google-places-autocomplete";
import { useTheme } from "@/utils/ThemeContext";
import ThemeSwitch from "@/components/ThemeSwitch";
import { NotificationBell } from "@/components/NotificationBell";
import { useRouter } from "expo-router";
import { Feather, Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";

const SUBSCRIPTION_WARNING_DAYS = 7;

export default function DealershipProfilePage() {
  const { isDarkMode } = useTheme();
  const { user } = useUser();
  const { signOut } = useAuth();
  const router = useRouter();
  const mapRef = React.useRef(null);

  const [dealership, setDealership] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    location: "",
    phone: "",
    logo: "",
    latitude: "",
    longitude: "",
  });
  const [isUploading, setIsUploading] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [mapVisible, setMapVisible] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [isChangePasswordMode, setIsChangePasswordMode] = useState(false);
  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [mapRegion, setMapRegion] = useState({
    latitude: 33.8547,
    longitude: 35.8623,
    latitudeDelta: 2,
    longitudeDelta: 2,
  });

  // Subscription and expiration checks
  const isSubscriptionValid = useCallback(() => {
    if (!dealership?.subscription_end_date) return false;
    return new Date(dealership.subscription_end_date) > new Date();
  }, [dealership]);

  const getDaysUntilExpiration = useCallback(() => {
    if (!dealership?.subscription_end_date) return null;
    const endDate = new Date(dealership.subscription_end_date);
    const today = new Date();
    const diffTime = endDate.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 3600 * 24));
  }, [dealership]);

  const daysUntilExpiration = getDaysUntilExpiration();
  const showWarning =
    daysUntilExpiration !== null &&
    daysUntilExpiration <= SUBSCRIPTION_WARNING_DAYS &&
    daysUntilExpiration > 0;
  const subscriptionExpired = !isSubscriptionValid();

  // Profile data fetching
  const fetchDealershipProfile = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("dealerships")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (error) throw error;

      if (data) {
        setDealership(data);
        setFormData({
          name: data.name || "",
          location: data.location || "",
          phone: data.phone || "",
          logo: data.logo || "",
          latitude: data.latitude?.toString() || "",
          longitude: data.longitude?.toString() || "",
        });
      }
    } catch (error) {
      setError(error.message);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchDealershipProfile();
  }, [fetchDealershipProfile]);

  // Location handlers
  const getLocation = useCallback(async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission Denied", "Please allow location access.");
        return;
      }

      const location = await Location.getCurrentPositionAsync({});
      const { latitude, longitude } = location.coords;

      setFormData((prev) => ({
        ...prev,
        latitude: latitude.toString(),
        longitude: longitude.toString(),
      }));
      setSelectedLocation({ latitude, longitude });

      setMapRegion({
        latitude,
        longitude,
        latitudeDelta: 0.0922,
        longitudeDelta: 0.0421,
      });
    } catch (error) {
      Alert.alert("Error", "Failed to get location");
    }
  }, []);

  // Image handling
  const pickImage = useCallback(async () => {
    try {
      const { status } =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission Denied", "Please allow photo access.");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 1,
      });

      if (!result.canceled && result.assets?.[0]) {
        setIsUploading(true);
        await handleImageUpload(result.assets[0].uri);
      }
    } catch (error) {
      Alert.alert("Error", "Failed to pick image");
    } finally {
      setIsUploading(false);
    }
  }, []);

  const handleImageUpload = useCallback(
    async (imageUri) => {
      if (!dealership?.id) return;

      try {
        const fileName = `${Date.now()}_${Math.random()
          .toString(36)
          .slice(2)}.jpg`;
        const filePath = `${dealership.id}/${fileName}`;
        const base64 = await FileSystem.readAsStringAsync(imageUri, {
          encoding: FileSystem.EncodingType.Base64,
        });

        const { error: uploadError } = await supabase.storage
          .from("logos")
          .upload(filePath, Buffer.from(base64, "base64"), {
            contentType: "image/jpeg",
          });

        if (uploadError) throw uploadError;

        const { data: publicURLData } = supabase.storage
          .from("logos")
          .getPublicUrl(filePath);

        if (!publicURLData?.publicUrl)
          throw new Error("Failed to get public URL");

        await supabase
          .from("dealerships")
          .update({ logo: publicURLData.publicUrl })
          .eq("id", dealership.id);

        setFormData((prev) => ({ ...prev, logo: publicURLData.publicUrl }));
        Alert.alert("Success", "Logo updated successfully");
      } catch (error) {
        Alert.alert("Error", "Failed to upload image");
      }
    },
    [dealership]
  );

  // Form handlers
  const updateProfile = useCallback(async () => {
    if (!dealership?.id) return;

    setIsLoading(true);
    try {
      const { error } = await supabase
        .from("dealerships")
        .update({
          name: formData.name,
          location: formData.location,
          phone: formData.phone,
          latitude: parseFloat(formData.latitude) || null,
          longitude: parseFloat(formData.longitude) || null,
        })
        .eq("id", dealership.id);

      if (error) throw error;
      Alert.alert("Success", "Profile updated successfully");
    } catch (error) {
      Alert.alert("Error", "Failed to update profile");
    } finally {
      setIsLoading(false);
    }
  }, [formData, dealership]);

  const handleChangePassword = useCallback(async () => {
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      Alert.alert("Error", "Passwords do not match");
      return;
    }

    try {
      await user?.updatePassword({
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword,
      });
      setIsChangePasswordMode(false);
      setPasswordData({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
      Alert.alert("Success", "Password updated successfully");
    } catch (error) {
      Alert.alert("Error", "Failed to update password");
    }
  }, [passwordData, user]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchDealershipProfile().finally(() => setRefreshing(false));
  }, [fetchDealershipProfile]);

  return (
    <ScrollView
      className={`flex-1 ${isDarkMode ? "bg-black" : "bg-white"}`}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* Subscription Warnings */}
      {subscriptionExpired && (
        <View className="bg-rose-700 p-4">
          <Text className="text-white text-center font-bold">
            Your subscription has expired. Please renew to continue.
          </Text>
        </View>
      )}

      {showWarning && (
        <View className="bg-yellow-500 p-4">
          <Text className="text-white text-center font-bold">
            Subscription expires in {daysUntilExpiration} days. Please renew
            soon.
          </Text>
        </View>
      )}

      {/* Profile Header */}
      <View className="relative">
        <LinearGradient
          colors={isDarkMode ? ["#D55004", "#1a1a1a"] : ["#D55004", "#ff8c00"]}
          className="pt-12 pb-24 rounded-b-[40px]"
        >
          <View className="flex-row justify-between px-6">
            <ThemeSwitch />
            <NotificationBell />
          </View>

          <View className="items-center mt-6">
            <View className="relative">
              <Image
                source={{
                  uri: formData.logo || "https://via.placeholder.com/150",
                }}
                className="w-32 h-32 rounded-full border-4 border-white/20"
              />
              <TouchableOpacity
                onPress={pickImage}
                disabled={isUploading}
                className="absolute bottom-0 right-0 bg-white/90 p-2 rounded-full shadow-lg"
              >
                {isUploading ? (
                  <ActivityIndicator color="#D55004" size="small" />
                ) : (
                  <Ionicons name="camera" size={20} color="#D55004" />
                )}
              </TouchableOpacity>
            </View>

            <Text className="text-white text-xl font-semibold mt-4">
              {formData.name}
            </Text>
            <Text className="text-white/80 text-sm">{formData.location}</Text>
          </View>
        </LinearGradient>
      </View>

      {/* Content Section */}
      <View className="px-6 -mt-12">
        <View
          className={`${
            isDarkMode ? "bg-neutral-800" : "bg-white"
          } rounded-3xl p-6 shadow-sm`}
        >
          {isChangePasswordMode ? (
            <View className="space-y-4">
              <TextInput
                className={`${
                  isDarkMode
                    ? "bg-neutral-700/50 text-white"
                    : "bg-neutral-700/5 text-black"
                } p-4 rounded-2xl border border-red`}
                value={passwordData.currentPassword}
                onChangeText={(text) =>
                  setPasswordData((prev) => ({
                    ...prev,
                    currentPassword: text,
                  }))
                }
                placeholder="Current Password"
                placeholderTextColor={isDarkMode ? "#999" : "#666"}
                secureTextEntry
                cursorColor="#D55004"
              />
              <TextInput
                className={`${
                  isDarkMode
                    ? "bg-neutral-700/50 text-white"
                    : "bg-neutral-700/5 text-black"
                } p-4 rounded-2xl border border-red`}
                value={passwordData.newPassword}
                onChangeText={(text) =>
                  setPasswordData((prev) => ({ ...prev, newPassword: text }))
                }
                placeholder="New Password"
                placeholderTextColor={isDarkMode ? "#999" : "#666"}
                secureTextEntry
                cursorColor="#D55004"
              />
              <TextInput
                className={`${
                  isDarkMode
                    ? "bg-neutral-700/50 text-white"
                    : "bg-neutral-700/5 text-black"
                } p-4 rounded-2xl border border-red`}
                value={passwordData.confirmPassword}
                onChangeText={(text) =>
                  setPasswordData((prev) => ({
                    ...prev,
                    confirmPassword: text,
                  }))
                }
                placeholder="Confirm New Password"
                placeholderTextColor={isDarkMode ? "#999" : "#666"}
                secureTextEntry
                cursorColor="#D55004"
              />

              <View className="flex-row space-x-4 mt-6">
                <TouchableOpacity
                  className="flex-1 bg-neutral-600/10 p-4 rounded-2xl"
                  onPress={() => setIsChangePasswordMode(false)}
                >
                  <Text
                    className={`text-center font-semibold ${
                      isDarkMode ? "text-white" : "text-black"
                    }`}
                  >
                    Cancel
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  className="flex-1 bg-red p-4 rounded-2xl"
                  onPress={handleChangePassword}
                >
                  <Text className="text-center text-white font-semibold">
                    Update Password
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View className="space-y-4">
              <Text
                className={`${
                  isDarkMode ? "text-white/60" : "text-textgray"
                } text-xs uppercase tracking-wider mb-6`}
              >
                Dealership Information
              </Text>

              <TextInput
                className={`${
                  isDarkMode
                    ? "bg-neutral-700/50 text-white"
                    : "bg-neutral-700/5 text-black"
                } p-4 rounded-2xl border border-red`}
                value={formData.name}
                onChangeText={(text) =>
                  setFormData((prev) => ({ ...prev, name: text }))
                }
                placeholder="Dealership Name"
                placeholderTextColor={isDarkMode ? "#999" : "#666"}
                cursorColor="#D55004"
              />

              <TextInput
                className={`${
                  isDarkMode
                    ? "bg-neutral-700/50 text-white"
                    : "bg-neutral-700/5 text-black"
                } p-4 rounded-2xl border border-red`}
                value={formData.phone}
                onChangeText={(text) =>
                  setFormData((prev) => ({ ...prev, phone: text }))
                }
                placeholder="Contact Number"
                keyboardType="phone-pad"
                placeholderTextColor={isDarkMode ? "#999" : "#666"}
                cursorColor="#D55004"
              />

              <TextInput
                className={`${
                  isDarkMode
                    ? "bg-neutral-700/50 text-white"
                    : "bg-neutral-700/5 text-black"
                } p-4 rounded-2xl border border-red`}
                value={formData.location}
                onChangeText={(text) =>
                  setFormData((prev) => ({ ...prev, location: text }))
                }
                placeholder="Address"
                placeholderTextColor={isDarkMode ? "#999" : "#666"}
                cursorColor="#D55004"
              />

              <View className="flex-row space-x-4">
                <TextInput
                  className={`${
                    isDarkMode
                      ? "bg-neutral-700/50 text-white"
                      : "bg-neutral-700/5 text-black"
                  } p-4 rounded-2xl border border-red flex-1`}
                  value={formData.latitude}
                  onChangeText={(text) =>
                    setFormData((prev) => ({ ...prev, latitude: text }))
                  }
                  placeholder="Latitude"
                  keyboardType="numeric"
                  placeholderTextColor={isDarkMode ? "#999" : "#666"}
                  cursorColor="#D55004"
                  editable={false}
                />
                <TextInput
                  className={`${
                    isDarkMode
                      ? "bg-neutral-700/50 text-white"
                      : "bg-neutral-700/5 text-black"
                  } p-4 rounded-2xl border border-red flex-1`}
                  value={formData.longitude}
                  onChangeText={(text) =>
                    setFormData((prev) => ({ ...prev, longitude: text }))
                  }
                  placeholder="Longitude"
                  keyboardType="numeric"
                  placeholderTextColor={isDarkMode ? "#999" : "#666"}
                  cursorColor="#D55004"
                  editable={false}
                />
              </View>

              <View className="flex-row space-x-4">
                <TouchableOpacity
                  className="flex-1 bg-blue-500 p-4 rounded-2xl flex-row justify-center items-center"
                  onPress={getLocation}
                >
                  <Ionicons
                    name="location"
                    size={20}
                    color="white"
                    style={{ marginRight: 8 }}
                  />
                  <Text className="text-white font-semibold">Get Location</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  className="flex-1 bg-green-500 p-4 rounded-2xl flex-row justify-center items-center"
                  onPress={() => setMapVisible(true)}
                >
                  <Ionicons
                    name="map"
                    size={20}
                    color="white"
                    style={{ marginRight: 8 }}
                  />
                  <Text className="text-white font-semibold">Pick on Map</Text>
                </TouchableOpacity>
              </View>

              <View className="space-y-3 mt-6">
                <TouchableOpacity
                  className="bg-red p-4 rounded-2xl flex-row justify-center items-center"
                  onPress={updateProfile}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <ActivityIndicator color="white" />
                  ) : (
                    <>
                      <Ionicons
                        name="save"
                        size={20}
                        color="white"
                        style={{ marginRight: 8 }}
                      />
                      <Text className="text-white font-semibold">
                        Update Profile
                      </Text>
                    </>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  className="flex-row items-center justify-center p-4 rounded-2xl border border-red/30"
                  onPress={() => setIsChangePasswordMode(true)}
                >
                  <Ionicons
                    name="key-outline"
                    size={20}
                    color={isDarkMode ? "#fff" : "#000"}
                    style={{ marginRight: 8 }}
                  />
                  <Text
                    className={`font-semibold ${
                      isDarkMode ? "text-white" : "text-black"
                    }`}
                  >
                    Change Password
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  className="bg-blue-500 p-4 rounded-2xl flex-row justify-center items-center"
                  onPress={() => router.push("/analytics")}
                >
                  <Ionicons
                    name="bar-chart"
                    size={20}
                    color="white"
                    style={{ marginRight: 8 }}
                  />
                  <Text className="text-white font-semibold">
                    View Analytics
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        {/* Sign Out Button */}
        <TouchableOpacity className="mt-8 mb-24" onPress={signOut}>
          <Text className="text-center text-red font-semibold border border-red p-4 rounded-2xl">
            Sign Out
          </Text>
        </TouchableOpacity>
      </View>

      {/* Map Modal */}
      <Modal
        visible={mapVisible}
        animationType="slide"
        onRequestClose={() => setMapVisible(false)}
      >
        <View className="flex-1">
          <GooglePlacesAutocomplete
            placeholder="Search location..."
            onPress={(data, details = null) => {
              if (details?.geometry?.location) {
                const { lat, lng } = details.geometry.location;
                setSelectedLocation({ latitude: lat, longitude: lng });
                setMapRegion({
                  latitude: lat,
                  longitude: lng,
                  latitudeDelta: 0.0922,
                  longitudeDelta: 0.0421,
                });
              }
            }}
            query={{
              key: "YOUR_GOOGLE_MAPS_API_KEY",
              language: "en",
              components: "country:lb",
            }}
            fetchDetails={true}
            styles={{
              container: {
                position: "absolute",
                top: Platform.OS === "ios" ? 50 : 10,
                left: 10,
                right: 10,
                zIndex: 1,
              },
              textInput: {
                height: 50,
                borderRadius: 25,
                paddingHorizontal: 16,
                backgroundColor: isDarkMode ? "#333" : "#fff",
                color: isDarkMode ? "#fff" : "#000",
              },
            }}
          />

          <MapView
            ref={mapRef}
            style={{ flex: 1 }}
            region={mapRegion}
            onPress={(e) => {
              setSelectedLocation(e.nativeEvent.coordinate);
              setMapRegion({
                ...e.nativeEvent.coordinate,
                latitudeDelta: 0.0922,
                longitudeDelta: 0.0421,
              });
            }}
          >
            {selectedLocation && <Marker coordinate={selectedLocation} />}
          </MapView>

          <BlurView
            intensity={80}
            tint={isDarkMode ? "dark" : "light"}
            className="absolute bottom-24 left-4 right-4 p-4 rounded-2xl"
          >
            {selectedLocation && (
              <Text className={isDarkMode ? "text-white" : "text-black"}>
                Location: {selectedLocation.latitude.toFixed(6)},{" "}
                {selectedLocation.longitude.toFixed(6)}
              </Text>
            )}
          </BlurView>

          <View className="flex-row justify-around p-4 pb-8 bg-transparent absolute bottom-0 left-0 right-0">
            <TouchableOpacity
              className="bg-red/90 px-8 py-4 rounded-full flex-row items-center"
              onPress={() => {
                setMapVisible(false);
                setSelectedLocation(null);
              }}
            >
              <Ionicons
                name="close"
                size={24}
                color="white"
                style={{ marginRight: 8 }}
              />
              <Text className="text-white font-bold">Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              className="bg-green-500/90 px-8 py-4 rounded-full flex-row items-center"
              onPress={() => {
                if (selectedLocation) {
                  setFormData((prev) => ({
                    ...prev,
                    latitude: selectedLocation.latitude.toString(),
                    longitude: selectedLocation.longitude.toString(),
                  }));
                  setMapVisible(false);
                }
              }}
              disabled={!selectedLocation}
            >
              <Ionicons
                name="checkmark"
                size={24}
                color="white"
                style={{ marginRight: 8 }}
              />
              <Text className="text-white font-bold">Confirm</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}
