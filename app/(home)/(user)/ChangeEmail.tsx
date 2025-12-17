import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { useAuth } from "@/utils/AuthContext";
import { useTheme } from "@/utils/ThemeContext";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { useLanguage } from "@/utils/LanguageContext";
import { supabase } from "@/utils/supabase";

export default function ChangeEmailScreen() {
  const { isDarkMode } = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const { t } = useTranslation();
  const { language } = useLanguage();
  const isRTL = language === "ar";

  const [currentEmail, setCurrentEmail] = useState<string | null>(null);
  const [newEmail, setNewEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [fetchingUser, setFetchingUser] = useState(true);

  useEffect(() => {
    fetchCurrentUser();
  }, []);

  const fetchCurrentUser = async () => {
    try {
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();
      setCurrentEmail(authUser?.email || null);
    } catch (err) {
      console.error("[ChangeEmail] Error fetching user:", err);
    } finally {
      setFetchingUser(false);
    }
  };

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleSubmitEmail = async () => {
    const trimmedEmail = newEmail.trim().toLowerCase();

    // Validation
    if (!trimmedEmail) {
      Alert.alert(t("common.error"), t("email.please_enter_email"));
      return;
    }

    if (!validateEmail(trimmedEmail)) {
      Alert.alert(t("common.error"), t("email.invalid_email"));
      return;
    }

    if (trimmedEmail === currentEmail?.toLowerCase()) {
      Alert.alert(t("common.error"), t("email.same_email_error"));
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.auth.updateUser({
        email: trimmedEmail,
      });

      if (error) {
        if (
          error.message.includes("already registered") ||
          error.message.includes("already been registered")
        ) {
          Alert.alert(t("common.error"), t("email.already_in_use"));
        } else if (error.message.includes("rate limit")) {
          Alert.alert(t("common.error"), t("email.rate_limit"));
        } else {
          Alert.alert(t("common.error"), error.message);
        }
        return;
      }

      // Success - navigate to appropriate verification screen
      // With "Secure email change" enabled, we need to verify BOTH emails:
      // 1. First verify the CURRENT email (proves ownership of account)
      // 2. Then verify the NEW email (proves access to new address)
      if (currentEmail) {
        // Changing existing email - need to verify current email first
        router.push({
          pathname: "/(home)/(user)/VerifyCurrentEmailOtp",
          params: {
            currentEmail: currentEmail,
            newEmail: trimmedEmail,
          },
        });
      } else {
        // Adding email (no current email) - just verify the new email
        router.push({
          pathname: "/(home)/(user)/VerifyEmailOtp",
          params: {
            email: trimmedEmail,
            isChange: "false",
          },
        });
      }
    } catch (err) {
      console.error("[ChangeEmail] Error updating email:", err);
      Alert.alert(t("common.error"), t("email.something_went_wrong"));
    } finally {
      setLoading(false);
    }
  };

  if (fetchingUser) {
    return (
      <SafeAreaView
        style={{
          flex: 1,
          backgroundColor: isDarkMode ? "#000000" : "#FFFFFF",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <ActivityIndicator size="large" color="#D55004" />
      </SafeAreaView>
    );
  }

  const isAddingEmail = !currentEmail;
  const title = isAddingEmail
    ? t("email.add_email_address")
    : t("email.change_email_address");
  const subtitle = isAddingEmail
    ? t("email.add_email_subtitle")
    : t("email.change_email_subtitle");

  return (
    <SafeAreaView
      style={{
        flex: 1,
        backgroundColor: isDarkMode ? "#000000" : "#FFFFFF",
      }}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, padding: 20 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View
            className={`${isRTL ? "flex-row-reverse" : "flex-row"} items-center mb-6`}
          >
            <TouchableOpacity onPress={() => router.back()} className="mr-4">
              <Ionicons
                name={isRTL ? "arrow-forward" : "arrow-back"}
                size={24}
                color={isDarkMode ? "#fff" : "#000"}
              />
            </TouchableOpacity>
            <Text
              className={`text-xl font-semibold ${
                isDarkMode ? "text-white" : "text-black"
              }`}
            >
              {title}
            </Text>
          </View>

          {/* Subtitle */}
          <Text
            className={`text-base mb-6 ${
              isDarkMode ? "text-white/70" : "text-gray-600"
            }`}
            style={{ textAlign: isRTL ? "right" : "left" }}
          >
            {subtitle}
          </Text>

          {/* Current Email Display */}
          {currentEmail && (
            <View
              className={`${
                isDarkMode ? "bg-neutral-800" : "bg-neutral-100"
              } p-4 rounded-xl mb-6`}
            >
              <Text
                className={`text-xs uppercase tracking-wide mb-1 ${
                  isDarkMode ? "text-white/60" : "text-gray-500"
                }`}
                style={{ textAlign: isRTL ? "right" : "left" }}
              >
                {t("email.current_email")}
              </Text>
              <Text
                className={`text-base font-medium ${
                  isDarkMode ? "text-white" : "text-gray-800"
                }`}
                style={{ textAlign: isRTL ? "right" : "left" }}
              >
                {currentEmail}
              </Text>
            </View>
          )}

          {/* New Email Input */}
          <Text
            className={`text-sm font-semibold mb-2 ${
              isDarkMode ? "text-white" : "text-gray-800"
            }`}
            style={{ textAlign: isRTL ? "right" : "left" }}
          >
            {isAddingEmail
              ? t("email.email_address")
              : t("email.new_email_address")}
          </Text>
          <TextInput
            className={`${
              isDarkMode
                ? "bg-neutral-800 text-white"
                : "bg-neutral-100 text-black"
            } p-4 rounded-xl mb-6`}
            placeholder={t("email.enter_email_placeholder")}
            placeholderTextColor={isDarkMode ? "#999" : "#666"}
            value={newEmail}
            onChangeText={setNewEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            editable={!loading}
            cursorColor="#D55004"
            style={{ textAlign: isRTL ? "right" : "left" }}
          />

          {/* Submit Button */}
          <TouchableOpacity
            className={`bg-red p-4 rounded-xl ${loading ? "opacity-70" : ""}`}
            onPress={handleSubmitEmail}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-white text-center font-semibold">
                {t("email.send_verification_code")}
              </Text>
            )}
          </TouchableOpacity>

          {/* Info Text */}
          <Text
            className={`mt-4 text-sm text-center ${
              isDarkMode ? "text-white/60" : "text-gray-500"
            }`}
          >
            {t("email.verification_info")}
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
