import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import {
	View,
	Text,
	Image,
	TouchableOpacity,
	TextInput,
	FlatList,
	Alert,
	StatusBar,
	Modal,
	StyleSheet,
	Animated,
	Easing,
	TouchableWithoutFeedback,
	Dimensions,
  Platform
} from 'react-native'
import { supabase } from '@/utils/supabase'
import { FontAwesome, Ionicons } from '@expo/vector-icons'
import { useTheme } from '@/utils/ThemeContext'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { RefreshControl } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { useScrollToTop } from '@react-navigation/native'

import * as Location from 'expo-location'
import { BlurView } from 'expo-blur'

interface Dealership {
	id: number
	name: string
	logo: string
	total_cars?: number
	location?: string
	latitude: number
	longitude: number
	distance?: number
}
const { height: SCREEN_HEIGHT } = Dimensions.get('window')

const SORT_OPTIONS = {
	AZ: 'a-z',
	ZA: 'z-a',
	RANDOM: 'random',
	NEAREST: 'nearest'
} as const

type SortOption = (typeof SORT_OPTIONS)[keyof typeof SORT_OPTIONS]

const SortModal = ({
	visible,
	onClose,
	onSelect,
	currentSort,
	isDarkMode
}: any) => {
	const animation = useRef(new Animated.Value(0)).current

	useEffect(() => {
		if (visible) {
			Animated.timing(animation, {
				toValue: 1,
				duration: 300,
				easing: Easing.bezier(0.33, 1, 0.68, 1),
				useNativeDriver: true
			}).start()
		} else {
			Animated.timing(animation, {
				toValue: 0,
				duration: 200,
				easing: Easing.bezier(0.33, 1, 0.68, 1),
				useNativeDriver: true
			}).start()
		}
	}, [visible])

	const modalTranslateY = animation.interpolate({
		inputRange: [0, 1],
		outputRange: [SCREEN_HEIGHT, 0]
	})



	return (
		<Modal
			animationType='none'
			transparent={true}
			visible={visible}
			onRequestClose={onClose}>
			<View style={styles.modalOverlay}>
				<TouchableWithoutFeedback onPress={onClose}>
					<BlurView
						intensity={isDarkMode ? 50 : 80}
						tint={isDarkMode ? 'dark' : 'light'}
						style={StyleSheet.absoluteFill}
					/>
				</TouchableWithoutFeedback>
				<Animated.View
					style={[
						styles.modalContent,
						{
							transform: [{ translateY: modalTranslateY }],
							backgroundColor: isDarkMode ? '#1A1A1A' : '#FFFFFF'
						}
					]}>
					<View style={styles.modalHeader}>
						<View style={styles.dragIndicator} />
						<Text
							style={[styles.modalTitle, isDarkMode && styles.modalTitleDark]}>
							Sort Dealerships
						</Text>
					</View>
					{Object.entries(SORT_OPTIONS).map(([key, value]) => (
						<TouchableOpacity
							key={value}
							style={[
								styles.option,
								currentSort === value && styles.selectedOption,
								isDarkMode && styles.optionDark
							]}
							onPress={() => {
								onSelect(value)
								onClose()
							}}>
							<Text
								style={[
									styles.optionText,
									currentSort === value && styles.selectedOptionText,
									isDarkMode && styles.optionTextDark
								]}>
								{key}
							</Text>
							{currentSort === value && <View style={styles.checkmark} />}
						</TouchableOpacity>
					))}
				</Animated.View>
			</View>
		</Modal>
	)
}

const CustomHeader = React.memo(({ title }: { title: string }) => {
  const { isDarkMode } = useTheme();

  // Use a negative margin for iOS and a normal (or small positive) margin for Android
  const headerTitleMargin = Platform.OS === 'ios' ? '-mb-5' : 'mb-2';

  return (
    <SafeAreaView
      className={`bg-${isDarkMode ? 'black' : 'white'}`}

    >
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <View className="flex-row ml-6">
        <Text className={`text-2xl font-bold text-black dark:text-white ${headerTitleMargin}`}>
          {title}
        </Text>
      </View>
    </SafeAreaView>
  );
});

