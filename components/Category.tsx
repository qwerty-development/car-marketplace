import React from 'react'
import {
	View,
	TouchableOpacity,
	Text,
	ScrollView,
	StyleSheet
} from 'react-native'
import { useTheme } from '@/utils/ThemeContext'
import { useLanguage } from '@/utils/LanguageContext'
import i18n from '@/utils/i18n'

const categories = [
	{ name: 'Sedan', key: 'sedan' },
	{ name: 'Sports', key: 'sports' },
	{ name: 'SUV', key: 'suv' },
	{ name: 'Hatchback', key: 'hatchback' },
	{ name: 'Coupe', key: 'coupe' },
	{ name: 'Convertible', key: 'convertible' },
	{ name: 'Classic', key: 'classic' },
	{ name: 'Motorcycle', key: 'motorcycle' },
	{ name: 'Truck', key: 'truck' },
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
	const { language } = useLanguage()
	const isRTL = language === 'ar'

	return (
		<View style={styles.container}>
			<ScrollView
				horizontal
				showsHorizontalScrollIndicator={false}
				contentContainerStyle={[
					styles.scrollContent,
					isRTL && styles.scrollContentRTL
				]}
			>
				{categories.map((item, index) => {
					const isSelected = selectedCategories?.includes(item.name) || false

					return (
						<TouchableOpacity
							key={item.name}
							onPress={() => onCategoryPress(item.name)}
							style={[
								styles.tag,
								isDarkMode ? styles.tagDark : styles.tagLight,
								isSelected && (isDarkMode ? styles.tagSelectedDark : styles.tagSelectedLight),
								index !== categories.length - 1 && (isRTL ? styles.tagMarginRTL : styles.tagMargin)
							]}
							activeOpacity={0.7}
						>
							<Text
								style={[
									styles.tagText,
									isDarkMode ? styles.tagTextDark : styles.tagTextLight,
									isSelected && (isDarkMode ? styles.tagTextSelectedDark : styles.tagTextSelectedLight)
							 ]}
							>
								{i18n.t(`category.${item.key}`)}
							</Text>
						</TouchableOpacity>
					)
				})}
			</ScrollView>
		</View>
	)
}

const styles = StyleSheet.create({
	container: {
		paddingHorizontal: 16,
		paddingVertical: 12,
	},
	scrollContent: {
		flexDirection: 'row',
		alignItems: 'center',
	},
	scrollContentRTL: {
		flexDirection: 'row-reverse',
	},
	tag: {
		paddingVertical: 8,
		paddingHorizontal: 16,
		borderRadius: 20,
		borderWidth: 1,
	},
	tagLight: {
		backgroundColor: '#FFFFFF',
		borderColor: '#000000',
	},
	tagDark: {
		backgroundColor: '#000000',
		borderColor: '#FFFFFF',
	},
	tagSelectedLight: {
		backgroundColor: '#000000',
		borderColor: '#000000',
	},
	tagSelectedDark: {
		backgroundColor: '#FFFFFF',
		borderColor: '#FFFFFF',
	},
	tagMargin: {
		marginRight: 8,
	},
	tagMarginRTL: {
		marginLeft: 8,
	},
	tagText: {
		fontSize: 14,
		fontWeight: '600',
	},
	tagTextLight: {
		color: '#000000',
	},
	tagTextDark: {
		color: '#FFFFFF',
	},
	tagTextSelectedLight: {
		color: '#FFFFFF',
	},
	tagTextSelectedDark: {
		color: '#000000',
	},
})

export default CategorySelector
