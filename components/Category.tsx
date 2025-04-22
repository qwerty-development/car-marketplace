import React from 'react'
import {
	View,
	TouchableOpacity,
	Text,
	Image,
	ScrollView,
	Platform,
	useWindowDimensions
} from 'react-native'
import { useTheme } from '@/utils/ThemeContext'
import { LinearGradient } from 'expo-linear-gradient'
import { BlurView } from 'expo-blur'

// Import your PNG assets
import SedanPng from '@/assets/types/sedan.png'
import SportsPng from '@/assets/types/sports.png'
import SuvPng from '@/assets/types/suv.png'
import HatchbackPng from '@/assets/types/hatchback.png'
import ConvertiblePng from '@/assets/types/convertible.png'
import CoupePng from '@/assets/types/coupe.png'
import classicPng from '@/assets/types/classic.png'

const categories = [
	{ name: 'Sedan', image: SedanPng },
	{ name: 'Sports', image: SportsPng },
	{ name: 'SUV', image: SuvPng },
	{ name: 'Hatchback', image: HatchbackPng },
	{ name: 'Coupe', image: CoupePng },
	{ name: 'Convertible', image: ConvertiblePng },
	{ name: 'Classic', image: classicPng },
]

interface CategorySelectorProps {
	selectedCategories?: string[]
	onCategoryPress: (category: string) => void
}

const CategorySelector: React.FC<CategorySelectorProps> = ({
	selectedCategories = [],
	onCategoryPress
}) => {
	const { isDarkMode } = useTheme()
	const { width } = useWindowDimensions()
	
	// Fixed card size to match ByBrands component
	// Using fixed dimensions rather than percentage-based
	const CARD_WIDTH = 120
	const CARD_HEIGHT = 120
	
	// Ensure the card size is reasonable on iPad
	const IMAGE_SIZE = 70

	return (
		<View className={`${isDarkMode ? '' : 'bg-white'} mt-3 mb-4`}>
			<Text
				className={`text-xl font-bold mb-4 ml-3 ${
					isDarkMode ? 'text-white' : 'text-black'
				}`}>
				Explore by Category
			</Text>

			<ScrollView
				horizontal
				showsHorizontalScrollIndicator={false}
				className='pl-4'
				decelerationRate='fast'
				snapToInterval={CARD_WIDTH + 12}>
				{categories.map(item => {
					const isSelected = selectedCategories?.includes(item.name) || false

					return (
						<TouchableOpacity
							key={item.name}
							onPress={() => onCategoryPress(item.name)}
							className={`mr-3 bg-black rounded-2xl overflow-hidden`}
							style={{ width: CARD_WIDTH, height: CARD_HEIGHT }}>
							<BlurView
								intensity={isDarkMode ? 30 : 50}
								tint={isDarkMode ? 'dark' : 'light'}
								className='h-full'>
								<LinearGradient
									colors={
										isSelected
											? ['#D55004', '#FF6B00']
											: isDarkMode
											? ['#000000', '#1A1A1A']
											: ['#FFFFFF', '#E0E0E0']
									}
									className='h-full p-3 items-center justify-center'>
									<View className='flex-1 justify-center items-center'>
										<View className='justify-center items-center mb-2'>
											<Image
												source={item.image}
												style={{ width: IMAGE_SIZE, height: IMAGE_SIZE }}
												className={`${
													isSelected && !isDarkMode ? 'tint-white' : ''
												}`}
												resizeMode='contain'
											/>
										</View>
										<Text
											className={`text-xs font-medium text-center ${
												isSelected
													? 'text-white'
													: isDarkMode
													? 'text-white'
													: 'text-black'
											}`}
											numberOfLines={1}>
											{item.name}
										</Text>
									</View>

									{isSelected && (
										<View className='absolute top-2 right-2 bg-white/20 rounded-full p-1'>
											<View className='w-1.5 h-1.5 rounded-full bg-white' />
										</View>
									)}
								</LinearGradient>
							</BlurView>
						</TouchableOpacity>
					)
				})}
			</ScrollView>
		</View>
	)
}

export default CategorySelector