import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  ScrollView,
  Alert,
  Linking,
  Modal,
  TouchableWithoutFeedback,
  StyleSheet,
  Animated,
} from "react-native";
import { supabase } from "@/utils/supabase";
import { useAuth } from "@/utils/AuthContext";
import * as ImagePicker from "expo-image-picker";
import { Feather, Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/utils/ThemeContext";
import { NotificationBell } from "@/components/NotificationBell";
import { useNotifications } from "@/hooks/useNotifications";
import { setIsSigningOut } from "@/app/(home)/_layout";
import { LinearGradient } from "expo-linear-gradient";
import { useScrollToTop } from "@react-navigation/native";
import { useRouter } from "expo-router";
import type { NotificationSettings } from "../types/type";
import openWhatsApp from "@/utils/openWhatsapp";
import { useGuestUser } from '@/utils/GuestUserContext';
import { BlurView } from "expo-blur";
import Constants from 'expo-constants';
import { SignOutOverlay } from '@/components/SignOutOverlay';
import { coordinateSignOut } from '@/app/(home)/_layout';
import * as SecureStore from 'expo-secure-store';

const WHATSAPP_NUMBER = "81972024";
const SUPPORT_EMAIL = "support@example.com";
const EMAIL_SUBJECT = "Support Request";
const DEFAULT_PROFILE_IMAGE = "https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y";

const MODAL_HEIGHT_PERCENTAGE = 0.75; // Adjust as needed

export default function UserProfileAndSupportPage() {
  const { isDarkMode } = useTheme();
  const { user, profile, signOut, updateUserProfile, updatePassword} = useAuth();
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);
  const {
    unreadCount,
    cleanupPushToken,
    refreshNotifications,
    loading: notificationsLoading
  } = useNotifications();
  const { isGuest, clearGuestMode } = useGuestUser();
  const bannerAnimation = useRef(new Animated.Value(0)).current;
  const [showSignOutOverlay, setShowSignOutOverlay] = useState(false);

  // State Management
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [isEditMode, setIsEditMode] = useState(false);
  const [isChangePasswordMode, setIsChangePasswordMode] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSecuritySettingsVisible, setIsSecuritySettingsVisible] = useState(false);
  const [isNotificationSettingsVisible, setIsNotificationSettingsVisible] = useState(false);
  const [pushNotificationsEnabled, setPushNotificationsEnabled] = useState(true);
  const [loading, setLoading] = useState(false);
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>({
    pushNotifications: true,
    emailNotifications: true,
    marketingUpdates: false,
    newCarAlerts: true,
  });

  useScrollToTop(scrollRef);

  // Fetch token status from database to update UI
  const fetchTokenStatus = useCallback(async () => {
    if (!user?.id || isGuest) return;

    try {
      setLoading(true);
      // Get the token from storage
      const token = await SecureStore.getItemAsync('expoPushToken');

      if (!token) {
        console.log('No token found when checking status');
        return;
      }

      // Check token status in database
      const { data } = await supabase
        .from('user_push_tokens')
        .select('active')
        .eq('user_id', user.id)
        .eq('token', token)
        .single();

      if (data) {
        setPushNotificationsEnabled(data.active);
        // Update local notification settings state to match
        setNotificationSettings(prev => ({
          ...prev,
          pushNotifications: data.active
        }));
      }
    } catch (error) {
      console.error('Error fetching token status:', error);
    } finally {
      setLoading(false);
    }
  }, [user?.id, isGuest]);

  // Function to toggle push notification status
