// components/PurchaseCreditsModal.tsx
// Modal for purchasing credits via Whish payment

import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  TouchableWithoutFeedback,
  ActivityIndicator,
  Alert,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/utils/AuthContext';

interface PurchaseCreditsModalProps {
  visible: boolean;
  onClose: () => void;
  isDarkMode: boolean;
  isRTL?: boolean;
  onSuccess?: () => void;
}

interface CreditPackage {
  credits: number;
  price: number;
  label: string;
  savings?: string;
  popular?: boolean;
}

const CREDIT_PACKAGES: CreditPackage[] = [
  { credits: 10, price: 10, label: 'Starter' },
  { credits: 25, price: 25, label: 'Basic', popular: true },
  { credits: 50, price: 48, label: 'Value', savings: '4% off' },
  { credits: 100, price: 90, label: 'Pro', savings: '10% off' },
  { credits: 250, price: 212, label: 'Premium', savings: '15% off' },
];

export const PurchaseCreditsModal: React.FC<PurchaseCreditsModalProps> = ({
  visible,
  onClose,
  isDarkMode,
  isRTL = false,
  onSuccess,
}) => {
  const { user } = useAuth();
  const [isProcessing, setIsProcessing] = useState(false);

  const handlePurchase = async (pkg: CreditPackage) => {
    if (!user?.id) {
      Alert.alert('Error', 'Please sign in to purchase credits');
      return;
    }

    try {
      setIsProcessing(true);

      const response = await fetch(
        'https://auth.fleetapp.me/functions/v1/credit-purchase',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
            Authorization: `Bearer ${process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!}`,
          },
          body: JSON.stringify({
            userId: user.id,
            creditAmount: pkg.credits,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Payment creation failed');
      }

      if (data.collectUrl) {
        onClose();

        Alert.alert(
          'Complete Payment',
          'You will be redirected to complete your payment securely.',
          [
            {
              text: 'Open Payment',
              onPress: async () => {
                await Linking.openURL(data.collectUrl);
                onSuccess?.();
              },
            },
            { text: 'Cancel', style: 'cancel' },
          ]
        );
      }
    } catch (error: any) {
      console.error('Credit purchase error:', error);
      Alert.alert('Error', error.message || 'Failed to create payment. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View className="flex-1 bg-black/50 justify-end">
          <TouchableWithoutFeedback>
            <View
              className={`${isDarkMode ? 'bg-neutral-900' : 'bg-white'} rounded-t-3xl p-6 max-h-[85%]`}
            >
              {/* Header */}
              <View
                className={`flex-row ${isRTL ? 'flex-row-reverse' : ''} justify-between items-center mb-6`}
              >
                <View>
                  <Text
                    className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-black'}`}
                  >
                    Purchase Credits
                  </Text>
                  <Text className={`${isDarkMode ? 'text-white/60' : 'text-gray-500'} mt-1`}>
                    Credits never expire
                  </Text>
                </View>
                <TouchableOpacity onPress={onClose} disabled={isProcessing}>
                  <Ionicons
                    name="close"
                    size={28}
                    color={isDarkMode ? '#fff' : '#000'}
                  />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false}>
                {CREDIT_PACKAGES.map((pkg) => (
                  <TouchableOpacity
                    key={pkg.credits}
                    className={`p-4 rounded-xl mb-3 ${
                      pkg.popular
                        ? 'border-2 border-orange-500'
                        : isDarkMode
                        ? 'bg-neutral-800'
                        : 'bg-neutral-100'
                    }`}
                    disabled={isProcessing}
                    onPress={() => handlePurchase(pkg)}
                  >
                    {pkg.popular && (
                      <View className="absolute -top-2 right-4 bg-orange-500 px-3 py-1 rounded-full">
                        <Text className="text-white text-xs font-bold">POPULAR</Text>
                      </View>
                    )}

                    <View
                      className={`flex-row ${isRTL ? 'flex-row-reverse' : ''} items-center justify-between`}
                    >
                      <View className="flex-1">
                        <View
                          className={`flex-row ${isRTL ? 'flex-row-reverse' : ''} items-center mb-1`}
                        >
                          <Text
                            className={`font-bold text-xl ${
                              isDarkMode ? 'text-white' : 'text-black'
                            }`}
                          >
                            {pkg.credits} Credits
                          </Text>
                          {pkg.savings && (
                            <View
                              className={`bg-green-500 px-2 py-1 rounded ${
                                isRTL ? 'mr-2' : 'ml-2'
                              }`}
                            >
                              <Text className="text-white text-xs font-semibold">
                                {pkg.savings}
                              </Text>
                            </View>
                          )}
                        </View>
                        <Text className={`${isDarkMode ? 'text-white/60' : 'text-gray-500'} text-sm`}>
                          {pkg.label} Package
                        </Text>
                        {pkg.credits >= 10 && (
                          <Text className={`${isDarkMode ? 'text-white/40' : 'text-gray-400'} text-xs mt-1`}>
                            {Math.floor(pkg.credits / 10)} car posts included
                          </Text>
                        )}
                      </View>
                      <View className="items-end">
                        <Text
                          className={`font-bold text-2xl ${
                            isDarkMode ? 'text-white' : 'text-black'
                          }`}
                        >
                          ${pkg.price}
                        </Text>
                        {pkg.savings && (
                          <Text className="text-gray-500 text-xs line-through">
                            ${pkg.credits}
                          </Text>
                        )}
                      </View>
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Info Box */}
              <View
                className={`mt-4 p-3 rounded-lg ${
                  isDarkMode ? 'bg-blue-900/20' : 'bg-blue-50'
                }`}
              >
                <View className="flex-row items-start">
                  <Ionicons
                    name="information-circle"
                    size={20}
                    color={isDarkMode ? '#60a5fa' : '#3b82f6'}
                    style={{ marginRight: 8, marginTop: 2 }}
                  />
                  <Text
                    className={`flex-1 text-xs ${
                      isDarkMode ? 'text-blue-300' : 'text-blue-600'
                    }`}
                  >
                    • Credits never expire{'\n'}
                    • Post cars: 10 credits each{'\n'}
                    • Boost listings: 5-9 credits per boost{'\n'}
                    • Secure payment via Whish
                  </Text>
                </View>
              </View>

              {isProcessing && (
                <View className="absolute inset-0 bg-black/50 rounded-t-3xl items-center justify-center">
                  <View className="bg-white p-6 rounded-2xl items-center">
                    <ActivityIndicator size="large" color="#D55004" />
                    <Text className="text-black font-semibold mt-3">Processing...</Text>
                  </View>
                </View>
              )}
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};
