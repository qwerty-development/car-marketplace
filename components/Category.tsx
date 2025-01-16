import React from 'react'
import {
	View,
	TouchableOpacity,
	Text,
	Image,
	ScrollView,
	Dimensions
} from 'react-native'
import { useTheme } from '@/utils/ThemeContext'
import { LinearGradient } from 'expo-linear-gradient'
import { BlurView } from 'expo-blur'

// Import your PNG assets
import SedanPng from '@/assets/types/sedan.png'
import SuvPng from '@/assets/types/suv.png'
import HatchbackPng from '@/assets/types/hatchback.png'
import ConvertiblePng from '@/assets/types/convertible.png'
import CoupePng from '@/assets/types/coupe.png'
import SportsPng from '@/assets/types/sports.png'

const { width } = Dimensions.get('window')
const CARD_WIDTH = width * 0.28
const CARD_HEIGHT = CARD_WIDTH * 1.2

const categories = [
	{ name: 'Sedan', image: SedanPng },
	{ name: 'SUV', image: SuvPng },
	{ name: 'Hatchback', image: HatchbackPng },
	{ name: 'Coupe', image: CoupePng },
	{ name: 'Convertible', image: ConvertiblePng },
	{ name: 'Sports', image: SportsPng }
]

interface CategorySelectorProps {
	selectedCategories: string[]
	onCategoryPress: (category: string) => void
}

const CategorySelector: React.FC<CategorySelectorProps> = ({
	selectedCategories,
	onCategoryPress
}) => {
	const { isDarkMode } = useTheme()

	return (
		<View className='py-6'>
			<Text
				className={`text-xl font-bold mb-4 px-4 ${
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
					const isSelected = selectedCategories.includes(item.name)

					return (
						<TouchableOpacity
							key={item.name}
							onPress={() => onCategoryPress(item.name)}
							className={`mr-3 rounded-2xl overflow-hidden`}
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
											? ['rgba(255,255,255,0.1)', 'rgba(255,255,255,0.05)']
											: ['rgba(255,255,255,0.9)', 'rgba(255,255,255,0.8)']
									}
									className='h-full p-3 items-center justify-center'>
									<View className='flex-1 justify-center items-center'>
										<View className='w-12 h-12 justify-center items-center mb-2'>
											<Image
												source={item.image}
												className={`w-24 h-24 ${
													isSelected && !isDarkMode ? 'tint-white' : ''
												}`}
												resizeMode='contain'
											/>
										</View>
										<Text
											className={`text-sm font-medium text-center ${
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
