import React, { useEffect, useState, useMemo } from 'react'
import {
	View,
	Text,
	Image,
	TouchableOpacity,
	ScrollView,
	ActivityIndicator
} from 'react-native'
import { useRouter } from 'expo-router'
import { supabase } from '@/utils/supabase'
import { FontAwesome } from '@expo/vector-icons'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useTheme } from '@/utils/ThemeContext'

interface Brand {
	name: string
	logoUrl: string
}

const BRANDS_CACHE_KEY = 'cachedBrands'
const CACHE_EXPIRY = 1000000000 // 24 hours in milliseconds

const getLogoUrl = (make: string, isLightMode: boolean) => {
	const formattedMake = make.toLowerCase().replace(/\s+/g, '-')
	console.log(formattedMake)

	// Handle special cases
	switch (formattedMake) {
		case 'range-rover':
			return isLightMode
				? 'https://www.carlogos.org/car-logos/land-rover-logo-2020-green.png'
				: 'https://www.carlogos.org/car-logos/land-rover-logo.png'
		case 'infiniti':
			return 'https://www.carlogos.org/car-logos/infiniti-logo.png'
		case 'audi':
			return 'https://www.freepnglogos.com/uploads/audi-logo-2.png'
		case 'nissan':
			return 'https://cdn.freebiesupply.com/logos/large/2x/nissan-6-logo-png-transparent.png'
		default:
			return `https://www.carlogos.org/car-logos/${formattedMake}-logo.png`
	}
}

const ByBrands = React.memo(() => {
	const [brands, setBrands] = useState<Brand[]>([])
	const [isLoading, setIsLoading] = useState(false)
	const router = useRouter()
	const { isDarkMode } = useTheme()

	const fetchBrands = useMemo(
		() => async () => {
			setIsLoading(true)
			try {
				const cachedData = await AsyncStorage.getItem(BRANDS_CACHE_KEY)
				if (cachedData) {
					const { brands: cachedBrands, timestamp } = JSON.parse(cachedData)
					if (Date.now() - timestamp < CACHE_EXPIRY) {
						setBrands(cachedBrands)
						setIsLoading(false)
						return
					}
				}

				const { data, error } = await supabase
					.from('cars')
					.select('make')
					.order('make')

				if (error) throw error

				const uniqueBrands = Array.from(
					new Set(data.map((item: { make: string }) => item.make))
				)
				const brandsData = uniqueBrands.map((make: string) => ({
					name: make,
					logoUrl: getLogoUrl(make, !isDarkMode)
				}))

				setBrands(brandsData)

				await AsyncStorage.setItem(
					BRANDS_CACHE_KEY,
					JSON.stringify({ brands: brandsData, timestamp: Date.now() })
				)
			} catch (error) {
				console.error('Error fetching brands:', error)
			}
			setIsLoading(false)
		},
		[]
	)

	useEffect(() => {
		fetchBrands()
	}, [])

	const handleBrandPress = (brand: string) => {
		router.push({
			pathname: '/(home)/(user)/CarsByBrand',
			params: { brand }
		})
	}

	const handleSeeAllBrands = () => {
		router.push('/(home)/(user)/AllBrandsPage')
	}

	if (isLoading) {
		return <ActivityIndicator size='large' color='#D55004' />
	}

	return (
		<View
			className={`mt-4 px-3  mb-4 ${isDarkMode ? 'bg-night' : 'bg-[#FFFFFF]'}`}>
			<View className='flex-row justify-between items-center mb-4'>
				<Text
					className={`text-xl font-bold ${
						isDarkMode ? 'text-white' : 'text-black'
					} mt-2`}>
					Explore by Brands
				</Text>
				<TouchableOpacity
					onPress={handleSeeAllBrands}
					className='flex-row items-center'>
					<Text className='text-red mr-2'>See all brands</Text>
					<FontAwesome
						name='chevron-right'
						size={14}
						color={isDarkMode ? '#FFFFFF' : '#000000'}
					/>
				</TouchableOpacity>
			</View>
			<ScrollView
				horizontal
				showsHorizontalScrollIndicator={false}
				className='rounded-lg'>
				{brands.map((brand, index) => (
					<TouchableOpacity
						key={index}
						onPress={() => handleBrandPress(brand.name)}
						className='items-center mb-1 mt-1 mr-4'>
						<Image
							source={{ uri: brand.logoUrl }}
							style={{ width: 80, height: 80 }}
							resizeMode='contain'
						/>
						<Text
							className={`${
								isDarkMode ? 'text-white' : 'text-black'
							} text-center mt-2`}>
							{brand.name}
						</Text>
					</TouchableOpacity>
				))}
			</ScrollView>
		</View>
	)
})

export default ByBrands
