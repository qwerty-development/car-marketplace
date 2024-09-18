import React, { useMemo } from 'react'
import {
	View,
	Text,
	TouchableOpacity,
	ScrollView,
	Dimensions,
	Linking,
	Alert
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { styled } from 'nativewind'
import { formatDistanceToNow } from 'date-fns'
import { useTheme } from '@/utils/ThemeContext'
import { Image } from 'react-native'
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
	const { isDarkMode } = useTheme()
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

	const InfoItem = ({ icon, text }: any) => (
		<StyledView className='items-center'>
			<Ionicons
				name={icon}
				size={33}
				color={`${isDarkMode ? '#FFFFFF' : '#000000'}`}
			/>
			<StyledText className='text-xs text-white mt-1'>{text}</StyledText>
		</StyledView>
	)

	const ActionButton = ({ icon, text, onPress }: any) => (
		<StyledTouchableOpacity
			onPress={onPress}
			className='items-center justify-center'>
			<Ionicons
				name={icon}
				size={25}
				color={`${isDarkMode ? '#FFFFFF' : '#000000'}`}
			/>
		</StyledTouchableOpacity>
	)
	return (
		<StyledScrollView>
			<StyledTouchableOpacity
				onPress={onPress}
				className={`m-4 ${
					isDarkMode
						? 'bg-black border-red'
						: 'bg-light-secondary border-light-accent'
				} border rounded-3xl overflow-hidden shadow-xl shadow-stone-200`}>
				<StyledView className='relative'>
					<Image
						source={{ uri: car.images[0] }}
						className='w-full h-64 rounded-t-3xl'
						resizeMode='cover'
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

				<StyledView
					className={`p-3  ${
						isDarkMode ? 'border-red' : 'border-light-accent'
					}`}>
					<StyledView className='flex-row justify-between items-center my-2 '>
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
						<StyledView>
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
								className={`text-s font-medium 	${
									isDarkMode ? 'text-white' : 'text-light-text'
								} mt-2`}>
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

					<StyledView className='flex-row justify-between items-center p-4 rounded-lg shadow-lg'>
						<InfoItem
							icon='speedometer-outline'
							text={
								<View className='flex items-center min-w-[80px]'>
									<Text
										className={` text-s ${
											isDarkMode ? 'text-red' : 'text-red'
										}`}>
										{car.mileage.toLocaleString()}{' '}
										<Text className='text-xs text-gray-500'>km</Text>
									</Text>
								</View>
							}
						/>
						<View className='w-0.5 bg-gray-300 h-full mx-2' />
						<InfoItem
							icon='cog-outline'
							text={
								<View className='flex items-center min-w-[80px]'>
									<Text className={` ${isDarkMode ? 'text-red' : 'text-red'}`}>
										{car.transmission}
									</Text>
								</View>
							}
						/>
						<View className='w-0.5 bg-gray-300 h-full mx-2' />
						<InfoItem
							icon='car-sport-outline'
							text={
								<View className='flex items-center min-w-[80px]'>
									<Text className={` ${isDarkMode ? 'text-red' : 'text-red'}`}>
										{car.condition}
									</Text>
								</View>
							}
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
