import React, { useMemo } from 'react'
import {
	View,
	Text,
	Image,
	TouchableOpacity,
	ScrollView,
	Dimensions,
	Linking,
	Alert,
	Share
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { styled } from 'nativewind'
import { formatDistanceToNow } from 'date-fns'

const StyledView = styled(View)
const StyledText = styled(Text)
const StyledImage = styled(Image)
const StyledTouchableOpacity = styled(TouchableOpacity)
const StyledScrollView = styled(ScrollView)

const { height: SCREEN_HEIGHT } = Dimensions.get('window')

export default function CarCard({
	car,
	onPress,
	onFavoritePress,
	isFavorite,
	tabBarHeight
}: any) {
	const cardHeight = SCREEN_HEIGHT - (tabBarHeight || 50)

	const formattedListingDate = useMemo(() => {
		return formatDistanceToNow(new Date(car.listed_at), { addSuffix: true })
	}, [car.listed_at])

	const handleCall = () => {
		if (car.dealership_phone) {
			Linking.openURL(`tel:${car.dealership_phone}`)
		} else {
			Alert.alert('Phone number not available')
		}
	}

	const handleWhatsApp = () => {
		if (car.dealership_phone) {
			const message = `Hi, I'm interested in the ${car.year} ${car.make} ${car.model}.`
			const url = `https://wa.me/${car.dealership_phone
				}?text=${encodeURIComponent(message)}`
			Linking.openURL(url)
		} else {
			Alert.alert('WhatsApp number not available')
		}
	}

	const handleChat = () => {
		Alert.alert('Chat feature coming soon!')
	}

	const handleShare = async () => {
		try {
			await Share.share({
				message: `Check out this ${car.year} ${car.make} ${car.model
					} for $${car.price.toLocaleString()}!`,
				url: car.images[0]
			})
		} catch (error: any) {
			Alert.alert('Error sharing', error.message)
		}
	}

	return (
		<StyledScrollView >
			<StyledTouchableOpacity
				onPress={onPress}
				className='m-4 bg-black border-red border rounded-3xl overflow-hidden shadow-xl shadow-stone-200'>
				<StyledView className='relative'>
					<StyledImage
						source={{ uri: car.images[0] }}
						className='w-full h-64 rounded-t-3xl'
					/>
					<StyledView className='absolute top-4 right-4 rounded-full p-1'>
						<TouchableOpacity onPress={onFavoritePress}>
							<Ionicons
								name={isFavorite ? 'heart' : 'heart-outline'}
								size={28}
								color={isFavorite ? '#EF4444' : '#D1D5DB'}
							/>
						</TouchableOpacity>
					</StyledView>
					<StyledView className='absolute bottom-4 left-4 bg-red/60 rounded-full px-3 py-1'>
						<StyledText className='text-white text-sm'>
							{formattedListingDate}
						</StyledText>
					</StyledView>
				</StyledView>

				<StyledView className='p-3 border'>
					<StyledView className='flex-row justify-between items-center my-2 '>
						<StyledView className='flex-row items-center'>
							<Ionicons name='eye-outline' size={18} color='#6B7280' />
							<StyledText className='ml-2 text-white'>
								{car.views || 0} views
							</StyledText>
						</StyledView>
						<StyledView className='flex-row items-center'>
							<Ionicons name='heart' size={18} color='#EF4444' />
							<StyledText className='ml-2 text-white'>
								{car.likes || 0} likes
							</StyledText>
						</StyledView>
					</StyledView>

					<StyledView className='flex-row justify-between items-center mb-4 mt-2'>
						<StyledView>
							<StyledText className='text-2xl font-semibold text-white'>
								{car.year} {car.make} {car.model}
							</StyledText>
							<StyledText className='text-xl font-medium text-red mt-2'>
								${car.price.toLocaleString()}
							</StyledText>
							<StyledText className='text-s font-medium text-white mt-2'>
								{car.dealership_location}
							</StyledText>
						</StyledView>
						{car.dealership_logo && (
							<StyledImage
								source={{ uri: car.dealership_logo }}
								className='w-12 h-12 rounded-full'
								alt={`${car.dealership_name} logo`}
							/>
						)}
					</StyledView>



					<StyledView className="flex-row justify-between items-center  p-4 rounded-lg shadow-lg">
						<InfoItem
							icon="speedometer-outline"
							text={
								<Text className="font-semibold text-red">
									{car.mileage.toLocaleString()} <Text className="text-xs text-gray-500">km</Text>
								</Text>
							}
						/>
						<View className="w-0.5 bg-gray-300 h-full mx-2" />
						<InfoItem
							icon="cog-outline"
							text={
								<Text className="font-semibold text-red">
									{car.transmission}
								</Text>
							}
						/>
						<View className="w-0.5 bg-gray-300 h-full mx-2" />
						<InfoItem
							icon="car-sport-outline"
							text={
								<Text className="font-semibold text-red">
									{car.condition}
								</Text>
							}
						/>
					</StyledView>


					<View className='mt-1 mb-1' style={{ flexDirection: 'row', alignItems: 'center' }}>
						<View
							style={{ flex: 1, height: 1, backgroundColor: '#701E1E' }}
						/>
						<View
							style={{ flex: 1, height: 1, backgroundColor: '#701E1E' }}
						/>
					</View>

					<StyledView className='flex-row mx-12 justify-between items-center mt-2'>
						<ActionButton
							icon='call-outline'
							text='Call'
							onPress={handleCall}
						/>
						<ActionButton
							icon='logo-whatsapp'
							text='WhatsApp'
							onPress={handleWhatsApp}
						/>
						<ActionButton
							icon='chatbubble-outline'
							text='Chat'
							onPress={handleChat}
						/>
					</StyledView>
				</StyledView>
			</StyledTouchableOpacity>
		</StyledScrollView>
	)
}

const InfoItem = ({ icon, text }: any) => (
	<StyledView className='items-center'>
		<Ionicons name={icon} size={33} color='#FFFFFF' />
		<StyledText className='text-xs text-white mt-1'>{text}</StyledText>
	</StyledView>
)

const ActionButton = ({ icon, text, onPress }: any) => (
	<StyledTouchableOpacity
		onPress={onPress}
		className='items-center justify-center'>
		<Ionicons name={icon} size={25} color='white' />
	</StyledTouchableOpacity>
)
