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
import { useFavorites } from '@/utils/useFavorites'
const { width } = Dimensions.get('window')

export default function CarDetailModal({
	isVisible,
	car,
	onClose,
	onFavoritePress,
	onViewUpdate
}: any) {
	if (!car) return null

	const { user } = useUser()
	const { isFavorite } = useFavorites()
	const renderImageItem = ({ item }: any) => (
		<Image source={{ uri: item }} style={styles.image} />
	)

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
					<Text style={styles.price}>${car.price.toLocaleString()}</Text>
					<View style={styles.statsContainer}>
						<Text style={styles.statsText}>Views: {car.views || 0}</Text>
						<Text style={styles.statsText}>Likes: {car.likes || 0}</Text>
					</View>
					<Text style={styles.description}>{car.description}</Text>
					<View style={styles.detailsContainer}>
						<DetailItem
							icon='speedometer-outline'
							text={`${car.mileage.toLocaleString()} km`}
						/>
						<DetailItem icon='color-palette-outline' text={car.color} />
						<DetailItem icon='cog-outline' text={car.transmission} />
						<DetailItem icon='car-outline' text={car.drivetrain} />
					</View>
					<TouchableOpacity
						style={styles.favoriteButton}
						onPress={() => onFavoritePress(car.id)}>
						<Ionicons
							name={isFavorite(car.id) ? 'heart' : 'heart-outline'}
							size={24}
							color={isFavorite(car.id) ? 'red' : 'black'}
						/>
						<Text style={styles.favoriteText}>
							{isFavorite(car.id) ? 'Unlike' : 'Like'}
						</Text>
					</TouchableOpacity>
					<View style={styles.dealerInfo}>
						
						<Text style={styles.dealerTitle}>Dealer Information</Text>
						<Text style={styles.dealerName}>{car.dealership_name}</Text>
						{car.dealership_phone && (
							<TouchableOpacity
								style={styles.callButton}
								onPress={() => {
									/* Implement call functionality */
								}}>
								<Ionicons name='call-outline' size={20} color='white' />
								<Text style={styles.callButtonText}>Call Dealer</Text>
							</TouchableOpacity>
						)}
					</View>

					

					
				</View>
			</ScrollView>
		</Modal>
	)
}

const DetailItem = ({ icon, text }: any) => (
	<View style={styles.detailItem}>
		<Ionicons name={icon} size={20} color='#4A5568' />
		<Text style={styles.detailText}>{text}</Text>
	</View>
)

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
		fontSize: 22,
		color: 'green',
		fontWeight: 'bold',
		marginTop: 10
	},
	statsContainer: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		marginTop: 10,
		marginBottom: 10
	},
	statsText: {
		fontSize: 16,
		color: '#666'
	},
	description: {
		fontSize: 16,
		marginTop: 10,
		marginBottom: 20
	},
	detailsContainer: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		justifyContent: 'space-between',
		marginBottom: 20
	},
	detailItem: {
		flexDirection: 'row',
		alignItems: 'center',
		width: '48%',
		marginBottom: 10
	},
	detailText: {
		marginLeft: 10,
		fontSize: 14,
		color: '#4A5568'
	},
	favoriteButton: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'center',
		backgroundColor: '#f0f0f0',
		padding: 10,
		borderRadius: 5,
		marginBottom: 20
	},
	favoriteText: {
		marginLeft: 10,
		fontSize: 16,
		fontWeight: 'bold'
	},
	dealerInfo: {
		borderTopWidth: 1,
		borderTopColor: '#e0e0e0',
		paddingTop: 20
	},
	dealerTitle: {
		fontSize: 18,
		fontWeight: 'bold',
		marginBottom: 10
	},
	dealerName: {
		fontSize: 16,
		marginBottom: 10
	},
	callButton: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'center',
		backgroundColor: '#4CAF50',
		padding: 10,
		borderRadius: 5
	},
	callButtonText: {
		color: 'white',
		marginLeft: 10,
		fontSize: 16,
		fontWeight: 'bold'
	}
})
