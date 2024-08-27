import React, { useState, useEffect, useMemo, useRef } from 'react'
import {
	View,
	Text,
	Image,
	TouchableOpacity,
	TextInput,
	SectionList,
	SectionListData,
	ActivityIndicator,
	Animated,
	StatusBar
} from 'react-native'
import { supabase } from '@/utils/supabase'
import { useNavigation } from '@react-navigation/native'
import { FontAwesome, Ionicons } from '@expo/vector-icons'
import { Stack, useRouter } from 'expo-router'
import { useTheme } from '@/utils/ThemeContext'
import dealership from '../(admin)/dealership'
import { SafeAreaView } from 'react-native-safe-area-context'

const CustomHeader = ({ title, onBack }: any) => {
	const { isDarkMode } = useTheme()
	const iconColor = isDarkMode ? '#D55004' : '#FF8C00'

	return (
		<SafeAreaView
			edges={['top']}
			style={{ backgroundColor: isDarkMode ? '#000000' : '#FFFFFF' }}>
			<StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
			<View style={{ flexDirection: 'row', alignItems: 'center', paddingBottom: 14, paddingHorizontal:16 }}>
				<TouchableOpacity onPress={onBack}>
					<Ionicons name='arrow-back' size={24} color={iconColor} />
				</TouchableOpacity>
				<Text
					style={{
						marginLeft: 16,
						fontSize: 18,
						fontWeight: 'bold',
						color: isDarkMode ? '#FFFFFF' : '#000000'
					}}>
					{title}
				</Text>
			</View>
		</SafeAreaView>
	)
}

interface Brand {
	name: string
	logoUrl: string
}

const getLogoUrl = (make: string, isLightMode: boolean) => {
    const formattedMake = make.toLowerCase().replace(/\s+/g, '-');
    console.log(formattedMake);

    // Handle special cases
    switch (formattedMake) {
        case 'range-rover':
            return isLightMode
                ? 'https://www.carlogos.org/car-logos/land-rover-logo-2020-green.png'
                : 'https://www.carlogos.org/car-logos/land-rover-logo.png';
        case 'infiniti':
            return 'https://www.carlogos.org/car-logos/infiniti-logo.png';
        case 'audi':
            return isLightMode
                ? 'https://upload.wikimedia.org/wikipedia/commons/9/92/Audi-Logo_2016.svg'
                : 'https://cdn.freebiesupply.com/logos/large/2x/audi-1-logo-black-and-white.png';
        case 'nissan':
            return isLightMode
                ? 'https://www.carlogos.org/logo/Nissan-logo-2020-black.png'
                : 'https://cdn.freebiesupply.com/logos/large/2x/nissan-6-logo-png-transparent.png';
        default:
                return `https://www.carlogos.org/car-logos/${formattedMake}-logo.png`;
    }
}

export default function AllBrandsPage() {
	const [brands, setBrands] = useState<Brand[]>([])
	const [searchQuery, setSearchQuery] = useState('')
	const [isLoading, setIsLoading] = useState(false)
	const navigation = useNavigation()
	const router = useRouter()
	const sectionListRef = useRef<SectionList>(null)
	const { isDarkMode } = useTheme()

	const textColor = isDarkMode ? 'text-white' : 'text-black'
	const bgColor = isDarkMode ? 'bg-night' : 'bg-white'
	const borderColor = isDarkMode ? 'border-gray-700' : 'border-gray-300'
	const sectionHeaderBgColor = isDarkMode ? 'bg-gray' : 'bg-light-secondary'

	useEffect(() => {
		fetchBrands()
	}, [])

	useEffect(() => {
		navigation.setOptions({
			headerTitle: 'All Brands'
		})
	}, [navigation])

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
				logoUrl: getLogoUrl(make, !isDarkMode)
			}))

			setBrands(brandsData)
		} catch (error) {
			console.error('Error fetching brands:', error)
		}
		setIsLoading(false)
	}

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

	const handleBrandPress = (brand: string) => {
		router.push({
			pathname: '/(home)/(user)/CarsByBrand',
			params: { brand }
		})
	}

	const scrollToSection = (index: number) => {
		sectionListRef.current?.scrollToLocation({
			sectionIndex: index,
			itemIndex: 0,
			animated: true,
			viewPosition: 0
		})
	}

	const renderBrandItem = ({ item }: { item: Brand }) => (
		<TouchableOpacity
			className={`flex-row items-center py-4 border-b ${borderColor}`}
			onPress={() => handleBrandPress(item.name)}>
			<Image
				source={{ uri: item.logoUrl }}
				style={{ width: 50, height: 50 }}
				resizeMode='contain'
			/>
			<Text className={`ml-4 text-lg ${textColor}`}>{item.name}</Text>
		</TouchableOpacity>
	)

	const renderSectionHeader = ({
		section
	}: {
		section: SectionListData<Brand>
	}) => (
		<View className={`${sectionHeaderBgColor} py-2`}>
			<Text className={`${textColor} font-bold`}>{section.title}</Text>
		</View>
	)

	const AlphabetIndex = () => (
		<View
			className={`absolute right-0 top-0 bottom-0 justify-center ${bgColor} bg-opacity-50 px-1`}>
			{groupedBrands.map((group, index) => (
				<TouchableOpacity
					key={group.title}
					onPress={() => scrollToSection(index)}>
					<Text className={textColor}>{group.title}</Text>
				</TouchableOpacity>
			))}
		</View>
	)

	const iconColor = isDarkMode ? '#D55004' : '#FF8C00'

	return (
		<View className={`flex-1 ${bgColor} px-2`}>
			<CustomHeader title='All Brands' onBack = {() => {router.back()}}/>
			<View
				className={`border  mx-4 pl-2 mt-3 border-red rounded-full z-50 flex-row items-center ${
					isDarkMode ? 'bg-gray' : 'bg-light-secondary'
				}`}>
				<FontAwesome
					name='search'
					size={20}
					color={isDarkMode ? 'white' : 'gray'}
					className='mx-3'
				/>
				<TextInput
					className={`p-2 ${textColor} flex-1`}
					placeholder='Search brands...'
					placeholderTextColor={isDarkMode ? 'lightgray' : 'gray'}
					value={searchQuery}
					onChangeText={setSearchQuery}
				/>
			</View>
			{isLoading ? (
				<ActivityIndicator size='large' color='#D55004' className='mt-4' />
			) : (
				<>
					<SectionList
						ref={sectionListRef}
						sections={groupedBrands}
						renderItem={renderBrandItem}
						renderSectionHeader={renderSectionHeader}
						keyExtractor={item => item.name}
						stickySectionHeadersEnabled={true}
						className='mt-4'
					/>
				</>
			)}
		</View>
	)
}
