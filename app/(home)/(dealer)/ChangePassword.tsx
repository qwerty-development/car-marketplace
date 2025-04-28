import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  StyleSheet,
} from "react-native";
import { useAuth } from "@/utils/AuthContext";
import { useTheme } from "@/utils/ThemeContext";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

export default function ChangePasswordScreen() {
  const { isDarkMode } = useTheme();
  const { updatePassword } = useAuth();
  const router = useRouter();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      Alert.alert("Error", "New passwords do not match");
      return;
    }
    
    if (newPassword.length < 8) {
      Alert.alert("Error", "Password must be at least 8 characters long");
      return;
    }

    try {
      setLoading(true);
      // Use updatePassword from AuthContext
      const { error } = await updatePassword({
        currentPassword,
        newPassword,
      });

      if (error) throw error;

      Alert.alert("Success", "Password changed successfully");
      router.back();
    } catch (error) {
      console.error("Error changing password:", error);
      Alert.alert("Error", "Failed to change password. Please check your current password and try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={{ 
      flex: 1, 
      backgroundColor: isDarkMode ? "#000000" : "#FFFFFF",
      padding: 20
    }}>
      <View className="flex-row items-center mb-6">
        <TouchableOpacity onPress={() => router.back()} className="mr-4">
          <Ionicons
            name="arrow-back"
            size={24}
            color={isDarkMode ? "#fff" : "#000"}
          />
        </TouchableOpacity>
        <Text
          className={`text-xl font-semibold ${
            isDarkMode ? "text-white" : "text-black"
          }`}
        >
          Change Password
        </Text>
      </View>

      <View className="space-y-4 mt-4">
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

      <TouchableOpacity
        className={`bg-red mt-6 p-4 rounded-xl ${loading ? "opacity-70" : ""}`}
        onPress={handleChangePassword}
        disabled={loading}
      >
        <Text className="text-white text-center font-semibold">
          {loading ? "Updating..." : "Update Password"}
        </Text>
      </TouchableOpacity>
      
      <View className="mt-6">
        <Text className={`text-base ${isDarkMode ? "text-white/70" : "text-gray-600"}`}>
          Password Requirements:
        </Text>
        <Text className={`mt-2 ${isDarkMode ? "text-white/60" : "text-gray-500"}`}>
          • At least 8 characters long
        </Text>
        <Text className={`${isDarkMode ? "text-white/60" : "text-gray-500"}`}>
          • Include at least one uppercase letter
        </Text>
        <Text className={`${isDarkMode ? "text-white/60" : "text-gray-500"}`}>
          • Include at least one number
        </Text>
        <Text className={`${isDarkMode ? "text-white/60" : "text-gray-500"}`}>
          • Include at least one special character
        </Text>
      </View>
    </SafeAreaView>
  );
}