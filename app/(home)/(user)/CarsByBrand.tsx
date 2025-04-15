import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
	View,
	FlatList,
	ActivityIndicator,
	TouchableOpacity,
	Dimensions,
	Text,
	StatusBar,
	RefreshControl,
	Platform,
	Image
} from 'react-native'
import { useRouter, useLocalSearchParams, Stack } from 'expo-router'
import CarCard from '@/components/CarCard'
import CarDetailModal from './CarDetailModal'
import CarDetailModalIOS from './CarDetailModal.ios'
import { supabase } from '@/utils/supabase'
import { useFavorites } from '@/utils/useFavorites'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '@/utils/ThemeContext'
import { SafeAreaView } from 'react-native-safe-area-context'

const { height: SCREEN_HEIGHT } = Dimensions.get('window')
const TAB_BAR_HEIGHT = 50
const CAR_CARD_HEIGHT = SCREEN_HEIGHT - TAB_BAR_HEIGHT

// Brand logo fetching function (copied from AllBrandsPage)
const getLogoUrl = (make: string, isLightMode: boolean) => {
  const formattedMake = make.toLowerCase().replace(/\s+/g, "-");
  switch (formattedMake) {
    case "range-rover":
      return isLightMode
        ? "https://www.carlogos.org/car-logos/land-rover-logo-2020-green.png"
        : "https://www.carlogos.org/car-logos/land-rover-logo.png";
    case "infiniti":
      return "https://www.carlogos.org/car-logos/infiniti-logo.png";
    case "audi":
      return "https://www.freepnglogos.com/uploads/audi-logo-2.png";
    case "nissan":
      return "https://cdn.freebiesupply.com/logos/large/2x/nissan-6-logo-png-transparent.png";
    case "jetour":
      return "https://1000logos.net/wp-content/uploads/2023/12/Jetour-Logo.jpg";
    default:
      return `https://www.carlogos.org/car-logos/${formattedMake}-logo.png`;
  }
};

const CustomHeader = React.memo(
	({ title, onBack, brandName }: { title: string; onBack: () => void; brandName?: string }) => {
		const { isDarkMode } = useTheme()
		const iconColor = isDarkMode ? '#D55004' : '#FF8C00'
		const logoUrl = brandName ? getLogoUrl(brandName, !isDarkMode) : null;

		return (
			<SafeAreaView
				edges={['top']}
				className={`bg-${isDarkMode ? 'black' : 'white'}`}>
				<StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
				<View className='flex-row items-center pb-4 px-4'>
					<TouchableOpacity onPress={onBack}>
						<Ionicons name='arrow-back' size={24} color={iconColor} />
					</TouchableOpacity>
					{logoUrl && (
						<Image
							source={{ uri: logoUrl }}
							style={{ width: 40, height: 40, marginLeft: 12 }}
							resizeMode="contain"
						/>
					)}
					<Text
						className={`ml-4 text-lg font-bold ${
							isDarkMode ? 'text-white' : 'text-black'
						}`}>
						{title}
					</Text>
				</View>
			</SafeAreaView>
		)
	}
)

