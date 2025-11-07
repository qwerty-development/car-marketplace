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
                paddingBottom: 40,
                maxHeight: '90%',
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
                <Text
                  style={{
                    fontSize: 22,
                    fontWeight: 'bold',
                    color: isDarkMode ? '#fff' : '#000',
                  }}
                >
                  Boost Your Listing
                </Text>
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
              >
                {/* Priority Selection */}
                <View style={{ padding: 20 }}>
                  <Text
                    style={{
                      fontSize: 18,
                      fontWeight: '600',
                      marginBottom: 12,
                      color: isDarkMode ? '#fff' : '#000',
                    }}
                  >
                    Select Priority Level
                  </Text>

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
                          marginBottom: 12,
                          borderRadius: 12,
                          borderWidth: 2,
                          borderColor: isSelected ? '#D55004' : isDarkMode ? '#333' : '#e5e5e5',
                          backgroundColor: isSelected
                            ? 'rgba(213, 80, 4, 0.1)'
                            : isDarkMode
                            ? '#252525'
                            : '#f9f9f9',
                        }}
                      >
                        <View
                          style={{
                            width: 48,
                            height: 48,
                            borderRadius: 24,
                            backgroundColor: isSelected ? '#D55004' : isDarkMode ? '#333' : '#e5e5e5',
                            alignItems: 'center',
                            justifyContent: 'center',
                            marginRight: isRTL ? 0 : 12,
                            marginLeft: isRTL ? 12 : 0,
                          }}
                        >
                          <Ionicons
                            name={level.icon as any}
                            size={24}
                            color={isSelected ? '#fff' : isDarkMode ? '#999' : '#666'}
                          />
                        </View>

                        <View style={{ flex: 1 }}>
                          <Text
                            style={{
                              fontSize: 16,
                              fontWeight: '600',
                              color: isDarkMode ? '#fff' : '#000',
                            }}
                          >
                            {level.label} - Priority {level.priority}
                          </Text>
                          <Text
                            style={{
                              fontSize: 14,
                              color: isDarkMode ? '#999' : '#666',
                              marginTop: 4,
                            }}
                          >
                            {level.description}
                          </Text>
                        </View>

                        <Text
                          style={{
                            fontSize: 16,
                            fontWeight: 'bold',
                            color: isSelected ? '#D55004' : isDarkMode ? '#999' : '#666',
                          }}
                        >
                          {level.baseCredits} credits
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Duration Selection */}
                <View style={{ padding: 20, paddingTop: 0 }}>
                  <Text
                    style={{
                      fontSize: 18,
                      fontWeight: '600',
                      marginBottom: 12,
                      color: isDarkMode ? '#fff' : '#000',
                    }}
                  >
                    Select Duration
                  </Text>

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
                            padding: 16,
                            borderRadius: 12,
                            borderWidth: 2,
                            borderColor: isSelected ? '#D55004' : isDarkMode ? '#333' : '#e5e5e5',
                            backgroundColor: isSelected
                              ? 'rgba(213, 80, 4, 0.1)'
                              : isDarkMode
                              ? '#252525'
                              : '#f9f9f9',
                            alignItems: 'center',
                          }}
                        >
                          {duration.popular && (
                            <View
                              style={{
                                position: 'absolute',
                                top: -8,
                                backgroundColor: '#10b981',
                                paddingHorizontal: 8,
                                paddingVertical: 2,
                                borderRadius: 8,
                              }}
                            >
                              <Text style={{ color: '#fff', fontSize: 10, fontWeight: 'bold' }}>
                                POPULAR
                              </Text>
                            </View>
                          )}
                          <Text
                            style={{
                              fontSize: 18,
                              fontWeight: 'bold',
                              color: isSelected ? '#D55004' : isDarkMode ? '#fff' : '#000',
                            }}
                          >
                            {duration.days}
                          </Text>
                          <Text
                            style={{
                              fontSize: 12,
                              color: isDarkMode ? '#999' : '#666',
                              marginTop: 4,
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
                    margin: 20,
                    padding: 20,
                    borderRadius: 16,
                    backgroundColor: isDarkMode ? '#252525' : '#f9f9f9',
                  }}
                >
                  <View
                    style={{
                      flexDirection: isRTL ? 'row-reverse' : 'row',
                      justifyContent: 'space-between',
                      marginBottom: 12,
                    }}
                  >
                    <Text style={{ color: isDarkMode ? '#999' : '#666' }}>
                      Base Cost:
                    </Text>
                    <Text style={{ color: isDarkMode ? '#fff' : '#000', fontWeight: '600' }}>
                      {PRIORITY_LEVELS.find((p) => p.priority === selectedPriority)?.baseCredits}{' '}
                      credits
                    </Text>
                  </View>

                  <View
                    style={{
                      flexDirection: isRTL ? 'row-reverse' : 'row',
                      justifyContent: 'space-between',
                      marginBottom: 12,
                    }}
                  >
                    <Text style={{ color: isDarkMode ? '#999' : '#666' }}>
                      Duration:
                    </Text>
                    <Text style={{ color: isDarkMode ? '#fff' : '#000', fontWeight: '600' }}>
                      {selectedDuration} days (×
                      {DURATIONS.find((d) => d.days === selectedDuration)?.multiplier})
                    </Text>
                  </View>

                  <View
                    style={{
                      height: 1,
                      backgroundColor: isDarkMode ? '#333' : '#e5e5e5',
                      marginVertical: 12,
                    }}
                  />

                  <View
                    style={{
                      flexDirection: isRTL ? 'row-reverse' : 'row',
                      justifyContent: 'space-between',
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 18,
                        fontWeight: 'bold',
                        color: isDarkMode ? '#fff' : '#000',
                      }}
                    >
                      Total Cost:
                    </Text>
                    <Text
                      style={{
                        fontSize: 20,
                        fontWeight: 'bold',
                        color: canAfford ? '#10b981' : '#ef4444',
                      }}
                    >
                      {cost} credits
                    </Text>
                  </View>

                  <View
                    style={{
                      flexDirection: isRTL ? 'row-reverse' : 'row',
                      justifyContent: 'space-between',
                      marginTop: 8,
                    }}
                  >
                    <Text style={{ fontSize: 12, color: isDarkMode ? '#999' : '#666' }}>
                      Your Balance:
                    </Text>
                    <Text style={{ fontSize: 12, color: isDarkMode ? '#999' : '#666' }}>
                      {creditBalance} credits
                    </Text>
                  </View>
                </View>

                {/* Info Box */}
                <View
                  style={{
                    margin: 20,
                    marginTop: 0,
                    padding: 16,
                    borderRadius: 12,
                    backgroundColor: isDarkMode ? 'rgba(59, 130, 246, 0.1)' : 'rgba(59, 130, 246, 0.05)',
                    borderLeftWidth: 4,
                    borderLeftColor: '#3b82f6',
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                    <Ionicons name="information-circle" size={20} color="#3b82f6" style={{ marginRight: 8, marginTop: 2 }} />
                    <Text style={{ flex: 1, fontSize: 13, color: isDarkMode ? '#bfdbfe' : '#1e40af', lineHeight: 20 }}>
                      Boosted listings appear at the top of search results. Higher priority levels get better placement. Multiple listings can have the same priority - first-come, first-served!
                    </Text>
                  </View>
                </View>
              </ScrollView>

              {/* Action Buttons */}
              <View style={{ padding: 20, paddingTop: 12 }}>
                <TouchableOpacity
                  onPress={handleBoost}
                  disabled={isProcessing || !canAfford}
                  style={{
                    backgroundColor: !canAfford || isProcessing ? '#999' : '#D55004',
                    padding: 16,
                    borderRadius: 12,
                    alignItems: 'center',
                    marginBottom: 12,
                  }}
                >
                  {isProcessing ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={{ color: '#fff', fontSize: 16, fontWeight: 'bold' }}>
                      {!canAfford ? 'Insufficient Credits' : `Boost for ${cost} Credits`}
                    </Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={onClose}
                  disabled={isProcessing}
                  style={{
                    padding: 16,
                    borderRadius: 12,
                    alignItems: 'center',
                    borderWidth: 1,
                    borderColor: isDarkMode ? '#333' : '#e5e5e5',
                  }}
                >
                  <Text style={{ color: isDarkMode ? '#999' : '#666', fontSize: 16 }}>
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
