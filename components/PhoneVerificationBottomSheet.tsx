import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/utils/ThemeContext';
import { supabase } from '@/utils/supabase';
import CustomPhoneInput, { getCallingCode, ICountry } from '@/components/PhoneInput';

const OTP_LENGTH = 6;

interface PhoneVerificationBottomSheetProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

type Step = 'phone' | 'otp';

const RESEND_SECONDS = 60;

export default function PhoneVerificationBottomSheet({
  visible,
  onClose,
  onSuccess,
}: PhoneVerificationBottomSheetProps) {
  const { isDarkMode } = useTheme();

  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('');
  const [selectedCountry, setSelectedCountry] = useState<ICountry | null>(null);
  const [verifyingPhone, setVerifyingPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [phoneError, setPhoneError] = useState('');
  const [otpError, setOtpError] = useState('');
  const [resendTimer, setResendTimer] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const otpInputRef = useRef<TextInput | null>(null);

  // Reset state when sheet opens — intentionally do NOT reset selectedCountry
  // so the library's defaultCountry="LB" initialization is not overwritten
  useEffect(() => {
    if (visible) {
      setStep('phone');
      setPhone('');
      setVerifyingPhone('');
      setOtp('');
      setPhoneError('');
      setOtpError('');
      setResendTimer(0);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [visible]);

  const startResendTimer = useCallback(() => {
    setResendTimer(RESEND_SECONDS);
    timerRef.current = setInterval(() => {
      setResendTimer(prev => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  const buildFullPhone = useCallback((): string | null => {
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length < 6) {
      setPhoneError('Please enter a valid phone number');
      return null;
    }
    // Fall back to Lebanon (+961) when the library hasn't fired onChangeSelectedCountry yet
    const callingCode = selectedCountry
      ? getCallingCode(selectedCountry).replace(/\D/g, '')
      : '961';
    // The PhoneInput component returns local numbers only (no prefix),
    // so we concatenate directly — no prefix stripping needed
    return `+${callingCode}${cleaned}`;
  }, [phone, selectedCountry]);

  const handleSendCode = useCallback(async () => {
    setPhoneError('');
    const fullPhone = buildFullPhone();
    if (!fullPhone) return;

    setIsLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ phone: fullPhone });
      if (error) {
        if (
          error.message.includes('already registered') ||
          error.message.includes('already been registered')
        ) {
          throw new Error('This phone number is already in use by another account.');
        } else if (error.message.includes('rate limit')) {
          throw new Error('Too many requests. Please wait a moment and try again.');
        } else {
          throw error;
        }
      }
      setVerifyingPhone(fullPhone);
      setOtp('');
      setOtpError('');
      setStep('otp');
      startResendTimer();
      // Manually focus after Modal has settled — autoFocus is unreliable inside Modals on Android
      setTimeout(() => otpInputRef.current?.focus(), 300);
    } catch (err: any) {
      setPhoneError(err.message || 'Failed to send verification code. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [buildFullPhone, startResendTimer]);

  const handleVerifyOtp = useCallback(async () => {
    setOtpError('');
    if (!otp || otp.length < OTP_LENGTH) {
      setOtpError('Please enter the 6-digit code sent to your phone.');
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        phone: verifyingPhone,
        token: otp,
        type: 'phone_change',
      });
      if (error) throw error;
      onSuccess();
      onClose();
    } catch (err: any) {
      setOtpError(err.message || 'Invalid code. Please try again.');
      setOtp('');
      setTimeout(() => otpInputRef.current?.focus(), 100);
    } finally {
      setIsLoading(false);
    }
  }, [otp, verifyingPhone, onSuccess, onClose]);

  const handleResend = useCallback(async () => {
    if (resendTimer > 0) return;
    setOtp('');
    setOtpError('');
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ phone: verifyingPhone });
      if (error) throw error;
      startResendTimer();
      setTimeout(() => otpInputRef.current?.focus(), 100);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to resend code. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [resendTimer, verifyingPhone, startResendTimer]);

  const bg = isDarkMode ? '#1C1C1E' : '#FFFFFF';
  const textPrimary = isDarkMode ? '#FFFFFF' : '#111827';
  const textSecondary = isDarkMode ? '#9CA3AF' : '#6B7280';
  const inputBg = isDarkMode ? '#2C2C2E' : '#F3F4F6';
  const borderColor = isDarkMode ? '#374151' : '#E5E7EB';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Backdrop — tapping outside dismisses */}
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }} />
        </TouchableWithoutFeedback>

        {/* Sheet */}
        <ScrollView
          keyboardShouldPersistTaps="handled"
          scrollEnabled={false}
          style={{
            backgroundColor: bg,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            flexGrow: 0,
          }}
          contentContainerStyle={{ padding: 24, paddingBottom: 40 }}
        >
                {/* Handle bar */}
                <View style={{
                  width: 40,
                  height: 4,
                  backgroundColor: borderColor,
                  borderRadius: 2,
                  alignSelf: 'center',
                  marginBottom: 20,
                }} />

                {/* Header */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <Text style={{ fontSize: 20, fontWeight: '700', color: textPrimary }}>
                    {step === 'phone' ? 'Add Phone Number' : 'Enter Verification Code'}
                  </Text>
                  <TouchableOpacity onPress={onClose} disabled={isLoading}>
                    <Ionicons name="close" size={24} color={textSecondary} />
                  </TouchableOpacity>
                </View>

                <Text style={{ fontSize: 14, color: textSecondary, marginBottom: 24 }}>
                  {step === 'phone'
                    ? 'A verified phone number is required to post car listings.'
                    : `We sent a 6-digit code to ${verifyingPhone}`}
                </Text>

                {step === 'phone' ? (
                  <>
                    <CustomPhoneInput
                      label="Phone Number"
                      value={phone}
                      onChangePhoneNumber={(text) => {
                        setPhone(text);
                        setPhoneError('');
                      }}
                      selectedCountry={selectedCountry}
                      onChangeSelectedCountry={setSelectedCountry}
                    />
                    {phoneError ? (
                      <Text style={{ color: '#EF4444', fontSize: 13, marginTop: 6 }}>
                        {phoneError}
                      </Text>
                    ) : null}

                    <TouchableOpacity
                      onPress={handleSendCode}
                      disabled={isLoading}
                      style={{
                        marginTop: 20,
                        height: 52,
                        backgroundColor: '#D55004',
                        borderRadius: 14,
                        justifyContent: 'center',
                        alignItems: 'center',
                        opacity: isLoading ? 0.7 : 1,
                      }}
                    >
                      {isLoading ? (
                        <ActivityIndicator color="white" />
                      ) : (
                        <Text style={{ color: 'white', fontWeight: '700', fontSize: 16 }}>
                          Send Verification Code
                        </Text>
                      )}
                    </TouchableOpacity>
                  </>
                ) : (
                  <>
                    {/* Single input — matches sign-in pattern with SMS autofill props */}
                    <TextInput
                      ref={otpInputRef}
                      style={{
                        height: 52,
                        paddingHorizontal: 16,
                        backgroundColor: inputBg,
                        color: textPrimary,
                        borderRadius: 12,
                        borderWidth: 1,
                        borderColor: otpError ? '#EF4444' : borderColor,
                        fontSize: 20,
                        letterSpacing: 6,
                        textAlign: 'center',
                      }}
                      value={otp}
                      placeholder="• • • • • •"
                      placeholderTextColor={textSecondary}
                      onChangeText={(text) => {
                        setOtp(text.replace(/[^0-9]/g, ''));
                        setOtpError('');
                      }}
                      keyboardType="number-pad"
                      maxLength={OTP_LENGTH}
                      textContentType="oneTimeCode"
                      autoComplete="sms-otp"
                      editable={!isLoading}
                    />
                    {otpError ? (
                      <Text style={{ color: '#EF4444', fontSize: 13, marginTop: 6, textAlign: 'center' }}>
                        {otpError}
                      </Text>
                    ) : null}

                    <TouchableOpacity
                      onPress={() => handleVerifyOtp()}
                      disabled={isLoading || otp.length < OTP_LENGTH}
                      style={{
                        marginTop: 20,
                        height: 52,
                        backgroundColor: '#D55004',
                        borderRadius: 14,
                        justifyContent: 'center',
                        alignItems: 'center',
                        opacity: (isLoading || otp.length < OTP_LENGTH) ? 0.5 : 1,
                      }}
                    >
                      {isLoading ? (
                        <ActivityIndicator color="white" />
                      ) : (
                        <Text style={{ color: 'white', fontWeight: '700', fontSize: 16 }}>
                          Verify
                        </Text>
                      )}
                    </TouchableOpacity>

                    <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 16, gap: 4 }}>
                      <Text style={{ color: textSecondary, fontSize: 14 }}>
                        Didn't receive a code?
                      </Text>
                      <TouchableOpacity
                        onPress={handleResend}
                        disabled={resendTimer > 0 || isLoading}
                      >
                        <Text style={{
                          fontSize: 14,
                          fontWeight: '600',
                          color: resendTimer > 0 ? textSecondary : '#D55004',
                        }}>
                          {resendTimer > 0 ? `Resend in ${resendTimer}s` : 'Resend'}
                        </Text>
                      </TouchableOpacity>
                    </View>

                    <TouchableOpacity
                      onPress={() => { setStep('phone'); setOtp(''); setOtpError(''); }}
                      style={{ marginTop: 8, alignItems: 'center' }}
                      disabled={isLoading}
                    >
                      <Text style={{ color: textSecondary, fontSize: 14 }}>
                        Change phone number
                      </Text>
                    </TouchableOpacity>
                  </>
                )}
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}
