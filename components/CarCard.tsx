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
			await Share.share({
				message: `Check out this ${car.year} ${car.make} ${
					car.model
				} for $${car.price.toLocaleString()}!`,
				url: car.images[0]
			})
		} catch (error: any) {
			Alert.alert('Error sharing', error.message)
		}
	}

	return (
		<StyledScrollView className='bg-black'>
			<StyledTouchableOpacity
				onPress={onPress}
				className='m-4 bg-black border border-gray-800 rounded-3xl overflow-hidden shadow-xl shadow-stone-200'>
				<StyledView className='relative'>
					<StyledImage
						source={{ uri: car.images[0] }}
						className='w-full h-64 rounded-t-3xl'
					/>
					<StyledView className='absolute top-4 right-4 bg-black/60 rounded-full p-1'>
						<TouchableOpacity onPress={onFavoritePress}>
							<Ionicons
								name={isFavorite ? 'heart' : 'heart-outline'}
								size={28}
								color={isFavorite ? '#EF4444' : '#D1D5DB'}
							/>
						</TouchableOpacity>
					</StyledView>
					<StyledView className='absolute bottom-4 left-4 bg-black/60 rounded-full px-3 py-1'>
						<StyledText className='text-white text-sm'>
							{formattedListingDate}
						</StyledText>
					</StyledView>
				</StyledView>

				<StyledView className='p-3'>
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
						</StyledView>
						{car.dealership_logo && (
							<StyledImage
								source={{ uri: car.dealership_logo }}
								className='w-12 h-12 rounded-full'
								alt={`${car.dealership_name} logo`}
							/>
						)}
					</StyledView>

					<StyledView className='flex-row justify-between items-center mb-4'>
						<InfoItem
							icon='speedometer-outline'
							text={`${car.mileage.toLocaleString()} km`}
						/>
						<InfoItem icon='cog-outline' text={car.transmission} />
						<InfoItem icon='car-sport-outline' text={car.condition} />
					</StyledView>

					<StyledView className='flex-row justify-between items-center mt-2'>
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
						<ActionButton
							icon='share-social-outline'
							text='Share'
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
		<Ionicons name={icon} size={20} color='#FFFFFF' />
		<StyledText className='text-xs text-white mt-1'>{text}</StyledText>
	</StyledView>
)

const ActionButton = ({ icon, text, onPress }: any) => (
	<StyledTouchableOpacity
		onPress={onPress}
		className='items-center justify-center'>
		<Ionicons name={icon} size={24} color='#D55004' />
		<StyledText className='text-white text-xs mt-1'>{text}</StyledText>
	</StyledTouchableOpacity>
)
