import React, { useState, useEffect, useCallback, useRef } from "react";
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
  BackHandler,
} from "react-native";
import { useAuth } from "@/utils/AuthContext";
import { useTheme } from "@/utils/ThemeContext";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from 'react-i18next';
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { supabase } from "@/utils/supabase";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Linking from 'expo-linking';
import { useFocusEffect } from '@react-navigation/native';

/**
 * CRITICAL SYSTEM: EditProfile Component with Complete State Synchronization
 * 
 * TECHNICAL SPECIFICATIONS:
 * - Implements comprehensive error handling with database verification
 * - Uses enhanced updateUserProfile function with proper state management
 * - Includes automatic state refresh mechanisms
 * - Provides real-time validation and feedback
 * - Handles navigation with state synchronization triggers
 */

export default function EditProfileScreen() {
  const { isDarkMode } = useTheme();
  const { t } = useTranslation();
  const {
    user,
    profile,
    updateUserProfile,
    signOut,
    forceProfileRefresh // CRITICAL: Add this if implemented in AuthContext
  } = useAuth();
  const router = useRouter();

  // CRITICAL SYSTEM: Enhanced state management with tracking
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // CRITICAL SYSTEM: State tracking and validation
  const [initialData, setInitialData] = useState({ firstName: "", lastName: "", email: "" });
  const [validationErrors, setValidationErrors] = useState({ firstName: "", lastName: "" });
  const profileSyncRef = useRef<string>("");
  const updateInProgressRef = useRef(false);

  // CRITICAL SYSTEM: Enhanced profile data synchronization
  const syncProfileData = useCallback(() => {
    if (user && profile) {
      const profileSignature = `${profile.name}-${profile.email}-${profile.last_active}`;
      
      // Only sync if profile data has actually changed
      if (profileSyncRef.current !== profileSignature) {
        console.log('[EditProfile] Syncing profile data - signature changed');
        console.log('[EditProfile] Profile data:', { name: profile.name, email: profile.email });
        
        const nameParts = profile.name ? profile.name.split(" ") : ["", ""];
        const newFirstName = nameParts[0] || "";
        const newLastName = nameParts.slice(1).join(" ") || "";
        const newEmail = profile.email || user.email || "";

        setFirstName(newFirstName);
        setLastName(newLastName);
        setEmail(newEmail);
        
        // Update initial data for change tracking
        setInitialData({
          firstName: newFirstName,
          lastName: newLastName,
          email: newEmail
        });
        
        profileSyncRef.current = profileSignature;
        console.log('[EditProfile] Profile data synchronized successfully');
      }
    }
  }, [user, profile]);

  // CRITICAL SYSTEM: Multiple synchronization triggers
  
  // Trigger 1: Focus-based synchronization
  useFocusEffect(
    useCallback(() => {
      console.log('[EditProfile] Screen focused - syncing profile data');
      syncProfileData();
    }, [syncProfileData])
  );

  // Trigger 2: Initial load and profile changes
  useEffect(() => {
    syncProfileData();
  }, [syncProfileData]);

  // Trigger 3: Direct profile property monitoring
  useEffect(() => {
    if (profile?.name || profile?.email) {
      console.log('[EditProfile] Profile properties changed, re-syncing');
      syncProfileData();
    }
  }, [profile?.name, profile?.email, profile?.last_active, syncProfileData]);

  // CRITICAL SYSTEM: Change tracking for unsaved changes warning
  useEffect(() => {
    const hasChanges = 
      firstName !== initialData.firstName || 
      lastName !== initialData.lastName;
    
    setHasUnsavedChanges(hasChanges);
  }, [firstName, lastName, initialData]);

  // CRITICAL SYSTEM: Form validation
  const validateForm = useCallback(() => {
    const errors = { firstName: "", lastName: "" };
    let isValid = true;

    if (!firstName.trim()) {
      errors.firstName = t('errors.required_field');
      isValid = false;
    } else if (firstName.trim().length < 2) {
      errors.firstName = t('profile.first_name') + ' must be at least 2 characters';
      isValid = false;
    }

    if (!lastName.trim()) {
      errors.lastName = t('errors.required_field');
      isValid = false;
    } else if (lastName.trim().length < 2) {
      errors.lastName = t('profile.last_name') + ' must be at least 2 characters';
      isValid = false;
    }

    setValidationErrors(errors);
    return isValid;
  }, [firstName, lastName, t]);

  // CRITICAL SYSTEM: Enhanced database verification function
  const verifyDatabaseUpdate = useCallback(async (expectedName: string): Promise<boolean> => {
    try {
      console.log('[EditProfile] Verifying database update...');
      
      const { data, error } = await supabase
        .from('users')
        .select('name, email')
        .eq('id', user?.id)
        .single();

      if (error) {
        console.error('[EditProfile] Database verification failed:', error);
        return false;
      }

      if (data?.name === expectedName) {
        console.log('[EditProfile] Database verification successful');
        return true;
      } else {
        console.warn('[EditProfile] Database verification failed - name mismatch');
        console.warn('Expected:', expectedName, 'Found:', data?.name);
        return false;
      }
    } catch (error) {
      console.error('[EditProfile] Database verification error:', error);
      return false;
    }
  }, [user?.id]);

  // CRITICAL SYSTEM: Enhanced profile update with comprehensive error handling
  const updateProfile = async () => {
    if (updateInProgressRef.current) {
      console.log('[EditProfile] Update already in progress, ignoring');
      return;
    }

    try {
      updateInProgressRef.current = true;
      setLoading(true);
      
      if (!user) {
        throw new Error("No user found");
      }

      // STEP 1: Validate form data
      if (!validateForm()) {
        console.log('[EditProfile] Form validation failed');
        Alert.alert(t('errors.validation_error'), "Please correct the errors and try again.");
        return;
      }

      // STEP 2: Check if there are actual changes
      const trimmedFirstName = firstName.trim();
      const trimmedLastName = lastName.trim();
      const fullName = `${trimmedFirstName} ${trimmedLastName}`;

      if (fullName === profile?.name) {
        console.log('[EditProfile] No changes detected');
        Alert.alert("No Changes", "No changes were made to your profile.");
        return;
      }

      console.log('[EditProfile] Starting profile update process');
      console.log('[EditProfile] Current profile name:', profile?.name);
      console.log('[EditProfile] New name:', fullName);

      // STEP 3: Execute update via AuthContext
      const { error } = await updateUserProfile({
        name: fullName,
      });

      if (error) {
        console.error('[EditProfile] AuthContext update failed:', error);
        throw error;
      }

      console.log('[EditProfile] AuthContext update completed');

      // STEP 4: Verify database update (with retry mechanism)
      let verificationAttempts = 0;
      const maxAttempts = 3;
      let isVerified = false;

      while (verificationAttempts < maxAttempts && !isVerified) {
        verificationAttempts++;
        console.log(`[EditProfile] Database verification attempt ${verificationAttempts}/${maxAttempts}`);
        
        // Wait a bit before verification to allow database propagation
        await new Promise(resolve => setTimeout(resolve, 500 * verificationAttempts));
        
        isVerified = await verifyDatabaseUpdate(fullName);
        
        if (!isVerified && verificationAttempts < maxAttempts) {
          console.log(`[EditProfile] Verification failed, retrying in ${500 * (verificationAttempts + 1)}ms`);
        }
      }

      // STEP 5: Handle verification results
      if (isVerified) {
        console.log('[EditProfile] Profile update verified successfully');
        
        // Force profile refresh if available
        if (forceProfileRefresh) {
          console.log('[EditProfile] Triggering force profile refresh');
          await forceProfileRefresh();
        }

        // Update initial data to reflect successful change
        setInitialData({
          firstName: trimmedFirstName,
          lastName: trimmedLastName,
          email: email
        });

        // Success feedback and navigation
        Alert.alert(
          t('common.success'),
          t('success.profile_updated'),
          [
            {
              text: t('common.ok'),
              onPress: () => {
                console.log('[EditProfile] Navigating back with delay');
                // Small delay to ensure all state updates are processed
                setTimeout(() => {
                  router.back();
                }, 150);
              }
            }
          ]
        );
      } else {
        console.warn('[EditProfile] Database verification failed after all attempts');
        Alert.alert(
          "Partial Success",
          "Profile may have been updated, but we couldn't verify the changes. Please check your profile and try again if needed."
        );
      }

    } catch (error: any) {
      console.error('[EditProfile] Profile update error:', error);
      
      // Detailed error handling
      let errorMessage = "Failed to update profile. Please try again.";
      
      if (error.message?.includes('timeout')) {
        errorMessage = "The update is taking longer than expected. Please check your connection and try again.";
      } else if (error.message?.includes('network')) {
        errorMessage = "Network error. Please check your internet connection and try again.";
      } else if (error.message?.includes('duplicate') || error.message?.includes('unique')) {
        errorMessage = "This name is already in use. Please choose a different name.";
      }
      
      Alert.alert(t('errors.profile_update_failed'), errorMessage);
      
      // Revert to last known good state if needed
      syncProfileData();
      
    } finally {
      setLoading(false);
      updateInProgressRef.current = false;
    }
  };

  // CRITICAL SYSTEM: Enhanced navigation handling with unsaved changes warning
  const handleBackPress = useCallback(() => {
    if (hasUnsavedChanges) {
      Alert.alert(
        "Unsaved Changes",
        "You have unsaved changes. Are you sure you want to go back?",
        [
          { text: "Stay", style: "cancel" },
          { 
            text: "Discard Changes", 
            style: "destructive",
            onPress: () => {
              syncProfileData(); // Reset to original data
              router.back();
            }
          }
        ]
      );
      return true; // Prevent default back action
    } else {
      router.back();
      return true;
    }
  }, [hasUnsavedChanges, router, syncProfileData]);

  // CRITICAL SYSTEM: Hardware back button handling for Android
  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        return handleBackPress();
      };

      const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => subscription.remove();
    }, [handleBackPress])
  );

  // Helper function to decode Base64
  const base64Decode = (base64String: string): Uint8Array => {
    const byteCharacters = atob(base64String);
    const byteNumbers = new Array(byteCharacters.length);

    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }

    return new Uint8Array(byteNumbers);
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

  // CRITICAL SYSTEM: Enhanced account deletion with proper state management
  const handleDeleteAccount = () => {
    if (isDeletingAccount) return;
    
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
                      
                      Alert.alert(
                        "Processing",
                        "Opening account deletion page. You will be signed out automatically."
                      );
                      
                      await Linking.openURL('https://fleetapp.me/account/delete');
                      
                      setTimeout(async () => {
                        try {
                          await signOut();
                          console.log("User signed out after deletion page opened");
                        } catch (signOutError) {
                          console.error("Error signing out after deletion redirect:", signOutError);
                          router.replace('/(auth)/sign-in');
                        } finally {
                          setIsDeletingAccount(false);
                        }
                      }, 500);
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
        keyboardShouldPersistTaps="handled"
      >
        {/* CRITICAL SYSTEM: Enhanced header with unsaved changes indicator */}
        <View className="flex-row items-center mb-6">
          <TouchableOpacity onPress={handleBackPress} className="mr-4">
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
{t('profile.edit_profile')}
          </Text>
          {hasUnsavedChanges && (
            <View className="ml-2 w-2 h-2 bg-red rounded-full" />
          )}
        </View>

        {/* CRITICAL SYSTEM: Enhanced form with validation feedback */}
        <View className="space-y-4 mt-4">
          <Text className={`text-sm font-medium ${isDarkMode ? "text-white/80" : "text-gray-700"}`}>
            {t('profile.first_name')} *
          </Text>
          <TextInput
            className={`${
              isDarkMode
                ? "bg-neutral-800 text-white"
                : "bg-neutral-100 text-black"
            } p-4 rounded-xl ${
              validationErrors.firstName ? 'border-2 border-red' : ''
            }`}
            value={firstName}
            onChangeText={(text) => {
              setFirstName(text);
              if (validationErrors.firstName) {
                setValidationErrors(prev => ({ ...prev, firstName: "" }));
              }
            }}
            placeholder={t('profile.first_name')}
            placeholderTextColor={isDarkMode ? "#999" : "#666"}
            cursorColor="#D55004"
            editable={!loading}
            maxLength={50}
          />
          {validationErrors.firstName ? (
            <Text className="text-red text-xs mt-1">{validationErrors.firstName}</Text>
          ) : null}
          
          <Text className={`text-sm font-medium ${isDarkMode ? "text-white/80" : "text-gray-700"}`}>
            {t('profile.last_name')} *
          </Text>
          <TextInput
            className={`${
              isDarkMode
                ? "bg-neutral-800 text-white"
                : "bg-neutral-100 text-black"
            } p-4 rounded-xl ${
              validationErrors.lastName ? 'border-2 border-red' : ''
            }`}
            value={lastName}
            onChangeText={(text) => {
              setLastName(text);
              if (validationErrors.lastName) {
                setValidationErrors(prev => ({ ...prev, lastName: "" }));
              }
            }}
            placeholder={t('profile.last_name')}
            placeholderTextColor={isDarkMode ? "#999" : "#666"}
            cursorColor="#D55004"
            editable={!loading}
            maxLength={50}
          />
          {validationErrors.lastName ? (
            <Text className="text-red text-xs mt-1">{validationErrors.lastName}</Text>
          ) : null}
          
          {/* Email Address with Change Button */}
          <Text className={`text-sm font-medium ${isDarkMode ? "text-white/80" : "text-gray-700"}`}>
            {t('profile.email')}
          </Text>
          <View className="flex-row items-center gap-2">
            <TextInput
              className={`${
                isDarkMode
                  ? "bg-neutral-800 text-white/70"
                  : "bg-neutral-100 text-black/70"
              } p-4 rounded-xl flex-1`}
              value={email || t('email.not_added')}
              editable={false}
              placeholder={t('profile.email')}
              placeholderTextColor={isDarkMode ? "#999" : "#666"}
            />
            <TouchableOpacity
              className="bg-red p-4 rounded-xl"
              onPress={() => router.push("/(home)/(user)/ChangeEmail")}
              disabled={loading}
            >
              <Ionicons name="create-outline" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
          <Text className={`text-xs ${isDarkMode ? "text-white/50" : "text-gray-500"}`}>
            {t('email.tap_to_change_email')}
          </Text>
        </View>

        {/* CRITICAL SYSTEM: Enhanced update button with loading state and validation */}
        <TouchableOpacity
          className={`mt-8 p-4 rounded-xl ${
            loading || !hasUnsavedChanges
              ? "bg-neutral-500 opacity-70" 
              : "bg-red"
          }`}
          onPress={updateProfile}
          disabled={loading || !hasUnsavedChanges}
        >
          {loading ? (
            <View className="flex-row justify-center items-center">
              <ActivityIndicator size="small" color="#ffffff" />
              <Text className="text-white text-center font-semibold ml-2">
                Updating Profile...
              </Text>
            </View>
          ) : (
            <Text className="text-white text-center font-semibold">
              {hasUnsavedChanges ? t('profile.update_profile') : "No Changes to Save"}
            </Text>
          )}
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
            disabled={isDeletingAccount || loading}
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