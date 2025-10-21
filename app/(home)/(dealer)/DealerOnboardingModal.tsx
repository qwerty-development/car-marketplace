import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/utils/supabase';
import { useTheme } from '@/utils/ThemeContext';
import { BlurView } from 'expo-blur';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useAuth } from '@/utils/AuthContext';
import MapView from 'react-native-maps';
import * as Location from 'expo-location';
import { DealerLogoPicker } from '@/components/DealerLogoPicker';
import { LocationModal } from './LocationModal';
import { useImageUpload } from './hooks/useImageUpload';
import { notifyDealershipProfileUpdated } from './hooks/dealershipProfileEvents';

interface DealerOnboardingModalProps {
  visible: boolean;
  dealershipId: number;
  onComplete: () => void;
}

interface DealershipForm {
  name: string;
  location: string;
  phone: string;
  subscriptionEndDate: Date;
  latitude: string;
  longitude: string;
  logo: string;
}

const DealerOnboardingModal: React.FC<DealerOnboardingModalProps> = ({
  visible,
  dealershipId,
  onComplete,
}) => {
  const { isDarkMode } = useTheme();
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [dealershipForm, setDealershipForm] = useState<DealershipForm>({
    name: '',
    location: '',
    phone: '',
    subscriptionEndDate: new Date(),
    latitude: '',
    longitude: '',
    logo: '',
  });
  const [errors, setErrors] = useState({
    name: '',
    location: '',
    phone: '',
    subscriptionEndDate: '',
  });
  const [isLocationModalVisible, setIsLocationModalVisible] = useState(false);
  const mapRef = useRef<MapView | null>(null);
  const [mapRegion, setMapRegion] = useState({
    latitude: 33.8547,
    longitude: 35.8623,
    latitudeDelta: 0.0922,
    longitudeDelta: 0.0421,
  });
  const [selectedLocation, setSelectedLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const {
    isUploading: isLogoUploading,
    handleImageUpload: triggerLogoUpload,
  } = useImageUpload(dealershipId ? String(dealershipId) : undefined);

  // Fetch existing dealership data when modal opens
  useEffect(() => {
    if (visible && dealershipId) {
      fetchDealershipData();
    }
  }, [visible, dealershipId]);

  const fetchDealershipData = async () => {
    try {
      setIsLoadingData(true);
      const { data, error } = await supabase
        .from('dealerships')
        .select('name, location, phone, subscription_end_date, latitude, longitude, logo')
        .eq('id', dealershipId)
        .single();

      if (error) throw error;

      if (data) {
        const latitudeValue =
          typeof data.latitude === 'number'
            ? data.latitude
            : data.latitude
            ? parseFloat(data.latitude)
            : null;
        const longitudeValue =
          typeof data.longitude === 'number'
            ? data.longitude
            : data.longitude
            ? parseFloat(data.longitude)
            : null;

        setDealershipForm({
          name: data.name || '',
          location: data.location || '',
          phone: data.phone || '',
          subscriptionEndDate: data.subscription_end_date
            ? new Date(data.subscription_end_date)
            : new Date(),
          latitude: latitudeValue !== null && !Number.isNaN(latitudeValue) ? latitudeValue.toString() : '',
          longitude: longitudeValue !== null && !Number.isNaN(longitudeValue) ? longitudeValue.toString() : '',
          logo: data.logo || '',
        });

        if (
          latitudeValue !== null &&
          longitudeValue !== null &&
          !Number.isNaN(latitudeValue) &&
          !Number.isNaN(longitudeValue)
        ) {
          setSelectedLocation({
            latitude: latitudeValue,
            longitude: longitudeValue,
          });
          setMapRegion((prev) => ({
            ...prev,
            latitude: latitudeValue,
            longitude: longitudeValue,
          }));
        } else {
          setSelectedLocation(null);
        }
      }
    } catch (error) {
      console.error('Error fetching dealership data:', error);
      Alert.alert('Error', 'Failed to load dealership information');
    } finally {
      setIsLoadingData(false);
    }
  };

  const validateForm = (): boolean => {
    const newErrors = {
      name: '',
      location: '',
      phone: '',
      subscriptionEndDate: '',
    };

    let isValid = true;

    if (!dealershipForm.name.trim()) {
      newErrors.name = 'Dealership name is required';
      isValid = false;
    }

    if (!dealershipForm.location.trim()) {
      newErrors.location = 'Location is required';
      isValid = false;
    } else if (!dealershipForm.latitude.trim() || !dealershipForm.longitude.trim()) {
      newErrors.location = 'Please select a location on the map';
      isValid = false;
    } else {
      const latitudeValue = parseFloat(dealershipForm.latitude);
      const longitudeValue = parseFloat(dealershipForm.longitude);

      if (!Number.isFinite(latitudeValue) || !Number.isFinite(longitudeValue)) {
        newErrors.location = 'Invalid coordinates. Please reselect the location.';
        isValid = false;
      }
    }

    if (!dealershipForm.phone.trim()) {
      newErrors.phone = 'Phone number is required';
      isValid = false;
    } else if (!/^\d{8,15}$/.test(dealershipForm.phone.replace(/[\s-]/g, ''))) {
      newErrors.phone = 'Please enter a valid phone number';
      isValid = false;
    }

    if (!dealershipForm.subscriptionEndDate) {
      newErrors.subscriptionEndDate = 'Subscription end date is required';
      isValid = false;
    }

    setErrors(newErrors);
    return isValid;
  };

  const handleLogoSelection = async () => {
    try {
      const uploadedLogo = await triggerLogoUpload();
      if (uploadedLogo) {
        setDealershipForm((prev) => ({
          ...prev,
          logo: uploadedLogo,
        }));
      }
    } catch (error) {
      console.error('Error uploading logo during onboarding:', error);
    }
  };

  const getLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permission Denied',
          'Please allow location access to select your dealership on the map.'
        );
        return;
      }

      const currentLocation = await Location.getCurrentPositionAsync({});
      const { latitude, longitude } = currentLocation.coords;

      setDealershipForm((prev) => ({
        ...prev,
        latitude: latitude.toString(),
        longitude: longitude.toString(),
      }));

      setSelectedLocation({
        latitude,
        longitude,
      });

      setMapRegion((prev) => ({
        ...prev,
        latitude,
        longitude,
      }));

      mapRef.current?.animateToRegion(
        {
          latitude,
          longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        },
        1000
      );
    } catch (error) {
      console.error('Error getting current location:', error);
      Alert.alert('Error', 'Failed to get current location. Please try again.');
    }
  };

  const handleLocationSave = async () => {
    if (!dealershipForm.location.trim()) {
      setErrors((prev) => ({
        ...prev,
        location: 'Location is required',
      }));
      return false;
    }

    const latitudeValue = parseFloat(dealershipForm.latitude);
    const longitudeValue = parseFloat(dealershipForm.longitude);

    if (!Number.isFinite(latitudeValue) || !Number.isFinite(longitudeValue)) {
      setErrors((prev) => ({
        ...prev,
        location: 'Please select a location on the map',
      }));
      return false;
    }

    setSelectedLocation({
      latitude: latitudeValue,
      longitude: longitudeValue,
    });

    setMapRegion((prev) => ({
      ...prev,
      latitude: latitudeValue,
      longitude: longitudeValue,
    }));

    setDealershipForm((prev) => ({
      ...prev,
      latitude: latitudeValue.toString(),
      longitude: longitudeValue.toString(),
    }));

    setErrors((prev) => ({
      ...prev,
      location: '',
    }));

    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      Alert.alert('Validation Error', 'Please fill in all required fields correctly');
      return;
    }

    if (!user?.id) {
      Alert.alert('Error', 'User information not found');
      return;
    }

    try {
      setIsLoading(true);

      const latitudeValue = parseFloat(dealershipForm.latitude);
      const longitudeValue = parseFloat(dealershipForm.longitude);

      const updateData = {
        name: dealershipForm.name.trim(),
        location: dealershipForm.location.trim(),
        phone: dealershipForm.phone.trim(),
        subscription_end_date: dealershipForm.subscriptionEndDate.toISOString().split('T')[0],
        latitude: Number.isFinite(latitudeValue) ? latitudeValue : null,
        longitude: Number.isFinite(longitudeValue) ? longitudeValue : null,
        logo: dealershipForm.logo || null,
        first_login: false, // Set to false after successful submission
        user_id: user.id,
      };

      const { error } = await supabase
        .from('dealerships')
        .update(updateData)
        .eq('id', dealershipId);

      if (error) throw error;

      notifyDealershipProfileUpdated();

      Alert.alert('Success', 'Dealership information updated successfully', [
        {
          text: 'OK',
          onPress: () => {
            onComplete();
          },
        },
      ]);
    } catch (error: any) {
      console.error('Error updating dealership:', error);
      Alert.alert('Error', error.message || 'Failed to update dealership information');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(Platform.OS === 'ios'); // Keep open on iOS, close on Android
    if (selectedDate) {
      setDealershipForm({ ...dealershipForm, subscriptionEndDate: selectedDate });
    }
  };

  const inputStyle = `w-full px-4 py-3.5 rounded-xl border mb-1 ${
    isDarkMode
      ? 'border-neutral-700 bg-neutral-800 text-white'
      : 'border-neutral-200 bg-neutral-50 text-black'
  }`;

  const errorTextStyle = `text-xs text-red-500 mb-3 ml-1`;
  const latitudeNumber = parseFloat(dealershipForm.latitude);
  const longitudeNumber = parseFloat(dealershipForm.longitude);
  const hasCoordinates =
    dealershipForm.latitude.trim().length > 0 &&
    dealershipForm.longitude.trim().length > 0 &&
    Number.isFinite(latitudeNumber) &&
    Number.isFinite(longitudeNumber);
  const coordinatesPreview = hasCoordinates
    ? `Lat: ${latitudeNumber.toFixed(4)}, Lon: ${longitudeNumber.toFixed(4)}`
    : null;

  if (isLoadingData) {
    return (
      <Modal visible={visible} transparent animationType="fade">
        <View className="flex-1 justify-center items-center bg-black/50">
          <ActivityIndicator size="large" color="#D55004" />
          <Text className="text-white mt-4">Loading dealership information...</Text>
        </View>
      </Modal>
    );
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={() => {
        // Prevent closing the modal by back button
        Alert.alert(
          'Complete Setup',
          'Please complete the dealership information before continuing.',
          [{ text: 'OK' }]
        );
      }}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <View className="flex-1 justify-center items-center">
          <BlurView
            intensity={isDarkMode ? 30 : 20}
            tint={isDarkMode ? 'dark' : 'light'}
            className="absolute inset-0"
          />

          <View
            className={`w-[90%] max-h-[85%] rounded-3xl ${
              isDarkMode ? 'bg-neutral-900' : 'bg-white'
            } p-6`}
          >
            {/* Header */}
            <View className="mb-6">
              <View className="flex-row items-center justify-center mb-2">
                <Ionicons
                  name="business"
                  size={32}
                  color="#D55004"
                />
              </View>
              <Text
                className={`text-2xl font-bold text-center ${
                  isDarkMode ? 'text-white' : 'text-black'
                }`}
              >
                Complete Your Profile
              </Text>
              <Text
                className={`text-sm text-center mt-2 ${
                  isDarkMode ? 'text-neutral-400' : 'text-neutral-600'
                }`}
              >
                Please fill in your dealership information to continue
              </Text>
            </View>

            {/* Form Fields */}
            <ScrollView 
              showsVerticalScrollIndicator={false}
              className="mb-4"
            >
              {/* Dealership Logo */}
              <View className="items-center mb-6">
                <DealerLogoPicker
                  logoUri={dealershipForm.logo}
                  onPick={handleLogoSelection}
                  isUploading={isLogoUploading}
                  size={112}
                  imageClassName={
                    isDarkMode ? 'border-4 border-neutral-700' : 'border-4 border-neutral-200'
                  }
                  badgeClassName={isDarkMode ? 'bg-neutral-800' : 'bg-white'}
                />
                <Text
                  className={`text-sm font-medium mt-3 ${
                    isDarkMode ? 'text-neutral-300' : 'text-neutral-700'
                  }`}
                >
                  Dealership Logo
                </Text>
                <Text
                  className={`text-xs text-center mt-1 ${
                    isDarkMode ? 'text-neutral-500' : 'text-neutral-500'
                  }`}
                >
                  Upload a logo to help customers recognize your brand.
                </Text>
              </View>

              {/* Dealership Name */}
              <View className="mb-3">
                <Text
                  className={`text-sm font-medium mb-2 ${
                    isDarkMode ? 'text-neutral-300' : 'text-neutral-700'
                  }`}
                >
                  Dealership Name *
                </Text>
                <TextInput
                  placeholder="Enter dealership name"
                  value={dealershipForm.name}
                  onChangeText={(text) => {
                    setDealershipForm({ ...dealershipForm, name: text });
                    setErrors({ ...errors, name: '' });
                  }}
                  className={inputStyle}
                  placeholderTextColor={isDarkMode ? '#9CA3AF' : '#6B7280'}
                  textAlignVertical="center"
                />
                {errors.name ? <Text className={errorTextStyle}>{errors.name}</Text> : null}
              </View>

              {/* Location */}
              <View className="mb-3">
                <Text
                  className={`text-sm font-medium mb-2 ${
                    isDarkMode ? 'text-neutral-300' : 'text-neutral-700'
                  }`}
                >
                  Location *
                </Text>
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => {
                    setErrors((prev) => ({ ...prev, location: '' }));
                    setIsLocationModalVisible(true);
                  }}
                  className={`${inputStyle} flex-col justify-center`}
                >
                  <View className="flex-row items-center justify-between">
                    <View className="flex-row items-center flex-1">
                      <Ionicons
                        name="location-outline"
                        size={18}
                        color="#D55004"
                        style={{ marginRight: 8 }}
                      />
                      <Text
                        className={`flex-1 ${
                          isDarkMode ? 'text-white' : 'text-black'
                        }`}
                        numberOfLines={2}
                      >
                        {dealershipForm.location.trim()
                          ? dealershipForm.location
                          : 'Tap to select your dealership location'}
                      </Text>
                    </View>
                    <Ionicons
                      name="map-outline"
                      size={20}
                      color={isDarkMode ? '#FFFFFF' : '#000000'}
                    />
                  </View>
                  <Text
                    className={`text-xs mt-2 ${
                      isDarkMode ? 'text-neutral-400' : 'text-neutral-500'
                    }`}
                  >
                    {coordinatesPreview ??
                      'Pick the location from the interactive map to finish setup.'}
                  </Text>
                </TouchableOpacity>
                {errors.location ? (
                  <Text className={errorTextStyle}>{errors.location}</Text>
                ) : null}
              </View>

              {/* Phone */}
              <View className="mb-3">
                <Text
                  className={`text-sm font-medium mb-2 ${
                    isDarkMode ? 'text-neutral-300' : 'text-neutral-700'
                  }`}
                >
                  Phone Number *
                </Text>
                <TextInput
                  placeholder="Enter phone number"
                  value={dealershipForm.phone}
                  onChangeText={(text) => {
                    setDealershipForm({ ...dealershipForm, phone: text });
                    setErrors({ ...errors, phone: '' });
                  }}
                  keyboardType="phone-pad"
                  className={inputStyle}
                  placeholderTextColor={isDarkMode ? '#9CA3AF' : '#6B7280'}
                  textAlignVertical="center"
                />
                {errors.phone ? <Text className={errorTextStyle}>{errors.phone}</Text> : null}
              </View>

              {/* Subscription End Date */}
              <View className="mb-3">
                <Text
                  className={`text-sm font-medium mb-2 ${
                    isDarkMode ? 'text-neutral-300' : 'text-neutral-700'
                  }`}
                >
                  Subscription End Date *
                </Text>
                <TouchableOpacity
                  onPress={() => setShowDatePicker(true)}
                  className={`${inputStyle} flex-row justify-between items-center`}
                >
                  <Text
                    className={isDarkMode ? 'text-white' : 'text-black'}
                  >
                    {dealershipForm.subscriptionEndDate.toLocaleDateString()}
                  </Text>
                  <Ionicons
                    name="calendar"
                    size={20}
                    color={isDarkMode ? '#FFFFFF' : '#000000'}
                  />
                </TouchableOpacity>
                {errors.subscriptionEndDate ? (
                  <Text className={errorTextStyle}>{errors.subscriptionEndDate}</Text>
                ) : null}
              </View>

              {showDatePicker && (
                <DateTimePicker
                  value={dealershipForm.subscriptionEndDate}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={handleDateChange}
                  minimumDate={new Date()}
                />
              )}

              {/* Info Box */}
              <View
                className={`p-4 rounded-xl mt-2 ${
                  isDarkMode ? 'bg-neutral-800' : 'bg-blue-50'
                }`}
              >
                <View className="flex-row items-start">
                  <Ionicons
                    name="information-circle"
                    size={20}
                    color={isDarkMode ? '#60A5FA' : '#3B82F6'}
                    style={{ marginRight: 8, marginTop: 2 }}
                  />
                  <Text
                    className={`flex-1 text-xs ${
                      isDarkMode ? 'text-neutral-300' : 'text-neutral-700'
                    }`}
                  >
                    All fields are required. This information will be displayed to potential
                    buyers and helps build trust in your dealership.
                  </Text>
                </View>
              </View>
            </ScrollView>

            {/* Submit Button */}
            <TouchableOpacity
              onPress={handleSubmit}
              disabled={isLoading}
              className={`py-4 rounded-xl ${
                isLoading ? 'bg-gray-400' : 'bg-red'
              } flex-row justify-center items-center`}
            >
              {isLoading ? (
                <>
                  <ActivityIndicator size="small" color="white" />
                  <Text className="text-white text-center font-semibold ml-2">
                    Updating...
                  </Text>
                </>
              ) : (
                <Text className="text-white text-center font-semibold">
                  Complete Setup
                </Text>
              )}
            </TouchableOpacity>

            {/* Required Fields Note */}
            <Text
              className={`text-xs text-center mt-3 ${
                isDarkMode ? 'text-neutral-500' : 'text-neutral-500'
              }`}
            >
              * All fields are required
            </Text>
          </View>
        </View>
      </KeyboardAvoidingView>
      <LocationModal
        visible={isLocationModalVisible}
        onClose={() => setIsLocationModalVisible(false)}
        isDarkMode={isDarkMode}
        formData={dealershipForm}
        setFormData={setDealershipForm}
        mapRef={mapRef}
        mapRegion={mapRegion}
        selectedLocation={selectedLocation}
        setSelectedLocation={setSelectedLocation}
        getLocation={getLocation}
        onUpdate={handleLocationSave}
        isLoading={isLoading}
      />
    </Modal>
  );
};

export default DealerOnboardingModal;
