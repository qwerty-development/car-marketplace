import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import {
	View,
	Text,
	Image,
	TouchableOpacity,
	TextInput,
	SectionList,
	SectionListData,
	ActivityIndicator,
	StatusBar,
	RefreshControl
} from 'react-native'
import { supabase } from '@/utils/supabase'
import { FontAwesome, Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useTheme } from '@/utils/ThemeContext'
import { SafeAreaView } from 'react-native-safe-area-context'

interface Brand {
	name: string
	logoUrl: string
}

const CustomHeader = React.memo(
	({ title, onBack }: { title: string; onBack: () => void }) => {
		const { isDarkMode } = useTheme()
		const iconColor = isDarkMode ? '#D55004' : '#FF8C00'

		return (
			<SafeAreaView
				edges={['top']}
				className={`bg-${isDarkMode ? 'black' : 'white'}`}>
				<StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
				<View className='flex-row items-center pb-4 px-4'>
					<TouchableOpacity onPress={onBack}>
						<Ionicons name='arrow-back' size={24} color={iconColor} />
					</TouchableOpacity>
					<Text
						className={`ml-4 text-lg font-bold ${
							isDarkMode ? 'text-white' : 'text-black'
						}`}>
						{title}
					</Text>
				</View>
			</SafeAreaView>
		)
	}
)

const getLogoUrl = (make: string, isLightMode: boolean) => {
	const formattedMake = make.toLowerCase().replace(/\s+/g, '-')
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

export default function AllBrandsPage() {
	const [brands, setBrands] = useState<Brand[]>([])
	const [searchQuery, setSearchQuery] = useState('')
	const [isLoading, setIsLoading] = useState(false)
	const [refreshing, setRefreshing] = useState(false)
	const router = useRouter()
	const sectionListRef = useRef<SectionList>(null)
	const { isDarkMode } = useTheme()

	const textColor = isDarkMode ? 'text-white' : 'text-black'
	const bgColor = isDarkMode ? 'bg-night' : 'bg-white'
	const borderColor = isDarkMode ? 'border-red' : 'border-red'
	const sectionHeaderBgColor = isDarkMode ? 'bg-gray' : 'bg-white'

	const fetchBrands = useCallback(async () => {
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
				logoUrl: getLogoUrl(make, !isDarkMode)
			}))

			setBrands(brandsData)
		} catch (error) {
			console.error('Error fetching brands:', error)
		} finally {
			setIsLoading(false)
		}
	}, [isDarkMode])

	useEffect(() => {
		fetchBrands()
	}, [fetchBrands])

	const onRefresh = useCallback(() => {
		setRefreshing(true)
		fetchBrands().then(() => setRefreshing(false))
	}, [fetchBrands])

	const filteredBrands = useMemo(() => {
		return brands.filter(brand =>
			brand.name.toLowerCase().includes(searchQuery.toLowerCase())
		)
	}, [brands, searchQuery])

	const groupedBrands = useMemo(() => {
		const groups: { title: string; data: Brand[] }[] = []
		const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')

		alphabet.forEach(letter => {
			const brandsForLetter = filteredBrands.filter(brand =>
				brand.name.toUpperCase().startsWith(letter)
			)
			if (brandsForLetter.length > 0) {
				groups.push({ title: letter, data: brandsForLetter })
			}
		})

		return groups
	}, [filteredBrands])

	const handleBrandPress = useCallback(
		(brand: string) => {
			router.push({
				pathname: '/(home)/(user)/CarsByBrand',
				params: { brand }
			})
		},
		[router]
	)

	const renderBrandItem = useCallback(
		({ item }: { item: Brand }) => (
			<TouchableOpacity
				className={`flex-row mx-3 items-center py-4 border-b border-gray`}
				onPress={() => handleBrandPress(item.name)}>
				<Image
					source={{ uri: item.logoUrl }}
					style={{ width: 50, height: 50 }}
					resizeMode='contain'
				/>
				<Text className={`ml-4 text-lg ${textColor}`}>{item.name}</Text>
			</TouchableOpacity>
		),
		[borderColor, textColor, handleBrandPress]
	)

	const renderSectionHeader = useCallback(
		({ section }: { section: SectionListData<Brand> }) => (
			<View className={`${sectionHeaderBgColor} p-2`}>
				<Text className={`${textColor} font-bold`}>{section.title}</Text>
			</View>
		),
		[sectionHeaderBgColor, textColor]
	)

	return (
		<View className={`flex-1 ${bgColor}`}>
			<CustomHeader title='All Brands' onBack={() => router.back()} />
			<View
				className={`border mx-4 pl-2 mt-3 border-red rounded-full z-50 flex-row items-center ${
					isDarkMode ? 'bg-gray' : 'bg-light-secondary'
				}`}>
				<FontAwesome
					name='search'
					size={20}
					color={isDarkMode ? 'white' : 'gray'}
					style={{ marginLeft: 12 }}
				/>
				<TextInput
					className={`p-2 ${textColor} flex-1`}
					placeholder='Search brands...'
					placeholderTextColor={isDarkMode ? 'lightgray' : 'gray'}
					value={searchQuery}
					onChangeText={setSearchQuery}
				/>
			</View>
			{isLoading && !refreshing ? (
				<ActivityIndicator size='large' color='#D55004' className='mt-4' />
			) : (
				<SectionList
					ref={sectionListRef}
					sections={groupedBrands}
					renderItem={renderBrandItem}
					renderSectionHeader={renderSectionHeader}
					keyExtractor={item => `${item.name}-${item.logoUrl}`}
					stickySectionHeadersEnabled={true}
					className='mt-4'
					refreshControl={
						<RefreshControl
							refreshing={refreshing}
							onRefresh={onRefresh}
							tintColor={isDarkMode ? '#ffffff' : '#000000'}
							colors={['#D55004']}
						/>
					}
				/>
			)}
		</View>
	)
}