const DealershipCard = React.memo(({ item, onPress, isDarkMode, index }: any) => {
	const fadeAnim = useRef(new Animated.Value(0)).current;
	const translateY = useRef(new Animated.Value(50)).current;

	useEffect(() => {
	  Animated.parallel([
		Animated.timing(fadeAnim, {
		  toValue: 1,
		  duration: 500,
		  delay: index * 100,
		  useNativeDriver: true,
		}),
		Animated.timing(translateY, {
		  toValue: 0,
		  duration: 500,
		  delay: index * 100,
		  useNativeDriver: true,
		}),
	  ]).start();
	}, []);

	return (
	  <Animated.View
		style={{
		  opacity: fadeAnim,
		  transform: [{ translateY }],
		}}
	  >
		<TouchableOpacity
		  className={`mx-4 mb-4 rounded-2xl overflow-hidden ${
			isDarkMode ? 'bg-gray' : 'bg-white'
		  }`}
		  style={{
			shadowColor: '#000',
			shadowOffset: { width: 0, height: 2 },
			shadowOpacity: 0.1,
			shadowRadius: 8,
			elevation: 5,
		  }}
		  onPress={() => onPress(item)}
		>
		<LinearGradient
			colors={isDarkMode ? ['#1A1A1A', '#1A1A1A'] : ['#e6e6e6', '#e6e6e6']}
			className='p-4'>
			<View className='flex-row items-center'>
				<Image
					source={{ uri: item.logo }}
					className='w-16 h-16 rounded-full bg-gray-200'
				/>
				<View className='flex-1 ml-4'>
					<Text
						className={`text-lg font-bold ${
							isDarkMode ? 'text-white' : 'text-black'
						}`}>
						{item.name}
					</Text>
					{item.location && (
						<View className='flex-row items-center mt-1'>
							<Ionicons
								name='location-outline'
								size={14}
								color={isDarkMode ? '#CCC' : '#666'}
							/>
							<Text
								className={`ml-1 text-sm ${
									isDarkMode ? 'text-white' : 'text-textgray'
								}`}>
								{item.location}{' '}
								{item.distance && `• ${item.distance.toFixed(1)} km away`}
							</Text>
						</View>
					)}
					{item.total_cars !== undefined && (
						<View className='flex-row items-center mt-1'>
							<Ionicons
								name='car-outline'
								size={14}
								color={isDarkMode ? '#CCC' : '#666'}
							/>
							<Text
								className={`ml-1 text-sm ${
									isDarkMode ? 'text-white' : 'text-textgray'
								}`}>
								{item.total_cars} vehicles available
							</Text>
						</View>
					)}
				</View>
			</View>
		</LinearGradient>
	</TouchableOpacity>
	</Animated.View>
  );
});

