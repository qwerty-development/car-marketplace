import React, { useState, useEffect, useRef } from "react";
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
} from "react-native";
import { supabase } from "@/utils/supabase";
import { useUser, useAuth } from "@clerk/clerk-expo";
import * as ImagePicker from "expo-image-picker";
import { Feather, Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/utils/ThemeContext";
import { NotificationBell } from "@/components/NotificationBell";
import { useNotifications } from "@/hooks/useNotifications";
import { setIsSigningOut } from "@/app/(home)/_layout";
import { LinearGradient } from "expo-linear-gradient";
import { useScrollToTop } from "@react-navigation/native";
import type { NotificationSettings } from "../types/type";
import openWhatsApp from "@/utils/openWhatsapp";

const WHATSAPP_NUMBER = "81972024";
const SUPPORT_EMAIL = "support@example.com";
const EMAIL_SUBJECT = "Support Request";

const MODAL_HEIGHT_PERCENTAGE = 0.75; // Adjust as needed

export default function UserProfileAndSupportPage() {
  const { isDarkMode } = useTheme();
  const { user } = useUser();
  const { signOut } = useAuth();
  const scrollRef = useRef<ScrollView>(null);
  const { cleanupPushToken } = useNotifications();

  // State Management
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
  const [notificationSettings, setNotificationSettings] =
    useState<NotificationSettings>({
      pushNotifications: true,
      emailNotifications: true,
      marketingUpdates: false,
      newCarAlerts: true,
    });

  useScrollToTop(scrollRef);

  useEffect(() => {
    if (user) {
      setFirstName(user.firstName || "");
      setLastName(user.lastName || "");
      setEmail(user.emailAddresses[0].emailAddress || "");
    }
  }, [user]);

  const updateProfile = async (): Promise<void> => {
    try {
      if (!user) throw new Error("No user found");

      await user.update({ firstName, lastName });
      const fullName = `${firstName} ${lastName}`.trim();
      const { error: supabaseError } = await supabase
        .from("users")
        .update({ name: fullName })
        .eq("id", user.id);

      if (supabaseError) throw supabaseError;
      Alert.alert("Success", "Profile updated successfully");
      setIsEditMode(false);
    } catch (error) {
      console.error("Error updating profile:", error);
      Alert.alert("Error", "Failed to update profile");
    }
  };

  const onPickImage = async (): Promise<void> => {
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
        const image = `data:${mimeType};base64,${base64}`;
        await user?.setProfileImage({ file: image });
        Alert.alert("Success", "Profile picture updated successfully");
      }
    } catch (err: any) {
      console.error("Error updating profile picture:", err);
      Alert.alert(
        "Error",
        err.errors?.[0]?.message || "Failed to update profile picture"
      );
    }
  };

  const handleChangePassword = async (): Promise<void> => {
    if (newPassword !== confirmPassword) {
      Alert.alert("Error", "New passwords do not match");
      return;
    }

    try {
      await user?.updatePassword({
        currentPassword,
        newPassword,
      });
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
    try {
      setIsSigningOut(true);
      await cleanupPushToken();
      await signOut();
    } catch (error) {
      console.error("Error during sign out:", error);
      Alert.alert("Error", "Failed to sign out properly");
    } finally {
      setIsSigningOut(false);
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
    setNotificationSettings((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const closeModal = (setModalVisible: (visible: boolean) => void) => {
    setModalVisible(false);
  };

  return (
    <ScrollView
      className={`flex-1 ${isDarkMode ? "bg-black" : "bg-white"} mb-10`}
      bounces={false}
      overScrollMode="never"
      showsVerticalScrollIndicator={false}
      ref={scrollRef}
    >
      {/* Header Section */}
      <View className="relative">
        <LinearGradient
          colors={isDarkMode ? ["#D55004", "#000000"] : ["#D55004","#DADADA"]}
          className="pt-12 pb-24 rounded-b-[40px]"
        >
          <View className="items-center mt-6">
            <View className="relative">
              <Image
                source={{ uri: user?.imageUrl }}
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
              {firstName} {lastName}
            </Text>
            <Text className="text-white/80 text-sm">{email}</Text>
          </View>
        </LinearGradient>
      </View>

      {/* Quick Actions */}
      {/* Quick Actions */}
      <View className="space-y-4 px-6 -mt-12">
        <TouchableOpacity
          onPress={() => setIsEditMode(true)}
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
              Update your personal information
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
          onPress={() => setIsSecuritySettingsVisible(true)}
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
              Password and privacy settings
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
          onPress={() => setIsNotificationSettingsVisible(true)}
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
              Your choice of beeps
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

      {/* Notification Settings Modal */}
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

            {(
              Object.keys(notificationSettings) as Array<
                keyof NotificationSettings
              >
            ).map((key) => (
              <TouchableOpacity
                key={key}
                onPress={() => toggleNotification(key)}
                className={`${isDarkMode ? "bg-neutral-800" : "bg-neutral-100"}
                    p-4 rounded-xl flex-row items-center justify-between mb-4`}
              >
                <View className="flex-row items-center">
                  <Ionicons
                    name={
                      notificationSettings[key]
                        ? "notifications"
                        : "notifications-off"
                    }
                    size={24}
                    color={isDarkMode ? "#fff" : "#000"}
                  />
                  <Text
                    className={`ml-3 ${
                      isDarkMode ? "text-white" : "text-black"
                    }`}
                  >
                    {key
                      .replace(/([A-Z])/g, " $1")
                      .replace(/^./, (str) => str.toUpperCase())}
                  </Text>
                </View>
                <View
                  className={`w-6 h-6 rounded-full ${
                    notificationSettings[key] ? "bg-green-500" : "bg-gray-400"
                  }`}
                />
              </TouchableOpacity>
            ))}
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
              p-4 rounded-2xl flex-row items-center`}
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

      {/* Sign Out Button */}
      <TouchableOpacity className="mt-2 p-5 mb-12" onPress={handleSignOut}>
        <Text
          className={`text-center text-red font-semibold border border-red p-4 rounded-2xl`}
        >
          Sign Out
        </Text>
      </TouchableOpacity>
    </ScrollView>
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