// Function to toggle push notification status
const togglePushNotifications = async (enabled: boolean) => {
  if (!user?.id || isGuest) {
    Alert.alert(
      "Feature Not Available",
      "Please sign in to manage notifications.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Sign In", onPress: handleSignIn }
      ]
    );
    return;
  }

  try {
    setLoading(true);

    // Update local state immediately for responsive UI
    setPushNotificationsEnabled(enabled);
    setNotificationSettings(prev => ({
      ...prev,
      pushNotifications: enabled
    }));

    // Get the token from secure storage
    const token = await SecureStore.getItemAsync('expoPushToken');

    if (!token) {
      console.log('No push token found in secure storage');
      Alert.alert('Error', 'Push notification token not found. Please restart the app.');
      return;
    }

    console.log(`Updating token status to: ${enabled} for token: ${token.substring(0, 10)}...`);

    // Update token active status in database
    const { data, error } = await supabase
      .from('user_push_tokens')
      .update({ active: enabled })
      .eq('user_id', user.id)
      .eq('token', token);

    if (error) {
      console.error('Error updating token status:', error);

      // Revert UI state on error
      setPushNotificationsEnabled(!enabled);
      setNotificationSettings(prev => ({
        ...prev,
        pushNotifications: !enabled
      }));

      Alert.alert('Error', 'Failed to update notification settings. Please try again.');
    } else {
      console.log('Successfully updated push notification status');

      // On success, refresh the notifications count if needed
      if (enabled) {
        refreshNotifications();
      }
    }
  } catch (error) {
    console.error('Error in togglePushNotifications:', error);

    // Revert UI state on error
    setPushNotificationsEnabled(!enabled);
    setNotificationSettings(prev => ({
      ...prev,
      pushNotifications: !enabled
    }));

    Alert.alert('Error', 'An unexpected error occurred while updating notification settings.');
  } finally {
    setLoading(false);
  }
};

  useEffect(() => {
    if (user && profile && !isGuest) {
      // Extract first and last name from full name in profile
      const nameParts = profile.name ? profile.name.split(' ') : ['', ''];
      setFirstName(nameParts[0] || "");
      setLastName(nameParts.slice(1).join(' ') || "");
      setEmail(profile.email || user.email || "");
    } else if (isGuest) {
      setFirstName("Guest");
      setLastName("User");
      setEmail("guest@example.com");
    }
  }, [user, profile, isGuest]);

  // Fetch token status when component mounts
  useEffect(() => {
    if (user?.id && !isGuest) {
      fetchTokenStatus();
    }
  }, [user?.id, isGuest, fetchTokenStatus]);

  useEffect(() => {
    // Animate the guest banner entrance
    if (isGuest) {
      Animated.spring(bannerAnimation, {
        toValue: 1,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }).start();
    }
  }, [isGuest, bannerAnimation]);

  // Helper function to decode Base64
  const base64Decode = (base64String: string): Uint8Array => {
    const byteCharacters = atob(base64String);
    const byteNumbers = new Array(byteCharacters.length);

    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }

    return new Uint8Array(byteNumbers);
  };

  const updateProfile = async (): Promise<void> => {
    // Only allow profile update for authenticated users
    if (isGuest) {
      Alert.alert(
        "Feature Not Available",
        "Please sign in to edit your profile information.",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Sign In", onPress: handleSignIn }
        ]
      );
      return;
    }

    try {
      if (!user) throw new Error("No user found");

      // Create full name from first and last name
      const fullName = `${firstName} ${lastName}`.trim();

      // Update user profile in Supabase database
      const { error } = await updateUserProfile({
        name: fullName
      });

      if (error) throw error;

      Alert.alert("Success", "Profile updated successfully");
      setIsEditMode(false);
    } catch (error) {
      console.error("Error updating profile:", error);
      Alert.alert("Error", "Failed to update profile");
    }
  };

  const onPickImage = async (): Promise<void> => {
    // Only allow profile image update for authenticated users
    if (isGuest) {
      Alert.alert(
        "Feature Not Available",
        "Please sign in to update your profile picture.",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Sign In", onPress: handleSignIn }
        ]
      );
      return;
    }

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.1,
        base64: true,
      });

      if (!result.canceled && result.assets[0].base64) {
        const base64 = result.assets[0].base64;
        const mimeType = result.assets[0].mimeType || "image/jpeg";

        // First, upload to Supabase Storage
        const fileName = `avatar-${user?.id}-${Date.now()}.jpg`;
        const { error: uploadError, data } = await supabase.storage
          .from('avatars')
          .upload(fileName, base64Decode(base64), {
            contentType: mimeType,
            upsert: true
          });

        if (uploadError) throw uploadError;

        // Get the public URL of the uploaded image
        const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(fileName);
        const avatarUrl = urlData?.publicUrl;

        // Update the user metadata with the new avatar URL
        const { data: userData, error: userError } = await supabase.auth.updateUser({
          data: { avatar_url: avatarUrl }
        });

        if (userError) throw userError;

        Alert.alert("Success", "Profile picture updated successfully");
      }
    } catch (err: any) {
      console.error("Error updating profile picture:", err);
      Alert.alert(
        "Error",
        err.message || "Failed to update profile picture"
      );
    }
  };

  const handleChangePassword = async (): Promise<void> => {
    // Only allow password change for authenticated users
    if (isGuest) {
      Alert.alert(
        "Feature Not Available",
        "Please sign in to change your password.",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Sign In", onPress: handleSignIn }
        ]
      );
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert("Error", "New passwords do not match");
      return;
    }

    try {
      // Use updatePassword from AuthContext
      const { error } = await updatePassword({
        currentPassword,
        newPassword
      });

      if (error) throw error;

      Alert.alert("Success", "Password changed successfully");
      setIsChangePasswordMode(false);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error) {
      console.error("Error changing password:", error);
      Alert.alert("Error", "Failed to change password");
    }
  };

  const handleSignOut = async (): Promise<void> => {
    // Confirm with user before signing out
    Alert.alert(
      "Sign Out",
      "Are you sure you want to sign out?",
      [
        {
          text: "Cancel",
          style: "cancel"
        },
        {
          text: "Sign Out",
          style: "destructive",
          onPress: async () => {
            try {
              // Show overlay during sign out
              setShowSignOutOverlay(true);

              if (isGuest) {
                // Handle guest user sign out with coordination
                await coordinateSignOut(router, async () => {
                  // Clean up guest mode
                  await clearGuestMode();
                });
              } else {
                // Handle regular user sign out with coordination
                await coordinateSignOut(router, async () => {
                  // First clean up push token (this now marks the token as signed_in: false instead of deleting)
                  try {
                    await cleanupPushToken();
                  } catch (tokenError) {
                    console.error("Token cleanup error:", tokenError);
                    // Continue with sign out even if token cleanup fails
                  }

                  // Then perform the actual sign out
                  await signOut();
                });
              }
            } catch (error) {
              console.error("Error during sign out:", error);

              // Force navigation to sign-in on failure
              router.replace('/(auth)/sign-in');

              Alert.alert(
                "Sign Out Issue",
                "There was a problem signing out, but we've redirected you to the sign-in screen."
              );
            } finally {
              // Hide overlay
              setShowSignOutOverlay(false);
            }
          }
        }
      ]
    );
  };

  // Handler for when guest user wants to sign in
  const handleSignIn = async (): Promise<void> => {
    try {
      await clearGuestMode();
      router.replace('/(auth)/sign-in');
    } catch (error) {
      console.error("Error transitioning to sign in:", error);
      Alert.alert("Error", "Failed to transition to sign in page");
    }
  };

  const openWhatsApp1 = () => {
    // If WHATSAPP_NUMBER is a constant, make sure it doesn't include country code
    openWhatsApp(WHATSAPP_NUMBER);
  };

  const openEmail = () => {
    const subject = encodeURIComponent(EMAIL_SUBJECT);
    Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=${subject}`);
  };

  const toggleNotification = (key: keyof NotificationSettings) => {
    // Only allow notification changes for authenticated users
    if (isGuest) {
      Alert.alert(
        "Feature Not Available",
        "Please sign in to manage notification settings.",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Sign In", onPress: handleSignIn }
        ]
      );
      return;
    }

    // Special handling for push notifications toggle
    if (key === 'pushNotifications') {
      togglePushNotifications(!notificationSettings.pushNotifications);
      return;
    }

    // Handle other notification settings normally
    setNotificationSettings((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const closeModal = (setModalVisible: (visible: boolean) => void) => {
    setModalVisible(false);
  };

  // Guest Banner animation styles
  const bannerAnimatedStyle = {
    opacity: bannerAnimation,
    transform: [
      {
        translateY: bannerAnimation.interpolate({
          inputRange: [0, 1],
          outputRange: [-50, 0],
        }),
      },
    ],
  };

  return (
    <View style={{ flex: 1, backgroundColor: isDarkMode ? "#000000" : "#FFFFFF" }}>
      {isGuest && (
        <View style={guestStyles.overlay} pointerEvents="auto">
          <BlurView
            intensity={80}
            tint={isDarkMode ? 'dark' : 'light'}
            style={StyleSheet.absoluteFill}
          />
          <Animated.View style={[guestStyles.container, bannerAnimatedStyle]}>
            <Ionicons
              name="lock-closed-outline"
              size={56}
              color="#ffffff"
              style={guestStyles.icon}
            />
            <Text style={guestStyles.title}>You're browsing as a guest</Text>
            <Text style={guestStyles.subtitle}>
              Please sign in to access this feature.
            </Text>
            <TouchableOpacity style={guestStyles.signInButton} onPress={handleSignIn}>
              <Text style={guestStyles.signInButtonText}>Sign In</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      )}

      <ScrollView
        className={`flex-1 ${isDarkMode ? "bg-black" : "bg-white"} mb-10`}
        bounces={false}
        overScrollMode="never"
        showsVerticalScrollIndicator={false}
        ref={scrollRef}
        contentContainerStyle={{ paddingTop: isGuest ? 80 : 0 }}
      >
        {/* Header Section */}
        <View className="relative">
          <LinearGradient
            colors={isDarkMode ? ["#D55004", "#000000"] : ["#D55004","#DADADA"]}
            className="pt-12 pb-24 rounded-b-[40px]"
          >
            {/* Header row with notification bell */}
            <View className="flex-row justify-end px-4">
              {!isGuest && <NotificationBell />}
            </View>

            {/* Profile information */}
            <View className="items-center mt-6">
              <View className="relative">
                <Image
                  source={{ uri: isGuest
                    ? DEFAULT_PROFILE_IMAGE
                    : (user?.user_metadata?.avatar_url || DEFAULT_PROFILE_IMAGE) }}
                  className="w-32 h-32 rounded-full border-4 border-white/20"
                />
                <TouchableOpacity
                  onPress={onPickImage}
                  className="absolute bottom-0 right-0 bg-white/90 p-2 rounded-full shadow-lg"
                >
                  <Ionicons name="camera" size={20} color="#D55004" />
                </TouchableOpacity>
              </View>
              <Text className="text-white text-xl font-semibold mt-4">
                {isGuest ? "Guest User" : `${firstName} ${lastName}`}
              </Text>
              <Text className="text-white/80 text-sm">
                {isGuest ? "" : email}
              </Text>
            </View>
          </LinearGradient>
        </View>

        {/* Quick Actions */}
        <View className="space-y-4 px-6 -mt-12">
          {/* Edit Profile button - different behavior for guests */}
          <TouchableOpacity
            onPress={() => {
              if (isGuest) {
                Alert.alert(
                  "Feature Not Available",
                  "Please sign in to edit your profile information.",
                  [
                    { text: "Cancel", style: "cancel" },
                    { text: "Sign In", onPress: handleSignIn }
                  ]
                );
              } else {
                setIsEditMode(true);
              }
            }}
            className={`${isDarkMode ? "bg-neutral-800" : "bg-neutral-200"}
        p-4 rounded-xl shadow-sm flex-row items-center`}
          >
            <View className="bg-red/10 p-3 rounded-xl">
              <Ionicons name="person-outline" size={24} color="#D55004" />
            </View>
            <View className="ml-4">
              <Text
                className={`${
                  isDarkMode ? "text-white" : "text-black"
                } font-semibold`}
              >
                Edit Profile
              </Text>
              <Text
                className={`${
                  isDarkMode ? "text-white/60" : "text-gray-500"
                } text-sm mt-1`}
              >
                {isGuest ? "Sign in to edit your profile" : "Update your infos"}
              </Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={24}
              color={isDarkMode ? "#fff" : "#000"}
              style={{ marginLeft: "auto" }}
            />
          </TouchableOpacity>

          {/* Security settings button - different behavior for guests */}
          <TouchableOpacity
            onPress={() => {
              if (isGuest) {
                Alert.alert(
                  "Feature Not Available",
                  "Please sign in to access security settings.",
                  [
                    { text: "Cancel", style: "cancel" },
                    { text: "Sign In", onPress: handleSignIn }
                  ]
                );
              } else {
                setIsSecuritySettingsVisible(true);
              }
            }}
            className={`${isDarkMode ? "bg-neutral-800" : "bg-neutral-200"}
        p-4 rounded-xl shadow-sm flex-row items-center`}
          >
            <View className="bg-purple-500/10 p-3 rounded-xl">
              <Ionicons name="shield-outline" size={24} color="#D55004" />
            </View>
            <View className="ml-4">
              <Text
                className={`${
                  isDarkMode ? "text-white" : "text-black"
                } font-semibold`}
              >
                Security
              </Text>
              <Text
                className={`${
                  isDarkMode ? "text-white/60" : "text-gray-500"
                } text-sm mt-1`}
              >
                {isGuest ? "Sign in to access security settings" : "Password and privacy"}
              </Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={24}
              color={isDarkMode ? "#fff" : "#000"}
              style={{ marginLeft: "auto" }}
            />
          </TouchableOpacity>

          {/* Notifications button - different behavior for guests */}
          <TouchableOpacity
            onPress={() => {
              if (isGuest) {
                Alert.alert(
                  "Feature Not Available",
                  "Please sign in to manage notifications.",
                  [
                    { text: "Cancel", style: "cancel" },
                    { text: "Sign In", onPress: handleSignIn }
                  ]
                );
              } else {
                setIsNotificationSettingsVisible(true);
              }
            }}
            className={`${isDarkMode ? "bg-neutral-800" : "bg-neutral-200"}
        p-4 rounded-xl shadow-sm flex-row items-center`}
          >
            <View className="bg-blue-500/10 p-3 rounded-xl">
              <Ionicons name="notifications-outline" size={24} color="#D55004" />
            </View>
            <View className="ml-4">
              <Text
                className={`${
                  isDarkMode ? "text-white" : "text-black"
                } font-semibold`}
              >
                Notifications
              </Text>
              <Text
                className={`${
                  isDarkMode ? "text-white/60" : "text-gray-500"
                } text-sm mt-1`}
              >
                {isGuest ? "Sign in to manage notifications" : "Control alerts"}
              </Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={24}
              color={isDarkMode ? "#fff" : "#000"}
              style={{ marginLeft: "auto" }}
            />
          </TouchableOpacity>
        </View>

        {/* Edit Profile Modal */}
        <Modal
          animationType="slide"
          transparent={true}
          visible={isEditMode}
          onRequestClose={() => setIsEditMode(false)}
        >
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback onPress={() => closeModal(setIsEditMode)}>
              <View style={styles.modalBackground} />
            </TouchableWithoutFeedback>
            <View style={[styles.modalContent, { maxHeight: `${MODAL_HEIGHT_PERCENTAGE * 100}%`, backgroundColor: isDarkMode ? "#1A1A1A" : "white" }]}>
              <View className="flex-row justify-between items-center mb-6">
                <Text
                  className={`text-xl font-semibold ${
                    isDarkMode ? "text-white" : "text-black"
                  }`}
                >
                  Edit Profile
                </Text>
                <TouchableOpacity onPress={() => setIsEditMode(false)}>
                  <Ionicons
                    name="close"
                    size={24}
                    color={isDarkMode ? "#fff" : "#000"}
                  />
                </TouchableOpacity>
              </View>

              <View className="space-y-4">
                <TextInput
                  className={`${
                    isDarkMode
                      ? "bg-neutral-800 text-white"
                      : "bg-neutral-100 text-black"
                  } p-4 rounded-xl`}
                  value={firstName}
                  onChangeText={setFirstName}
                  placeholder="First Name"
                  placeholderTextColor={isDarkMode ? "#999" : "#666"}
                  cursorColor="#D55004"
                />
                <TextInput
                  className={`${
                    isDarkMode
                      ? "bg-neutral-800 text-white"
                      : "bg-neutral-100 text-black"
                  } p-4 rounded-xl`}
                  value={lastName}
                  onChangeText={setLastName}
                  placeholder="Last Name"
                  placeholderTextColor={isDarkMode ? "#999" : "#666"}
                  cursorColor="#D55004"
                />
                <TextInput
                  className={`${
                    isDarkMode
                      ? "bg-neutral-800 text-white"
                      : "bg-neutral-100 text-black"
                  } p-4 rounded-xl`}
                  value={email}
                  editable={false}
                  placeholder="Email"
                  placeholderTextColor={isDarkMode ? "#999" : "#666"}
                />
              </View>

              <TouchableOpacity
                className="bg-red mt-6 p-4 rounded-xl"
                onPress={updateProfile}
              >
                <Text className="text-white text-center font-semibold">
                  Update Profile
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* Security Settings Modal */}
        <Modal
          animationType="slide"
          transparent={true}
          visible={isSecuritySettingsVisible}
          onRequestClose={() => setIsSecuritySettingsVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback onPress={() => closeModal(setIsSecuritySettingsVisible)}>
              <View style={styles.modalBackground} />
            </TouchableWithoutFeedback>

            <View style={[styles.modalContent, { maxHeight: `${MODAL_HEIGHT_PERCENTAGE * 100}%`, backgroundColor: isDarkMode ? "#1A1A1A" : "white" }]}>
              <View className="flex-row justify-between items-center mb-6">
                <Text
                  className={`text-xl font-semibold ${
                    isDarkMode ? "text-white" : "text-black"
                  }`}
                >
                  Security & Privacy
                </Text>
                <TouchableOpacity
                  onPress={() => setIsSecuritySettingsVisible(false)}
                >
                  <Ionicons
                    name="close"
                    size={24}
                    color={isDarkMode ? "#fff" : "#000"}
                  />
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                onPress={() => {
                  setIsSecuritySettingsVisible(false);
                  setIsChangePasswordMode(true);
                }}
                className={`${isDarkMode ? "bg-neutral-800" : "bg-neutral-100"}
                    p-4 rounded-xl flex-row items-center mb-4`}
              >
                <Ionicons
                  name="key-outline"
                  size={24}
                  color={isDarkMode ? "#fff" : "#000"}
                />
                <Text
                  className={`ml-3 ${isDarkMode ? "text-white" : "text-black"}`}
                >
                  Change Password
                </Text>
                <Ionicons
                  name="chevron-forward"
                  size={24}
                  color={isDarkMode ? "#fff" : "#000"}
                  style={{ marginLeft: "auto" }}
                />
              </TouchableOpacity>

              <TouchableOpacity
                className={`${isDarkMode ? "bg-neutral-800" : "bg-neutral-100"}
                    p-4 rounded-xl flex-row items-center mb-4`}
              >
                <Ionicons
                  name="shield-outline"
                  size={24}
                  color={isDarkMode ? "#fff" : "#000"}
                />
                <Text
                  className={`ml-3 ${isDarkMode ? "text-white" : "text-black"}`}
                >
                  Privacy Policy
                </Text>
                <Ionicons
                  name="chevron-forward"
                  size={24}
                  color={isDarkMode ? "#fff" : "#000"}
                  style={{ marginLeft: "auto" }}
                />
              </TouchableOpacity>

              <TouchableOpacity
                className={`${isDarkMode ? "bg-neutral-800" : "bg-neutral-100"}
                    p-4 rounded-xl flex-row items-center`}
              >
                <Ionicons
                  name="lock-closed-outline"
                  size={24}
                  color={isDarkMode ? "#fff" : "#000"}
                />
                <Text
                  className={`ml-3 ${isDarkMode ? "text-white" : "text-black"}`}
                >
                  Security Settings
                </Text>
                <Ionicons
                  name="chevron-forward"
                  size={24}
                  color={isDarkMode ? "#fff" : "#000"}
                  style={{ marginLeft: "auto" }}
                />
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* Notification Settings Modal - Updated with functional push notification toggle */}
{/* Notification Settings Modal - Updated with functional push notification toggle */}
<Modal
  animationType="slide"
  transparent={true}
  visible={isNotificationSettingsVisible}
  onRequestClose={() => setIsNotificationSettingsVisible(false)}
>
  <View style={styles.modalOverlay}>
    <TouchableWithoutFeedback onPress={() => closeModal(setIsNotificationSettingsVisible)}>
      <View style={styles.modalBackground} />
    </TouchableWithoutFeedback>
    <View style={[styles.modalContent, { maxHeight: `${MODAL_HEIGHT_PERCENTAGE * 100}%`, backgroundColor: isDarkMode ? "#1A1A1A" : "white" }]}>
      <View className="flex-row justify-between items-center mb-6">
        <Text
          className={`text-xl font-semibold ${
            isDarkMode ? "text-white" : "text-black"
          }`}
        >
          Notification Settings
        </Text>
        <TouchableOpacity
          onPress={() => setIsNotificationSettingsVisible(false)}
        >
          <Ionicons
            name="close"
            size={24}
            color={isDarkMode ? "#fff" : "#000"}
          />
        </TouchableOpacity>
      </View>

      {/* Push Notification Toggle - Controls token active status */}
      <TouchableOpacity
        onPress={() => togglePushNotifications(!pushNotificationsEnabled)}
        className={`${isDarkMode ? "bg-neutral-800" : "bg-neutral-100"}
            p-4 rounded-xl flex-row items-center justify-between mb-4`}
        disabled={loading}
      >
        <View className="flex-row items-center">
          <Ionicons
            name={pushNotificationsEnabled ? "notifications" : "notifications-off"}
            size={24}
            color={pushNotificationsEnabled ? "#22c55e" : (isDarkMode ? "#fff" : "#000")}
          />
          <Text
            className={`ml-3 ${isDarkMode ? "text-white" : "text-black"}`}
          >
            Push Notifications
          </Text>
        </View>
        <View
          className={`w-12 h-6 rounded-full flex justify-center ${
            pushNotificationsEnabled ? "bg-green-500" : "bg-gray-400"
          }`}
        >
          <View
            className={`w-5 h-5 rounded-full bg-white shadow-md ${
              pushNotificationsEnabled ? "ml-6" : "ml-1"
            }`}
          />
        </View>
      </TouchableOpacity>

      {/* Explanation text */}
      <Text className={`${isDarkMode ? "text-white/70" : "text-gray-600"} text-sm mt-2 mb-4`}>
        {pushNotificationsEnabled
          ? "You will receive push notifications about car listings, price changes, and other updates."
          : "You have disabled push notifications. You won't receive alerts about new listings or updates."}
      </Text>

      {loading && (
        <View className="items-center py-2">
          <Text className={`${isDarkMode ? "text-white/70" : "text-gray-600"} text-sm flex-row items-center`}>
            <Ionicons name="sync" size={16} color={isDarkMode ? "#fff" : "#000"} className="animate-spin mr-2" />
            Updating settings...
          </Text>
        </View>
      )}

      {/* Additional notification options can remain but separated */}
      <View className="mt-6">
        <Text className={`${isDarkMode ? "text-white/90" : "text-gray-800"} font-semibold mb-4`}>
          Other Notification Types
        </Text>

        {/* Email notifications toggle */}
        <TouchableOpacity
          onPress={() => toggleNotification('emailNotifications')}
          className={`${isDarkMode ? "bg-neutral-800" : "bg-neutral-100"}
              p-4 rounded-xl flex-row items-center justify-between mb-4`}
        >
          <View className="flex-row items-center">
            <Ionicons
              name={notificationSettings.emailNotifications ? "mail" : "mail-outline"}
              size={24}
              color={notificationSettings.emailNotifications ? "#3b82f6" : (isDarkMode ? "#fff" : "#000")}
            />
            <Text
              className={`ml-3 ${isDarkMode ? "text-white" : "text-black"}`}
            >
              Email Notifications
            </Text>
          </View>
          <View
            className={`w-12 h-6 rounded-full flex justify-center ${
              notificationSettings.emailNotifications ? "bg-blue-500" : "bg-gray-400"
            }`}
          >
            <View
              className={`w-5 h-5 rounded-full bg-white shadow-md ${
                notificationSettings.emailNotifications ? "ml-6" : "ml-1"
              }`}
            />
          </View>
        </TouchableOpacity>

        {/* Marketing updates toggle */}
        <TouchableOpacity
          onPress={() => toggleNotification('marketingUpdates')}
          className={`${isDarkMode ? "bg-neutral-800" : "bg-neutral-100"}
              p-4 rounded-xl flex-row items-center justify-between mb-4`}
        >
          <View className="flex-row items-center">
            <Ionicons
              name={notificationSettings.marketingUpdates ? "megaphone" : "megaphone-outline"}
              size={24}
              color={notificationSettings.marketingUpdates ? "#ec4899" : (isDarkMode ? "#fff" : "#000")}
            />
            <Text
              className={`ml-3 ${isDarkMode ? "text-white" : "text-black"}`}
            >
              Marketing Updates
            </Text>
          </View>
          <View
            className={`w-12 h-6 rounded-full flex justify-center ${
              notificationSettings.marketingUpdates ? "bg-pink-500" : "bg-gray-400"
            }`}
          >
            <View
              className={`w-5 h-5 rounded-full bg-white shadow-md ${
                notificationSettings.marketingUpdates ? "ml-6" : "ml-1"
              }`}
            />
          </View>
        </TouchableOpacity>
      </View>
    </View>
  </View>
</Modal>

        {/* Change Password Modal */}
        <Modal
          animationType="slide"
          transparent={true}
          visible={isChangePasswordMode}
          onRequestClose={() => setIsChangePasswordMode(false)}
        >
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback onPress={() => closeModal(setIsChangePasswordMode)}>
              <View style={styles.modalBackground} />
            </TouchableWithoutFeedback>
            <View style={[styles.modalContent, { maxHeight: `${MODAL_HEIGHT_PERCENTAGE * 100}%`, backgroundColor: isDarkMode ? "#1A1A1A" : "white" }]}>
              <View className="flex-row justify-between items-center mb-6">
                <Text
                  className={`text-xl font-semibold ${
                    isDarkMode ? "text-white" : "text-black"
                  }`}
                >
                  Change Password
                </Text>
                <TouchableOpacity onPress={() => setIsChangePasswordMode(false)}>
                  <Ionicons
                    name="close"
                    size={24}
                    color={isDarkMode ? "#fff" : "#000"}
                  />
                </TouchableOpacity>
              </View>

              <View className="space-y-4">
                <TextInput
                  className={`${
                    isDarkMode
                      ? "bg-neutral-800 text-white"
                      : "bg-neutral-100 text-black"
                  } p-4 rounded-xl`}
                  value={currentPassword}
                  onChangeText={setCurrentPassword}
                  placeholder="Current Password"
                  placeholderTextColor={isDarkMode ? "#999" : "#666"}
                  secureTextEntry
                  cursorColor="#D55004"
                />
                <TextInput
                  className={`${
                    isDarkMode
                      ? "bg-neutral-800 text-white"
                      : "bg-neutral-100 text-black"
                  } p-4 rounded-xl`}
                  value={newPassword}
                  onChangeText={setNewPassword}
                  placeholder="New Password"
                  placeholderTextColor={isDarkMode ? "#999" : "#666"}
                  secureTextEntry
                  cursorColor="#D55004"
                />
                <TextInput
                  className={`${
                    isDarkMode
                      ? "bg-neutral-800 text-white"
                      : "bg-neutral-100 text-black"
                  } p-4 rounded-xl`}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder="Confirm New Password"
                  placeholderTextColor={isDarkMode ? "#999" : "#666"}
                  secureTextEntry
                  cursorColor="#D55004"
                />
              </View>

              <View className="flex-row space-x-4 mt-6">
                <TouchableOpacity
                  className="flex-1 bg-neutral-600/10 p-4 rounded-xl"
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
                  className="flex-1 bg-red p-4 rounded-xl"
                  onPress={handleChangePassword}
                >
                  <Text className="text-center text-white font-semibold">
                    Update Password
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Support Section */}
        <View className="mt-2 p-8 space-y-4">
          <Text
            className={`${
              isDarkMode ? "text-white/60" : "text-textgray"
            } text-xs uppercase tracking-wider`}
          >
            Support & Help
          </Text>

          <TouchableOpacity
            onPress={openWhatsApp1}
            className={`${isDarkMode ? "bg-neutral-800" : "bg-neutral-200"}
                p-4 rounded-2xl flex-row items-center`}
          >
            <View className="bg-green-500/10 p-3 rounded-xl">
              <Feather name="message-circle" size={22} color="#22c55e" />
            </View>
            <View className="ml-4">
              <Text
                className={`font-semibold ${
                  isDarkMode ? "text-white" : "text-black"
                }`}
              >
                WhatsApp Support
              </Text>
              <Text
                className={`text-xs ${
                  isDarkMode ? "text-white/60" : "text-textgray"
                }`}
              >
                Available 24/7
              </Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={20}
              color={isDarkMode ? "#fff" : "#000"}
              style={{ marginLeft: "auto" }}
            />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={openEmail}
            className={`${isDarkMode ? "bg-neutral-800" : "bg-neutral-200"}
                p-4 rounded-2xl flex-row items-center mb-4`}
          >
            <View className="bg-blue-500/10 p-3 rounded-xl">
              <Feather name="mail" size={22} color="#3b82f6" />
            </View>
            <View className="ml-4">
              <Text
                className={`font-semibold ${
                  isDarkMode ? "text-white" : "text-black"
                }`}
              >
                Email Support
              </Text>
              <Text
                className={`text-xs ${
                  isDarkMode ? "text-white/60" : "text-gray"
                }`}
              >
                Detailed inquiries
              </Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={20}
              color={isDarkMode ? "#fff" : "#000"}
              style={{ marginLeft: "auto" }}
            />
          </TouchableOpacity>
        </View>

        {/* Version Information */}
        <Text className="text-center mb-4" style={{ fontSize: 12, color: isDarkMode ? "#fff" : "#333" }}>
          Version {Constants.expoConfig?.version || '1.0.0'}
        </Text>

        {/* Sign Out Button */}
        {!isGuest && (
          <TouchableOpacity
            className="mt-2 p-5 mb-12"
            onPress={handleSignOut}
            disabled={showSignOutOverlay} // Disable during sign-out
          >
            <Text
              className={`text-center text-red font-semibold border border-red p-4 rounded-2xl ${
                showSignOutOverlay ? 'opacity-50' : 'opacity-100'
              }`}
            >
              {showSignOutOverlay ? 'Signing Out...' : 'Sign Out'}
            </Text>
          </TouchableOpacity>
        )}
      </ScrollView>
      <SignOutOverlay visible={showSignOutOverlay} />
    </View>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.5)", // Semi-transparent background
  },
  modalBackground: {
    position: "absolute",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
  },
  modalContent: {
    width: "80%",
    borderRadius: 20,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
});

// Common guest styles – can be placed in a separate file for reuse
const guestStyles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)', // semi-transparent overlay
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  container: {
    width: '80%',
    padding: 24,
    borderRadius: 16,
    backgroundColor: '#D55004', // unified orange background
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 10,
  },
  icon: {
    marginBottom: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#ffffff',
    marginBottom: 20,
    textAlign: 'center',
  },
  signInButton: {
    backgroundColor: '#ffffff',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  signInButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#D55004',
  },
});