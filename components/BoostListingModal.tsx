// components/BoostListingModal.tsx
// Modal for boosting car listings with priority and duration selection
// Updated for priority-based boost system

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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useCredits } from '@/utils/CreditContext';
import { useAuth } from '@/utils/AuthContext';

interface BoostListingModalProps {
  visible: boolean;
  onClose: () => void;
  carId: number;
  isDarkMode: boolean;
  isRTL?: boolean;
  onSuccess?: () => void;
}

interface PriorityLevel {
  priority: number;
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

const PRIORITY_LEVELS: PriorityLevel[] = [
  {
    priority: 5,
    baseCredits: 9,
    label: 'Ultimate',
    icon: 'trophy',
    description: 'Highest priority - Maximum visibility',
  },
  {
    priority: 4,
    baseCredits: 8,
    label: 'Premium',
    icon: 'medal',
    description: 'Premium priority - High visibility',
  },
  {
    priority: 3,
    baseCredits: 7,
    label: 'Enhanced',
    icon: 'star',
    description: 'Enhanced priority - Good visibility',
  },
  {
    priority: 2,
    baseCredits: 6,
    label: 'Standard',
    icon: 'star-half',
    description: 'Standard priority - Decent boost',
  },
  {
    priority: 1,
    baseCredits: 5,
    label: 'Basic',
    icon: 'star-outline',
    description: 'Basic priority - Entry level boost',
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
  const [selectedPriority, setSelectedPriority] = useState(3); // Default to Enhanced (middle tier)
  const [selectedDuration, setSelectedDuration] = useState(7);
  const [isProcessing, setIsProcessing] = useState(false);

  const calculateCost = (): number => {
    const priorityConfig = PRIORITY_LEVELS.find((p) => p.priority === selectedPriority)!;
    const durationConfig = DURATIONS.find((d) => d.days === selectedDuration)!;
    return Math.round(priorityConfig.baseCredits * durationConfig.multiplier);
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
              // User can navigate to profile to purchase
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
              priority: selectedPriority,
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
        `Your listing is now boosted at priority ${selectedPriority} for ${selectedDuration} days!`,
        [
          {
            text: 'OK',
            onPress: () => {
              onClose();
              onSuccess?.();
            },
          },
        ]
      );
    } catch (error: any) {
      console.error('Boost error:', error);
      Alert.alert(
        'Boost Failed',
        error.message || 'Failed to boost listing. Please try again.'
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const cost = calculateCost();
  const canAfford = creditBalance >= cost;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View
          style={{
            flex: 1,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            justifyContent: 'flex-end',
          }}
        >
          <TouchableWithoutFeedback>
            <View
              style={{
                backgroundColor: isDarkMode ? '#1a1a1a' : '#ffffff',
                borderTopLeftRadius: 24,
                borderTopRightRadius: 24,
                height: '90%',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              {/* Header */}
              <View
                style={{
                  flexDirection: isRTL ? 'row-reverse' : 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: 20,
                  borderBottomWidth: 1,
                  borderBottomColor: isDarkMode ? '#333' : '#e5e5e5',
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontSize: 24,
                      fontWeight: '700',
                      color: isDarkMode ? '#fff' : '#000',
                    }}
                  >
                    Boost Your Listing
                  </Text>
                  <Text
                    style={{
                      fontSize: 14,
                      color: isDarkMode ? '#888' : '#666',
                      marginTop: 6,
                      fontWeight: '500',
                    }}
                  >
                    Get more visibility with priority placement
                  </Text>
                </View>
                <TouchableOpacity onPress={onClose}>
                  <Ionicons
                    name="close"
                    size={28}
                    color={isDarkMode ? '#fff' : '#000'}
                  />
                </TouchableOpacity>
              </View>

              <ScrollView
                style={{ flex: 1 }}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 24 }}
              >
                {/* Priority Selection */}
                <View style={{ paddingHorizontal: 20, paddingTop: 24, paddingBottom: 12 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 18 }}>
                    <View style={{
                      width: 4,
                      height: 20,
                      backgroundColor: '#D55004',
                      borderRadius: 2,
                      marginRight: 10
                    }} />
                    <Text
                      style={{
                        fontSize: 19,
                        fontWeight: '700',
                        color: isDarkMode ? '#fff' : '#000',
                      }}
                    >
                      Select Priority
                    </Text>
                  </View>

                  {PRIORITY_LEVELS.map((level) => {
                    const isSelected = selectedPriority === level.priority;
                    return (
                      <TouchableOpacity
                        key={level.priority}
                        onPress={() => setSelectedPriority(level.priority)}
                        style={{
                          flexDirection: isRTL ? 'row-reverse' : 'row',
                          alignItems: 'center',
                          padding: 16,
                          marginBottom: 10,
                          borderRadius: 14,
                          borderWidth: isSelected ? 2 : 1,
                          borderColor: isSelected ? '#D55004' : isDarkMode ? '#2a2a2a' : '#e8e8e8',
                          backgroundColor: isSelected
                            ? isDarkMode ? '#2a1810' : '#fff5f0'
                            : isDarkMode
                            ? '#1f1f1f'
                            : '#ffffff',
                        }}
                      >
                        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
                          <View
                            style={{
                              width: 40,
                              height: 40,
                              borderRadius: 10,
                              backgroundColor: isSelected
                                ? '#D55004'
                                : isDarkMode ? '#2a2a2a' : '#f5f5f5',
                              alignItems: 'center',
                              justifyContent: 'center',
                              marginRight: 14,
                            }}
                          >
                            <Ionicons
                              name={level.icon as any}
                              size={20}
                              color={isSelected ? '#fff' : isDarkMode ? '#999' : '#666'}
                            />
                          </View>
                          <Text
                            style={{
                              fontSize: 16,
                              fontWeight: '600',
                              color: isDarkMode ? '#fff' : '#000',
                            }}
                          >
                            {level.label}
                          </Text>
                        </View>

                        <Text
                          style={{
                            fontSize: 17,
                            fontWeight: '700',
                            color: isSelected ? '#D55004' : isDarkMode ? '#888' : '#666',
                          }}
                        >
                          {level.baseCredits} cr
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Duration Selection */}
                <View style={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 12 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 18 }}>
                    <View style={{
                      width: 4,
                      height: 20,
                      backgroundColor: '#D55004',
                      borderRadius: 2,
                      marginRight: 10
                    }} />
                    <Text
                      style={{
                        fontSize: 19,
                        fontWeight: '700',
                        color: isDarkMode ? '#fff' : '#000',
                      }}
                    >
                      Select Duration
                    </Text>
                  </View>

                  <View
                    style={{
                      flexDirection: isRTL ? 'row-reverse' : 'row',
                      justifyContent: 'space-between',
                    }}
                  >
                    {DURATIONS.map((duration) => {
                      const isSelected = selectedDuration === duration.days;
                      return (
                        <TouchableOpacity
                          key={duration.days}
                          onPress={() => setSelectedDuration(duration.days)}
                          style={{
                            flex: 1,
                            marginHorizontal: 4,
                            paddingVertical: 18,
                            paddingHorizontal: 8,
                            borderRadius: 14,
                            borderWidth: isSelected ? 2 : 1,
                            borderColor: isSelected ? '#D55004' : isDarkMode ? '#2a2a2a' : '#e8e8e8',
                            backgroundColor: isSelected
                              ? isDarkMode ? '#2a1810' : '#fff5f0'
                              : isDarkMode
                              ? '#1f1f1f'
                              : '#ffffff',
                            alignItems: 'center',
                            position: 'relative',
                          }}
                        >
                          {duration.popular && (
                            <View
                              style={{
                                position: 'absolute',
                                top: -10,
                                backgroundColor: '#10b981',
                                paddingHorizontal: 10,
                                paddingVertical: 3,
                                borderRadius: 10,
                              }}
                            >
                              <Text style={{ color: '#fff', fontSize: 9, fontWeight: '700', letterSpacing: 0.5 }}>
                                POPULAR
                              </Text>
                            </View>
                          )}
                          <Text
                            style={{
                              fontSize: 26,
                              fontWeight: '700',
                              color: isSelected ? '#D55004' : isDarkMode ? '#fff' : '#000',
                            }}
                          >
                            {duration.days}
                          </Text>
                          <Text
                            style={{
                              fontSize: 13,
                              color: isDarkMode ? '#888' : '#666',
                              marginTop: 2,
                              fontWeight: '500',
                            }}
                          >
                            days
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                {/* Cost Summary */}
                <View
                  style={{
                    marginHorizontal: 20,
                    marginTop: 20,
                    marginBottom: 16,
                    padding: 18,
                    borderRadius: 16,
                    backgroundColor: isDarkMode ? '#1f1f1f' : '#ffffff',
                    borderWidth: 1,
                    borderColor: isDarkMode ? '#2a2a2a' : '#e8e8e8',
                  }}
                >
                  <View
                    style={{
                      flexDirection: isRTL ? 'row-reverse' : 'row',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 15,
                        fontWeight: '500',
                        color: isDarkMode ? '#999' : '#666',
                      }}
                    >
                      Total Cost
                    </Text>
                    <Text
                      style={{
                        fontSize: 28,
                        fontWeight: '700',
                        color: canAfford ? '#10b981' : '#ef4444',
                      }}
                    >
                      {cost}
                      <Text style={{ fontSize: 16, fontWeight: '600' }}> cr</Text>
                    </Text>
                  </View>

                  <View
                    style={{
                      height: 1,
                      backgroundColor: isDarkMode ? '#2a2a2a' : '#f0f0f0',
                      marginVertical: 12,
                    }}
                  />

                  <View
                    style={{
                      flexDirection: isRTL ? 'row-reverse' : 'row',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <Text style={{ fontSize: 14, color: isDarkMode ? '#888' : '#666', fontWeight: '500' }}>
                      Your Balance
                    </Text>
                    <Text style={{ fontSize: 15, color: isDarkMode ? '#aaa' : '#444', fontWeight: '600' }}>
                      {creditBalance} cr
                    </Text>
                  </View>
                </View>
              </ScrollView>

              {/* Action Buttons */}
              <View style={{
                padding: 20,
                paddingTop: 16,
                borderTopWidth: 1,
                borderTopColor: isDarkMode ? '#2a2a2a' : '#e8e8e8',
                backgroundColor: isDarkMode ? '#1a1a1a' : '#ffffff',
              }}>
                <TouchableOpacity
                  onPress={handleBoost}
                  disabled={isProcessing || !canAfford}
                  style={{
                    backgroundColor: !canAfford || isProcessing ? '#888' : '#D55004',
                    paddingVertical: 16,
                    borderRadius: 14,
                    alignItems: 'center',
                    marginBottom: 10,
                  }}
                >
                  {isProcessing ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>
                      {!canAfford ? 'Insufficient Credits' : `Boost for ${cost} Credits`}
                    </Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={onClose}
                  disabled={isProcessing}
                  style={{
                    paddingVertical: 14,
                    borderRadius: 14,
                    alignItems: 'center',
                  }}
                >
                  <Text style={{ color: isDarkMode ? '#888' : '#666', fontSize: 15, fontWeight: '600' }}>
                    Cancel
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};
