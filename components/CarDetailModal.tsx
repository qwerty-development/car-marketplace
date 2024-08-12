// components/CarDetailModal.tsx
import React from 'react'
import {
	View,
	Text,
	Image,
	TouchableOpacity,
	StyleSheet,
	Modal,
	ScrollView,
	FlatList,
	Dimensions
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'

const { width } = Dimensions.get('window')

export default function CarDetailModal({
	isVisible,
	car,
	onClose,
	onFavoritePress,
	isFavorite
}: any) {
	if (!car) return null

	const renderImageItem = ({ item }: any) => (
		<Image source={{ uri: item }} style={styles.image} />
	)

	return (
		<Modal visible={isVisible} animationType='slide'>
			<ScrollView style={styles.container}>
				<TouchableOpacity style={styles.closeButton} onPress={onClose}>
					<Ionicons name='close' size={24} color='black' />
				</TouchableOpacity>
				<FlatList
					data={car.images}
					renderItem={renderImageItem}
					keyExtractor={(item, index) => index.toString()}
					horizontal
					pagingEnabled
					showsHorizontalScrollIndicator={false}
				/>
				<View style={styles.infoContainer}>
					<Text style={styles.title}>
						{car.year} {car.make} {car.model}
					</Text>
					<Text style={styles.price}>${car.price}</Text>
					<Text style={styles.description}>{car.description}</Text>
					<TouchableOpacity
						style={styles.favoriteButton}
						onPress={onFavoritePress}>
						<Ionicons
							name={isFavorite ? 'heart' : 'heart-outline'}
							size={24}
							color={isFavorite ? 'red' : 'black'}
						/>
						<Text style={styles.favoriteText}>
							{isFavorite ? 'Remove from Favorites' : 'Add to Favorites'}
						</Text>
					</TouchableOpacity>
				</View>
			</ScrollView>
		</Modal>
	)
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: 'white'
	},
	closeButton: {
		position: 'absolute',
		top: 40,
		right: 20,
		zIndex: 1
	},
	image: {
		width: width,
		height: 300,
		resizeMode: 'cover'
	},
	infoContainer: {
		padding: 20
	},
	title: {
		fontSize: 24,
		fontWeight: 'bold'
	},
	price: {
		fontSize: 20,
		color: 'green',
		marginTop: 10
	},
	description: {
		fontSize: 16,
		marginTop: 10
	},
	favoriteButton: {
		flexDirection: 'row',
		alignItems: 'center',
		marginTop: 20
	},
	favoriteText: {
		marginLeft: 10,
		fontSize: 16
	}
})
