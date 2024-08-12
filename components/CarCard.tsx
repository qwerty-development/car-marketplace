import React from 'react';
import { View, Text, Image, TouchableOpacity } from 'react-native';
import { Ionicons, FontAwesome } from '@expo/vector-icons';
import { styled } from 'nativewind';

const StyledView = styled(View);
const StyledText = styled(Text);
const StyledImage = styled(Image);
const StyledTouchableOpacity = styled(TouchableOpacity);

export default function CarCard({
	car,
	onPress,
	onFavoritePress,
	isFavorite,
}: any) {
	return (
		<StyledTouchableOpacity
			className="bg-white rounded-xl h-screen shadow-md mb-4 overflow-hidden"
			onPress={onPress}
		>
			<StyledImage
				source={{ uri: car.images[0] }}
				className="w-full h-48"
			/>
			<StyledView className="p-4 relative">

				<StyledText className="text-2xl font-bold text-gray-800">
					{car.make} {car.model}
				</StyledText>
				
				<StyledView className="flex-row items-center">
					<Ionicons name="calendar-outline" size={18} color="black" />
					<StyledText className="text-lg text-gray ml-1">
						{car.year}
					</StyledText>

					<View className="flex-row items-center ml-4">
						<FontAwesome name="road" size={18} color="black" />
						<StyledText className="text-lg text-gray-800 ml-1">
							{/* Placeholder for mileage */}
							{car.mileage} Miles
						</StyledText>
					</View>

					<StyledView className="flex-row items-center ml-4">
					<FontAwesome name="check" size={18} color="black" />
						<StyledText className={`text-lg ml-1 ${car.condition === 'New' ? 'text-green-600' : 'text-gray-600'}`}>
							{car.condition}
						</StyledText>
					</StyledView>
				</StyledView>
				<StyledText className="text-xl text-red">
					${car.price.toLocaleString()}
				</StyledText>
				<StyledTouchableOpacity
					className="absolute top-3 right-3"
					onPress={onFavoritePress}
				>
					<Ionicons
						name={isFavorite ? 'heart' : 'heart-outline'}
						size={24}
						color={isFavorite ? 'red' : 'gray'}
					/>
				</StyledTouchableOpacity>
				<StyledText className="absolute right-3 top-12 text-red text-xl font-bold text-md">
					{car.dealership_name}
				</StyledText>
			</StyledView>
		</StyledTouchableOpacity>
	);
}
