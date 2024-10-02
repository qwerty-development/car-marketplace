import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import {
	View,
	Text,
	Image,
	TouchableOpacity,
	TextInput,
	SectionList,
	SectionListData,
	Alert,
	StatusBar,
	Animated,
	Easing,
	Platform
} from 'react-native'
import { supabase } from '@/utils/supabase'
import { FontAwesome, Ionicons } from '@expo/vector-icons'
import { useTheme } from '@/utils/ThemeContext'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { RefreshControl } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import ShimmerPlaceholder from 'react-native-shimmer-placeholder'

interface Dealership {
	id: number
	name: string
	logo: string
}

const AnimatedTextInput = Animated.createAnimatedComponent(TextInput)

const CustomHeader = React.memo(({ title }: { title: string }) => {
	const { isDarkMode } = useTheme()

	return (
		<SafeAreaView
			className={`bg-${isDarkMode ? 'black' : 'white'} border-b border-red`}>
			<StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
			<View className='flex-row items-center justify-center py-3'>
				<Text className='text-xl font-semibold text-red'>{title}</Text>
			</View>
		</SafeAreaView>
	)
})

const DealershipItem = React.memo(
	({ item, onPress, textColor, isDarkMode }: any) => (
		<TouchableOpacity
			className={`flex-row items-center py-4 px-4 ${
				isDarkMode ? 'border-red' : 'border-red'
			} border-b`}
			onPress={() => onPress(item)}>
			<Image source={{ uri: item.logo }} className='w-12 h-12 rounded-full' />
			<Text className={`ml-4 text-lg ${textColor}`}>{item.name}</Text>
		</TouchableOpacity>
	)
)

