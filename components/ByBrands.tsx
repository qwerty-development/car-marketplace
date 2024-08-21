import React, { useEffect, useState } from 'react'
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

interface Brand {
	name: string
	logoUrl: string
}

const getLogoUrl = (make: string) => {
	const formattedMake = make.toLowerCase().replace(/\s+/g, '-')
	// Handle special cases
	switch (formattedMake) {
		case 'range-rover':
			return 'https://www.carlogos.org/car-logos/land-rover-logo.png'
		case 'infiniti':
			return 'https://www.carlogos.org/car-logos/infiniti-logo.png'
		case 'audi':
			return 'https://cdn.freebiesupply.com/logos/large/2x/audi-1-logo-black-and-white.png'
		case 'nissan':
			return 'https://cdn.freebiesupply.com/logos/large/2x/nissan-6-logo-png-transparent.png'
		default:
			return `https://www.carlogos.org/car-logos/${formattedMake}-logo.png`
	}
}

export default function ByBrands() {
	const [brands, setBrands] = useState<Brand[]>([])
	const [isLoading, setIsLoading] = useState(false)
	const router = useRouter()

	useEffect(() => {
		fetchBrands()
	}, [])

	const fetchBrands = async () => {
		setIsLoading(true)
		try {
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
				logoUrl: getLogoUrl(make)
			}))

			setBrands(brandsData)
		} catch (error) {
			console.error('Error fetching brands:', error)
		}
		setIsLoading(false)
	}

	const handleBrandPress = (brand: string) => {
		router.push({
			pathname: '/(home)/(user)/CarsByBrand',
			params: { brand }
		})
	}

	const handleSeeAllBrands = () => {
		router.push('/(home)/(user)/AllBrandsPage')
	}

	return (
		<View className='mt-4 mx-5 mb-4'>
			<View className='flex-row justify-between items-center mb-4'>
				<Text className='text-xl font-bold text-white mt-2'>
					Explore by Brands
				</Text>
				<TouchableOpacity
					onPress={handleSeeAllBrands}
					className='flex-row items-center'>
					<Text className='text-red-500 mr-2'>See all brands</Text>
					<FontAwesome name='chevron-right' size={14} color='#FFFFFF' />
				</TouchableOpacity>
			</View>
			{isLoading ? (
				<ActivityIndicator size='large' color='#D55004' />
			) : (
				<ScrollView
					horizontal
					showsHorizontalScrollIndicator={false}
					className=' rounded-lg'>
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
							<Text className='text-white text-center mt-2'>{brand.name}</Text>
						</TouchableOpacity>
					))}
				</ScrollView>
			)}
		</View>
	)
}
