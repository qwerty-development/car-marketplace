// components/CarDetailModal.tsx
import React, { useCallback, useEffect } from 'react'
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
import { useUser } from '@clerk/clerk-expo'
import { supabase } from '@/utils/supabase'
import { debounce } from '@/utils/debounce'
const { width } = Dimensions.get('window')

export default function CarDetailModal({
	isVisible,
	car,
	onClose,
	onFavoritePress,
	isFavorite,
	onViewUpdate
}: any) {
	if (!car) return null

	const renderImageItem = ({ item }: any) => (
		<Image source={{ uri: item }} style={styles.image} />
	)
	const { user } = useUser()

	useEffect(() => {
		if (isVisible && car && user) {
			trackCarView(car.id, user.id)
		}
	}, [isVisible, car, user])

	const trackCarView = useCallback(
		async (carId: number, userId: string) => {
			try {
				const { data, error } = await supabase.rpc('track_car_view', {
					car_id: carId,
					user_id: userId
				})

				if (error) throw error

				if (data && onViewUpdate) {
					onViewUpdate(carId, data)
				}
			} catch (error) {
				console.error('Error tracking car view:', error)
			}
		},
		[onViewUpdate]
	)

	const debouncedTrackCarView = useCallback(
		debounce((carId: number, userId: string) => {
			trackCarView(carId, userId)
		}, 1000),
		[trackCarView]
	)

	useEffect(() => {
		if (isVisible && car && user) {
			debouncedTrackCarView(car.id, user.id)
		}
	}, [isVisible, car, user, debouncedTrackCarView])

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
