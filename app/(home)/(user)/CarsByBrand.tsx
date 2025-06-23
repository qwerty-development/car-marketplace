import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import {
	View,
	FlatList,
	TouchableOpacity,
	Dimensions,
	Text,
	StatusBar,
	RefreshControl,
	Platform,
	Image,
	Animated
} from 'react-native'
import { useRouter, useLocalSearchParams, Stack } from 'expo-router'
import CarCard from '@/components/CarCard'
import CarDetailModal from './CarDetailModal'
import CarDetailModalIOS from './CarDetailModal.ios'
import { supabase } from '@/utils/supabase'
import { useFavorites } from '@/utils/useFavorites'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '@/utils/ThemeContext'
import { SafeAreaView } from 'react-native-safe-area-context'

const { height: SCREEN_HEIGHT } = Dimensions.get('window')

// Brand logo fetching function (copied from AllBrandsPage)
	const getLogoUrl = useCallback((make: string, isLightMode: boolean) => {
	  const formattedMake = make.toLowerCase().replace(/\s+/g, "-");
	  switch (formattedMake) {
		case "range-rover":
		  return isLightMode
			? "https://www.carlogos.org/car-logos/land-rover-logo-2020-green.png"
			: "https://www.carlogos.org/car-logos/land-rover-logo.png";
		case "infiniti":
		  return "https://www.carlogos.org/car-logos/infiniti-logo.png";
		case "jetour":
		  return "https://1000logos.net/wp-content/uploads/2023/12/Jetour-Logo.jpg";
		case "audi":
		  return "https://www.freepnglogos.com/uploads/audi-logo-2.png";
		case "nissan":
		  return "https://cdn.freebiesupply.com/logos/large/2x/nissan-6-logo-png-transparent.png";
		case "deepal":
		  return "https://www.chinacarstrading.com/wp-content/uploads/2023/04/deepal-logo2.png";
		case "denza":
		  return "https://upload.wikimedia.org/wikipedia/en/5/5e/Denza_logo.png";
		case "voyah":
		  return "https://i0.wp.com/www.caradviser.io/wp-content/uploads/2024/07/VOYAH.png?fit=722%2C722&ssl=1";
		case "rox":
		  return "https://contactcars.fra1.cdn.digitaloceanspaces.com/contactcars-production/Images/Large/Makes/f64aa1a8-fb87-4028-b60e-7128f4588f5e_202502061346164286.jpg";
		case "xiaomi":
		  return "https://upload.wikimedia.org/wikipedia/commons/thumb/a/ae/Xiaomi_logo_%282021-%29.svg/1024px-Xiaomi_logo_%282021-%29.svg.png";
		default:
		  return `https://www.carlogos.org/car-logos/${formattedMake}-logo.png`;
	  }
	}, []);

