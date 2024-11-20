import React from 'react'
import { View, TouchableOpacity, Text, Image } from 'react-native'
import { useTheme } from '@/utils/ThemeContext'

// Import your PNG assets
import SedanPng from '@/assets/types/sedan.png'
import SuvPng from '@/assets/types/suv.png'
import HatchbackPng from '@/assets/types/hatchback.png'
import ConvertiblePng from '@/assets/types/convertible.png'
import CoupePng from '@/assets/types/coupe.png'
import SportsPng from '@/assets/types/sports.png'

const categories = [
	{ name: 'Sedan', image: SedanPng },
	{ name: 'Hatchback', image: HatchbackPng },
	{ name: 'Coupe', image: CoupePng },
	{ name: 'Convertible', image: ConvertiblePng },
	{ name: 'SUV', image: SuvPng },
	{ name: 'Sports', image: SportsPng, isLarge: true } // Added isLarge flag
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
		<View className='px-4 py-2'>
			<Text
				className={`text-xl font-bold mb-4 ${
					isDarkMode ? 'text-white' : 'text-black'
				}`}>
				Explore by Category
			</Text>

			<View className='flex flex-row flex-wrap justify-between'>
				{categories.map(category => (
					<TouchableOpacity
						key={category.name}
						className={`w-[48%] mb-4 p-4 rounded-2xl flex items-center justify-center ${
							isDarkMode ? 'bg-gray' : 'bg-white'
						} ${
							selectedCategories.includes(category.name)
								? 'border-2 border-red'
								: ''
						}`}
						onPress={() => onCategoryPress(category.name)}>
						<View className='w-full aspect-square mb-2 flex items-center justify-center'>
							<Image
								source={category.image}
								className={`${category.isLarge ? 'w-28 h-28' : 'w-24 h-24'} ${
									selectedCategories.includes(category.name) && !isDarkMode
										? 'tint-red'
										: ''
								}`}
								resizeMode='contain'
							/>
						</View>

						<Text
							className={`text-base text-center mt-2 ${
								isDarkMode ? 'text-white' : 'text-black'
							} ${
								selectedCategories.includes(category.name)
									? 'text-red font-bold'
									: ''
							}`}>
							{category.name}
						</Text>
					</TouchableOpacity>
				))}
			</View>
		</View>
	)
}

export default CategorySelector
