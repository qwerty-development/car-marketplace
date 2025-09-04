import 'react-native-get-random-values'
import React, { useState, useCallback, useRef } from 'react'
import {
  View,
  Text,
  Image,
  ScrollView,
  ActivityIndicator,
  Alert,
  RefreshControl,
  TouchableOpacity,
  Modal,
  TouchableWithoutFeedback,
  StyleSheet,
  Linking
} from 'react-native'
import { useAuth } from '@/utils/AuthContext'
import * as ImagePicker from 'expo-image-picker'
import * as FileSystem from 'expo-file-system'
import { useTheme } from '@/utils/ThemeContext'
import { useRouter } from 'expo-router'
import { Ionicons, Feather } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import { useScrollToTop } from '@react-navigation/native'
import { useDealershipProfile } from '../hooks/useDealershipProfile'
import { supabase } from '@/utils/supabase'
import { Buffer } from 'buffer'
import { coordinateSignOut } from '@/app/(home)/_layout'
import { SignOutOverlay } from '@/components/SignOutOverlay'
import Constants from 'expo-constants'

const SUBSCRIPTION_WARNING_DAYS = 7
const MODAL_HEIGHT_PERCENTAGE = 0.7;

// Subscription pricing configuration
const SUBSCRIPTION_PRICE_MONTHLY_USD = 1
const SUBSCRIPTION_PRICE_YEARLY_USD = 2500

// Enable/disable subscription renewal feature
const ENABLE_RENEW_SUBSCRIPTION = false

type RouterType = ReturnType<typeof useRouter>

type LegalsModalProps = {
  visible: boolean
  onClose: () => void
  isDarkMode: boolean
  router: RouterType
}

