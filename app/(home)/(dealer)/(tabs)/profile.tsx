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
import { useTheme } from '@/utils/ThemeContext'
import { useRouter } from 'expo-router'
import { Ionicons, Feather } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import { useScrollToTop } from '@react-navigation/native'
import { useDealershipProfile } from '../_hooks/useDealershipProfile'
import { useImageUpload } from '../_hooks/useImageUpload'
import { coordinateSignOut } from '@/utils/signOutState'
import { SignOutOverlay } from '@/components/SignOutOverlay'
import { DealerLogoPicker } from '@/components/DealerLogoPicker'
import Constants from 'expo-constants'
import { useTranslation } from 'react-i18next'
import { useLanguage } from '@/utils/LanguageContext'
import { useCredits } from '@/utils/CreditContext'
import { CreditBalance } from '@/components/CreditBalance'
import { PurchaseCreditsModal } from '@/components/PurchaseCreditsModal'

const SUBSCRIPTION_WARNING_DAYS = 7
const MODAL_HEIGHT_PERCENTAGE = 0.7;

// Subscription pricing configuration
const SUBSCRIPTION_PRICE_MONTHLY_USD = 250
const SUBSCRIPTION_PRICE_YEARLY_USD = 2500

// Enable/disable subscription renewal feature
const ENABLE_RENEW_SUBSCRIPTION = true

type RouterType = ReturnType<typeof useRouter>

type LegalsModalProps = {
  visible: boolean
  onClose: () => void
  isDarkMode: boolean
  router: RouterType
}

// New component for Legal Options Modal
const LegalsModal = ({ visible, onClose, isDarkMode, router }: LegalsModalProps) => {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const isRTL = language === 'ar';
  
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
          <View className={`flex-row ${isRTL ? 'flex-row-reverse' : ''} justify-between items-center mb-6`}>
            <Text className={`text-xl font-semibold ${isDarkMode ? 'text-white' : 'text-black'}`} style={{ textAlign: isRTL ? 'right' : 'left' }}>
              {t('profile.legal_documents')}
            </Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={isDarkMode ? '#fff' : '#000'} />
            </TouchableOpacity>
          </View>
          
          <TouchableOpacity 
            className={`flex-row ${isRTL ? 'flex-row-reverse' : ''} items-center p-4 mb-3 rounded-xl ${isDarkMode ? 'bg-neutral-800' : 'bg-neutral-100'}`}
            onPress={() => {
              onClose();
              router.push('/(home)/(dealer)/terms-of-service');
            }}
          >
            <Ionicons 
              name="document-text-outline" 
              size={22} 
              color="#D55004" 
              style={isRTL ? { marginLeft: 12 } : { marginRight: 12 }} 
            />
            <Text className={isDarkMode ? 'text-white' : 'text-black'} style={{ textAlign: isRTL ? 'right' : 'left', flex: 1 }}>
              {t('profile.terms_of_service')}
            </Text>
            <Ionicons 
              name={isRTL ? "chevron-back" : "chevron-forward"} 
              size={20} 
              color={isDarkMode ? '#ddd' : '#999'} 
            />
          </TouchableOpacity>
          
          <TouchableOpacity 
            className={`flex-row ${isRTL ? 'flex-row-reverse' : ''} items-center p-4 mb-3 rounded-xl ${isDarkMode ? 'bg-neutral-800' : 'bg-neutral-100'}`}
            onPress={() => {
              onClose();
              router.push('/(home)/(dealer)/privacy-policy');
            }}
          >
            <Ionicons 
              name="shield-checkmark-outline" 
              size={22} 
              color="#D55004" 
              style={isRTL ? { marginLeft: 12 } : { marginRight: 12 }} 
            />
            <Text className={isDarkMode ? 'text-white' : 'text-black'} style={{ textAlign: isRTL ? 'right' : 'left', flex: 1 }}>
              {t('profile.privacy_policy')}
            </Text>
            <Ionicons 
              name={isRTL ? "chevron-back" : "chevron-forward"} 
              size={20} 
              color={isDarkMode ? '#ddd' : '#999'} 
            />
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
  t: any
}

