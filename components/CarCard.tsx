import React from 'react'
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

	const handleCall = () => {
		if (car.dealership_phone) {
			Linking.openURL(`tel:${car.dealership_phone}`)
		} else {
			Alert.alert('Phone number not available')
		}
	}

	const handleWhatsApp = () => {
		if (car.dealership_phone) {
			const message = `Hi, I'm interested in the ${car.make} ${car.model}.`
			const url = `https://wa.me/${
				car.dealership_phone
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
			const result = await Share.share({
				message: `Check out this ${car.year} ${car.make} ${
					car.model
				} for $${car.price.toLocaleString()}!`,
				url: car.images[0] // You might want to replace this with an actual link to the car listing
			})
			if (result.action === Share.sharedAction) {
				if (result.activityType) {
					// shared with activity type of result.activityType
				} else {
					// shared
				}
			} else if (result.action === Share.dismissedAction) {
				// dismissed
			}
		} catch (error: any) {
			Alert.alert(error.message)
		}
	}

	return (
		<StyledScrollView
			className='bg-gray-100'
			contentContainerStyle={{ height: cardHeight || SCREEN_HEIGHT }}>
			<StyledTouchableOpacity
				onPress={onPress}
				className='m-4 bg-white rounded-3xl shadow-lg overflow-hidden'>
				<StyledView className='relative'>
					<StyledImage
						source={{ uri: car.images[0] }}
						className='w-full h-64 rounded-t-3xl'
					/>
					<StyledView className='absolute top-4 right-4 bg-white/50 rounded-full p-2'>
						<TouchableOpacity onPress={onFavoritePress}>
							<Ionicons
								name={isFavorite ? 'heart' : 'heart-outline'}
								size={28}
								color={isFavorite ? 'red' : 'black'}
							/>
						</TouchableOpacity>
					</StyledView>
				</StyledView>

				<StyledView className='p-6'>
					<StyledView className='flex-row justify-between items-center mb-6'>
						<StyledView className='flex-row items-center'>
							<Ionicons name='eye-outline' size={20} color='gray' />
							<StyledText className='ml-2 text-gray-600'>
								{car.views || 0} views
							</StyledText>
						</StyledView>
						<StyledView className='flex-row items-center'>
							<Ionicons name='heart-outline' size={20} color='gray' />
							<StyledText className='ml-2 text-gray-600'>
								{car.likes} likes
							</StyledText>
						</StyledView>
					</StyledView>
					<StyledView className='flex-row justify-between items-center mb-4'>
						<StyledView>
							<StyledText className='text-3xl font-bold text-gray-800'>
								{car.make} {car.model}
							</StyledText>
							<StyledText className='text-2xl font-semibold text-red mt-1'>
								${car.price.toLocaleString()}
							</StyledText>
						</StyledView>
						{car.dealership_logo && (
							<StyledImage
								source={{ uri: car.dealership_logo }}
								className='w-16 h-16 rounded-full'
								alt={`${car.dealership_name} logo`}
							/>
						)}
					</StyledView>

					<StyledView className='flex-row justify-between mb-6'>
						<InfoItem icon='calendar-outline' text={car.year} />
						<InfoItem icon='speedometer-outline' text={`${car.mileage} km`} />
						<InfoItem icon='color-palette-outline' text={car.color} />
						<InfoItem icon='car-outline' text={car.condition} />
					</StyledView>

					<StyledView className='flex-row justify-around'>
						<ActionButton
							icon='call-outline'
							color='#4CAF50'
							onPress={handleCall}
						/>
						<ActionButton
							icon='logo-whatsapp'
							color='#25D366'
							onPress={handleWhatsApp}
						/>
						<ActionButton
							icon='chatbubble-outline'
							color='#FF9800'
							onPress={handleChat}
						/>
						<ActionButton
							icon='share-social-outline'
							color='#2196F3'
							onPress={handleShare}
						/>
					</StyledView>
				</StyledView>
			</StyledTouchableOpacity>
		</StyledScrollView>
	)
}

const InfoItem = ({ icon, text }: any) => (
	<StyledView className='items-center'>
		<Ionicons name={icon} size={24} color='#4A5568' />
		<StyledText className='text-sm text-gray-600 mt-1'>{text}</StyledText>
	</StyledView>
)

const ActionButton = ({ icon, color, onPress }: any) => (
	<StyledTouchableOpacity
		onPress={onPress}
		className='w-14 h-14 rounded-full flex items-center justify-center shadow-md'
		style={{ backgroundColor: color }}>
		<Ionicons name={icon} size={24} color='white' />
	</StyledTouchableOpacity>
)
