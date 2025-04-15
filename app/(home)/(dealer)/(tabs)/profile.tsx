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
  TouchableOpacity
} from 'react-native'
import { useAuth } from '@/utils/AuthContext'
import * as ImagePicker from 'expo-image-picker'
import * as FileSystem from 'expo-file-system'
import * as Location from 'expo-location'
import { useTheme } from '@/utils/ThemeContext'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import { useScrollToTop } from '@react-navigation/native'
import { useDealershipProfile } from '../hooks/useDealershipProfile'
import { EditProfileModal } from '../EditProfileModal'
import { LocationModal } from '../LocationModal'
import { SecurityModal } from '../SecurityModal'
import { ProfileMenu } from '../ProfileMenu'
import { supabase } from '@/utils/supabase'
import { Buffer } from 'buffer'
import { coordinateSignOut } from '@/app/(home)/_layout'
import { SignOutOverlay } from '@/components/SignOutOverlay'

const SUBSCRIPTION_WARNING_DAYS = 7

interface FormData {
  name: string
  location: string
  phone: string
  logo: string
  latitude: string
  longitude: string
}

interface PasswordData {
  currentPassword: string
  newPassword: string
  confirmPassword: string
}

export default function DealershipProfilePage() {
  const { isDarkMode } = useTheme()
  const { user, profile, signOut, updatePassword } = useAuth()
  const router = useRouter()
  const scrollRef = useRef<ScrollView>(null)
  const mapRef = useRef(null)

  useScrollToTop(scrollRef)

  const { dealership, isLoading: isProfileLoading, fetchDealershipProfile } = useDealershipProfile()

  // State Management
  const [formData, setFormData] = useState<FormData>({
    name: '',
    location: '',
    phone: '',
    logo: '',
    latitude: '',
    longitude: ''
  })
  const [isUploading, setIsUploading] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [selectedLocation, setSelectedLocation] = useState<{
    latitude: number
    longitude: number
  } | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [passwordData, setPasswordData] = useState<PasswordData>({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  })
  const [showSignOutOverlay, setShowSignOutOverlay] = useState(false)

  // Modal States
  const [isEditProfileVisible, setIsEditProfileVisible] = useState(false)
  const [isLocationModalVisible, setIsLocationModalVisible] = useState(false)
  const [isSecurityModalVisible, setIsSecurityModalVisible] = useState(false)

  const [mapRegion, setMapRegion] = useState({
    latitude: 33.8547,
    longitude: 35.8623,
    latitudeDelta: 2,
    longitudeDelta: 2
  })

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

  // Initialize form data when dealership data is loaded
  React.useEffect(() => {
    if (dealership) {
      setFormData({
        name: dealership.name || '',
        location: dealership.location || '',
        phone: dealership.phone || '',
        logo: dealership.logo || '',
        latitude: dealership.latitude?.toString() || '',
        longitude: dealership.longitude?.toString() || ''
      })
    }
  }, [dealership])

  // Location handlers
  const getLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync()
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Please allow location access.')
        return
      }

      const location = await Location.getCurrentPositionAsync({})
      const { latitude, longitude } = location.coords

      setFormData(prev => ({
        ...prev,
        latitude: latitude.toString(),
        longitude: longitude.toString()
      }))
      setSelectedLocation({ latitude, longitude })
      setMapRegion({
        latitude,
        longitude,
        latitudeDelta: 0.0922,
        longitudeDelta: 0.0421
      })
    } catch (error) {
      Alert.alert('Error', 'Failed to get location')
    }
  }

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

      setFormData(prev => ({ ...prev, logo: publicURLData.publicUrl }))
      Alert.alert('Success', 'Logo updated successfully')
    } catch (error) {
      Alert.alert('Error', 'Failed to upload image')
    }
  }

  // Form handlers
  const updateProfile = async () => {
    if (!dealership?.id) return

    setIsLoading(true)
    try {
      const { error } = await supabase
        .from('dealerships')
        .update({
          name: formData.name,
          location: formData.location,
          phone: formData.phone,
          latitude: parseFloat(formData.latitude) || null,
          longitude: parseFloat(formData.longitude) || null
        })
        .eq('id', dealership.id)

      if (error) throw error
      Alert.alert('Success', 'Profile updated successfully')
      setIsEditProfileVisible(false)
    } catch (error) {
      Alert.alert('Error', 'Failed to update profile')
    } finally {
      setIsLoading(false)
    }
  }

  const handleChangePassword = async () => {
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      Alert.alert('Error', 'Passwords do not match')
      return
    }

    try {
      // Using the updatePassword method from AuthContext
      const { error } = await updatePassword({
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword
      })

      if (error) throw error

      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      })
      setIsSecurityModalVisible(false)
      Alert.alert('Success', 'Password updated successfully')
    } catch (error) {
      console.error('Error changing password:', error)
      Alert.alert('Error', 'Failed to update password')
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

  if (isProfileLoading) {
    return (
      <View className="flex-1 justify-center items-center">
        <ActivityIndicator size="large" color="#D55004" />
      </View>
    )
  }

  return (
    <ScrollView
      ref={scrollRef}
      className={`flex-1 ${isDarkMode ? 'bg-black' : 'bg-white'}`}
    >

      {/* Profile Header */}
      <View className="relative">
        <LinearGradient
          colors={isDarkMode ? ['#D55004', '#1a1a1a'] : ['#D55004', '#ff8c00']}
          className="pt-12 pb-24 rounded-b-[40px]"
        >

          <View className="items-center mt-6">
            <View className="relative">
              <Image
                source={{
                  uri: formData.logo || 'https://via.placeholder.com/150'
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
              {formData.name}
            </Text>
            <Text className="text-white/80 text-sm">{formData.location}</Text>
          </View>
        </LinearGradient>
      </View>

      {/* Menu Items */}
      <ProfileMenu
        isDarkMode={isDarkMode}
        onEditProfile={() => setIsEditProfileVisible(true)}
        onLocation={() => setIsLocationModalVisible(true)}
        onSecurity={() => setIsSecurityModalVisible(true)}
        subscriptionExpired={subscriptionExpired}
        daysUntilExpiration={daysUntilExpiration}
        onSignOut={handleSignOut}
      />

      {/* Modals */}
      <EditProfileModal
        visible={isEditProfileVisible}
        onClose={() => setIsEditProfileVisible(false)}
        isDarkMode={isDarkMode}
        formData={formData}
        setFormData={setFormData}
        onUpdate={updateProfile}
        isLoading={isLoading}
      />

      <LocationModal
        visible={isLocationModalVisible}
        onClose={() => setIsLocationModalVisible(false)}
        isDarkMode={isDarkMode}
        formData={formData}
        setFormData={setFormData}
        mapRef={mapRef}
        mapRegion={mapRegion}
        selectedLocation={selectedLocation}
        setSelectedLocation={setSelectedLocation}
        getLocation={getLocation}
        onUpdate={updateProfile}
        isLoading={isLoading}
      />

      <SecurityModal
        visible={isSecurityModalVisible}
        onClose={() => setIsSecurityModalVisible(false)}
        isDarkMode={isDarkMode}
        passwordData={passwordData}
        setPasswordData={setPasswordData}
        onUpdatePassword={handleChangePassword}
      />

      {/* Sign Out Overlay */}
      <SignOutOverlay visible={showSignOutOverlay} />
    </ScrollView>
  )
}