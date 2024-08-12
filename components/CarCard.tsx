// components/CarCard.tsx
import React from 'react'
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'

export default function CarCard({
	car,
	onPress,
	onFavoritePress,
	isFavorite
}: any) {
	return (
		<TouchableOpacity style={styles.container} onPress={onPress}>
			<Image source={{ uri: car.images[0] }} style={styles.image} />
			<View style={styles.infoContainer}>
				<Text style={styles.title}>
					{car.year} {car.make} {car.model}
				</Text>
				<Text style={styles.price}>${car.price}</Text>
				<TouchableOpacity
					style={styles.favoriteButton}
					onPress={onFavoritePress}>
					<Ionicons
						name={isFavorite ? 'heart' : 'heart-outline'}
						size={24}
						color={isFavorite ? 'red' : 'black'}
					/>
				</TouchableOpacity>
			</View>
		</TouchableOpacity>
	)
}

const styles = StyleSheet.create({
	container: {
		backgroundColor: 'white',
		borderRadius: 10,
		marginBottom: 15,
		overflow: 'hidden'
	},
	image: {
		width: '100%',
		height: 200
	},
	infoContainer: {
		padding: 10
	},
	title: {
		fontSize: 18,
		fontWeight: 'bold'
	},
	price: {
		fontSize: 16,
		color: 'green',
		marginTop: 5
	},
	favoriteButton: {
		position: 'absolute',
		top: 10,
		right: 10
	}
})