// New component for Legal Options Modal
const LegalsModal = ({ visible, onClose, isDarkMode, router }: LegalsModalProps) => {
  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={styles.modalBackground} />
        </TouchableWithoutFeedback>
        <View
          style={[
            styles.modalContent,
            {
              maxHeight: `${MODAL_HEIGHT_PERCENTAGE * 100}%`,
              backgroundColor: isDarkMode ? "#1A1A1A" : "white",
            },
          ]}
        >
          <View className="flex-row justify-between items-center mb-6">
            <Text className={`text-xl font-semibold ${isDarkMode ? 'text-white' : 'text-black'}`}>
              Legal Documents
            </Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={isDarkMode ? '#fff' : '#000'} />
            </TouchableOpacity>
          </View>
          
          <TouchableOpacity 
            className={`flex-row items-center p-4 mb-3 rounded-xl ${isDarkMode ? 'bg-neutral-800' : 'bg-neutral-100'}`}
            onPress={() => {
              onClose();
              router.push('/(home)/(dealer)/terms-of-service');
            }}
          >
            <Ionicons name="document-text-outline" size={22} color="#D55004" style={{ marginRight: 12 }} />
            <Text className={isDarkMode ? 'text-white' : 'text-black'}>Terms of Service</Text>
            <View style={{ flex: 1 }} />
            <Ionicons name="chevron-forward" size={20} color={isDarkMode ? '#ddd' : '#999'} />
          </TouchableOpacity>
          
          <TouchableOpacity 
            className={`flex-row items-center p-4 mb-3 rounded-xl ${isDarkMode ? 'bg-neutral-800' : 'bg-neutral-100'}`}
            onPress={() => {
              onClose();
              router.push('/(home)/(dealer)/privacy-policy');
            }}
          >
            <Ionicons name="shield-checkmark-outline" size={22} color="#D55004" style={{ marginRight: 12 }} />
            <Text className={isDarkMode ? 'text-white' : 'text-black'}>Privacy Policy</Text>
            <View style={{ flex: 1 }} />
            <Ionicons name="chevron-forward" size={20} color={isDarkMode ? '#ddd' : '#999'} />
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

type SubscriptionBannerProps = {
  isDarkMode: boolean
  subscriptionExpired: boolean
  showWarning: boolean
  daysUntilExpiration: number | null
  router: RouterType
  onRenewPress?: () => void
}

type RenewSubscriptionModalProps = {
	visible: boolean
	onClose: () => void
	isDarkMode: boolean
	onSelectPlan: (plan: 'monthly' | 'yearly') => void
	isSubmitting: boolean
}

const RenewSubscriptionModal = ({ visible, onClose, isDarkMode, onSelectPlan, isSubmitting }: RenewSubscriptionModalProps) => {
	return (
		<Modal
			visible={visible}
			transparent={true}
			animationType="fade"
			onRequestClose={onClose}
		>
			<View style={styles.modalOverlay}>
				<TouchableWithoutFeedback onPress={onClose}>
					<View style={styles.modalBackground} />
				</TouchableWithoutFeedback>
				<View
					style={[
						styles.modalContent,
						{ backgroundColor: isDarkMode ? '#1A1A1A' : 'white' }
					]}
				>
					<View className="flex-row justify-between items-center mb-6">
						<Text className={`text-xl font-semibold ${isDarkMode ? 'text-white' : 'text-black'}`}>
							Renew Subscription
						</Text>
						<TouchableOpacity onPress={onClose}>
							<Ionicons name="close" size={24} color={isDarkMode ? '#fff' : '#000'} />
						</TouchableOpacity>
					</View>

					<Text className={`${isDarkMode ? 'text-white/80' : 'text-gray-600'} mb-4`}>
						Choose a plan to proceed with payment via Whish (sandbox)
					</Text>

					<TouchableOpacity
						className={`p-4 rounded-xl mb-3 flex-row items-center ${isDarkMode ? 'bg-neutral-800' : 'bg-neutral-100'}`}
						disabled={isSubmitting}
						onPress={() => onSelectPlan('monthly')}
					>
						<View className="w-10 h-10 rounded-full bg-blue-500/10 items-center justify-center mr-3">
							<Ionicons name="calendar-outline" size={22} color="#3b82f6" />
						</View>
						<View style={{ flex: 1 }}>
							<Text className={`font-semibold ${isDarkMode ? 'text-white' : 'text-black'}`}>Monthly Plan</Text>
							<Text className={`${isDarkMode ? 'text-white/60' : 'text-gray-500'} text-xs`}>${SUBSCRIPTION_PRICE_MONTHLY_USD} / month</Text>
						</View>
						{isSubmitting && <ActivityIndicator size="small" color="#3b82f6" />}
					</TouchableOpacity>

					<TouchableOpacity
						className={`p-4 rounded-xl flex-row items-center ${isDarkMode ? 'bg-neutral-800' : 'bg-neutral-100'}`}
						disabled={isSubmitting}
						onPress={() => onSelectPlan('yearly')}
					>
						<View className="w-10 h-10 rounded-full bg-emerald-500/10 items-center justify-center mr-3">
							<Ionicons name="ribbon-outline" size={22} color="#10b981" />
						</View>
						<View style={{ flex: 1 }}>
							<Text className={`font-semibold ${isDarkMode ? 'text-white' : 'text-black'}`}>Yearly Plan</Text>
							<Text className={`${isDarkMode ? 'text-white/60' : 'text-gray-500'} text-xs`}>${SUBSCRIPTION_PRICE_YEARLY_USD} / year</Text>
						</View>
						{isSubmitting && <ActivityIndicator size="small" color="#10b981" />}
					</TouchableOpacity>
				</View>
			</View>
		</Modal>
	)
}

// Subscription Banner Component
const SubscriptionBanner = ({ isDarkMode, subscriptionExpired, showWarning, daysUntilExpiration, onRenewPress }: SubscriptionBannerProps) => {
  if (subscriptionExpired) {
    return (
      <LinearGradient
        colors={isDarkMode ? ['#3A1A1A', '#2A0F0F'] : ['#FFEFEF', '#FFE0E0']}
        className="p-4 rounded-xl shadow-sm overflow-hidden"
      >
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center">
            <View className="w-10 h-10 rounded-full bg-red-500/20 items-center justify-center mr-3">
              <Ionicons name="alert-circle" size={24} color="#ef4444" />
            </View>
            <View>
              <Text className={`font-semibold ${isDarkMode ? "text-white" : "text-gray-800"}`}>
                Subscription Expired
              </Text>
              <Text className={`text-xs ${isDarkMode ? "text-red-400" : "text-red-600"}`}>
                Renew now to continue services
              </Text>
            </View>
          </View>
          {ENABLE_RENEW_SUBSCRIPTION && (
            <TouchableOpacity 
              className="bg-red-500 px-3 py-2 rounded-lg" 
              onPress={onRenewPress}
            >
              <Text className="text-white font-medium text-sm">Renew</Text>
            </TouchableOpacity>
          )}
        </View>
      </LinearGradient>
    );
  } 
  
  if (showWarning) {
    return (
      <LinearGradient
        colors={isDarkMode ? ['#3A2C1A', '#2A1F0F'] : ['#FFF9EF', '#FFF2D9']}
        className="p-4 rounded-xl shadow-sm overflow-hidden"
      >
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center">
            <View className="w-10 h-10 rounded-full bg-yellow-500/20 items-center justify-center mr-3">
              <Ionicons name="time-outline" size={24} color="#f59e0b" />
            </View>
            <View>
              <Text className={`font-semibold ${isDarkMode ? "text-white" : "text-gray-800"}`}>
                Expiring Soon
              </Text>
              <Text className={`text-xs ${isDarkMode ? "text-yellow-400" : "text-yellow-600"}`}>
                {daysUntilExpiration} day{daysUntilExpiration !== 1 ? 's' : ''} remaining
              </Text>
            </View>
          </View>
          {ENABLE_RENEW_SUBSCRIPTION && (
            <TouchableOpacity 
              className="bg-yellow-500 px-3 py-2 rounded-lg" 
              onPress={onRenewPress}
            >
              <Text className="text-white font-medium text-sm">Extend</Text>
            </TouchableOpacity>
          )}
        </View>
      </LinearGradient>
    );
  }
  
  return (
    <LinearGradient
      colors={isDarkMode ? ['#1A3A1A', '#0F2A0F'] : ['#EFFFF0', '#E0FFE5']}
      className="p-4 rounded-xl shadow-sm overflow-hidden"
    >
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center">
          <View className="w-10 h-10 rounded-full bg-green-500/20 items-center justify-center mr-3">
            <Ionicons name="checkmark-circle" size={24} color="#10b981" />
          </View>
          <View>
            <Text className={`font-semibold ${isDarkMode ? "text-white" : "text-gray-800"}`}>
              Active Subscription
            </Text>
            <Text className={`text-xs ${isDarkMode ? "text-green-400" : "text-green-600"}`}>
              {daysUntilExpiration !== null ? `${daysUntilExpiration} days remaining` : 'Subscription active'}
            </Text>
          </View>
        </View>
        {ENABLE_RENEW_SUBSCRIPTION && (
          <TouchableOpacity 
            className="bg-green-600 px-3 py-2 rounded-lg" 
            onPress={onRenewPress}
          >
            <Text className="text-white font-medium text-sm">Renew</Text>
          </TouchableOpacity>
        )}
      </View>
    </LinearGradient>
  );
};

export default function DealershipProfilePage() {
  const { isDarkMode } = useTheme()
  const { user, profile, signOut } = useAuth()
  const router = useRouter()
  const scrollRef = useRef<ScrollView>(null)
  const mapRef = useRef(null)

  useScrollToTop(scrollRef)

  const { dealership, isLoading: isProfileLoading, fetchDealershipProfile } = useDealershipProfile()

  // State Management
  const [isUploading, setIsUploading] = useState(false)
  const [isLegalsModalVisible, setIsLegalsModalVisible] = useState(false)
  const [isRenewModalVisible, setIsRenewModalVisible] = useState(false)
  const [isCreatingPayment, setIsCreatingPayment] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [showSignOutOverlay, setShowSignOutOverlay] = useState(false)

  // Subscription checks
  const isSubscriptionValid = useCallback(() => {
    if (!dealership?.subscription_end_date) return false
    return new Date(dealership.subscription_end_date) > new Date()
  }, [dealership])

  const getDaysUntilExpiration = useCallback(() => {
    if (!dealership?.subscription_end_date) return null
    const endDate = new Date(dealership.subscription_end_date)
    const today = new Date()
    const diffTime = endDate.getTime() - today.getTime()
    return Math.ceil(diffTime / (1000 * 3600 * 24))
  }, [dealership])

  const daysUntilExpiration = getDaysUntilExpiration()
  const showWarning = daysUntilExpiration !== null &&
    daysUntilExpiration <= SUBSCRIPTION_WARNING_DAYS &&
    daysUntilExpiration > 0
  const subscriptionExpired = !isSubscriptionValid()

  // Handler for switching to user interface
  const handleUserInterfaceRedirect = async () => {
    try {
      Alert.alert(
        "Switch to Customer View",
        "You will be redirected to the customer browsing interface.",
        [
          {
            text: "Cancel",
            style: "cancel"
          },
          {
            text: "Continue",
            onPress: async () => {
              try {
                // Navigate to user interface
                router.replace('/(home)/(user)' as any);
              } catch (error) {
                console.error('Error navigating to user interface:', error);
                Alert.alert('Error', 'Failed to navigate. Please try again.');
              }
            }
          }
        ]
      );
    } catch (error) {
      console.error('Error switching to user interface:', error);
      Alert.alert('Error', 'Something went wrong. Please try again.');
    }
  };

  // Image handling
  const pickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Please allow photo access.')
        return
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 1
      })

      if (!result.canceled && result.assets?.[0]) {
        setIsUploading(true)
        await handleImageUpload(result.assets[0].uri)
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to pick image')
    } finally {
      setIsUploading(false)
    }
  }

  const handleImageUpload = async (imageUri: string) => {
    if (!dealership?.id) return

    try {
      const fileName = `${Date.now()}_${Math.random().toString(36).slice(2)}.jpg`
      const filePath = `${dealership.id}/${fileName}`
      const base64 = await FileSystem.readAsStringAsync(imageUri, {
        encoding: FileSystem.EncodingType.Base64
      })

      const { error: uploadError } = await supabase.storage
        .from('logos')
        .upload(filePath, Buffer.from(base64, 'base64'), {
          contentType: 'image/jpeg'
        })

      if (uploadError) throw uploadError

      const { data: publicURLData } = supabase.storage
        .from('logos')
        .getPublicUrl(filePath)

      if (!publicURLData?.publicUrl) throw new Error('Failed to get public URL')

      await supabase
        .from('dealerships')
        .update({ logo: publicURLData.publicUrl })
        .eq('id', dealership.id)

      fetchDealershipProfile()
      Alert.alert('Success', 'Logo updated successfully')
    } catch (error) {
      Alert.alert('Error', 'Failed to upload image')
    }
  }

  // Enhanced sign out function with proper coordination
  const handleSignOut = async () => {
    Alert.alert(
      "Sign Out",
      "Are you sure you want to sign out?",
      [
        {
          text: "Cancel",
          style: "cancel"
        },
        {
          text: "Sign Out",
          style: "destructive",
          onPress: async () => {
            try {
              // Show overlay during sign out
              setShowSignOutOverlay(true);

              // Use the coordinated sign out process
              await coordinateSignOut(router, async () => {
                // Perform the actual sign out
                await signOut();
              });
            } catch (error) {
              console.error("Error during sign out:", error);

              // Force navigation to sign-in on failure
              router.replace('/(auth)/sign-in');

              Alert.alert(
                "Sign Out Issue",
                "There was a problem signing out, but we've redirected you to the sign-in screen."
              );
            } finally {
              // Hide overlay
              setShowSignOutOverlay(false);
            }
          }
        }
      ]
    );
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true)
    fetchDealershipProfile().finally(() => setRefreshing(false))
  }, [fetchDealershipProfile])

  const handleSelectPlan = useCallback(async (plan: 'monthly' | 'yearly') => {
    try {
      setIsCreatingPayment(true)
      
      if (!dealership?.id) {
        Alert.alert('Error', 'Dealership ID not found')
        return
      }

      // Call our Supabase Edge Function
      const response = await fetch('https://auth.fleetapp.me/functions/v1/whish-create-payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
          'Authorization': `Bearer ${process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!}`
        },
        body: JSON.stringify({
          dealerId: dealership.id,
          plan: plan
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Payment creation failed')
      }

      if (data.collectUrl) {
        setIsRenewModalVisible(false)
        Alert.alert(
          'Proceed to Payment',
          'You will be redirected to Whish sandbox to complete the payment.',
          [
            {
              text: 'Open Payment Page',
              onPress: () => {
                Linking.openURL(data.collectUrl)
              }
            },
            { text: 'Cancel', style: 'cancel' }
          ]
        )
      } else {
        Alert.alert('Error', 'No payment URL received')
      }
    } catch (error: any) {
      console.error('Payment error:', error)
      Alert.alert('Error', error.message || 'Failed to create payment. Please try again.')
    } finally {
      setIsCreatingPayment(false)
    }
  }, [dealership?.id])

  if (isProfileLoading) {
    return (
      <View className="flex-1 justify-center items-center">
        <ActivityIndicator size="large" color="#D55004" />
      </View>
    )
  }

  return (
    <View style={{ flex: 1, backgroundColor: isDarkMode ? "#000000" : "#FFFFFF" }}>
      <ScrollView
        ref={scrollRef}
        className={`flex-1 ${isDarkMode ? "bg-black" : "bg-white"} mb-10`}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#D55004']}
            tintColor={isDarkMode ? '#D55004' : '#D55004'}
          />
        }
      >
        {/* Profile Header */}
        <View className="relative">
          <LinearGradient
            colors={isDarkMode ? ['#D55004', '#000000'] : ['#D55004', '#DADADA']}
            className="pt-12 pb-24 rounded-b-[40px]"
          >
            <View className="items-center mt-6">
              <View className="relative">
                <Image
                  source={{
                    uri: dealership?.logo || 'https://via.placeholder.com/150'
                  }}
                  className="w-32 h-32 rounded-full border-4 border-white/20"
                />
                <TouchableOpacity
                  onPress={pickImage}
                  disabled={isUploading}
                  className="absolute bottom-0 right-0 bg-white/90 p-2 rounded-full shadow-lg"
                >
                  {isUploading ? (
                    <ActivityIndicator color="#D55004" size="small" />
                  ) : (
                    <Ionicons name="camera" size={20} color="#D55004" />
                  )}
                </TouchableOpacity>
              </View>

              <Text className="text-white text-xl font-semibold mt-4">
                {dealership?.name}
              </Text>
              <Text className="text-white/80 text-sm">{dealership?.location}</Text>
              
              {/* Customer View Button */}
              <TouchableOpacity
                onPress={handleUserInterfaceRedirect}
                className="mt-6 bg-white/20 backdrop-blur-sm px-6 py-3 rounded-full flex-row items-center border border-white/30"
              >
                <Ionicons 
                  name="storefront-outline" 
                  size={20} 
                  color="white" 
                  style={{ marginRight: 8 }}
                />
                <Text className="text-white font-semibold">
                  Browse as Customer
                </Text>
              </TouchableOpacity>
            </View>
          </LinearGradient>
        </View>

        {/* Subscription Banner */}
        <View className="px-6 mt-4 mb-6">
          <SubscriptionBanner 
            isDarkMode={isDarkMode}
            subscriptionExpired={subscriptionExpired}
            showWarning={showWarning}
            daysUntilExpiration={daysUntilExpiration}
            router={router}
            onRenewPress={() => setIsRenewModalVisible(true)}
          />
        </View>

        {/* Menu Items - Styled like User Profile */}
        <View className="space-y-4 px-6">
          {/* Edit Profile & Location Button */}
          <TouchableOpacity
            onPress={() => router.push(`/(home)/(dealer)/EditProfile?dealershipId=${dealership?.id}`)}
            className={`${isDarkMode ? "bg-neutral-800" : "bg-neutral-200"}
              p-4 rounded-xl shadow-sm flex-row items-center`}
          >
            <View className="w-10 h-10 rounded-full bg-blue-500/10 items-center justify-center">
              <Ionicons name="person-outline" size={24} color="#3b82f6" />
            </View>
            <View className="ml-3 flex-1">
              <Text className={`font-semibold ${isDarkMode ? "text-white" : "text-black"}`}>
                Edit Profile & Location
              </Text>
              <Text className={`text-xs mt-1 ${isDarkMode ? "text-white/60" : "text-gray-500"}`}>
                Update dealership information and map location
              </Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={24}
              color={isDarkMode ? "#fff" : "#000"}
            />
          </TouchableOpacity>

          {/* Security Button */}
          <TouchableOpacity
            onPress={() => router.push('/(home)/(dealer)/ChangePassword')}
            className={`${isDarkMode ? "bg-neutral-800" : "bg-neutral-200"}
              p-4 rounded-xl shadow-sm flex-row items-center`}
          >
            <View className="w-10 h-10 rounded-full bg-purple-500/10 items-center justify-center">
              <Ionicons name="lock-closed-outline" size={24} color="#9333ea" />
            </View>
            <View className="ml-3 flex-1">
              <Text className={`font-semibold ${isDarkMode ? "text-white" : "text-black"}`}>
                Security
              </Text>
              <Text className={`text-xs mt-1 ${isDarkMode ? "text-white/60" : "text-gray-500"}`}>
                Change password and security settings
              </Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={24}
              color={isDarkMode ? "#fff" : "#000"}
            />
          </TouchableOpacity>

          {/* Analytics Button */}
          <TouchableOpacity
            onPress={() => router.push('/(home)/(dealer)/analytics')}
            className={`${isDarkMode ? "bg-neutral-800" : "bg-neutral-200"}
              p-4 rounded-xl shadow-sm flex-row items-center`}
          >
            <View className="w-10 h-10 rounded-full bg-green-500/10 items-center justify-center">
              <Ionicons name="bar-chart-outline" size={24} color="#10b981" />
            </View>
            <View className="ml-3 flex-1">
              <Text className={`font-semibold ${isDarkMode ? "text-white" : "text-black"}`}>
                Analytics Dashboard
              </Text>
              <Text className={`text-xs mt-1 ${isDarkMode ? "text-white/60" : "text-gray-500"}`}>
                View statistics and reports
              </Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={24}
              color={isDarkMode ? "#fff" : "#000"}
            />
          </TouchableOpacity>

          {/* Legals Button */}
          <TouchableOpacity
            onPress={() => setIsLegalsModalVisible(true)}
            className={`${isDarkMode ? "bg-neutral-800" : "bg-neutral-200"}
              p-4 rounded-xl shadow-sm flex-row items-center`}
          >
            <View className="w-10 h-10 rounded-full bg-amber-500/10 items-center justify-center">
              <Ionicons name="document-text-outline" size={24} color="#f59e0b" />
            </View>
            <View className="ml-3 flex-1">
              <Text className={`font-semibold ${isDarkMode ? "text-white" : "text-black"}`}>
                Legals
              </Text>
              <Text className={`text-xs mt-1 ${isDarkMode ? "text-white/60" : "text-gray-500"}`}>
                Terms of Service and Privacy Policy
              </Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={24}
              color={isDarkMode ? "#fff" : "#000"}
            />
          </TouchableOpacity>
        </View>

        {/* Support Section */}
        <View className="mt-8 px-6 space-y-4">
          <Text
            className={`${isDarkMode ? "text-white/60" : "text-gray-500"} 
            text-xs uppercase tracking-wider mb-1`}
          >
            Support & Help
          </Text>

          <TouchableOpacity
            onPress={() => Linking.openURL('https://wa.me/70993415')}
            className={`${isDarkMode ? "bg-neutral-800" : "bg-neutral-200"}
              p-4 rounded-xl shadow-sm flex-row items-center`}
          >
            <View className="w-10 h-10 rounded-full bg-green-500/10 items-center justify-center">
              <Feather name="message-circle" size={22} color="#22c55e" />
            </View>
            <View className="ml-3 flex-1">
              <Text className={`font-semibold ${isDarkMode ? "text-white" : "text-black"}`}>
                WhatsApp Support
              </Text>
              <Text className={`text-xs mt-1 ${isDarkMode ? "text-white/60" : "text-gray-500"}`}>
                Available 24/7
              </Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={24}
              color={isDarkMode ? "#fff" : "#000"}
            />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => Linking.openURL('mailto:info@notqwerty.com?subject=Dealer Support Request')}
            className={`${isDarkMode ? "bg-neutral-800" : "bg-neutral-200"}
              p-4 rounded-xl shadow-sm flex-row items-center`}
          >
            <View className="w-10 h-10 rounded-full bg-blue-500/10 items-center justify-center">
              <Feather name="mail" size={22} color="#3b82f6" />
            </View>
            <View className="ml-3 flex-1">
              <Text className={`font-semibold ${isDarkMode ? "text-white" : "text-black"}`}>
                Email Support
              </Text>
              <Text className={`text-xs mt-1 ${isDarkMode ? "text-white/60" : "text-gray-500"}`}>
                Detailed inquiries
              </Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={24}
              color={isDarkMode ? "#fff" : "#000"}
            />
          </TouchableOpacity>
        </View>

        {/* Version Information */}
        <Text
          className="text-center mt-8"
          style={{ fontSize: 12, color: isDarkMode ? "#777" : "#999" }}
        >
          Version {Constants.expoConfig?.version || "1.0.0"}
        </Text>

        {/* Sign Out Button - Styled like User Profile */}
        <TouchableOpacity
          className="mx-6 mt-4 mb-12 "
          onPress={handleSignOut}
          disabled={showSignOutOverlay}
        >
          <Text
            className={`text-center border text-white font-semibold p-4 rounded-2xl bg-rose-800 ${
              showSignOutOverlay ? "opacity-50" : "opacity-100"
            }`}
          >
            {showSignOutOverlay ? "Signing Out..." : "Sign Out"}
          </Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Legals Modal */}
      <LegalsModal
        visible={isLegalsModalVisible}
        onClose={() => setIsLegalsModalVisible(false)}
        isDarkMode={isDarkMode}
        router={router}
      />

      {/* Renew Subscription Modal */}
      <RenewSubscriptionModal
        visible={isRenewModalVisible}
        onClose={() => setIsRenewModalVisible(false)}
        isDarkMode={isDarkMode}
        onSelectPlan={handleSelectPlan}
        isSubmitting={isCreatingPayment}
      />

      {/* Sign Out Overlay */}
      <SignOutOverlay visible={showSignOutOverlay} />
    </View>
  )
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.5)", // Semi-transparent background
  },
  modalBackground: {
    position: "absolute",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
  },
  modalContent: {
    width: "80%",
    borderRadius: 20,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
});