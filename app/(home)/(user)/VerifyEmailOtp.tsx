import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { useTheme } from "@/utils/ThemeContext";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { useLanguage } from "@/utils/LanguageContext";
import { supabase } from "@/utils/supabase";

const OTP_LENGTH = 6;

export default function VerifyEmailOtpScreen() {
  const { isDarkMode } = useTheme();
  const router = useRouter();
  const { t } = useTranslation();
  const { language } = useLanguage();
  const isRTL = language === "ar";

  const params = useLocalSearchParams<{ 
    email: string; 
    isChange: string;
    isSecondStep?: string; // true if this is the second step of secure email change
  }>();
  const email = params.email || "";
  const isChange = params.isChange === "true";
  const isSecondStep = params.isSecondStep === "true";

  const [otp, setOtp] = useState<string[]>(Array(OTP_LENGTH).fill(""));
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  const inputRefs = useRef<(TextInput | null)[]>([]);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(
        () => setResendCooldown(resendCooldown - 1),
        1000
      );
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  const handleOtpChange = (value: string, index: number) => {
    // Handle paste of full OTP
    if (value.length > 1) {
      const pastedCode = value.slice(0, OTP_LENGTH).split("");
      const newOtp = [...otp];
      pastedCode.forEach((digit, i) => {
        if (i < OTP_LENGTH && /^\d$/.test(digit)) {
          newOtp[i] = digit;
        }
      });
      setOtp(newOtp);

      // Focus last filled input or last input
      const lastIndex = Math.min(pastedCode.length - 1, OTP_LENGTH - 1);
      inputRefs.current[lastIndex]?.focus();
      return;
    }

    // Only allow single digit
    if (value && !/^\d$/.test(value)) return;

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    // Auto-focus next input
    if (value && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all digits filled
    if (value && index === OTP_LENGTH - 1) {
      const fullOtp = newOtp.join("");
      if (fullOtp.length === OTP_LENGTH) {
        Keyboard.dismiss();
        handleVerify(fullOtp);
      }
    }
  };

  const handleKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === "Backspace" && !otp[index] && index > 0) {
      const newOtp = [...otp];
      newOtp[index - 1] = "";
      setOtp(newOtp);
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerify = async (otpCode?: string) => {
    const code = otpCode || otp.join("");

    if (code.length !== OTP_LENGTH) {
      Alert.alert(
        t("common.error"),
        t("email.enter_complete_code", { length: OTP_LENGTH })
      );
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email: email,
        token: code,
        type: "email_change",
      });

      if (error) {
        if (
          error.message.includes("expired") ||
          error.message.includes("Token has expired")
        ) {
          Alert.alert(t("email.code_expired_title"), t("email.code_expired"), [
            { text: t("common.ok"), onPress: () => clearOtpInputs() },
          ]);
        } else if (
          error.message.includes("invalid") ||
          error.message.includes("Invalid")
        ) {
          Alert.alert(t("email.invalid_code_title"), t("email.invalid_code"), [
            { text: t("common.ok"), onPress: () => clearOtpInputs() },
          ]);
        } else {
          Alert.alert(t("common.error"), error.message);
        }
        return;
      }

      // Success!
      const successMessage = isChange
        ? t("email.email_updated_success")
        : t("email.email_added_success");

      Alert.alert(t("common.success"), successMessage, [
        {
          text: t("common.ok"),
          onPress: () => {
            // Navigate back to profile
            router.dismissAll();
            router.replace("/(home)/(user)/(tabs)/profile");
          },
        },
      ]);
    } catch (err) {
      console.error("[VerifyEmailOtp] Error verifying OTP:", err);
      Alert.alert(t("common.error"), t("email.something_went_wrong"));
    } finally {
      setLoading(false);
    }
  };

  const clearOtpInputs = () => {
    setOtp(Array(OTP_LENGTH).fill(""));
    inputRefs.current[0]?.focus();
  };

  const handleResendCode = async () => {
    if (resendCooldown > 0) return;

    setResending(true);

    try {
      const { error } = await supabase.auth.updateUser({
        email: email,
      });

      if (error) {
        if (error.message.includes("rate limit")) {
          Alert.alert(t("email.please_wait"), t("email.rate_limit"));
        } else {
          Alert.alert(t("common.error"), error.message);
        }
        return;
      }

      Alert.alert(t("email.code_sent_title"), t("email.code_sent"));
      clearOtpInputs();
      setResendCooldown(60); // 60 second cooldown
    } catch (err) {
      console.error("[VerifyEmailOtp] Error resending code:", err);
      Alert.alert(t("common.error"), t("email.resend_failed"));
    } finally {
      setResending(false);
    }
  };

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
              {isSecondStep ? t("email.verify_new_email") : t("email.verify_email")}
            </Text>
          </View>

          {/* Step indicator (only shown for second step of secure email change) */}
          {isSecondStep && (
            <View className="flex-row items-center justify-center mb-6">
              <View className="flex-row items-center">
                <View className={`w-8 h-8 rounded-full ${isDarkMode ? "bg-green-600" : "bg-green-500"} items-center justify-center`}>
                  <Ionicons name="checkmark" size={18} color="#fff" />
                </View>
                <View className="h-1 w-8 bg-red" />
                <View className="w-8 h-8 rounded-full bg-red items-center justify-center">
                  <Text className="text-white font-bold">2</Text>
                </View>
              </View>
            </View>
          )}

          {/* Instructions */}
          <Text
            className={`text-base ${
              isDarkMode ? "text-white/70" : "text-gray-600"
            }`}
            style={{ textAlign: isRTL ? "right" : "left" }}
          >
            {t("email.enter_code_sent_to")}
          </Text>
          <Text
            className={`text-base font-semibold mb-8 ${
              isDarkMode ? "text-white" : "text-gray-800"
            }`}
            style={{ textAlign: isRTL ? "right" : "left" }}
          >
            {email}
          </Text>

          {/* OTP Input Boxes */}
          <View
            className={`${isRTL ? "flex-row-reverse" : "flex-row"} justify-between mb-8`}
          >
            {otp.map((digit, index) => (
              <TextInput
                key={index}
                ref={(ref) => (inputRefs.current[index] = ref)}
                className={`w-12 h-14 border-2 rounded-xl text-center text-2xl font-semibold ${
                  digit
                    ? "border-red bg-red/5"
                    : isDarkMode
                      ? "border-neutral-700 bg-neutral-800"
                      : "border-gray-300 bg-white"
                } ${isDarkMode ? "text-white" : "text-black"}`}
                value={digit}
                onChangeText={(value) => handleOtpChange(value, index)}
                onKeyPress={(e) => handleKeyPress(e, index)}
                keyboardType="number-pad"
                maxLength={1}
                selectTextOnFocus
                editable={!loading}
                autoFocus={index === 0}
                cursorColor="#D55004"
              />
            ))}
          </View>

          {/* Verify Button */}
          <TouchableOpacity
            className={`bg-red p-4 rounded-xl ${
              loading || otp.join("").length !== OTP_LENGTH ? "opacity-50" : ""
            }`}
            onPress={() => handleVerify()}
            disabled={loading || otp.join("").length !== OTP_LENGTH}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-white text-center font-semibold">
                {t("email.verify_email")}
              </Text>
            )}
          </TouchableOpacity>

          {/* Resend Section */}
          <View className="flex-row justify-center items-center mt-6">
            <Text
              className={`text-sm ${
                isDarkMode ? "text-white/60" : "text-gray-500"
              }`}
            >
              {t("email.didnt_receive_code")}{" "}
            </Text>
            <TouchableOpacity
              onPress={handleResendCode}
              disabled={resending || loading || resendCooldown > 0}
            >
              {resending ? (
                <ActivityIndicator color="#D55004" size="small" />
              ) : resendCooldown > 0 ? (
                <Text className="text-sm text-gray-400">
                  {t("email.resend_in", { seconds: resendCooldown })}
                </Text>
              ) : (
                <Text className="text-sm text-red font-semibold">
                  {t("email.resend_code")}
                </Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Help Text */}
          <Text
            className={`mt-6 text-sm text-center ${
              isDarkMode ? "text-white/50" : "text-gray-400"
            }`}
          >
            {t("email.check_spam")}
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