export default function DealershipListPage() {
	const { isDarkMode } = useTheme()
	const [dealerships, setDealerships] = useState<Dealership[]>([])
	const [searchQuery, setSearchQuery] = useState('')
	const [refreshing, setRefreshing] = useState(false)
	const [isLoading, setIsLoading] = useState(true)
	const sectionListRef = useRef<SectionList>(null)
	const router = useRouter()
	const searchBarWidth = useRef(new Animated.Value(0)).current
	const searchBarOpacity = useRef(new Animated.Value(0)).current

	const bgColor = isDarkMode ? 'bg-night' : 'bg-white'
	const textColor = isDarkMode ? 'text-white' : 'text-black'

	const animateSearchBar = useCallback(() => {
		Animated.parallel([
			Animated.timing(searchBarWidth, {
				toValue: 1,
				duration: 500,
				easing: Easing.out(Easing.quad),
				useNativeDriver: false
			}),
			Animated.timing(searchBarOpacity, {
				toValue: 1,
				duration: 500,
				easing: Easing.out(Easing.quad),
				useNativeDriver: false
			})
		]).start()
	}, [searchBarWidth, searchBarOpacity])

	const fetchDealerships = useCallback(async () => {
		setIsLoading(true)
		try {
			const { data, error } = await supabase
				.from('dealerships')
				.select('id, name, logo')
				.order('name')

			if (error) throw error

			setDealerships(data || [])
		} catch (error) {
			console.error('Error fetching dealerships:', error)
			Alert.alert('Error', 'Failed to fetch dealerships')
		} finally {
			setIsLoading(false)
		}
	}, [])

	useEffect(() => {
		fetchDealerships()
		animateSearchBar()
	}, [fetchDealerships, animateSearchBar])

	const onRefresh = useCallback(async () => {
		setRefreshing(true)
		await fetchDealerships()
		setRefreshing(false)
	}, [fetchDealerships])

	const filteredDealerships = useMemo(() => {
		return dealerships.filter(dealership =>
			dealership.name.toLowerCase().includes(searchQuery.toLowerCase())
		)
	}, [dealerships, searchQuery])

	const groupedDealerships = useMemo(() => {
		const groups: { title: string; data: Dealership[] }[] = []
		const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')

		alphabet.forEach(letter => {
			const dealershipsForLetter = filteredDealerships.filter(dealership =>
				dealership.name.toUpperCase().startsWith(letter)
			)
			if (dealershipsForLetter.length > 0) {
				groups.push({ title: letter, data: dealershipsForLetter })
			}
		})

		return groups
	}, [filteredDealerships])

	const handleDealershipPress = useCallback(
		(dealership: Dealership) => {
			router.push({
				pathname: '/(home)/(user)/DealershipDetails',
				params: { dealershipId: dealership.id }
			})
		},
		[router]
	)

	const renderSectionHeader = useCallback(
		({ section }: { section: SectionListData<Dealership> }) => (
			<LinearGradient
				colors={isDarkMode ? ['#1A1A1A', '#2A2A2A'] : ['#F0F0F0', '#E0E0E0']}
				className='py-2 px-4'>
				<Text className={`${textColor} font-bold text-lg`}>
					{section.title}
				</Text>
			</LinearGradient>
		),
		[isDarkMode, textColor]
	)

	const renderDealershipItem = useCallback(
		({ item }: { item: Dealership }) => (
			<DealershipItem
				item={item}
				onPress={handleDealershipPress}
				textColor={textColor}
				isDarkMode={isDarkMode}
			/>
		),
		[handleDealershipPress, textColor, isDarkMode]
	)

	const renderListEmptyComponent = useCallback(
		() => (
			<View className='flex-1 justify-center items-center py-20'>
				<Ionicons
					name='sad-outline'
					size={50}
					color={isDarkMode ? '#FFFFFF' : '#000000'}
				/>
				<Text className={`${textColor} text-lg mt-4`}>
					No dealerships found
				</Text>
			</View>
		),
		[isDarkMode, textColor]
	)

	const renderShimmerPlaceholder = useCallback(
		() => (
			<View className='flex-1 justify-center items-center'>
				{[...Array(3)].map((_, index) => (
					<ShimmerPlaceholder
						key={index}
						style={{
							width: '90%',
							height: 60,
							marginBottom: 10,
							borderRadius: 10
						}}
						shimmerColors={
							isDarkMode
								? ['#333', '#3A3A3A', '#333']
								: ['#f6f7f8', '#edeef1', '#f6f7f8']
						}
					/>
				))}
			</View>
		),
		[isDarkMode]
	)

	return (
		<View className={`flex-1 ${bgColor}`}>
			<CustomHeader title='Dealerships' />
			<Animated.View
				style={{
					width: searchBarWidth.interpolate({
						inputRange: [0, 1],
						outputRange: ['0%', '100%']
					}),
					opacity: searchBarOpacity
				}}>
				<View
					className={`mx-4 my-2 rounded-full flex-row items-center ${
						isDarkMode ? 'bg-gray' : 'bg-white'
					}`}>
					<FontAwesome
						name='search'
						size={20}
						color={isDarkMode ? 'white' : 'black'}
						style={{ marginLeft: 12 }}
					/>
					<AnimatedTextInput
						className={`p-2 flex-1 ${textColor}`}
						placeholder='Search dealerships...'
						placeholderTextColor={isDarkMode ? 'lightgray' : 'gray'}
						value={searchQuery}
						onChangeText={setSearchQuery}
					/>
				</View>
			</Animated.View>
			{isLoading ? (
				renderShimmerPlaceholder()
			) : (
				<SectionList
					ref={sectionListRef}
					sections={groupedDealerships}
					renderItem={renderDealershipItem}
					renderSectionHeader={renderSectionHeader}
					keyExtractor={item => `${item.id}-${item.name}`}
					stickySectionHeadersEnabled={true}
					ListEmptyComponent={renderListEmptyComponent}
					refreshControl={
						<RefreshControl
							refreshing={refreshing}
							onRefresh={onRefresh}
							colors={['#D55004']}
							tintColor={isDarkMode ? '#FFFFFF' : '#000000'}
							title='Pull to refresh'
							titleColor={isDarkMode ? '#FFFFFF' : '#000000'}
						/>
					}
				/>
			)}
		</View>
	)
}