export default function CarsByBrand() {
	const { isDarkMode } = useTheme()
	const router = useRouter()
	const { brand } = useLocalSearchParams<{ brand: string }>()
	const [cars, setCars] = useState<any[]>([])
	const [isLoading, setIsLoading] = useState(true)
	const { isFavorite, toggleFavorite } = useFavorites()
	const [selectedCar, setSelectedCar] = useState<any>(null)
	const [isModalVisible, setIsModalVisible] = useState(false)
	const [refreshing, setRefreshing] = useState(false)

	const fetchCarsByBrand = useCallback(async (brandName: string) => {
		setIsLoading(true)
		try {
			const { data, error } = await supabase
				.from('cars')
				.select(`*, dealerships (name,logo,phone,location,latitude,longitude)`)
				.eq('status', 'available')
				.eq('make', brandName)

			if (error) throw error

			const carsData =
				data?.map(item => ({
					...item,
					dealership_name: item.dealerships.name,
					dealership_logo: item.dealerships.logo,
					dealership_phone: item.dealerships.phone,
					dealership_location: item.dealerships.location,
					dealership_latitude: item.dealerships.latitude,
					dealership_longitude: item.dealerships.longitude
				})) || []
			setCars(carsData)
		} catch (error) {
			console.error('Error fetching cars by brand:', error)
		} finally {
			setIsLoading(false)
		}
	}, [])

	const onRefresh = useCallback(() => {
		setRefreshing(true)
		if (brand) {
			fetchCarsByBrand(brand).then(() => setRefreshing(false))
		} else {
			setRefreshing(false)
		}
	}, [brand, fetchCarsByBrand])

	useEffect(() => {
		if (brand) {
			fetchCarsByBrand(brand)
		}
	}, [brand, fetchCarsByBrand])

	const handleFavoritePress = useCallback(
		async (carId: number) => {
			const newLikesCount = await toggleFavorite(carId)
			setCars(prevCars =>
				prevCars.map(car =>
					car.id === carId ? { ...car, likes: newLikesCount } : car
				)
			)
		},
		[toggleFavorite]
	)

	const handleCarPress = useCallback((car: any) => {
		setSelectedCar(car)
		setIsModalVisible(true)
	}, [])

	const handleViewUpdate = useCallback(
		(carId: number, newViewCount: number) => {
			setCars(prevCars =>
				prevCars.map(car =>
					car.id === carId ? { ...car, views: newViewCount } : car
				)
			)
		},
		[]
	)

	const renderCarItem = useCallback(
		({ item }: { item: any }) => (
			<CarCard
				car={item}
				onPress={() => handleCarPress(item)}
				onFavoritePress={() => handleFavoritePress(item.id)}
				isFavorite={isFavorite(item.id)}
				cardHeight={CAR_CARD_HEIGHT}
			/>
		),
		[handleCarPress, handleFavoritePress, isFavorite]
	)

	const renderModal = useMemo(() => {
		const ModalComponent =
			Platform.OS === 'ios' ? CarDetailModalIOS : CarDetailModal
		return (
			<ModalComponent
				isVisible={isModalVisible}
				car={selectedCar}
				onClose={() => setIsModalVisible(false)}
				onFavoritePress={() =>
					selectedCar && handleFavoritePress(selectedCar.id)
				}
				isFavorite={!!selectedCar && isFavorite(selectedCar.id)}
				onViewUpdate={handleViewUpdate}
				setSelectedCar={setSelectedCar}
				setIsModalVisible={setIsModalVisible}
			/>
		)
	}, [
		isModalVisible,
		selectedCar,
		handleFavoritePress,
		isFavorite,
		handleViewUpdate
	])

	const memoizedHeader = useMemo(
		() => (
			<Stack.Screen
				options={{
					presentation: 'modal',
					headerLeft: () => (
						<TouchableOpacity className='ml-3' onPress={() => router.back()}>
							<Ionicons name='arrow-back' size={30} color='#D55004' />
						</TouchableOpacity>
					),
					title: brand ? `${brand} Cars` : 'Cars by Brand',
					headerStyle: { backgroundColor: isDarkMode ? '#0D0D0D' : '#FFFFFF' },
					headerTintColor: isDarkMode ? '#FFFFFF' : '#333333'
				}}
			/>
		),
		[brand, router, isDarkMode]
	)

	const renderContent = () => {
		if (isLoading && !refreshing) {
			return (
				<ActivityIndicator
					size='large'
					color='#D55004'
					className='flex-1 justify-center items-center'
				/>
			)
		}

		if (cars.length === 0) {
			return (
				<View className='flex-1 justify-center items-center'>
					<Text
						className={`${isDarkMode ? 'text-white' : 'text-black'} text-lg`}>
						No cars found for this brand.
					</Text>
				</View>
			)
		}

		return (
			<FlatList
				data={cars}
				renderItem={renderCarItem}
				keyExtractor={item => `${item.id}-${item.make}-${item.model}`}
				showsVerticalScrollIndicator={false}
				snapToAlignment='start'
				decelerationRate='fast'
				snapToInterval={CAR_CARD_HEIGHT}
				contentContainerStyle={{ paddingBottom: 20 }}
				refreshControl={
					<RefreshControl
						refreshing={refreshing}
						onRefresh={onRefresh}
						tintColor={isDarkMode ? '#ffffff' : '#000000'}
						colors={['#D55004']}
					/>
				}
			/>
		)
	}

	return (
		<View className={`flex-1 ${isDarkMode ? 'bg-night' : 'bg-white'}`}>
			<CustomHeader
				title={brand ? `${brand} Cars` : 'Cars by Brand'}
				onBack={() => router.back()}
				brandName={brand}
			/>
			{memoizedHeader}
			{renderContent()}
			{renderModal}
		</View>
	)
}