export default function DealershipListPage() {
	const { isDarkMode } = useTheme()
	const [dealerships, setDealerships] = useState<Dealership[]>([])
	const [searchQuery, setSearchQuery] = useState('')
	const [refreshing, setRefreshing] = useState(false)
	const [isLoading, setIsLoading] = useState(true)
	const [sortBy, setSortBy] = useState<SortOption>(SORT_OPTIONS.RANDOM)
	const [showSortModal, setShowSortModal] = useState(false)
	const [userLocation, setUserLocation] =
		useState<Location.LocationObject | null>(null)
	const router = useRouter()
	const scrollRef = useRef(null)
	const DealershipSkeleton = React.memo(() => (
		<View
		  className={`mx-4 mb-4 rounded-2xl overflow-hidden`}
		  style={{
			shadowColor: '#000',
			shadowOffset: { width: 0, height: 2 },
			shadowOpacity: 0.1,
			shadowRadius: 8,
			elevation: 5,
		  }}
		>
		  <LinearGradient
			colors={['#f0f0f0', '#e0e0e0']}
			className='p-4'
		  >
			<View className='flex-row items-center'>
			  <View className='w-16 h-16 rounded-full bg-gray-300' />
			  <View className='flex-1 ml-4'>
				<View className='w-3/4 h-5 bg-gray-300 rounded' />
				<View className='w-1/2 h-4 bg-gray-300 rounded mt-2' />
				<View className='w-2/3 h-4 bg-gray-300 rounded mt-2' />
			  </View>
			</View>
		  </LinearGradient>
		</View>
	  ));

	// This hook will listen for tab re-press events and scroll the ref to top.
	useScrollToTop(scrollRef)
	// Get user location
	const getUserLocation = async () => {
		try {
			const { status } = await Location.requestForegroundPermissionsAsync()
			if (status !== 'granted') {
				Alert.alert('Permission denied', 'Unable to access location')
				return
			}

			const location = await Location.getCurrentPositionAsync({})
			setUserLocation(location)
		} catch (error) {
			console.error('Error getting location:', error)
		}
	}

	useEffect(() => {
		getUserLocation()
	}, [])

	// Calculate distance between two coordinates
	const calculateDistance = (
		lat1: number,
		lon1: number,
		lat2: number,
		lon2: number
	) => {
		const R = 6371 // Earth's radius in km
		const dLat = ((lat2 - lat1) * Math.PI) / 180
		const dLon = ((lon2 - lon1) * Math.PI) / 180
		const a =
			Math.sin(dLat / 2) * Math.sin(dLat / 2) +
			Math.cos((lat1 * Math.PI) / 180) *
				Math.cos((lat2 * Math.PI) / 180) *
				Math.sin(dLon / 2) *
				Math.sin(dLon / 2)
		const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
		return R * c
	}

	const fetchDealerships = useCallback(async () => {
		setIsLoading(true)
		try {
			const { data, error } = await supabase
				.from('dealerships')
				.select('*, cars(count)')

			if (error) throw error

			let formattedData =
				data?.map(dealer => ({
					...dealer,
					total_cars: dealer.cars?.[0]?.count || 0,
					distance: userLocation
						? calculateDistance(
								userLocation.coords.latitude,
								userLocation.coords.longitude,
								dealer.latitude,
								dealer.longitude
						  )
						: undefined
				})) || []

			setDealerships(formattedData)
		} catch (error) {
			console.error('Error fetching dealerships:', error)
			Alert.alert('Error', 'Failed to fetch dealerships')
		} finally {
			setIsLoading(false)
		}
	}, [userLocation])

	useEffect(() => {
		fetchDealerships()
	}, [fetchDealerships])

	const sortedAndFilteredDealerships = useMemo(() => {
		let filtered = dealerships.filter(dealership =>
			dealership.name.toLowerCase().includes(searchQuery.toLowerCase())
		)

		switch (sortBy) {
			case SORT_OPTIONS.AZ:
				return filtered.sort((a, b) => a.name.localeCompare(b.name))
			case SORT_OPTIONS.ZA:
				return filtered.sort((a, b) => b.name.localeCompare(a.name))
			case SORT_OPTIONS.RANDOM:
				return filtered.sort(() => Math.random() - 0.5)
			case SORT_OPTIONS.NEAREST:
				return filtered.sort((a, b) => (a.distance || 0) - (b.distance || 0))
			default:
				return filtered
		}
	}, [dealerships, searchQuery, sortBy])
	const onRefresh = useCallback(async () => {
		setRefreshing(true)
		await fetchDealerships()
		setRefreshing(false)
	}, [fetchDealerships])

	const filteredDealerships = useMemo(() => {
		return dealerships.filter(dealership =>
			dealership.name.toLowerCase().includes(searchQuery.toLowerCase())
		)
	}, [dealerships, searchQuery])

	const handleDealershipPress = useCallback(
		(dealership: Dealership) => {
			router.push({
				pathname: '/(home)/(user)/DealershipDetails',
				params: { dealershipId: dealership.id }
			})
		},
		[router]
	)

	const renderEmpty = useCallback(
		() => (
			<View className='flex-1 justify-center items-center py-20'>
				<Ionicons
					name='business-outline'
					size={50}
					color={isDarkMode ? '#FFFFFF' : '#000000'}
				/>
				<Text
					className={`${
						isDarkMode ? 'text-white' : 'text-black'
					} text-lg mt-4 text-center`}>
					No dealerships found
				</Text>
				<Text
					className={`${
						isDarkMode ? 'text-gray-400' : 'text-gray-600'
					} text-base mt-2 text-center`}>
					Try adjusting your search
				</Text>
			</View>
		),
		[isDarkMode]
	)

	return (
		<View className={`flex-1 ${isDarkMode ? 'bg-black' : 'bg-white'}`}>
			<CustomHeader title={'Dealerships'} />

			<View className='px-4 pb-3'>
				<View className='flex-row gap-2'>
					<View
						className={`flex-1 flex-row items-center rounded-full border border-[#ccc] dark:border-[#555] px-4
						`}>
						<FontAwesome
							name='search'
							size={20}
							color={isDarkMode ? 'white' : 'black'}
						/>
						<TextInput
							className={`flex-1 p-3 ${
								isDarkMode ? 'text-white' : 'text-black'
							}`}
							placeholder='Search Dealerships...'
							placeholderTextColor={isDarkMode ? 'lightgray' : 'gray'}
							value={searchQuery}
							onChangeText={setSearchQuery}
						/>
					</View>

					<TouchableOpacity
						onPress={() => setShowSortModal(true)}
						className={`items-center justify-center w-12 h-12`}>
						<FontAwesome
							name='sort'
							size={20}
							color={isDarkMode ? 'white' : 'black'}
						/>
					</TouchableOpacity>
				</View>
			</View>

			{isLoading ? (
  <FlatList
    data={[1, 2, 3, 4, 5]} // Show 5 skeleton items
    renderItem={() => <DealershipSkeleton />}
    keyExtractor={(item) => `skeleton-${item}`}
    contentContainerStyle={{
      paddingVertical: 8,
      flexGrow: 1,
    }}
  />
) : (
  <FlatList
    ref={scrollRef}
    data={sortedAndFilteredDealerships}
    renderItem={({ item, index }) => (
      <DealershipCard
        item={item}
        onPress={handleDealershipPress}
        isDarkMode={isDarkMode}
        index={index}
      />
    )}
    keyExtractor={item => `${item.id}`}
    ListEmptyComponent={renderEmpty}
    refreshControl={
      <RefreshControl
        refreshing={refreshing}
        onRefresh={onRefresh}
        colors={['#D55004']}
        tintColor={isDarkMode ? '#FFFFFF' : '#000000'}
      />
    }
   contentContainerStyle={{
    paddingVertical: 8,
    flexGrow: 1,
    paddingBottom: Platform.OS === 'android' ? 70 : 8, // Extra bottom padding for Android
  }}
  />
)}

			<SortModal
				visible={showSortModal}
				onClose={() => setShowSortModal(false)}
				onSelect={setSortBy}
				currentSort={sortBy}
				isDarkMode={isDarkMode}
			/>
		</View>
	)
}
const styles = StyleSheet.create({
	modalOverlay: {
		flex: 1,
		justifyContent: 'flex-end',
		backgroundColor: 'transparent'
	},
	modalContent: {
		borderTopLeftRadius: 24,
		borderTopRightRadius: 24,
		padding: 20,
		maxHeight: '80%',
		backgroundColor: '#FFFFFF',
		shadowColor: '#000',
		shadowOffset: {
			width: 0,
			height: -2
		},
		shadowOpacity: 0.25,
		shadowRadius: 8,
		elevation: 5
	},
	modalHeader: {
		alignItems: 'center',
		marginBottom: 20
	},
	dragIndicator: {
		width: 40,
		height: 4,
		backgroundColor: '#E0E0E0',
		borderRadius: 2,
		marginBottom: 16
	},
	modalTitle: {
		fontSize: 18,
		fontWeight: 'bold',
		color: '#333333'
	},
	modalTitleDark: {
		color: '#FFFFFF'
	},
	option: {
		flexDirection: 'row',
		alignItems: 'center',
		paddingVertical: 16,
		paddingHorizontal: 16,
		borderRadius: 12,
		marginBottom: 8
	},
	optionDark: {
		backgroundColor: 'rgba(255, 255, 255, 0.05)'
	},
	optionText: {
		fontSize: 16,
		color: '#333333',
		flex: 1
	},
	optionTextDark: {
		color: '#FFFFFF'
	},
	selectedOption: {
		backgroundColor: 'rgba(213, 80, 4, 0.1)'
	},
	selectedOptionText: {
		color: '#D55004',
		fontWeight: '600'
	},
	checkmark: {
		width: 10,
		height: 10,
		backgroundColor: '#D55004',
		borderRadius: 50,
		marginLeft: 8
	}
})
