import React, {
	useEffect,
	useState,
	useCallback,
	useRef
} from 'react'
import {
	View,
	Text,
	TouchableOpacity,
	Animated,
	StyleSheet,
	I18nManager
} from 'react-native'
import { Image } from 'expo-image'
import { useRouter } from 'expo-router'
import { supabase } from '@/utils/supabase'
import { FontAwesome } from '@expo/vector-icons'
import { useTheme } from '@/utils/ThemeContext'
import SkeletonByBrands from '@/components/SkeletonByBrands'
import { useLanguage } from '@/utils/LanguageContext'
import i18n from '@/utils/i18n'
import { getLogoSource } from '@/hooks/getLogoUrl'
import { ImageSourcePropType } from 'react-native'
import { VehicleCategory } from '@/components/CategorySelectorModal'

interface Brand {
	name: string
	logoSource: { uri: string } | ImageSourcePropType | null
	listingCount: number
}

interface ByBrandsProps {
	mode?: 'sale' | 'rent'
	vehicleCategory?: VehicleCategory
}

const ByBrands = React.memo(({ mode = 'sale', vehicleCategory = 'all' }: ByBrandsProps) => {
	const { language } = useLanguage();
	const [brands, setBrands] = useState<Brand[]>([])
	const [isLoading, setIsLoading] = useState(true)
	const router = useRouter()
	const { isDarkMode } = useTheme()
	const scrollAnim = useRef(new Animated.Value(0)).current
	const isRTL = I18nManager.isRTL

	const fetchBrands = useCallback(async () => {
		setIsLoading(true)
		setBrands([])
		try {
			const { data, error } = await supabase
				.rpc('get_brands_by_vehicle_category', {
					p_vehicle_category: vehicleCategory === 'plates' ? 'all' : vehicleCategory,
					p_mode: mode,
				})

			if (error) throw error

			const brandsData = (data || []).map((item: { make: string; listing_count: number }) => ({
				name: item.make,
				logoSource: getLogoSource(item.make, isDarkMode),
				listingCount: item.listing_count,
			}))
				.sort((a: Brand, b: Brand) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))

			setBrands(brandsData)
		} catch (error) {
			console.error('Error fetching brands:', error)
		} finally {
			setIsLoading(false)
		}
	}, [isDarkMode, mode, vehicleCategory])

	useEffect(() => {
		fetchBrands()
	}, [fetchBrands])

	useEffect(() => {
		if (!isLoading) {
			// Animate into view only when the data is loaded
			Animated.timing(scrollAnim, {
				toValue: 1,
				duration: 500,
				useNativeDriver: true // Enable native driver for better performance
			}).start()
		} else {
			scrollAnim.setValue(0) // Reset the animation when loading
		}
	}, [isLoading, scrollAnim])

	const handleBrandPress = (brand: string) => {
		router.push({
			pathname: '/(home)/(user)/CarsByBrand',
			params: { brand, mode, vehicleCategory }
		})
	}

	const handleSeeAllBrands = () => {
		router.push({
			pathname: '/(home)/(user)/AllBrandsPage',
			params: { mode, vehicleCategory }
		})
	}

	if (isLoading) {
		return <SkeletonByBrands />
	}

	return (
		<View
			className={`mt-3  px-3 pb-3 mb-4 ${isDarkMode ? '' : 'bg-[]'}`}>
			<View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
				<Text
					className={`text-xl font-bold ${
						isDarkMode ? 'text-white' : 'text-black'
					}`}>
					{i18n.t('brands.explore_by_brands')}
				</Text>
				<TouchableOpacity
					onPress={handleSeeAllBrands}
					style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center' }}>
					<Text className='text-red'>{i18n.t('common.view_all')}</Text>
					<FontAwesome
						name={isRTL ? 'chevron-left' : 'chevron-right'}
						size={14}
						color={isDarkMode ? '#FFFFFF' : '#000000'}
						style={isRTL ? { marginRight: 8 } : { marginLeft: 8 }}
					/>
				</TouchableOpacity>
			</View>
			<Animated.ScrollView
				horizontal
				showsHorizontalScrollIndicator={false}
				className='rounded-lg'
				style={{ opacity: scrollAnim, transform: [{ translateX: scrollAnim.interpolate({
					inputRange: [0,1],
					outputRange: [-50,0]
				}) }] }}
			>
				{brands.map((brand, index) => (
					<TouchableOpacity
						key={index}
						onPress={() => handleBrandPress(brand.name)}
						className='items-center mb-1 mt-1 mr-4'>
						<Image
							source={brand.logoSource || require('@/assets/images/placeholder-logo.png')}
							style={{ width: 80, height: 80 }}
							contentFit='contain'
							placeholder={require('@/assets/images/placeholder-logo.png')}
							transition={200}
						/>
						<Text
							className={`${
								isDarkMode ? 'text-white' : 'text-black'
							} text-center mt-2`}>
							{brand.name}
						</Text>
					</TouchableOpacity>
				))}
			</Animated.ScrollView>
		</View>
	)
})

export default ByBrands