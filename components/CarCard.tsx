import React from 'react';
import { View, Text, Image, TouchableOpacity, ScrollView, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { styled } from 'nativewind';

const StyledView = styled(View);
const StyledText = styled(Text);
const StyledImage = styled(Image);
const StyledTouchableOpacity = styled(TouchableOpacity);
const StyledScrollView = styled(ScrollView);

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function CarCard({
	car,
	onPress,
	onFavoritePress,
	isFavorite,
	tabBarHeight, // Pass the tabBarHeight as a prop
}: any) {
	const cardHeight = SCREEN_HEIGHT - (tabBarHeight || 50); // Calculate available height with fallback


	return (
		<StyledScrollView className="bg-white" contentContainerStyle={{ height: cardHeight || SCREEN_HEIGHT }}>
			<StyledTouchableOpacity onPress={onPress}>
				<StyledView className="relative">
					<StyledImage
						source={{ uri: car.images[0] }}
						className="w-full h-72"
					/>
					<StyledView className="absolute top-4 right-4 rounded-full p-2">
						<TouchableOpacity onPress={onFavoritePress}>
							<Ionicons
								name={isFavorite ? 'heart' : 'heart-outline'}
								size={28}
								color={isFavorite ? 'red' : 'white'}
							/>
						</TouchableOpacity>
					</StyledView>
				</StyledView>

				<StyledView className="flex-row justify-between items-center px-6 py-2 border-b border-red">
					<StyledView className="flex-row items-center">
						<Ionicons name="eye-outline" size={20} color="gray" />
						<StyledText className="ml-1 text-gray-600">{car.views}</StyledText>
					</StyledView>
					<StyledView className="flex-row items-center">
						<Ionicons name="heart-outline" size={20} color="gray" />
						<StyledText className="ml-1 text-gray-600">{car.likes}</StyledText>
					</StyledView>
				</StyledView>

				<StyledView className="p-6">
					<StyledView className="flex-row justify-between items-center mb-2">
						<StyledText className="text-3xl font-bold text-gray-800">
							{car.make} {car.model}
						</StyledText>
						{car.dealership_logo && (
							<StyledImage
								source={{ uri: car.dealership_logo }}
								className="w-20 h-12 ml-4"
								alt={`${car.dealership_name} logo`}
							/>
						)}
					</StyledView>
					<StyledText className="text-2xl text-red font-semibold text-red-600 mb-4">
						${car.price.toLocaleString()}
					</StyledText>

					<StyledView className="flex-row  mt-8 justify-between mb-6">
						<InfoItem icon="calendar-outline" text={car.year}  />
						<InfoItem icon="speedometer-outline" text={`${car.mileage}`} />
						<InfoItem icon="color-palette-outline" text={car.color} />
						<InfoItem icon="car-outline" text={car.condition} />
					</StyledView>



				</StyledView>
			</StyledTouchableOpacity>
		</StyledScrollView>
	);
}


const InfoItem = ({ icon, text }) => (
	<StyledView className="items-center">
		<Ionicons name={icon} size={24} color="gray" />
		<StyledText className="text-sm text-gray-600 mt-1">{text}</StyledText>
	</StyledView>
);
