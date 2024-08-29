import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
	View,
	FlatList,
	ActivityIndicator,
	TouchableOpacity,
	Dimensions,
	Text,
	StatusBar
} from 'react-native'
import { useRouter, useLocalSearchParams, Stack } from 'expo-router'
import CarCard from '@/components/CarCard'
import CarDetailModal from './CarDetailModal'
import { supabase } from '@/utils/supabase'
import { useFavorites } from '@/utils/useFavorites'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '@/utils/ThemeContext'
import { SafeAreaView } from 'react-native-safe-area-context'

const { height: SCREEN_HEIGHT } = Dimensions.get('window')
const TAB_BAR_HEIGHT = 50
const CAR_CARD_HEIGHT = SCREEN_HEIGHT - TAB_BAR_HEIGHT

const CustomHeader = ({ title, onBack }: any) => {
	const { isDarkMode } = useTheme()
	const iconColor = isDarkMode ? '#D55004' : '#FF8C00'

	return (
		<SafeAreaView
			edges={['top']}
			style={{ backgroundColor: isDarkMode ? '#000000' : '#FFFFFF' }}>
			<StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
			<View
				style={{
					flexDirection: 'row',
					alignItems: 'center',
					paddingBottom: 14,
					paddingHorizontal: 16
				}}>
				<TouchableOpacity onPress={onBack}>
					<Ionicons name='arrow-back' size={24} color={iconColor} />
				</TouchableOpacity>
				<Text
					style={{
						marginLeft: 16,
						fontSize: 18,
						fontWeight: 'bold',
						color: isDarkMode ? '#FFFFFF' : '#000000'
					}}>
					{title}
				</Text>
			</View>
		</SafeAreaView>
	)
}

export default function CarsByBrand() {
	const { isDarkMode } = useTheme()
	const router = useRouter()
	const params = useLocalSearchParams()
	const { brand } = params
	const [cars, setCars] = useState<any[]>([])
	const [isLoading, setIsLoading] = useState(true)
	const { isFavorite, toggleFavorite } = useFavorites()
	const [selectedCar, setSelectedCar] = useState<any>(null)
	const [isModalVisible, setIsModalVisible] = useState(false)
	const bgColor = isDarkMode ? 'bg-night' : 'bg-white'
	const textColor = isDarkMode ? 'text-white' : 'text-black'

	const fetchCarsByBrand = useCallback(async (brand: string) => {
		setIsLoading(true)
		const { data, error } = await supabase
			.from('cars')
			.select(
				`
        *,
        dealerships (name,logo,phone,location,latitude,longitude)
      `
			)
			.eq('make', brand)

		if (error) {
			console.error('Error fetching cars by brand:', error)
		} else {
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
		}
		setIsLoading(false)
	}, [])

	useEffect(() => {
		if (brand) {
			fetchCarsByBrand(brand as string)
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

	return (
		<View className={`flex-1 ${bgColor}`}>
			<CustomHeader title={brand} onBack={() => router.back()} />
			{memoizedHeader}
			{isLoading ? (
				<ActivityIndicator
					size='large'
					color='#D55004'
					className='flex-1 justify-center items-center'
				/>
			) : cars.length > 0 ? (
				<FlatList
					data={cars}
					renderItem={renderCarItem}
					keyExtractor={item => item.id.toString()}
					showsVerticalScrollIndicator={false}
					snapToAlignment='start'
					decelerationRate='fast'
					snapToInterval={CAR_CARD_HEIGHT}
					contentContainerStyle={{ paddingBottom: 20 }}
				/>
			) : (
				<View className='flex-1 justify-center items-center'>
					<Text className={`${textColor} text-lg`}>
						No cars found for this brand.
					</Text>
				</View>
			)}
			<CarDetailModal
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
		</View>
	)
}
