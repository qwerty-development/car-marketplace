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

export default function VerifyPhoneOtpScreen() {
  const { isDarkMode } = useTheme();
  const router = useRouter();
  const { t } = useTranslation();
  const { language } = useLanguage();
  const isRTL = language === "ar";

  const params = useLocalSearchParams<{ 
    phone: string;
    fromCompleteProfile?: string; // true if coming from complete-profile flow
  }>();
  const phone = params.phone || "";
  const fromCompleteProfile = params.fromCompleteProfile === "true";

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
        t("phone.enter_complete_code", { length: OTP_LENGTH })
      );
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.auth.verifyOtp({
        phone: phone,
        token: code,
        type: "sms", // For phone verification, use 'sms' type
      });

      if (error) {
        if (
          error.message.includes("expired") ||
          error.message.includes("Token has expired")
        ) {
          Alert.alert(t("phone.code_expired_title"), t("phone.code_expired"), [
            { text: t("common.ok"), onPress: () => clearOtpInputs() },
          ]);
        } else if (
          error.message.includes("invalid") ||
          error.message.includes("Invalid")
        ) {
          Alert.alert(t("phone.invalid_code_title"), t("phone.invalid_code"), [
            { text: t("common.ok"), onPress: () => clearOtpInputs() },
          ]);
        } else {
          Alert.alert(t("common.error"), error.message);
        }
        return;
      }

      // NOTE: phone_number in public.users is synced automatically via database trigger
      // when auth.users.phone is updated through verifyOtp - no manual update needed

      // Success!
      Alert.alert(t("common.success"), t("phone.phone_added_success"), [
        {
          text: t("common.ok"),
          onPress: () => {
            if (fromCompleteProfile) {
              // Coming from complete-profile, go back to let the routing logic take over
              router.back();
            } else {
              // Normal flow, go to profile
              router.dismissAll();
              router.replace("/(home)/(user)/(tabs)/profile");
            }
          },
        },
      ]);
    } catch (err) {
      console.error("[VerifyPhoneOtp] Error verifying OTP:", err);
      Alert.alert(t("common.error"), t("phone.something_went_wrong"));
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
        phone: phone,
      });

      if (error) {
        if (error.message.includes("rate limit")) {
          Alert.alert(t("phone.please_wait"), t("phone.rate_limit"));
        } else {
          Alert.alert(t("common.error"), error.message);
        }
        return;
      }

      Alert.alert(t("phone.code_sent_title"), t("phone.code_sent"));
      clearOtpInputs();
      setResendCooldown(60); // 60 second cooldown
    } catch (err) {
      console.error("[VerifyPhoneOtp] Error resending code:", err);
      Alert.alert(t("common.error"), t("phone.resend_failed"));
    } finally {
      setResending(false);
    }
  };

  return (
    <SafeAreaView
      className={`flex-1 ${isDarkMode ? "bg-black" : "bg-white"}`}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View className="flex-row items-center justify-between px-6 pt-4 pb-2">
            <TouchableOpacity
              onPress={() => router.back()}
              className="p-2 -ml-2"
              disabled={loading}
            >
              <Ionicons
                name={isRTL ? "arrow-forward" : "arrow-back"}
                size={24}
                color={isDarkMode ? "#fff" : "#000"}
              />
            </TouchableOpacity>
          </View>

          {/* Content */}
          <View className="flex-1 px-6 pt-8">
            <Text
              className={`text-3xl font-bold mb-3 ${
                isDarkMode ? "text-white" : "text-black"
              }`}
            >
              {t("phone.verify_phone")}
            </Text>

            <Text
              className={`text-base mb-8 ${
                isDarkMode ? "text-white/60" : "text-black/60"
              }`}
            >
              {t("phone.enter_code_sent_to")} {phone}
            </Text>

            {/* OTP Input */}
            <View
              className={`flex-row justify-center gap-2 mb-8 ${
                isRTL ? "flex-row-reverse" : ""
              }`}
            >
              {otp.map((digit, index) => (
                <TextInput
                  key={index}
                  ref={(ref) => {
                    inputRefs.current[index] = ref;
                  }}
                  className={`w-12 h-14 text-center text-xl font-bold rounded-xl ${
                    isDarkMode
                      ? "bg-neutral-800 text-white border-neutral-700"
                      : "bg-neutral-100 text-black border-neutral-200"
                  } ${digit ? "border-2 border-red" : "border"}`}
                  maxLength={OTP_LENGTH}
                  keyboardType="number-pad"
                  value={digit}
                  onChangeText={(value) => handleOtpChange(value, index)}
                  onKeyPress={(e) => handleKeyPress(e, index)}
                  selectTextOnFocus
                  editable={!loading}
                />
              ))}
            </View>

            {/* Verify Button */}
            <TouchableOpacity
              className={`bg-red py-4 rounded-xl mb-6 ${
                loading ? "opacity-70" : ""
              }`}
              onPress={() => handleVerify()}
              disabled={loading || otp.join("").length !== OTP_LENGTH}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text className="text-white text-center font-semibold text-base">
                  {t("common.verify")}
                </Text>
              )}
            </TouchableOpacity>

            {/* Resend Code */}
            <View className="items-center">
              <Text
                className={`text-sm mb-2 ${
                  isDarkMode ? "text-white/60" : "text-black/60"
                }`}
              >
                {t("phone.didnt_receive_code")}
              </Text>
              {resendCooldown > 0 ? (
                <Text
                  className={`text-sm ${
                    isDarkMode ? "text-white/60" : "text-black/60"
                  }`}
                >
                  {t("phone.resend_in", { seconds: resendCooldown })}
                </Text>
              ) : (
                <TouchableOpacity
                  onPress={handleResendCode}
                  disabled={resending}
                >
                  <Text className="text-red font-semibold text-base">
                    {resending
                      ? t("phone.please_wait")
                      : t("phone.resend_code")}
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Help Text */}
            <Text
              className={`text-xs text-center mt-4 ${
                isDarkMode ? "text-white/40" : "text-black/40"
              }`}
            >
              {t("phone.check_sms")}
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
