import React from 'react'
import { View, TouchableOpacity, Text, StyleSheet, Image } from 'react-native'
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
	{ name: 'SUV', image: SuvPng },
	{ name: 'Hatchback', image: HatchbackPng },
	{ name: 'Convertible', image: ConvertiblePng },
	{ name: 'Coupe', image: CoupePng },
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
		<View>
			<Text
				style={[styles.title, { color: isDarkMode ? '#FFFFFF' : '#000000' }]}>
				Explore by Category
			</Text>
			<View style={styles.container}>
				{categories.map(category => (
					<TouchableOpacity
						key={category.name}
						style={[
							styles.categoryButton,
							selectedCategories.includes(category.name) &&
								styles.selectedButton,
							{ backgroundColor: isDarkMode ? '#333333' : '#F0F0F0' }
						]}
						onPress={() => onCategoryPress(category.name)}>
						<Image
							source={category.image}
							style={[
								styles.categoryImage,
								isDarkMode && {
									tintColor: selectedCategories.includes(category.name)
										? '#D55004'
										: '#FFFFFF'
								},
								selectedCategories.includes(category.name) &&
									!isDarkMode && { tintColor: '#D55004' }
							]}
						/>
						<Text
							style={[
								styles.categoryText,
								{ color: isDarkMode ? '#FFFFFF' : '#000000' },
								selectedCategories.includes(category.name) &&
									styles.selectedText
							]}>
							{category.name}
						</Text>
					</TouchableOpacity>
				))}
			</View>
		</View>
	)
}

const styles = StyleSheet.create({
	title: {
		fontSize: 20,
		fontWeight: 'bold',
		marginLeft: 16,
		marginTop: 8,
		marginBottom: 8
	},
	container: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		justifyContent: 'space-around',
		padding: 8
	},
	categoryButton: {
		flexDirection: 'column',
		alignItems: 'center',
		padding: 12,
		margin: 8,
		borderRadius: 16,
		width: '45%'
	},
	selectedButton: {
		borderColor: '#D55004',
		borderWidth: 2
	},
	categoryImage: {
		width: 60,
		height: 60,
		marginBottom: 8,
		resizeMode: 'contain'
	},
	categoryText: {
		fontSize: 16,
		textAlign: 'center',
		marginTop: 8
	},
	selectedText: {
		color: '#D55004',
		fontWeight: 'bold'
	}
})

export default CategorySelector
