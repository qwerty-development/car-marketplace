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
  RefreshControl,
} from "react-native";
import { supabase } from "@/utils/supabase";
import { useAuth } from "@/utils/AuthContext";
import * as ImagePicker from "expo-image-picker";
import { Feather, Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/utils/ThemeContext";
import { useNotifications } from "@/hooks/useNotifications";
import { setIsSigningOut } from "@/app/(home)/_layout";
import { LinearGradient } from "expo-linear-gradient";
import { useScrollToTop, useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import type { NotificationSettings } from "../types/type";
import openWhatsApp from "@/utils/openWhatsapp";
import { useGuestUser } from "@/utils/GuestUserContext";
import { BlurView } from "expo-blur";
import Constants from "expo-constants";
import { SignOutOverlay } from "@/components/SignOutOverlay";
import { coordinateSignOut } from "@/app/(home)/_layout";
import * as SecureStore from "expo-secure-store";
import { NotificationService } from "@/services/NotificationService";
import { useNavigation } from "@react-navigation/native";

const WHATSAPP_NUMBER = "70786818";
const SUPPORT_EMAIL = "support@fleetapp.me";
const EMAIL_SUBJECT = "Support Request";
const DEFAULT_PROFILE_IMAGE =
  "https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y";

const MODAL_HEIGHT_PERCENTAGE = 0.75;
import * as Updates from 'expo-updates';

export default function UserProfileAndSupportPage() {
  const { isDarkMode } = useTheme();
  const {
    user,
    profile,
    signOut,
    updateUserProfile,
    updatePassword,
    forceProfileRefresh, // OPTIONAL: Only if implemented in AuthContext
  } = useAuth();
  const router = useRouter();
  const navigation = useNavigation();
  const scrollRef = useRef<ScrollView>(null);
  const { cleanupPushToken } = useNotifications();
  const { isGuest, clearGuestMode } = useGuestUser();
  const bannerAnimation = useRef(new Animated.Value(0)).current;
  const [showSignOutOverlay, setShowSignOutOverlay] = useState(false);
  const [isLegalVisible, setIsLegalVisible] = useState(false);

  // CRITICAL FIX: Simplified state management without aggressive refresh mechanisms
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [isEditMode, setIsEditMode] = useState(false);
  const [isChangePasswordMode, setIsChangePasswordMode] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSecuritySettingsVisible, setIsSecuritySettingsVisible] =
    useState(false);
  const [isNotificationSettingsVisible, setIsNotificationSettingsVisible] =
    useState(false);
  const [pushNotificationsEnabled, setPushNotificationsEnabled] =
    useState(true);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [notificationSettings, setNotificationSettings] =
    useState<NotificationSettings>({
      pushNotifications: true,
      emailNotifications: true,
      marketingUpdates: false,
      newCarAlerts: true,
    });

  // CRITICAL FIX: Controlled refresh mechanism with guards
  const profileInitialized = useRef(false);
  const lastSyncedProfile = useRef<string>("");
  const refreshTimeoutRef = useRef<NodeJS.Timeout>();

  useScrollToTop(scrollRef);

  // CRITICAL FIX: Debounced profile refresh function
  const handleProfileRefresh = useCallback(async () => {
    if (!user?.id || isGuest || refreshing) return;

    try {
      setRefreshing(true);
      console.log("[Profile] Manual refresh triggered");

      // GUARD: Clear any pending refresh timeouts
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }

      if (forceProfileRefresh) {
        await forceProfileRefresh();
      } else {
        // Direct database fetch as fallback
        const { data, error } = await supabase
          .from("users")
          .select("*")
          .eq("id", user.id)
          .single();

        if (data && !error) {
          console.log("[Profile] Manual refresh successful");
          // The profile will be updated through normal AuthContext flow
        }
      }
    } catch (error) {
      console.error("[Profile] Refresh error:", error);
    } finally {
      setRefreshing(false);
    }
  }, [user?.id, isGuest, refreshing, forceProfileRefresh]);

  // CRITICAL FIX: Optimized profile state synchronization with change detection
  const syncProfileState = useCallback(() => {
    if (!user || !profile || isGuest) {
      if (isGuest) {
        // GUARD: Only set guest data if not already set
        if (firstName !== "Guest" || lastName !== "User") {
          setFirstName("Guest");
          setLastName("User");
          setEmail("guest@example.com");
        }
      }
      return;
    }

    // CRITICAL FIX: Create profile signature for change detection
    const profileSignature = `${profile.name || ""}-${profile.email || ""}-${
      profile.last_active || ""
    }`;

    // GUARD: Only update if profile has actually changed
    if (lastSyncedProfile.current === profileSignature) {
      return;
    }

    console.log("[Profile] Profile data changed, updating local state");

    const nameParts = profile.name ? profile.name.split(" ") : ["", ""];
    const newFirstName = nameParts[0] || "";
    const newLastName = nameParts.slice(1).join(" ") || "";
    const newEmail = profile.email || user.email || "";

    // GUARD: Only update state if values actually changed
    if (firstName !== newFirstName) setFirstName(newFirstName);
    if (lastName !== newLastName) setLastName(newLastName);
    if (email !== newEmail) setEmail(newEmail);

    lastSyncedProfile.current = profileSignature;
    profileInitialized.current = true;
  }, [user, profile, isGuest, firstName, lastName, email]);

  // CRITICAL FIX: Initial profile synchronization (runs once)
  useEffect(() => {
    if (!profileInitialized.current) {
      console.log("[Profile] Initial profile synchronization");
      syncProfileState();
    }
  }, [syncProfileState]);

  // CRITICAL FIX: Controlled profile updates on profile object changes
  useEffect(() => {
    // GUARD: Only sync if profile is initialized and data actually changed
    if (profileInitialized.current && profile) {
      const profileSignature = `${profile.name || ""}-${profile.email || ""}-${
        profile.last_active || ""
      }`;

      if (lastSyncedProfile.current !== profileSignature) {
        console.log("[Profile] Profile object changed, syncing state");
        syncProfileState();
      }
    }
  }, [profile?.name, profile?.email, profile?.last_active, syncProfileState]);

  // CRITICAL FIX: Controlled focus-based refresh (debounced)
  useFocusEffect(
    useCallback(() => {
      console.log("[Profile] Screen focused");

      // GUARD: Debounce focus refresh to prevent excessive calls
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }

      refreshTimeoutRef.current = setTimeout(() => {
        // Only sync state, don't force database refresh on every focus
        if (profileInitialized.current) {
          syncProfileState();
        }
      }, 300);

      // Cleanup timeout on unmount
      return () => {
        if (refreshTimeoutRef.current) {
          clearTimeout(refreshTimeoutRef.current);
        }
      };
    }, [syncProfileState])
  );

  const fetchTokenStatus = useCallback(async () => {
    if (!user?.id || isGuest) return;

    try {
      setLoading(true);
      const token = await SecureStore.getItemAsync("expoPushToken");

      if (token) {
        const { data } = await supabase
          .from("user_push_tokens")
          .select("active, signed_in")
          .eq("user_id", user.id)
          .eq("token", token)
          .single();

        if (data) {
          setPushNotificationsEnabled(data.active && data.signed_in);
        }
      }
    } catch (error) {
      console.error("Error in fetchTokenStatus:", error);
    } finally {
      setLoading(false);
    }
  }, [user?.id, isGuest]);

  // CRITICAL FIX: Controlled token status fetch (only once)
  useEffect(() => {
    if (user?.id && !isGuest && !loading) {
      fetchTokenStatus();
    }
  }, [user?.id, isGuest]); // Removed fetchTokenStatus from dependencies

  useEffect(() => {
    if (isGuest) {
      Animated.spring(bannerAnimation, {
        toValue: 1,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }).start();
    }
  }, [isGuest, bannerAnimation]);

  // CRITICAL FIX: Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
    };
  }, []);

  const base64Decode = (base64String: string): Uint8Array => {
    const byteCharacters = atob(base64String);
    const byteNumbers = new Array(byteCharacters.length);

    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }

    return new Uint8Array(byteNumbers);
  };

  const updateProfile = async (): Promise<void> => {
    if (isGuest) {
      Alert.alert(
        "Feature Not Available",
        "Please sign in to edit your profile information.",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Sign In", onPress: handleSignIn },
        ]
      );
      return;
    }

    try {
      if (!user) throw new Error("No user found");

      const fullName = `${firstName} ${lastName}`.trim();

      console.log("[Profile] Updating profile via modal with name:", fullName);

      const { error } = await updateUserProfile({
        name: fullName,
      });

      if (error) throw error;

      Alert.alert("Success", "Profile updated successfully");
      setIsEditMode(false);

      // CRITICAL FIX: Let AuthContext handle the state update, no forced refresh
      console.log(
        "[Profile] Profile update completed, waiting for AuthContext update"
      );
    } catch (error) {
      console.error("Error updating profile:", error);
      Alert.alert("Error", "Failed to update profile");
    }
  };

  const onPickImage = async (): Promise<void> => {
    if (isGuest) {
      Alert.alert(
        "Feature Not Available",
        "Please sign in to update your profile picture.",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Sign In", onPress: handleSignIn },
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

        const fileName = `avatar-${user?.id}-${Date.now()}.jpg`;
        const { error: uploadError, data } = await supabase.storage
          .from("avatars")
          .upload(fileName, base64Decode(base64), {
            contentType: mimeType,
            upsert: true,
          });

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from("avatars")
          .getPublicUrl(fileName);
        const avatarUrl = urlData?.publicUrl;

        const { data: userData, error: userError } =
          await supabase.auth.updateUser({
            data: { avatar_url: avatarUrl },
          });

        if (userError) throw userError;

        Alert.alert("Success", "Profile picture updated successfully");
      }
    } catch (err: any) {
      console.error("Error updating profile picture:", err);
      Alert.alert("Error", err.message || "Failed to update profile picture");
    }
  };

  const handleChangePassword = async (): Promise<void> => {
    if (isGuest) {
      Alert.alert(
        "Feature Not Available",
        "Please sign in to change your password.",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Sign In", onPress: handleSignIn },
        ]
      );
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert("Error", "New passwords do not match");
      return;
    }

    try {
      const { error } = await updatePassword({
        currentPassword,
        newPassword,
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
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      {
        text: "Cancel",
        style: "cancel",
      },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: async () => {
          try {
            setShowSignOutOverlay(true);

            if (isGuest) {
              await coordinateSignOut(router, async () => {
                await clearGuestMode();
              });
            } else {
              if (user?.id) {
                const token = await SecureStore.getItemAsync("expoPushToken");
                if (token) {
                  await supabase
                    .from("user_push_tokens")
                    .update({
                      signed_in: false,
                      last_updated: new Date().toISOString(),
                    })
                    .eq("user_id", user.id)
                    .eq("token", token);
                }
              }

              await coordinateSignOut(router, async () => {
                try {
                  await cleanupPushToken();
                } catch (tokenError) {
                  console.error("Token cleanup error:", tokenError);
                }
                await signOut();
              });
            }
          } catch (error) {
            console.error("Error during sign out:", error);
            router.replace("/(auth)/sign-in");
            Alert.alert(
              "Sign Out Issue",
              "There was a problem signing out, but we've redirected you to the sign-in screen."
            );
          } finally {
            setShowSignOutOverlay(false);
          }
        },
      },
    ]);
  };

  const handleSignIn = async (): Promise<void> => {
    try {
      await clearGuestMode();
      router.replace("/(auth)/sign-in");
    } catch (error) {
      console.error("Error transitioning to sign in:", error);
      Alert.alert("Error", "Failed to transition to sign in page");
    }
  };

  const openWhatsApp1 = () => {
    openWhatsApp(WHATSAPP_NUMBER);
  };

  const openEmail = () => {
    const subject = encodeURIComponent(EMAIL_SUBJECT);
    Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=${subject}`);
  };

  const closeModal = (setModalVisible: (visible: boolean) => void) => {
    setModalVisible(false);
  };

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

   const handleDealershipRedirect = async () => {
    try {
      Alert.alert(
        "Switch to Dealership Interface",
        "You will be redirected to the dealership interface. The app will reload.",
        [
          {
            text: "Cancel",
            style: "cancel"
          },
          {
            text: "Continue",
            onPress: async () => {
              try {
                // Reload the entire app
                await Updates.reloadAsync();
              } catch (error) {
                console.error('Error reloading app:', error);
                Alert.alert('Error', 'Failed to reload app. Please restart manually.');
              }
            }
          }
        ]
      );
    } catch (error) {
      console.error('Error switching to dealership interface:', error);
      Alert.alert('Error', 'Something went wrong. Please try again.');
    }
  };

  return (
    <View
      style={{ flex: 1, backgroundColor: isDarkMode ? "#000000" : "#FFFFFF" }}
    >
      {isGuest && (
        <View style={guestStyles.overlay} pointerEvents="auto">
          <BlurView
            intensity={80}
            tint={isDarkMode ? "dark" : "light"}
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
            <TouchableOpacity
              style={guestStyles.signInButton}
              onPress={handleSignIn}
            >
              <Text style={guestStyles.signInButtonText}>Sign In</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      )}

      <ScrollView
        className={`flex-1 ${isDarkMode ? "bg-black" : "bg-white"} mb-10`}
        showsVerticalScrollIndicator={false}
        ref={scrollRef}
        contentContainerStyle={{ paddingTop: isGuest ? 80 : 0 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleProfileRefresh}
            tintColor={isDarkMode ? "#FFFFFF" : "#000000"}
          />
        }
      >
        {/* Header Section */}
        <View className="relative">
          <LinearGradient
            colors={
              isDarkMode ? ["#D55004", "#000000"] : ["#D55004", "#DADADA"]
            }
            className="pt-12 pb-24 rounded-b-[40px]"
          >
            {/* CRITICAL FIX: Removed dynamic key that caused re-renders */}
            <View className="items-center mt-6">
              <View className="relative">
                <Ionicons
                  name="person-circle-sharp"
                  size={128}
                  color={isDarkMode ? "#fff" : "#000"}
                />
              </View>
              <Text className="text-white text-xl font-semibold mt-4">
                {isGuest ? "Guest User" : `${firstName} ${lastName}`}
              </Text>
              <Text className="text-white/80 text-sm">
                {isGuest ? "" : email}
              </Text>

              {/* Dealer Role Check and Button */}
              {!isGuest && profile?.role === "dealer" && (
                <TouchableOpacity
                  onPress={handleDealershipRedirect}
                  className="mt-6 bg-red px-6 py-3 rounded-full flex-row items-center"
                >
                  <Ionicons
                    name="business"
                    size={20}
                    color="white"
                    style={{ marginRight: 8 }}
                  />
                  <Text className="text-white font-semibold">
                    You are a dealership, go to dealership interface
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </LinearGradient>
        </View>

        {/* Quick Actions */}
        <View className="space-y-4 px-6 -mt-12">
          <TouchableOpacity
            onPress={() => {
              if (isGuest) {
                Alert.alert(
                  "Feature Not Available",
                  "Please sign in to edit your profile information.",
                  [
                    { text: "Cancel", style: "cancel" },
                    { text: "Sign In", onPress: handleSignIn },
                  ]
                );
              } else {
                router.push("/(user)/EditProfile");
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

          <TouchableOpacity
            onPress={() => {
              if (isGuest) {
                Alert.alert(
                  "Feature Not Available",
                  "Please sign in to access security settings.",
                  [
                    { text: "Cancel", style: "cancel" },
                    { text: "Sign In", onPress: handleSignIn },
                  ]
                );
              } else {
                router.push("/(user)/ChangePassword");
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
                {isGuest
                  ? "Sign in to access security settings"
                  : "Change password"}
              </Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={24}
              color={isDarkMode ? "#fff" : "#000"}
              style={{ marginLeft: "auto" }}
            />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => {
              if (isGuest) {
                Alert.alert(
                  "Feature Not Available",
                  "Please sign in to access security settings.",
                  [
                    { text: "Cancel", style: "cancel" },
                    { text: "Sign In", onPress: handleSignIn },
                  ]
                );
              } else {
                setIsLegalVisible(true);
              }
            }}
            className={`${isDarkMode ? "bg-neutral-800" : "bg-neutral-200"}
            p-4 rounded-xl shadow-sm flex-row items-center`}
          >
            <View className="bg-purple-500/10 p-3 rounded-xl">
              <Ionicons name="reader-outline" size={24} color="#D55004" />
            </View>
            <View className="ml-4">
              <Text
                className={`${
                  isDarkMode ? "text-white" : "text-black"
                } font-semibold`}
              >
                Legal
              </Text>
              <Text
                className={`${
                  isDarkMode ? "text-white/60" : "text-gray-500"
                } text-sm mt-1`}
              >
                {isGuest ? "Sign in to access legal" : "Privacy and terms"}
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

        {/* Legal Modal */}
        <Modal
          animationType="slide"
          transparent={true}
          visible={isLegalVisible}
          onRequestClose={() => setIsLegalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback
              onPress={() => closeModal(setIsLegalVisible)}
            >
              <View style={styles.modalBackground} />
            </TouchableWithoutFeedback>
            <View
              style={[
                styles.modalContent,
                {
                  maxHeight: `${MODAL_HEIGHT_PERCENTAGE * 100}%`,
                  backgroundColor: isDarkMode ? "#1A1A1A" : "white",
                },
              ]}
            >
              <View className="flex-row justify-between items-center mb-6">
                <Text
                  className={`text-xl font-semibold ${
                    isDarkMode ? "text-white" : "text-black"
                  }`}
                >
                  Legal Documents
                </Text>
                <TouchableOpacity onPress={() => setIsLegalVisible(false)}>
                  <Ionicons
                    name="close"
                    size={24}
                    color={isDarkMode ? "#fff" : "#000"}
                  />
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                onPress={() => {
                  setIsLegalVisible(false);
                  router.push("/(user)/privacy-policy");
                }}
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
                onPress={() => {
                  setIsLegalVisible(false);
                  router.push("/(user)/terms-of-service");
                }}
                className={`${isDarkMode ? "bg-neutral-800" : "bg-neutral-100"}
                    p-4 rounded-xl flex-row items-center`}
              >
                <Ionicons
                  name="document-text-outline"
                  size={24}
                  color={isDarkMode ? "#fff" : "#000"}
                />
                <Text
                  className={`ml-3 ${isDarkMode ? "text-white" : "text-black"}`}
                >
                  Terms
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
            <View
              style={[
                styles.modalContent,
                {
                  maxHeight: `${MODAL_HEIGHT_PERCENTAGE * 100}%`,
                  backgroundColor: isDarkMode ? "#1A1A1A" : "white",
                },
              ]}
            >
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

        {/* Change Password Modal */}
        <Modal
          animationType="slide"
          transparent={true}
          visible={isChangePasswordMode}
          onRequestClose={() => setIsChangePasswordMode(false)}
        >
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback
              onPress={() => closeModal(setIsChangePasswordMode)}
            >
              <View style={styles.modalBackground} />
            </TouchableWithoutFeedback>
            <View
              style={[
                styles.modalContent,
                {
                  maxHeight: `${MODAL_HEIGHT_PERCENTAGE * 100}%`,
                  backgroundColor: isDarkMode ? "#1A1A1A" : "white",
                },
              ]}
            >
              <View className="flex-row justify-between items-center mb-6">
                <Text
                  className={`text-xl font-semibold ${
                    isDarkMode ? "text-white" : "text-black"
                  }`}
                >
                  Change Password
                </Text>
                <TouchableOpacity
                  onPress={() => setIsChangePasswordMode(false)}
                >
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

        <Text
          className="text-center mb-4"
          style={{ fontSize: 12, color: isDarkMode ? "#fff" : "#333" }}
        >
          Version {Constants.expoConfig?.version || "1.0.0"}
        </Text>

        {!isGuest && (
          <TouchableOpacity
            className="mt-2  p-5 mb-12 "
            onPress={handleSignOut}
            disabled={showSignOutOverlay}
          >
            <Text
              className={`text-center text-white  bg-rose-800 font-semibold border border-black p-4 rounded-2xl ${
                showSignOutOverlay ? "opacity-50" : "opacity-100"
              }`}
            >
              {showSignOutOverlay ? "Signing Out..." : "Sign Out"}
            </Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
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

const guestStyles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1000,
  },
  container: {
    width: "80%",
    padding: 24,
    borderRadius: 16,
    backgroundColor: "#D55004",
    alignItems: "center",
    shadowColor: "#000",
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
    fontWeight: "bold",
    color: "#ffffff",
    marginBottom: 12,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 16,
    color: "#ffffff",
    marginBottom: 20,
    textAlign: "center",
  },
  signInButton: {
    backgroundColor: "#ffffff",
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  signInButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#D55004",
  },
});
