// components/BoostListingModal.tsx
// Modal for boosting car listings with slot and duration selection

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  TouchableWithoutFeedback,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useCredits } from '@/utils/CreditContext';
import { useAuth } from '@/utils/AuthContext';
import { supabase } from '@/utils/supabase';

interface BoostListingModalProps {
  visible: boolean;
  onClose: () => void;
  carId: number;
  isDarkMode: boolean;
  isRTL?: boolean;
  onSuccess?: () => void;
}

interface BoostSlot {
  slot: number;
  baseCredits: number;
  label: string;
  icon: string;
  description: string;
}

interface Duration {
  days: number;
  multiplier: number;
  label: string;
  popular?: boolean;
}

const BOOST_SLOTS: BoostSlot[] = [
  {
    slot: 1,
    baseCredits: 9,
    label: 'Premium Slot',
    icon: 'trophy',
    description: 'Top position - Maximum visibility',
  },
  {
    slot: 2,
    baseCredits: 8,
    label: 'Featured Slot',
    icon: 'medal',
    description: 'High visibility position',
  },
  {
    slot: 3,
    baseCredits: 7,
    label: 'Priority Slot',
    icon: 'star',
    description: 'Priority placement',
  },
  {
    slot: 4,
    baseCredits: 6,
    label: 'Standard Slot',
    icon: 'star-half',
    description: 'Standard boost',
  },
  {
    slot: 5,
    baseCredits: 5,
    label: 'Basic Slot',
    icon: 'star-outline',
    description: 'Basic visibility boost',
  },
];

const DURATIONS: Duration[] = [
  { days: 3, multiplier: 1.0, label: '3 Days' },
  { days: 7, multiplier: 1.8, label: '7 Days', popular: true },
  { days: 10, multiplier: 2.3, label: '10 Days' },
];

