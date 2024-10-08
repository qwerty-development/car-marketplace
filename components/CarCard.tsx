import React, { useMemo, useState, useRef, useCallback } from 'react'
import {
	View,
	Text,
	TouchableOpacity,
	ScrollView,
	Dimensions,
	Linking,
	Alert,
	FlatList,
	Image,
	ActivityIndicator
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { styled } from 'nativewind'
import { formatDistanceToNow } from 'date-fns'
import { useTheme } from '@/utils/ThemeContext'
import { useRouter } from 'expo-router'

const StyledView = styled(View)
const StyledText = styled(Text)
const StyledImage = styled(Image)
const StyledTouchableOpacity = styled(TouchableOpacity)
const StyledScrollView = styled(ScrollView)

const { width: SCREEN_WIDTH } = Dimensions.get('window')

const InfoItem = ({ icon, text, isDarkMode }: any) => (
	<StyledView className='items-center'>
		<Ionicons
			name={icon}
			size={33}
			color={isDarkMode ? '#FFFFFF' : '#000000'}
		/>
		<StyledText className='text-xs text-white mt-1'>{text}</StyledText>
	</StyledView>
)

const ActionButton = ({ icon, text, onPress, isDarkMode }: any) => (
	<StyledTouchableOpacity
		onPress={onPress}
		className='items-center justify-center'>
		<Ionicons
			name={icon}
			size={25}
			color={isDarkMode ? '#FFFFFF' : '#000000'}
		/>
		<StyledText
			className={`text-xs mt-1 ${isDarkMode ? 'text-white' : 'text-black'}`}>
			{text}
		</StyledText>
	</StyledTouchableOpacity>
)

const OptimizedImage = ({ source, style, onLoad }: any) => {
	const [loaded, setLoaded] = useState(false)

	const handleLoad = useCallback(() => {
		setLoaded(true)
		onLoad && onLoad()
	}, [onLoad])

	return (
		<View style={[style, { overflow: 'hidden' }]}>
			{!loaded && (
				<View
					style={[
						style,
						{
							backgroundColor: '#E0E0E0',
							position: 'absolute',
							justifyContent: 'center',
							alignItems: 'center'
						}
					]}>
					<ActivityIndicator size='large' color='#D55004' />
				</View>
			)}
			<StyledImage
				source={source}
				style={[style, { opacity: loaded ? 1 : 0 }]}
				onLoad={handleLoad}
				resizeMode='cover'
			/>
		</View>
	)
}

export default function CarCard({
	car,
	onPress,
	onFavoritePress,
	isFavorite,
	isDealer = false
}: any) {
	const { isDarkMode } = useTheme()
	const router = useRouter()
	const [currentImageIndex, setCurrentImageIndex] = useState(0)
	const flatListRef = useRef(null)

	const formattedListingDate = useMemo(() => {
		return formatDistanceToNow(new Date(car.listed_at), { addSuffix: true })
	}, [car.listed_at])

	const handleCall = useCallback(() => {
		if (car.dealership_phone) {
			Linking.openURL(`tel:${car.dealership_phone}`)
		} else {
			Alert.alert('Phone number not available')
		}
	}, [car.dealership_phone])

	const handleDealershipPress = useCallback(() => {
		router.push({
			pathname: '/(home)/(user)/DealershipDetails',
			params: { dealershipId: car.dealership_id }
		})
	}, [router, car.dealership_id])

	const handleWhatsApp = useCallback(() => {
		if (car.dealership_phone) {
			const message = `Hi, I'm interested in the ${car.year} ${car.make} ${car.model}.`
			const url = `https://wa.me/${
				car.dealership_phone
			}?text=${encodeURIComponent(message)}`
			Linking.openURL(url)
		} else {
			Alert.alert('WhatsApp number not available')
		}
	}, [car])

	const handleChat = useCallback(() => {
		Alert.alert('Chat feature coming soon!')
	}, [])

	const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
		if (viewableItems.length > 0) {
			setCurrentImageIndex(viewableItems[0].index)
		}
	}).current

	const viewabilityConfig = useRef({
		itemVisiblePercentThreshold: 50
	}).current

	const renderImage = useCallback(
		({ item }: any) => (
			<OptimizedImage
				source={{ uri: item }}
				style={{
					width: SCREEN_WIDTH - 35,
					height: 245,
					borderRadius: 20
				}}
			/>
		),
		[]
	)

	return (
		<StyledView
			className={`m-4 ${
				isDarkMode
					? 'bg-black border-red'
					: 'bg-light-secondary border-light-accent'
			} border rounded-3xl overflow-hidden shadow-xl shadow-stone-200`}>
			<View className='overflow-hidden'>
				<FlatList
					ref={flatListRef}
					data={car.images}
					renderItem={renderImage}
					keyExtractor={(item, index) => index.toString()}
					horizontal
					pagingEnabled
					showsHorizontalScrollIndicator={false}
					onViewableItemsChanged={onViewableItemsChanged}
					viewabilityConfig={viewabilityConfig}
					initialNumToRender={1}
					maxToRenderPerBatch={2}
					windowSize={3}
					removeClippedSubviews={true}
					contentContainerStyle={{ flexGrow: 0 }} // Add padding to the content
				/>
			</View>
			<StyledTouchableOpacity onPress={onPress}>
				<StyledView className='relative'>
					<StyledView className='absolute bottom-4 left-0 right-0 flex-row justify-center'>
						{car.images.map((_: any, index: number) => (
							<View
								key={index}
								className={`h-2 w-2 rounded-full mx-1 ${
									index === currentImageIndex ? 'bg-white' : 'bg-white/50'
								}`}
							/>
						))}
					</StyledView>

					{!isDealer && (
						<StyledView className='absolute bottom-4 right-4 rounded-full p-1'>
							<TouchableOpacity onPress={onFavoritePress}>
								<Ionicons
									name={isFavorite ? 'heart' : 'heart-outline'}
									size={28}
									color={isFavorite ? '#EF4444' : '#D1D5DB'}
								/>
							</TouchableOpacity>
						</StyledView>
					)}

					<StyledView className='absolute bottom-4 left-4 bg-red/60 rounded-full px-3 py-1'>
						<StyledText className='text-white text-sm'>
							{formattedListingDate}
						</StyledText>
					</StyledView>
				</StyledView>

				<StyledView
					className={`p-3 ${
						isDarkMode ? 'border-red' : 'border-light-accent'
					}`}>
					<StyledView className='flex-row justify-between items-center my-2'>
						<StyledView className='flex-row items-center'>
							<Ionicons
								name='eye-outline'
								size={18}
								color={isDarkMode ? '#6B7280' : '#4C4C4C'}
							/>
							<StyledText
								className={`ml-2 ${
									isDarkMode ? 'text-white' : 'text-light-text'
								}`}>
								{car.views || 0} views
							</StyledText>
						</StyledView>
						<StyledView className='flex-row items-center'>
							<Ionicons name='heart' size={18} color='#EF4444' />
							<StyledText
								className={`ml-2 ${
									isDarkMode ? 'text-white' : 'text-light-text'
								}`}>
								{car.likes || 0} likes
							</StyledText>
						</StyledView>
					</StyledView>

					<StyledView className='flex-row justify-between items-center mb-4 mt-2'>
						<StyledView className='flex-1'>
							<StyledText
								className={`text-2xl font-semibold ${
									isDarkMode ? 'text-white' : 'text-light-text'
								}`}>
								{car.year} {car.make} {car.model}
							</StyledText>
							<StyledText
								className={`text-xl font-medium ${
									isDarkMode ? 'text-red' : 'text-red'
								} mt-2`}>
								${car.price.toLocaleString()}
							</StyledText>
							<StyledText
								className={`text-s font-medium ${
									isDarkMode ? 'text-white' : 'text-light-text'
								} mt-2`}>
								{car.dealership_location}
							</StyledText>
						</StyledView>
						{car.dealership_logo && (
							<TouchableOpacity
								onPress={handleDealershipPress}
								disabled={isDealer}
								className='absolute top-5 right-0'>
								<OptimizedImage
									source={{ uri: car.dealership_logo }}
									style={{ width: 54, height: 54, borderRadius: 27 }}
								/>
							</TouchableOpacity>
						)}
					</StyledView>

					<StyledView className='flex-row justify-between items-center p-4 rounded-lg shadow-lg'>
						<InfoItem
							icon='speedometer-outline'
							text={
								<View className='flex items-center min-w-[80px]'>
									<Text
										className={`text-s ${
											isDarkMode ? 'text-red' : 'text-red'
										}`}>
										{car.mileage.toLocaleString()}{' '}
										<Text className='text-xs text-gray-500'>km</Text>
									</Text>
								</View>
							}
							isDarkMode={isDarkMode}
						/>
						<View className='w-0.5 bg-gray-300 h-full mx-2' />
						<InfoItem
							icon='cog-outline'
							text={
								<View className='flex items-center min-w-[80px]'>
									<Text className={isDarkMode ? 'text-red' : 'text-red'}>
										{car.transmission}
									</Text>
								</View>
							}
							isDarkMode={isDarkMode}
						/>
						<View className='w-0.5 bg-gray-300 h-full mx-2' />
						<InfoItem
							icon='car-sport-outline'
							text={
								<View className='flex items-center min-w-[80px]'>
									<Text className={isDarkMode ? 'text-red' : 'text-red'}>
										{car.condition}
									</Text>
								</View>
							}
							isDarkMode={isDarkMode}
						/>
					</StyledView>

					<View
						className='mt-1 mb-1'
						style={{ flexDirection: 'row', alignItems: 'center' }}>
						<View style={{ flex: 1, height: 1, backgroundColor: '#D55004' }} />
						<View style={{ flex: 1, height: 1, backgroundColor: '#D55004' }} />
					</View>

					<StyledView className='flex-row mx-12 justify-between items-center mt-2'>
						<ActionButton
							icon='call-outline'
							text='Call'
							onPress={handleCall}
							isDarkMode={isDarkMode}
						/>
						<ActionButton
							icon='logo-whatsapp'
							text='WhatsApp'
							onPress={handleWhatsApp}
							isDarkMode={isDarkMode}
						/>
						<ActionButton
							icon='chatbubble-outline'
							text='Chat'
							onPress={handleChat}
							isDarkMode={isDarkMode}
						/>
					</StyledView>
				</StyledView>
			</StyledTouchableOpacity>
		</StyledView>
	)
}
