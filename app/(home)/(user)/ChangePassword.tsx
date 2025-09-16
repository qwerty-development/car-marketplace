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
import { useTranslation } from "react-i18next";

export default function ChangePasswordScreen() {
  const { isDarkMode } = useTheme();
  const { updatePassword } = useAuth();
  const router = useRouter();
  const { t } = useTranslation();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      Alert.alert(t('common.error'), t('password.passwords_do_not_match'));
      return;
    }

    if (newPassword.length < 8) {
      Alert.alert(t('common.error'), t('password.min_length_error'));
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

      Alert.alert(t('common.success'), t('password.change_success'));
      router.back();
    } catch (error) {
      console.error("Error changing password:", error);
      Alert.alert(t('common.error'), t('password.change_failed'));
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
          {t('password.change_password')}
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
          placeholder={t('password.current_password')}
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
          placeholder={t('password.new_password')}
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
          placeholder={t('password.confirm_password')}
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
          {loading ? t('password.updating') : t('password.update_password')}
        </Text>
      </TouchableOpacity>
      
      <View className="mt-6">
        <Text className={`text-base ${isDarkMode ? "text-white/70" : "text-gray-600"}`}>
          {t('password.requirements_title')}:
        </Text>
        <Text className={`mt-2 ${isDarkMode ? "text-white/60" : "text-gray-500"}`}>
          • {t('password.min_length')}
        </Text>
        <Text className={`${isDarkMode ? "text-white/60" : "text-gray-500"}`}>
          • {t('password.uppercase_required')}
        </Text>
        <Text className={`${isDarkMode ? "text-white/60" : "text-gray-500"}`}>
          • {t('password.number_required')}
        </Text>
        <Text className={`${isDarkMode ? "text-white/60" : "text-gray-500"}`}>
          • {t('password.special_char_required')}
        </Text>
      </View>
    </SafeAreaView>
  );
}