export const BoostListingModal: React.FC<BoostListingModalProps> = ({
  visible,
  onClose,
  carId,
  isDarkMode,
  isRTL = false,
  onSuccess,
}) => {
  const { user } = useAuth();
  const { creditBalance, refreshBalance } = useCredits();
  const [selectedSlot, setSelectedSlot] = useState(1);
  const [selectedDuration, setSelectedDuration] = useState(7);
  const [isProcessing, setIsProcessing] = useState(false);
  const [availableSlots, setAvailableSlots] = useState<number[]>([1, 2, 3, 4, 5]);

  useEffect(() => {
    if (visible) {
      fetchAvailableSlots();
    }
  }, [visible]);

  const fetchAvailableSlots = async () => {
    try {
      const { data, error } = await supabase.rpc('get_available_boost_slots');

      if (error) throw error;

      if (data) {
        const available = data
          .filter((slot: any) => slot.is_available)
          .map((slot: any) => slot.slot_number);
        setAvailableSlots(available);

        // Auto-select first available slot
        if (available.length > 0 && !available.includes(selectedSlot)) {
          setSelectedSlot(available[0]);
        }
      }
    } catch (error) {
      console.error('Error fetching available slots:', error);
    }
  };

  const calculateCost = (): number => {
    const slotConfig = BOOST_SLOTS.find((s) => s.slot === selectedSlot)!;
    const durationConfig = DURATIONS.find((d) => d.days === selectedDuration)!;
    return Math.round(slotConfig.baseCredits * durationConfig.multiplier);
  };

  const handleBoost = async () => {
    if (!user?.id) {
      Alert.alert('Error', 'Please sign in to boost listings');
      return;
    }

    const cost = calculateCost();

    if (creditBalance < cost) {
      Alert.alert(
        'Insufficient Credits',
        `You need ${cost} credits but only have ${creditBalance}. Would you like to purchase more credits?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Buy Credits',
            onPress: () => {
              onClose();
              // Navigate to purchase screen or show purchase modal
            },
          },
        ]
      );
      return;
    }

    try {
      setIsProcessing(true);

      const response = await fetch(
        'https://auth.fleetapp.me/functions/v1/credit-operations',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
            Authorization: `Bearer ${process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!}`,
          },
          body: JSON.stringify({
            operation: 'boost_listing',
            userId: user.id,
            carId: carId,
            boostConfig: {
              slot: selectedSlot,
              durationDays: selectedDuration,
            },
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Boost failed');
      }

      await refreshBalance();

      Alert.alert(
        'Success!',
        `Your listing is now boosted in slot ${selectedSlot} for ${selectedDuration} days!`,
        [
          {
            text: 'OK',
            onPress: () => {
              onSuccess?.();
              onClose();
            },
          },
        ]
      );
    } catch (error: any) {
      console.error('Boost error:', error);
      Alert.alert('Error', error.message || 'Failed to boost listing. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const cost = calculateCost();
  const canAfford = creditBalance >= cost;
  const slotAvailable = availableSlots.includes(selectedSlot);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View className="flex-1 bg-black/50 justify-end">
          <TouchableWithoutFeedback>
            <View
              className={`${isDarkMode ? 'bg-neutral-900' : 'bg-white'} rounded-t-3xl p-6 max-h-[90%]`}
            >
              {/* Header */}
              <View className="flex-row justify-between items-center mb-4">
                <View>
                  <Text className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-black'}`}>
                    Boost Your Listing
                  </Text>
                  <Text className={`${isDarkMode ? 'text-white/60' : 'text-gray-500'} mt-1`}>
                    Balance: {creditBalance} credits
                  </Text>
                </View>
                <TouchableOpacity onPress={onClose}>
                  <Ionicons name="close" size={28} color={isDarkMode ? '#fff' : '#000'} />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false}>
                {/* Slot Selection */}
                <Text className={`text-lg font-semibold mb-3 ${isDarkMode ? 'text-white' : 'text-black'}`}>
                  Select Priority Slot
                </Text>
                {BOOST_SLOTS.map((slot) => {
                  const isAvailable = availableSlots.includes(slot.slot);
                  const isSelected = selectedSlot === slot.slot;

                  return (
                    <TouchableOpacity
                      key={slot.slot}
                      className={`p-4 rounded-xl mb-2 flex-row items-center justify-between ${
                        isSelected
                          ? 'bg-orange-500 border-2 border-orange-600'
                          : isDarkMode
                          ? 'bg-neutral-800'
                          : 'bg-neutral-100'
                      } ${!isAvailable ? 'opacity-50' : ''}`}
                      onPress={() => isAvailable && setSelectedSlot(slot.slot)}
                      disabled={!isAvailable}
                    >
                      <View className="flex-row items-center flex-1">
                        <Ionicons
                          name={slot.icon as any}
                          size={24}
                          color={isSelected ? '#fff' : '#D55004'}
                        />
                        <View className="ml-3 flex-1">
                          <View className="flex-row items-center">
                            <Text
                              className={`font-semibold ${
                                isSelected ? 'text-white' : isDarkMode ? 'text-white' : 'text-black'
                              }`}
                            >
                              Slot {slot.slot} - {slot.label}
                            </Text>
                            {!isAvailable && (
                              <View className="ml-2 bg-red-500 px-2 py-0.5 rounded">
                                <Text className="text-white text-xs font-bold">TAKEN</Text>
                              </View>
                            )}
                          </View>
                          <Text
                            className={`text-xs mt-0.5 ${
                              isSelected ? 'text-white/80' : isDarkMode ? 'text-white/60' : 'text-gray-500'
                            }`}
                          >
                            {slot.description} • {slot.baseCredits} credits base
                          </Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                })}

                {/* Duration Selection */}
                <Text className={`text-lg font-semibold mt-6 mb-3 ${isDarkMode ? 'text-white' : 'text-black'}`}>
                  Select Duration
                </Text>
                <View className="flex-row justify-between mb-6">
                  {DURATIONS.map((duration) => (
                    <TouchableOpacity
                      key={duration.days}
                      className={`flex-1 mx-1 p-4 rounded-xl items-center ${
                        selectedDuration === duration.days
                          ? 'bg-orange-500 border-2 border-orange-600'
                          : isDarkMode
                          ? 'bg-neutral-800'
                          : 'bg-neutral-100'
                      }`}
                      onPress={() => setSelectedDuration(duration.days)}
                    >
                      {duration.popular && (
                        <View className="absolute -top-2 bg-green-500 px-2 py-1 rounded">
                          <Text className="text-white text-xs font-bold">BEST</Text>
                        </View>
                      )}
                      <Text
                        className={`text-2xl font-bold ${
                          selectedDuration === duration.days
                            ? 'text-white'
                            : isDarkMode
                            ? 'text-white'
                            : 'text-black'
                        }`}
                      >
                        {duration.days}
                      </Text>
                      <Text
                        className={`text-xs ${
                          selectedDuration === duration.days
                            ? 'text-white/80'
                            : isDarkMode
                            ? 'text-white/60'
                            : 'text-gray-500'
                        }`}
                      >
                        Days
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Cost Summary */}
                <View className={`p-4 rounded-xl ${isDarkMode ? 'bg-neutral-800' : 'bg-neutral-100'} mb-4`}>
                  <View className="flex-row justify-between mb-2">
                    <Text className={isDarkMode ? 'text-white/60' : 'text-gray-600'}>
                      Base Cost (Slot {selectedSlot})
                    </Text>
                    <Text className={isDarkMode ? 'text-white' : 'text-black'}>
                      {BOOST_SLOTS.find((s) => s.slot === selectedSlot)!.baseCredits} credits
                    </Text>
                  </View>
                  <View className="flex-row justify-between mb-2">
                    <Text className={isDarkMode ? 'text-white/60' : 'text-gray-600'}>
                      Duration ({selectedDuration} days)
                    </Text>
                    <Text className={isDarkMode ? 'text-white' : 'text-black'}>
                      ×{DURATIONS.find((d) => d.days === selectedDuration)!.multiplier}
                    </Text>
                  </View>
                  <View className="border-t border-gray-300 mt-2 pt-2 flex-row justify-between">
                    <Text className={`font-bold text-lg ${isDarkMode ? 'text-white' : 'text-black'}`}>
                      Total Cost
                    </Text>
                    <Text className={`font-bold text-lg ${canAfford ? 'text-green-500' : 'text-red-500'}`}>
                      {cost} credits
                    </Text>
                  </View>
                </View>

                {/* Boost Button */}
                <TouchableOpacity
                  className={`p-4 rounded-xl items-center ${
                    canAfford && slotAvailable && !isProcessing ? 'bg-orange-500' : 'bg-gray-400'
                  }`}
                  onPress={handleBoost}
                  disabled={!canAfford || !slotAvailable || isProcessing}
                >
                  {isProcessing ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text className="text-white font-bold text-lg">
                      {!slotAvailable
                        ? 'Slot Not Available'
                        : !canAfford
                        ? 'Insufficient Credits'
                        : 'Boost Listing'}
                    </Text>
                  )}
                </TouchableOpacity>
              </ScrollView>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};