// Car Card Skeleton Component - Updated for standard list layout
const CarCardSkeleton = React.memo(({ isDarkMode }: { isDarkMode: boolean }) => {
  const fadeAnim = useRef(new Animated.Value(0.5)).current;
  
  useEffect(() => {
    // Create shimmer effect
    Animated.loop(
      Animated.sequence([
        Animated.timing(fadeAnim, {
          toValue: 0.8,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 0.5,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [fadeAnim]);

  const bgColor = isDarkMode ? '#161616' : '#f5f5f5';
  const shimmerColor = isDarkMode ? '#222222' : '#e0e0e0';

  return (
    <View 
      style={{ 
        height: 420, // Standard card height instead of full screen
        marginVertical: 8, 
        marginHorizontal: 16,
        borderRadius: 16,
        overflow: 'hidden',
        backgroundColor: bgColor
      }}
    >
      {/* Image placeholder */}
      <Animated.View 
        style={{
          height: 240, // Fixed image height
          width: '100%',
          backgroundColor: shimmerColor,
          opacity: fadeAnim
        }}
      />
      
      {/* Content placeholders */}
      <View style={{ padding: 16 }}>
        {/* Title placeholder */}
        <Animated.View 
          style={{
            height: 24,
            width: '80%',
            marginBottom: 8,
            backgroundColor: shimmerColor,
            borderRadius: 4,
            opacity: fadeAnim
          }}
        />
        
        {/* Subtitle placeholder */}
        <Animated.View 
          style={{
            height: 16,
            width: '60%',
            marginBottom: 16,
            backgroundColor: shimmerColor,
            borderRadius: 4,
            opacity: fadeAnim
          }}
        />
        
        {/* Details placeholders */}
        <View style={{ flexDirection: 'row', marginBottom: 16 }}>
          {[1, 2, 3].map((_, index) => (
            <Animated.View 
              key={index}
              style={{
                height: 32,
                width: 70,
                marginRight: 8,
                backgroundColor: shimmerColor,
                borderRadius: 16,
                opacity: fadeAnim
              }}
            />
          ))}
        </View>
        
        {/* Price placeholder */}
        <Animated.View 
          style={{
            height: 20,
            width: '40%',
            backgroundColor: shimmerColor,
            borderRadius: 4,
            opacity: fadeAnim
          }}
        />
      </View>
    </View>
  );
});

// Skeleton loading list - Updated for standard scrolling
const CarListSkeleton = React.memo(({ isDarkMode }: { isDarkMode: boolean }) => {
  return (
    <FlatList
      data={[1, 2, 3, 4, 5]} // Show 5 skeleton cards for better loading perception
      renderItem={() => <CarCardSkeleton isDarkMode={isDarkMode} />}
      keyExtractor={(item) => `skeleton-${item}`}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ 
        paddingBottom: Platform.OS === 'ios' ? 100 : 80,
        paddingTop: 8
      }}
    />
  );
});

const CustomHeader = React.memo(
	({ title, onBack, brandName }: { title: string; onBack: () => void; brandName?: string }) => {
		const { isDarkMode } = useTheme()
		const iconColor = isDarkMode ? '#D55004' : '#FF8C00'
		const logoUrl = brandName ? getLogoUrl(brandName, !isDarkMode) : null;

		return (
			<SafeAreaView
				edges={['top']}
				className={`bg-${isDarkMode ? 'black' : 'white'}`}>
	
				<View className='flex-row items-center pb-4 px-4'>
					<TouchableOpacity onPress={onBack}>
						<Ionicons name='arrow-back' size={24} color={iconColor} />
					</TouchableOpacity>
					{logoUrl && (
						<Image
							source={{ uri: logoUrl }}
							style={{ width: 40, height: 40, marginLeft: 12 }}
							resizeMode="contain"
						/>
					)}
					<Text
						className={`ml-4 text-lg font-bold ${
							isDarkMode ? 'text-white' : 'text-black'
						}`}>
						{title}
					</Text>
				</View>
			</SafeAreaView>
		)
	}
)

export default function CarsByBrand() {
	const { isDarkMode } = useTheme()
	const router = useRouter()
	const { brand } = useLocalSearchParams<{ brand: string }>()
	const [cars, setCars] = useState<any[]>([])
	const [isLoading, setIsLoading] = useState(true)
	const { isFavorite, toggleFavorite } = useFavorites()
	const [selectedCar, setSelectedCar] = useState<any>(null)
	const [isModalVisible, setIsModalVisible] = useState(false)
	const [refreshing, setRefreshing] = useState(false)

	const fetchCarsByBrand = useCallback(async (brandName: string) => {
		if (!refreshing) setIsLoading(true)
		try {
			const { data, error } = await supabase
				.from('cars')
				.select(`*, dealerships (name,logo,phone,location,latitude,longitude)`)
				.eq('status', 'available')
				.eq('make', brandName)
				.order('listed_at', { ascending: false }) // Add default sorting

			if (error) throw error

			const carsData =
				data?.map(item => ({
					...item,
					dealership_name: item.dealerships.name,
					dealership_logo: item.dealerships.logo,
					dealership_phone: item.dealerships.phone,
					dealership_location: item.dealerships.location,
					dealership_latitude: item.dealerships.latitude,
					dealership_longitude: item.dealerships.longitude
				})) || []
			setCars(carsData)
		} catch (error) {
			console.error('Error fetching cars by brand:', error)
		} finally {
			setIsLoading(false)
		}
	}, [refreshing])

	const onRefresh = useCallback(() => {
		setRefreshing(true)
		if (brand) {
			fetchCarsByBrand(brand).then(() => setRefreshing(false))
		} else {
			setRefreshing(false)
		}
	}, [brand, fetchCarsByBrand])

	useEffect(() => {
		if (brand) {
			fetchCarsByBrand(brand)
		}
	}, [brand, fetchCarsByBrand])

	const handleFavoritePress = useCallback(
		async (carId: number) => {
			const newLikesCount = await toggleFavorite(carId)
			setCars(prevCars =>
				prevCars.map(car =>
					car.id === carId ? { ...car, likes: newLikesCount } : car
				)
			)
		},
		[toggleFavorite]
	)

	const handleCarPress = useCallback((car: any) => {
		setSelectedCar(car)
		setIsModalVisible(true)
	}, [])

	const handleViewUpdate = useCallback(
		(carId: number, newViewCount: number) => {
			setCars(prevCars =>
				prevCars.map(car =>
					car.id === carId ? { ...car, views: newViewCount } : car
				)
			)
		},
		[]
	)

	// Updated renderCarItem without cardHeight prop - let CarCard use natural height
	const renderCarItem = useCallback(
		({ item, index }: { item: any; index: number }) => (
			<CarCard
				car={item}
				index={index} // Add index for potential animations
				onPress={() => handleCarPress(item)}
				onFavoritePress={() => handleFavoritePress(item.id)}
				isFavorite={isFavorite(item.id)}
				isDealer={false} // Specify this is not dealer view
			/>
		),
		[handleCarPress, handleFavoritePress, isFavorite]
	)

	const renderModal = useMemo(() => {
		const ModalComponent =
			Platform.OS === 'ios' ? CarDetailModalIOS : CarDetailModal
		return (
			<ModalComponent
				isVisible={isModalVisible}
				car={selectedCar}
				onClose={() => setIsModalVisible(false)}
				onFavoritePress={() =>
					selectedCar && handleFavoritePress(selectedCar.id)
				}
				isFavorite={!!selectedCar && isFavorite(selectedCar.id)}
				onViewUpdate={handleViewUpdate}
				setSelectedCar={setSelectedCar}
				setIsModalVisible={setIsModalVisible}
			/>
		)
	}, [
		isModalVisible,
		selectedCar,
		handleFavoritePress,
		isFavorite,
		handleViewUpdate
	])

	const memoizedHeader = useMemo(
		() => (
			<Stack.Screen
				options={{
					presentation: 'modal',
					headerLeft: () => (
						<TouchableOpacity className='ml-3' onPress={() => router.back()}>
							<Ionicons name='arrow-back' size={30} color='#D55004' />
						</TouchableOpacity>
					),
					title: brand ? `${brand} Cars` : 'Cars by Brand',
					headerStyle: { backgroundColor: isDarkMode ? '#0D0D0D' : '#FFFFFF' },
					headerTintColor: isDarkMode ? '#FFFFFF' : '#333333'
				}}
			/>
		),
		[brand, router, isDarkMode]
	)

	const renderContent = () => {
		if (isLoading && !refreshing) {
			// Show skeleton loading instead of ActivityIndicator
			return <CarListSkeleton isDarkMode={isDarkMode} />;
		}

		if (cars.length === 0) {
			return (
				<View className='flex-1 justify-center items-center px-4'>
					<Ionicons 
						name="car-outline" 
						size={60} 
						color={isDarkMode ? '#666' : '#999'} 
						style={{ marginBottom: 16 }}
					/>
					<Text
						className={`${isDarkMode ? 'text-white' : 'text-black'} text-lg text-center`}>
						No cars found for {brand}.
					</Text>
					<Text
						className={`${isDarkMode ? 'text-gray-400' : 'text-gray-600'} text-sm text-center mt-2`}>
						Try browsing other brands or check back later.
					</Text>
				</View>
			)
		}

		return (
			<FlatList
				data={cars}
				renderItem={renderCarItem}
				keyExtractor={(item, index) => `${item.id}-${item.make}-${item.model}-${index}`}
				showsVerticalScrollIndicator={false}
				// REMOVED: All TikTok-style snapping properties
				// snapToAlignment='start'
				// decelerationRate='fast' 
				// snapToInterval={CAR_CARD_HEIGHT}
				contentContainerStyle={{ 
					paddingBottom: Platform.OS === 'ios' ? 100 : 80,
					paddingTop: 8 
				}}
				refreshControl={
					<RefreshControl
						refreshing={refreshing}
						onRefresh={onRefresh}
						tintColor={isDarkMode ? '#ffffff' : '#000000'}
						colors={['#D55004']}
					/>
				}
				// Optional: Add some performance optimizations for standard scrolling
				removeClippedSubviews={true}
				maxToRenderPerBatch={10}
				updateCellsBatchingPeriod={50}
				initialNumToRender={5}
				windowSize={10}
			/>
		)
	}

	return (
		<View className={`flex-1 ${isDarkMode ? 'bg-night' : 'bg-white'}`}>
			<CustomHeader
				title={brand ? `${brand} Cars` : 'Cars by Brand'}
				onBack={() => router.back()}
				brandName={brand}
			/>
			{memoizedHeader}
			{renderContent()}
			{renderModal}
		</View>
	)
}