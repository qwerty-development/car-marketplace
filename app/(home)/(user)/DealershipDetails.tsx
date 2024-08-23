import React, { useEffect, useState, useCallback } from 'react'
import {
	View,
	Text,
	Image,
	FlatList,
	ActivityIndicator,
	TouchableOpacity,
	ScrollView
} from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { supabase } from '@/utils/supabase'
import CarCard from '@/components/CarCard'
import CarDetailModal from '@/components/CarDetailModal'
import { useFavorites } from '@/utils/useFavorites'
import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import { useTheme } from '@/utils/ThemeContext'

const ITEMS_PER_PAGE = 10

interface Dealership {
	id: number
	name: string
	logo: string
	phone: string
	location: string
}

interface Car {
	id: number
	make: string
	model: string
	year: number
	price: number
	images: string[]
	description: string
	condition: 'New' | 'Used'
	mileage: number
	color: string
	transmission: 'Manual' | 'Automatic'
	drivetrain: 'FWD' | 'RWD' | 'AWD' | '4WD' | '4x4'
}

export default function DealershipDetails() {
	const { isDarkMode } = useTheme()
	const { dealershipId } = useLocalSearchParams()
	const router = useRouter()
	const [dealership, setDealership] = useState<Dealership | null>(null)
	const [cars, setCars] = useState<Car[]>([])
	const [isLoading, setIsLoading] = useState(true)
	const [selectedCar, setSelectedCar] = useState<Car | null>(null)
	const [isModalVisible, setIsModalVisible] = useState(false)
	const [currentPage, setCurrentPage] = useState(1)
	const [totalPages, setTotalPages] = useState(1)
	const { favorites, toggleFavorite, isFavorite } = useFavorites()

	useEffect(() => {
		fetchDealershipDetails()
		fetchDealershipCars()
	}, [dealershipId])

	const fetchDealershipDetails = async () => {
		const { data, error } = await supabase
			.from('dealerships')
			.select('*')
			.eq('id', dealershipId)
			.single()

		if (error) {
			console.error('Error fetching dealership details:', error)
		} else {
			setDealership(data)
		}
	}

	const bgGradient = isDarkMode
		? ['#000000', '#1c1c1c']
		: ['#FFFFFF', '#F0F0F0']
	const textColor = isDarkMode ? 'text-white' : 'text-black'
	const iconColor = isDarkMode ? '#D55004' : '#FF8C00'

	const fetchDealershipCars = async (page = 1) => {
		setIsLoading(true)
		const { data, count, error } = await supabase
			.from('cars')
			.select('*', { count: 'exact' })
			.eq('dealership_id', dealershipId)
			.range((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE - 1)
			.order('listed_at', { ascending: false })

		if (error) {
			console.error('Error fetching dealership cars:', error)
		} else {
			setCars(prevCars => (page === 1 ? data : [...prevCars, ...data]))
			setTotalPages(Math.ceil((count || 0) / ITEMS_PER_PAGE))
			setCurrentPage(page)
		}
		setIsLoading(false)
	}

	const handleCarPress = useCallback((car: Car) => {
		setSelectedCar(car)
		setIsModalVisible(true)
	}, [])

	const handleFavoritePress = async (carId: number) => {
		const newLikesCount = await toggleFavorite(carId)
		setCars(prevCars =>
			prevCars.map(car =>
				car.id === carId ? { ...car, likes: newLikesCount } : car
			)
		)
	}

	const handleViewUpdate = (carId: number, newViewCount: number) => {
		setCars(prevCars =>
			prevCars.map(car =>
				car.id === carId ? { ...car, views: newViewCount } : car
			)
		)
	}

	const renderCarItem = useCallback(
		({ item }: { item: Car }) => (
			<CarCard
				car={item}
				onPress={() => handleCarPress(item)}
				onFavoritePress={() => handleFavoritePress(item.id)}
				isFavorite={isFavorite(item.id)}
			/>
		),
		[handleCarPress, handleFavoritePress, isFavorite]
	)

	if (isLoading && cars.length === 0) {
		return (
			<View
				className={`flex-1 justify-center items-center ${
					isDarkMode ? 'bg-night' : 'bg-white'
				}`}>
				<ActivityIndicator size='large' color='#D55004' />
			</View>
		)
	}

	return (
		<LinearGradient colors={bgGradient} className='flex-1 pt-16'>
			<ScrollView className='flex-1'>
				<View className='p-4'>
					<TouchableOpacity
						className='absolute top-4 left-4 z-10 bg-red p-2 rounded-full'
						onPress={() => router.back()}>
						<Ionicons
							name='arrow-back'
							size={24}
							color={isDarkMode ? 'white' : 'black'}
						/>
					</TouchableOpacity>

					{dealership && (
						<View className='items-center mb-6 mt-12'>
							<Image
								source={{ uri: dealership.logo }}
								className='w-32 h-32 rounded-full mb-4'
							/>
							<Text className={`text-3xl font-bold ${textColor} mb-2`}>
								{dealership.name}
							</Text>
							<View className='flex-row items-center mb-2'>
								<Ionicons name='call-outline' size={20} color={iconColor} />
								<Text className={`${textColor} ml-2`}>{dealership.phone}</Text>
							</View>
							<View className='flex-row items-center'>
								<Ionicons name='location-outline' size={20} color={iconColor} />
								<Text className={`${textColor} ml-2`}>
									{dealership.location}
								</Text>
							</View>
						</View>
					)}

					<View className='mb-4'>
						<Text className={`text-2xl font-bold ${textColor} mb-4`}>
							Available Cars
						</Text>
						<FlatList
							data={cars}
							renderItem={renderCarItem}
							keyExtractor={item => item.id.toString()}
							showsVerticalScrollIndicator={false}
							onEndReached={() => {
								if (currentPage < totalPages && !isLoading) {
									fetchDealershipCars(currentPage + 1)
								}
							}}
							onEndReachedThreshold={0.1}
							ListFooterComponent={() =>
								isLoading ? (
									<View className='py-4'>
										<ActivityIndicator size='large' color='#D55004' />
									</View>
								) : null
							}
						/>
					</View>
				</View>
			</ScrollView>

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
		</LinearGradient>
	)
}