type RenewSubscriptionModalProps = {
	visible: boolean
	onClose: () => void
	isDarkMode: boolean
	onSelectPlan: (plan: 'monthly' | 'yearly') => void
	isSubmitting: boolean
}

const RenewSubscriptionModal = ({ visible, onClose, isDarkMode, onSelectPlan, isSubmitting }: RenewSubscriptionModalProps) => {
	const { language } = useLanguage();
	const { t } = useTranslation();
	const isRTL = language === 'ar';
	
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
					<View className={`flex-row ${isRTL ? 'flex-row-reverse' : ''} justify-between items-center mb-6`}>
						<Text className={`text-xl font-semibold ${isDarkMode ? 'text-white' : 'text-black'}`} style={{ textAlign: isRTL ? 'right' : 'left' }}>
							{t('subscription.renew_subscription', 'Renew Subscription')}
						</Text>
						<TouchableOpacity onPress={onClose}>
							<Ionicons name="close" size={24} color={isDarkMode ? '#fff' : '#000'} />
						</TouchableOpacity>
					</View>

					<Text className={`${isDarkMode ? 'text-white/80' : 'text-gray-600'} mb-4`} style={{ textAlign: isRTL ? 'right' : 'left' }}>
						{t('subscription.choose_plan_message', 'Choose a plan to proceed with payment via Whish (sandbox)')}
					</Text>

					<TouchableOpacity
						className={`p-4 rounded-xl mb-3 flex-row ${isRTL ? 'flex-row-reverse' : ''} items-center ${isDarkMode ? 'bg-neutral-800' : 'bg-neutral-100'}`}
						disabled={isSubmitting}
						onPress={() => onSelectPlan('monthly')}
					>
						<View className={`w-10 h-10 rounded-full bg-blue-500/10 items-center justify-center ${isRTL ? 'ml-3' : 'mr-3'}`}>
							<Ionicons name="calendar-outline" size={22} color="#3b82f6" />
						</View>
						<View style={{ flex: 1 }}>
							<Text className={`font-semibold ${isDarkMode ? 'text-white' : 'text-black'}`} style={{ textAlign: isRTL ? 'right' : 'left' }}>
								{t('subscription.monthly_plan', 'Monthly Plan')}
							</Text>
							<Text className={`${isDarkMode ? 'text-white/60' : 'text-gray-500'} text-xs`} style={{ textAlign: isRTL ? 'right' : 'left' }}>
								${SUBSCRIPTION_PRICE_MONTHLY_USD} {t('subscription.per_month', '/ month')}
							</Text>
						</View>
						{isSubmitting && <ActivityIndicator size="small" color="#3b82f6" />}
					</TouchableOpacity>

					<TouchableOpacity
						className={`p-4 rounded-xl flex-row ${isRTL ? 'flex-row-reverse' : ''} items-center ${isDarkMode ? 'bg-neutral-800' : 'bg-neutral-100'}`}
						disabled={isSubmitting}
						onPress={() => onSelectPlan('yearly')}
					>
						<View className={`w-10 h-10 rounded-full bg-emerald-500/10 items-center justify-center ${isRTL ? 'ml-3' : 'mr-3'}`}>
							<Ionicons name="ribbon-outline" size={22} color="#10b981" />
						</View>
						<View style={{ flex: 1 }}>
							<Text className={`font-semibold ${isDarkMode ? 'text-white' : 'text-black'}`} style={{ textAlign: isRTL ? 'right' : 'left' }}>
								{t('subscription.yearly_plan', 'Yearly Plan')}
							</Text>
							<Text className={`${isDarkMode ? 'text-white/60' : 'text-gray-500'} text-xs`} style={{ textAlign: isRTL ? 'right' : 'left' }}>
								${SUBSCRIPTION_PRICE_YEARLY_USD} {t('subscription.per_year', '/ year')}
							</Text>
						</View>
						{isSubmitting && <ActivityIndicator size="small" color="#10b981" />}
					</TouchableOpacity>
				</View>
			</View>
		</Modal>
	)
}

