import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  StyleSheet,
  Image,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { useAuth } from "@/utils/AuthContext";
import { useTheme } from "@/utils/ThemeContext";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { supabase } from "@/utils/supabase";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Linking from 'expo-linking';

export default function EditProfileScreen() {
  const { isDarkMode } = useTheme();
  const { user, profile, updateUserProfile, signOut } = useAuth();
  const router = useRouter();
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user && profile) {
      // Extract first and last name from full name in profile
      const nameParts = profile.name ? profile.name.split(" ") : ["", ""];
      setFirstName(nameParts[0] || "");
      setLastName(nameParts.slice(1).join(" ") || "");
      setEmail(profile.email || user.email || "");
    }
  }, [user, profile]);

  // Helper function to decode Base64
  const base64Decode = (base64String: string): Uint8Array => {
    const byteCharacters = atob(base64String);
    const byteNumbers = new Array(byteCharacters.length);

    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }

    return new Uint8Array(byteNumbers);
  };

  const updateProfile = async () => {
    try {
      setLoading(true);
      if (!user) throw new Error("No user found");

      // Create full name from first and last name
      const fullName = `${firstName} ${lastName}`.trim();

      // Update user profile in Supabase database
      const { error } = await updateUserProfile({
        name: fullName,
      });

      if (error) throw error;

      Alert.alert("Success", "Profile updated successfully");
      router.back();
    } catch (error) {
      console.error("Error updating profile:", error);
      Alert.alert("Error", "Failed to update profile");
    } finally {
      setLoading(false);
    }
  };

  const onPickImage = async () => {
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
          .from("avatars")
          .upload(fileName, base64Decode(base64), {
            contentType: mimeType,
            upsert: true,
          });

        if (uploadError) throw uploadError;

        // Get the public URL of the uploaded image
        const { data: urlData } = supabase.storage
          .from("avatars")
          .getPublicUrl(fileName);
        const avatarUrl = urlData?.publicUrl;

        // Update the user metadata with the new avatar URL
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

  // Handle account deletion process
  const handleDeleteAccount = () => {
    if (isDeletingAccount) return; // Prevent multiple calls
    
    Alert.alert(
      "Delete Account",
      "Are you sure you want to delete your account? This action cannot be undone.",
      [
        {
          text: "Cancel",
          style: "cancel"
        },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            Alert.alert(
              "Final Confirmation",
              "All your data will be permanently deleted. This action CANNOT be undone.",
              [
                {
                  text: "Cancel",
                  style: "cancel"
                },
                {
                  text: "Proceed to Deletion",
                  style: "destructive",
                  onPress: async () => {
                    try {
                      setIsDeletingAccount(true);
                      
                      // 1. Show a loading message
                      Alert.alert(
                        "Processing",
                        "Opening account deletion page. You will be signed out automatically."
                      );
                      
                      // 2. Open the web deletion page
                      await Linking.openURL('https://fleetapp.me/account/delete');
                      
                      // 3. Wait a moment to ensure the URL has opened
                      setTimeout(async () => {
                        try {
                          // 4. Sign out the user
                          await signOut();
                          console.log("User signed out after deletion page opened");
                        } catch (signOutError) {
                          console.error("Error signing out after deletion redirect:", signOutError);
                          // Still try to navigate to auth screen as fallback
                          router.replace('/(auth)/sign-in');
                        } finally {
                          setIsDeletingAccount(false);
                        }
                      }, 500); // 0.5 second delay
                    } catch (err) {
                      setIsDeletingAccount(false);
                      console.error('Error in account deletion process:', err);
                      Alert.alert(
                        "Error",
                        "There was a problem processing your account deletion request. Please try again later."
                      );
                    }
                  }
                }
              ]
            );
          }
        }
      ]
    );
  };

  return (
    <SafeAreaView 
      style={{ 
        flex: 1, 
        backgroundColor: isDarkMode ? "#000000" : "#FFFFFF",
      }}
    >
      <ScrollView 
        contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
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
            Edit Profile
          </Text>
        </View>

        <View className="space-y-4 mt-4">
          <Text className={`text-sm font-medium ${isDarkMode ? "text-white/80" : "text-gray-700"}`}>
            First Name
          </Text>
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
          
          <Text className={`text-sm font-medium ${isDarkMode ? "text-white/80" : "text-gray-700"}`}>
            Last Name
          </Text>
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
          
          <Text className={`text-sm font-medium ${isDarkMode ? "text-white/80" : "text-gray-700"}`}>
            Email
          </Text>
          <TextInput
            className={`${
              isDarkMode
                ? "bg-neutral-800 text-white/70"
                : "bg-neutral-100 text-black/70"
            } p-4 rounded-xl`}
            value={email}
            editable={false}
            placeholder="Email"
            placeholderTextColor={isDarkMode ? "#999" : "#666"}
          />
        </View>

        <TouchableOpacity
          className={`bg-red mt-8 p-4 rounded-xl ${loading ? "opacity-70" : ""}`}
          onPress={updateProfile}
          disabled={loading}
        >
          <Text className="text-white text-center font-semibold">
            {loading ? "Updating..." : "Update Profile"}
          </Text>
        </TouchableOpacity>

        {/* Account Deletion Section */}
        <View className="mt-12 pt-8 border-t border-gray-300 dark:border-gray-700">
          <Text className={`text-lg font-semibold mb-4 ${isDarkMode ? "text-white" : "text-black"}`}>
            Delete Account
          </Text>
          <Text className={`mb-4 ${isDarkMode ? "text-white/70" : "text-gray-600"}`}>
            Permanently delete your account and all associated data. This action cannot be undone.
          </Text>
          <TouchableOpacity
            className={`bg-rose-600 p-4 rounded-xl ${isDeletingAccount ? 'opacity-50' : ''}`}
            onPress={handleDeleteAccount}
            disabled={isDeletingAccount}
          >
            {isDeletingAccount ? (
              <View className="flex-row justify-center items-center">
                <ActivityIndicator size="small" color="#ffffff" />
                <Text className="text-white text-center font-semibold ml-2">
                  Processing...
                </Text>
              </View>
            ) : (
              <Text className="text-white text-center font-semibold">
                Delete Account
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}