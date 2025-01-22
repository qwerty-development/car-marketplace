import React, { useMemo, useState, useRef, useCallback } from 'react'
import {
	View,
	Text,
	TouchableOpacity,
	Dimensions,
	Linking,
	Alert,
	FlatList,
	Image,
	ActivityIndicator,
	TouchableWithoutFeedback,
	Pressable,
	Share
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { styled } from 'nativewind'
import { useTheme } from '@/utils/ThemeContext'
import { useRouter } from 'expo-router'
import { LinearGradient } from 'expo-linear-gradient'

const StyledView = styled(View)
const StyledText = styled(Text)
const StyledImage = styled(Image)
const StyledTouchableOpacity = styled(TouchableOpacity)

const { width: SCREEN_WIDTH } = Dimensions.get('window')

const OptimizedImage = ({ source, style, onLoad }: any) => {
	const [loaded, setLoaded] = useState(false)
	const { isDarkMode } = useTheme()

	const handleLoad = useCallback(() => {
		setLoaded(true)
		onLoad?.()
	}, [onLoad])

	return (
		<View style={[style, { overflow: 'hidden' }]}>
			{!loaded && (
				<View
					style={[
						style,
						{
							backgroundColor: isDarkMode ? '#2D2D2D' : '#E0E0E0',
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

const SpecItem = ({ icon, title, value, isDarkMode }: any) => (
	<StyledView className='flex-1 items-center justify-center'>
		<StyledText
			className={`text-xs mb-1 ${
				isDarkMode ? 'text-[#e6e6e6]' : 'text-textgray'
			}`}
			style={{ textAlign: 'center' }}>
			{title}
		</StyledText>
		<Ionicons
			name={icon}
			size={30}
			color={isDarkMode ? '#FFFFFF' : '#000000'}
			style={{ marginVertical: 1 }}
		/>
		<StyledText
			className={`text-sm font-bold mt-1 ${
				isDarkMode ? 'text-white' : 'text-black'
			}`}
			style={{ textAlign: 'center' }}>
			{value}
		</StyledText>
	</StyledView>
)

const ActionButton = ({ icon, text, onPress, isDarkMode }: any) => (
	<StyledTouchableOpacity
		onPress={onPress}
		className='items-center justify-center px-4'>
		<Ionicons
			name={icon}
			size={25}
			color={isDarkMode ? '#FFFFFF' : '#000000'}
		/>
		{text && (
			<StyledText
				className={`text-xs mt-0.5 ${
					isDarkMode ? 'text-white' : 'text-black'
				}`}>
				{text}
			</StyledText>
		)}
	</StyledTouchableOpacity>
)

export default function CarCard({
	car,
	onFavoritePress,
	isFavorite,
	isDealer = false
}: any) {
	const { isDarkMode } = useTheme()
	const router = useRouter()
	const [currentImageIndex, setCurrentImageIndex] = useState(0)
	const flatListRef = useRef(null)

	const handleCardPress = useCallback(() => {
		router.push({
			pathname: isDealer
				? '/(home)/(dealer)/CarDetailModalIOS'
				: '/(home)/(user)/CarDetails',
			params: {
				carId: car.id,
				car: JSON.stringify(car),
				isDealerView: isDealer
			}
		})
	}, [router, car, isDealer])

	const handleCall = useCallback(() => {
		if (car.dealership_phone) {
			Linking.openURL(`tel:${car.dealership_phone}`)
		} else {
			Alert.alert('Phone number not available')
		}
	}, [car.dealership_phone])

	const handleShare = useCallback(async () => {
		try {
			const message =
				`Check out this ${car.year} ${car.make} ${car.model}\n` +
				`Price: $${car.price.toLocaleString()}\n` +
				`Mileage: ${(car.mileage / 1000).toFixed(1)}k miles\n` +
				`Condition: ${car.condition}\n` +
				`At: ${car.dealership_name}\n` +
				`Contact: ${
					car.dealership_phone || 'Contact dealer for more information'
				}`

			await Share.share({
				message,
				title: `${car.year} ${car.make} ${car.model}`
			})
		} catch (error) {
			Alert.alert('Error', 'Failed to share car details')
		}
	}, [car])

	const handleDealershipPress = useCallback(() => {
		const route = isDealer
			? '/(home)/(dealer)/DealershipDetails'
			: '/(home)/(user)/DealershipDetails'
		router.push({
			pathname: route,
			params: { dealershipId: car.dealership_id }
		})
	}, [isDealer, router, car.dealership_id])

	const formattedLocation = useMemo(() => {
		if (car.dealership_location?.length > 20) {
			return (
				car.dealership_location.slice(0, 20) +
				'\n' +
				car.dealership_location.slice(20)
			)
		}
		return car.dealership_location
	}, [car.dealership_location])

	const onViewableItemsChanged = useCallback(({ viewableItems }: any) => {
		if (viewableItems.length > 0) {
			setCurrentImageIndex(viewableItems[0].index)
		}
	}, [])

	const viewabilityConfig = useRef({
		itemVisiblePercentThreshold: 50
	}).current

	const renderImage = useCallback(
		({ item }: any) => (
			<Pressable onPress={handleCardPress}>
				<View className='relative'>
					<OptimizedImage
						source={{ uri: item }}
						style={{
							width: SCREEN_WIDTH - 30,
							height: 245
						}}
					/>

					<LinearGradient
						colors={['transparent', 'rgba(0,0,0,0.7)']}
						className='absolute bottom-0 left-0 right-0 h-32'
					/>

					{/* Updated layout for car info and price */}
					<View className='absolute bottom-0 w-full p-4'>
						{/* Price section - Now positioned absolutely */}
						<View className='absolute top-4 right-4 z-10'>
							<StyledView className='bg-red/90 px-4 py-2 rounded-2xl backdrop-blur-sm'>
								<StyledText className='text-white text-lg font-extrabold'>
									${car.price.toLocaleString()}
								</StyledText>
							</StyledView>
						</View>

						{/* Car details section with flex-1 to take remaining space */}
						<View className='pr-32'>
							{' '}
							{/* Added right padding to prevent overlap with price */}
							<StyledText
								className='text-white text-xl font-bold mb-1'
								numberOfLines={1}>
								{car.make} {car.model}
							</StyledText>
							<View className='flex-row items-center flex-wrap'>
								<View className='flex-row items-center mr-4'>
									<Ionicons name='eye-outline' size={16} color='#FFF' />
									<StyledText className='text-zinc-200 text-sm ml-1'>
										{car.views || 0}
									</StyledText>
								</View>

								<View className='flex-row items-center mr-4'>
									<Ionicons name='heart-outline' size={16} color='#FFF' />
									<StyledText className='text-zinc-200 text-sm ml-1'>
										{car.likes || 0}
									</StyledText>
								</View>

								{car.category && (
									<View className='bg-slate-700/70 px-2 py-1 rounded-full'>
										<StyledText className='text-white text-xs'>
											{car.category}
										</StyledText>
									</View>
								)}
							</View>
						</View>
					</View>

					{!isDealer && (
						<StyledTouchableOpacity
							onPress={() => onFavoritePress(car.id)}
							className={`absolute top-4 right-4 ${
								isDarkMode ? 'bg-black/60' : 'bg-black/40'
							} rounded-full p-3 backdrop-blur-sm`}>
							<Ionicons
								name={isFavorite ? 'heart' : 'heart-outline'}
								size={24}
								color={isFavorite ? '#EF4444' : '#FFFFFF'}
							/>
						</StyledTouchableOpacity>
					)}
				</View>
			</Pressable>
		),
		[car, isFavorite, isDealer, onFavoritePress, isDarkMode, handleCardPress]
	)

	return (
		<StyledView
			className={`m-4 mb-4 ${
				isDarkMode ? 'bg-textgray' : 'bg-[#e6e6e6]'
			} rounded-3xl overflow-hidden shadow-xl`}>
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
				decelerationRate='fast'
				snapToInterval={SCREEN_WIDTH - 30}
				snapToAlignment='center'
				bounces={false}
			/>

			<StyledTouchableOpacity onPress={handleCardPress} activeOpacity={0.9}>
				<StyledView className='flex items-center justify-center'>
					<StyledView
						className={`${isDarkMode ? 'bg-gray' : 'bg-gray'} my-2 w-5/6`}
					/>
				</StyledView>

				<StyledView className='flex-row justify-between mt-4 mb-4'>
					<SpecItem
						title='Year'
						icon='calendar-outline'
						value={car.year}
						isDarkMode={isDarkMode}
					/>
					<SpecItem
						title='Mileage'
						icon='speedometer-outline'
						value={`${(car.mileage / 1000).toFixed(1)}k`}
						isDarkMode={isDarkMode}
					/>
					<SpecItem
						title='Transm.'
						icon='cog-outline'
						value={
							car.transmission === 'Automatic'
								? 'Auto'
								: car.transmission === 'Manual'
								? 'Man'
								: car.transmission
						}
						isDarkMode={isDarkMode}
					/>
					<SpecItem
						title='Condition'
						icon='car-sport-outline'
						value={car.condition}
						isDarkMode={isDarkMode}
					/>
				</StyledView>

				<View className='w-full px-4'>
					<View className='h-[0.5px] mt-2 bg-textgray opacity-30' />
				</View>

				<StyledView className='p-4'>
					<StyledView className='flex-row items-start justify-between'>
						{car.dealership_logo && (
							<TouchableOpacity onPress={handleDealershipPress}>
								<OptimizedImage
									source={{ uri: car.dealership_logo }}
									style={{ width: 50, height: 48, borderRadius: 24 }}
								/>
							</TouchableOpacity>
						)}

						<StyledView className='flex-row items-start justify-between flex-1 ml-2'>
							<StyledView style={{ flexShrink: 1, marginRight: 10 }}>
								<StyledText
									className={`text-base font-medium ${
										isDarkMode ? 'text-white' : 'text-black'
									}`}
									numberOfLines={1}
									ellipsizeMode='tail'>
									{car.dealership_name}
								</StyledText>
								<StyledText
									className={`text-xs ${
										isDarkMode ? 'text-[#e6e6e6]' : 'text-textgray'
									}`}
									numberOfLines={2}
									ellipsizeMode='tail'>
									{formattedLocation}
								</StyledText>
							</StyledView>

							<StyledView style={{ flexShrink: 0, flexDirection: 'row' }}>
								<ActionButton
									icon='call-outline'
									onPress={handleCall}
									text='Call'
									isDarkMode={isDarkMode}
								/>
								<ActionButton
									icon='share-outline'
									onPress={handleShare}
									text='Share'
									isDarkMode={isDarkMode}
								/>
							</StyledView>
						</StyledView>
					</StyledView>
				</StyledView>
			</StyledTouchableOpacity>
		</StyledView>
	)
}