// Subscription Banner Component
const SubscriptionBanner = ({ isDarkMode, subscriptionExpired, showWarning, daysUntilExpiration, onRenewPress, t }: SubscriptionBannerProps) => {
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
  
  // Use language context for RTL
  const language = typeof t === 'function' && t('language.code') ? t('language.code') : (typeof t === 'string' ? t : 'en');
  const isRTL = language === 'ar';
  return (
    <LinearGradient
      colors={isDarkMode ? ['#1A3A1A', '#0F2A0F'] : ['#EFFFF0', '#E0FFE5']}
      className="p-4 rounded-xl shadow-sm overflow-hidden"
    >
      {isRTL ? (
        <View className="flex-row items-center justify-between w-full">
          {/* Renew button right */}
          <TouchableOpacity 
            className="bg-green-600 px-3 py-2 rounded-lg" 
            onPress={onRenewPress}
            style={{ marginLeft: 0, marginRight: 0 }}
          >
            <Text className="text-white font-medium text-sm">{t('subscription.renew')}</Text>
          </TouchableOpacity>
          {/* Subscription text left */}
          <View className="flex-row items-center" style={{ flex: 1, justifyContent: 'flex-start' }}>
            <View className="w-10 h-10 rounded-full bg-green-500/20 items-center justify-center ml-3">
              <Ionicons name="checkmark-circle" size={24} color="#10b981" />
            </View>
            <View>
              <Text className={`font-semibold ${isDarkMode ? "text-white" : "text-gray-800"}`} style={{ textAlign: 'left' }}>{t('subscription.active')}</Text>
              <Text className={`text-xs ${isDarkMode ? "text-green-400" : "text-green-600"}`} style={{ textAlign: 'left' }}>{daysUntilExpiration !== null ? t('subscription.days_remaining', { days: daysUntilExpiration }) : t('subscription.active')}</Text>
            </View>
          </View>
        </View>
      ) : (
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center">
            <View className="w-10 h-10 rounded-full bg-green-500/20 items-center justify-center mr-3">
              <Ionicons name="checkmark-circle" size={24} color="#10b981" />
            </View>
            <View>
              <Text className={`font-semibold ${isDarkMode ? "text-white" : "text-gray-800"}`}>{t('subscription.active')}</Text>
              <Text className={`text-xs ${isDarkMode ? "text-green-400" : "text-green-600"}`}>{daysUntilExpiration !== null ? t('subscription.days_remaining', { days: daysUntilExpiration }) : t('subscription.active')}</Text>
            </View>
          </View>
          {ENABLE_RENEW_SUBSCRIPTION && (
            <TouchableOpacity 
              className="bg-green-600 px-3 py-2 rounded-lg" 
              onPress={onRenewPress}
            >
              <Text className="text-white font-medium text-sm">{t('subscription.renew')}</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </LinearGradient>
  );
};

export default function DealershipProfilePage() {
  const { isDarkMode } = useTheme()
  const { user, profile, signOut } = useAuth()
  const { t } = useTranslation()
  const { language, setLanguage } = useLanguage()
  const router = useRouter()
  const scrollRef = useRef<ScrollView>(null)
  const mapRef = useRef(null)
  const isRTL = language === 'ar'

  useScrollToTop(scrollRef)

  const { dealership, isLoading: isProfileLoading, fetchDealershipProfile } = useDealershipProfile()
  const { refreshBalance } = useCredits()
  const {
    isUploading: isLogoUploading,
    handleImageUpload: handleLogoUpload,
  } = useImageUpload(
    dealership?.id ? String(dealership.id) : undefined,
    {
      persistLogo: true,
      onUploadComplete: async () => {
        await fetchDealershipProfile()
        Alert.alert(t('common.success'), t('profile.logo_updated_successfully'))
      },
      onUploadError: () => {
        Alert.alert(t('common.error'), t('profile.failed_to_upload_image'))
      },
    }
  )

  // State Management
  const [isLegalsModalVisible, setIsLegalsModalVisible] = useState(false)
  const [isRenewModalVisible, setIsRenewModalVisible] = useState(false)
  const [isCreatingPayment, setIsCreatingPayment] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [showSignOutOverlay, setShowSignOutOverlay] = useState(false)
  const [showPurchaseModal, setShowPurchaseModal] = useState(false)

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
        t('profile.switch_to_customer_view'),
        t('profile.switch_to_customer_message'),
        [
          {
            text: t('common.cancel'),
            style: "cancel"
          },
          {
            text: t('common.continue'),
            onPress: async () => {
              try {
                // Navigate to user interface
                router.replace('/(home)/(user)' as any);
              } catch (error) {
                console.error('Error navigating to user interface:', error);
                Alert.alert(t('common.error'), t('profile.navigation_failed'));
              }
            }
          }
        ]
      );
    } catch (error) {
      console.error('Error switching to user interface:', error);
      Alert.alert(t('common.error'), t('profile.something_went_wrong'));
    }
  };

  // Image handling
  const pickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
      if (status !== 'granted') {
        Alert.alert(t('permissions.denied'), t('permissions.photo_access_required'))
        return
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 1,
        legacy: true, // Allow browsing files outside photo library (includes file managers, cloud storage, etc.)
      })

      if (!result.canceled && result.assets?.[0]) {
        await handleLogoUpload(result.assets[0].uri)
      }
    } catch (error) {
      Alert.alert(t('common.error'), t('profile.failed_to_pick_image'))
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

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    try {
      await Promise.all([
        fetchDealershipProfile(),
        refreshBalance()
      ])
    } finally {
      setRefreshing(false)
    }
  }, [fetchDealershipProfile])

  const handleSelectPlan = useCallback(async (plan: 'monthly' | 'yearly') => {
    try {
      setIsCreatingPayment(true)
      
      if (!dealership?.id) {
        Alert.alert(t('common.error'), t('profile.dealership_id_not_found'))
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
          t('subscription.proceed_to_payment'),
          t('subscription.payment_redirect_message'),
          [
            {
              text: t('subscription.open_payment_page'),
              onPress: () => {
                Linking.openURL(data.collectUrl)
              }
            },
            { text: t('common.cancel'), style: 'cancel' }
          ]
        )
      } else {
        Alert.alert(t('common.error'), t('profile.no_payment_url_received'))
      }
    } catch (error: any) {
      console.error('Payment error:', error)
      Alert.alert(t('common.error'), error.message || t('profile.failed_to_create_payment'))
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
    <View style={{ flex: 1, backgroundColor: isDarkMode ? "#000000" : "#FFFFFF", writingDirection: isRTL ? 'rtl' : 'ltr' }}>
      <ScrollView
        ref={scrollRef}
        className={`flex-1 ${isDarkMode ? "bg-black" : "bg-white"} mb-16`}
        contentContainerStyle={{ writingDirection: isRTL ? 'rtl' : 'ltr' }}
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
              <DealerLogoPicker
                logoUri={dealership?.logo}
                onPick={pickImage}
                isUploading={isLogoUploading}
                size={128}
                isRTL={isRTL}
              />

              <Text className="text-white text-xl font-semibold mt-4" style={{ textAlign: 'center' }}>
                {dealership?.name}
              </Text>
              <Text className="text-white/80 text-sm" style={{ textAlign: 'center' }}>
                {dealership?.location}
              </Text>

              {/* Language Selection Button */}
              <TouchableOpacity
                onPress={() => setLanguage(language === 'en' ? 'ar' : 'en')}
                className={`mt-4 bg-white/20 backdrop-blur-sm px-4 py-2 rounded-full flex-row ${isRTL ? 'flex-row-reverse' : ''} items-center border border-white/30`}
              >
                <Ionicons
                  name="language-outline"
                  size={18}
                  color="white"
                  style={isRTL ? { marginLeft: 6 } : { marginRight: 6 }}
                />
                <Text className="text-white font-medium text-sm">
                  {language === 'en' ? t('language.arabic') : t('language.english')}
                </Text>
              </TouchableOpacity>

              {/* Customer View Button */}
              <TouchableOpacity
                onPress={handleUserInterfaceRedirect}
                className={`mt-4 bg-white/20 backdrop-blur-sm px-6 py-3 rounded-full flex-row ${isRTL ? 'flex-row-reverse' : ''} items-center border border-white/30`}
              >
                <Ionicons
                  name="storefront-outline"
                  size={20}
                  color="white"
                  style={isRTL ? { marginLeft: 8 } : { marginRight: 8 }}
                />
                <Text className="text-white font-semibold">
                  {t('dealership.browse_as_customer')}
                </Text>
              </TouchableOpacity>
            </View>
          </LinearGradient>
        </View>

        {/* Subscription Banner */}
        <View className="px-6 mt-4 mb-4">
          <SubscriptionBanner
            isDarkMode={isDarkMode}
            subscriptionExpired={subscriptionExpired}
            showWarning={showWarning}
            daysUntilExpiration={daysUntilExpiration}
            router={router}
            onRenewPress={() => setIsRenewModalVisible(true)}
            t={t}
          />
        </View>

        <View className="px-6 mb-6">
          <CreditBalance
            isDarkMode={isDarkMode}
            onPurchasePress={() => setShowPurchaseModal(true)}
            isRTL={isRTL}
          />
        </View>

        {/* Menu Items - Styled like User Profile */}
        <View className="space-y-4 px-6">
          {/* Edit Profile & Location Button */}
          <TouchableOpacity
            onPress={() => router.push(`/(home)/(dealer)/EditProfile?dealershipId=${dealership?.id}`)}
            className={`${isDarkMode ? "bg-neutral-800" : "bg-neutral-200"}
              p-4 rounded-xl shadow-sm flex-row items-center ${
                isRTL ? 'flex-row-reverse' : ''
              }`}
          >
            <View className="w-10 h-10 rounded-full bg-blue-500/10 items-center justify-center">
              <Ionicons name="person-outline" size={24} color="#3b82f6" />
            </View>
            <View className={`flex-1 ${isRTL ? 'mr-3' : 'ml-3'}`}>
              <Text className={`font-semibold ${isDarkMode ? "text-white" : "text-black"} ${
                isRTL ? 'text-right' : 'text-left'
              }`}>
                {t('profile.edit_profile_and_location')}
              </Text>
              <Text className={`text-xs mt-1 ${isDarkMode ? "text-white/60" : "text-gray-500"} ${
                isRTL ? 'text-right' : 'text-left'
              }`}>
                {t('profile.update_dealership_info')}
              </Text>
            </View>
            <Ionicons
              name={isRTL ? "chevron-back" : "chevron-forward"}
              size={24}
              color={isDarkMode ? "#fff" : "#000"}
            />
          </TouchableOpacity>

          {/* Security Button */}
          <TouchableOpacity
            onPress={() => router.push('/(home)/(dealer)/ChangePassword')}
            className={`${isDarkMode ? "bg-neutral-800" : "bg-neutral-200"}
              p-4 rounded-xl shadow-sm flex-row items-center ${
                isRTL ? 'flex-row-reverse' : ''
              }`}
          >
            <View className="w-10 h-10 rounded-full bg-purple-500/10 items-center justify-center">
              <Ionicons name="lock-closed-outline" size={24} color="#9333ea" />
            </View>
            <View className={`flex-1 ${isRTL ? 'mr-3' : 'ml-3'}`}>
              <Text className={`font-semibold ${isDarkMode ? "text-white" : "text-black"} ${
                isRTL ? 'text-right' : 'text-left'
              }`}>
                {t('profile.security_settings')}
              </Text>
              <Text className={`text-xs mt-1 ${isDarkMode ? "text-white/60" : "text-gray-500"} ${
                isRTL ? 'text-right' : 'text-left'
              }`}>
                {t('profile.update_password_security')}
              </Text>
            </View>
            <Ionicons
              name={isRTL ? "chevron-back" : "chevron-forward"}
              size={24}
              color={isDarkMode ? "#fff" : "#000"}
            />
          </TouchableOpacity>

          {/* Sales History Button */}
          <TouchableOpacity
            onPress={() => router.push('/(home)/(dealer)/(tabs)/sales-history')}
            className={`${isDarkMode ? "bg-neutral-800" : "bg-neutral-200"}
              p-4 rounded-xl shadow-sm flex-row items-center ${
                isRTL ? 'flex-row-reverse' : ''
              }`}
          >
            <View className="w-10 h-10 rounded-full bg-orange-500/10 items-center justify-center">
              <Ionicons name="receipt-outline" size={24} color="#D55004" />
            </View>
            <View className={`flex-1 ${isRTL ? 'mr-3' : 'ml-3'}`}>
              <Text className={`font-semibold ${isDarkMode ? "text-white" : "text-black"} ${
                isRTL ? 'text-right' : 'text-left'
              }`}>
                {t('profile.sales.sales_history', t('navbar.sales_history'))}
              </Text>
              <Text className={`text-xs mt-1 ${isDarkMode ? "text-white/60" : "text-gray-500"} ${
                isRTL ? 'text-right' : 'text-left'
              }`}>
                {t('profile.sales.sales_overview', 'Sales Overview')}
              </Text>
            </View>
            <Ionicons
              name={isRTL ? "chevron-back" : "chevron-forward"}
              size={24}
              color={isDarkMode ? "#fff" : "#000"}
            />
          </TouchableOpacity>

          {/* Analytics Button */}
          <TouchableOpacity
            onPress={() => router.push('/(home)/(dealer)/analytics')}
            className={`${isDarkMode ? "bg-neutral-800" : "bg-neutral-200"}
              p-4 rounded-xl shadow-sm flex-row items-center ${
                isRTL ? 'flex-row-reverse' : ''
              }`}
          >
            <View className="w-10 h-10 rounded-full bg-green-500/10 items-center justify-center">
              <Ionicons name="bar-chart-outline" size={24} color="#10b981" />
            </View>
            <View className={`flex-1 ${isRTL ? 'mr-3' : 'ml-3'}`}>
              <Text className={`font-semibold ${isDarkMode ? "text-white" : "text-black"} ${
                isRTL ? 'text-right' : 'text-left'
              }`}>
                {t('profile.analytics_dashboard')}
              </Text>
              <Text className={`text-xs mt-1 ${isDarkMode ? "text-white/60" : "text-gray-500"} ${
                isRTL ? 'text-right' : 'text-left'
              }`}>
                {t('profile.view_statistics_reports')}
              </Text>
            </View>
            <Ionicons
              name={isRTL ? "chevron-back" : "chevron-forward"}
              size={24}
              color={isDarkMode ? "#fff" : "#000"}
            />
          </TouchableOpacity>



          {/* Legals Button */}
          <TouchableOpacity
            onPress={() => setIsLegalsModalVisible(true)}
            className={`${isDarkMode ? "bg-neutral-800" : "bg-neutral-200"}
              p-4 rounded-xl shadow-sm flex-row items-center ${
                isRTL ? 'flex-row-reverse' : ''
              }`}
          >
            <View className="w-10 h-10 rounded-full bg-amber-500/10 items-center justify-center">
              <Ionicons name="document-text-outline" size={24} color="#f59e0b" />
            </View>
            <View className={`flex-1 ${isRTL ? 'mr-3' : 'ml-3'}`}>
              <Text className={`font-semibold ${isDarkMode ? "text-white" : "text-black"} ${
                isRTL ? 'text-right' : 'text-left'
              }`}>
                {t('profile.legal')}
              </Text>
              <Text className={`text-xs mt-1 ${isDarkMode ? "text-white/60" : "text-gray-500"} ${
                isRTL ? 'text-right' : 'text-left'
              }`}>
                {t('profile.privacy_and_terms')}
              </Text>
            </View>
            <Ionicons
              name={isRTL ? "chevron-back" : "chevron-forward"}
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
            style={{ textAlign: isRTL ? 'right' : 'left' }}
          >
            {t('profile.support_help')}
          </Text>

          <TouchableOpacity
            onPress={() => Linking.openURL('https://wa.me/70993415')}
            className={`${isDarkMode ? "bg-neutral-800" : "bg-neutral-200"}
              p-4 rounded-xl shadow-sm flex-row items-center ${
                isRTL ? 'flex-row-reverse' : ''
              }`}
          >
            <View className="w-10 h-10 rounded-full bg-green-500/10 items-center justify-center">
              <Feather name="message-circle" size={22} color="#22c55e" />
            </View>
            <View className={`flex-1 ${isRTL ? 'mr-3' : 'ml-3'}`}>
              <Text className={`font-semibold ${isDarkMode ? "text-white" : "text-black"} ${
                isRTL ? 'text-right' : 'text-left'
              }`}>
                {t('profile.whatsapp_support')}
              </Text>
              <Text className={`text-xs mt-1 ${isDarkMode ? "text-white/60" : "text-gray-500"} ${
                isRTL ? 'text-right' : 'text-left'
              }`}>
                {t('profile.available_24_7')}
              </Text>
            </View>
            <Ionicons
              name={isRTL ? "chevron-back" : "chevron-forward"}
              size={24}
              color={isDarkMode ? "#fff" : "#000"}
            />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => Linking.openURL('mailto:info@notqwerty.com?subject=Dealer Support Request')}
            className={`${isDarkMode ? "bg-neutral-800" : "bg-neutral-200"}
              p-4 rounded-xl shadow-sm flex-row items-center ${
                isRTL ? 'flex-row-reverse' : ''
              }`}
          >
            <View className="w-10 h-10 rounded-full bg-blue-500/10 items-center justify-center">
              <Feather name="mail" size={22} color="#3b82f6" />
            </View>
            <View className={`flex-1 ${isRTL ? 'mr-3' : 'ml-3'}`}>
              <Text className={`font-semibold ${isDarkMode ? "text-white" : "text-black"} ${
                isRTL ? 'text-right' : 'text-left'
              }`}>
                {t('profile.email_support')}
              </Text>
              <Text className={`text-xs mt-1 ${isDarkMode ? "text-white/60" : "text-gray-500"} ${
                isRTL ? 'text-right' : 'text-left'
              }`}>
                {t('profile.detailed_inquiries')}
              </Text>
            </View>
            <Ionicons
              name={isRTL ? "chevron-back" : "chevron-forward"}
              size={24}
              color={isDarkMode ? "#fff" : "#000"}
            />
          </TouchableOpacity>
        </View>

        {/* Version Information */}
        <Text
          className="text-center mt-8"
          style={{ 
            fontSize: 12, 
            color: isDarkMode ? "#777" : "#999",
            textAlign: 'center'
          }}
        >
          {t('profile.version')} {Constants.expoConfig?.version || "1.0.0"}
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
            style={{ textAlign: 'center' }}
          >
            {showSignOutOverlay ? t('profile.signing_out') : t('profile.sign_out')}
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

      <PurchaseCreditsModal
        visible={showPurchaseModal}
        onClose={() => setShowPurchaseModal(false)}
        isDarkMode={isDarkMode}
        isRTL={isRTL}
        onSuccess={() => {
          setShowPurchaseModal(false);
        }}
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
