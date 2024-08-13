import React, { useState, useEffect, useCallback } from 'react';
import {
	View,
	Text,
	FlatList,
	TextInput,
	TouchableOpacity,
	Modal,
	ScrollView,
	ActivityIndicator,
	Dimensions,
} from 'react-native';
import RNPickerSelect from 'react-native-picker-select';
import Slider from '@react-native-community/slider';
import { supabase } from '@/utils/supabase';
import { useUser } from '@clerk/clerk-expo';
import CarCard from '@/components/CarCard';
import CarDetailModal from '@/components/CarDetailModal';
import { useFavorites } from '@/utils/useFavorites';
import { FontAwesome } from '@expo/vector-icons';

const ITEMS_PER_PAGE = 10;
const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');
const TAB_BAR_HEIGHT = 50; // Adjust this based on your actual tab bar height
const CAR_CARD_HEIGHT = SCREEN_HEIGHT - TAB_BAR_HEIGHT;

interface Car {
	id: number;
	make: string;
	model: string;
	year: number;
	price: number;
	dealership_name: string;
	images: string[];
	description: string;
	condition: 'New' | 'Used';
	mileage: number;
	color: string;
	transmission: 'Manual' | 'Automatic';
	drivetrain: 'FWD' | 'RWD' | 'AWD' | '4WD' | '4x4';
}

interface Dealership {
	id: number;
	name: string;
}

const CustomRangeSlider = ({
	minValue,
	maxValue,
	currentMin,
	currentMax,
	onValuesChange,
	step,
	formatLabel,
}: any) => (
	<View className="w-full">
		<View className="flex-row justify-between mb-2">
			<Text>{formatLabel(currentMin)}</Text>
			<Text>{formatLabel(currentMax)}</Text>
		</View>
		<View className="flex-row justify-between">
			<Slider
				style={{ width: SCREEN_WIDTH * 0.4 }}
				minimumValue={minValue}
				maximumValue={maxValue}
				step={step}
				value={currentMin}
				onValueChange={(value) => onValuesChange([value, currentMax])}
			/>
			<Slider
				style={{ width: SCREEN_WIDTH * 0.4 }}
				minimumValue={currentMin}
				maximumValue={maxValue}
				step={step}
				value={currentMax}
				onValueChange={(value) => onValuesChange([currentMin, value])}
			/>
		</View>
	</View>
);

export default function BrowseCarsPage() {
	const { user } = useUser();
	const { favorites, addFavorite, removeFavorite, isFavorite } = useFavorites();
	const [cars, setCars] = useState<Car[]>([]);
	const [currentPage, setCurrentPage] = useState(1);
	const [totalPages, setTotalPages] = useState(1);
	const [isLoading, setIsLoading] = useState(false);
	const [searchQuery, setSearchQuery] = useState('');
	const [sortOption, setSortOption] = useState('');
	const [filters, setFilters] = useState({
		dealership: '',
		make: '',
		model: '',
		condition: '',
		priceRange: [0, 1000000],
		mileageRange: [0, 500000],
		year: '',
		color: '',
		transmission: '',
		drivetrain: '',
	});
	const [dealerships, setDealerships] = useState<Dealership[]>([]);
	const [makes, setMakes] = useState<string[]>([]);
	const [models, setModels] = useState<string[]>([]);
	const [colors, setColors] = useState<string[]>([]);
	const [selectedCar, setSelectedCar] = useState<Car | null>(null);
	const [isModalVisible, setIsModalVisible] = useState(false);
	const [isFilterModalVisible, setIsFilterModalVisible] = useState(false);
	const [priceRange, setPriceRange] = useState<[number, number]>([0, 1000000]);
	const [mileageRange, setMileageRange] = useState<[number, number]>([0, 500000]);

	useEffect(() => {
		fetchInitialData();
	}, []);

	const fetchInitialData = () => {
		fetchCars();
		fetchDealerships();
		fetchMakes();
		fetchColors();
		fetchPriceRange();
		fetchMileageRange();
	};

	const fetchCars = useCallback(
		async (page = 1, currentFilters = filters) => {
			setIsLoading(true);
			let query = supabase.from('cars').select(
				`
				*,
				dealerships (name,logo)
				`,
				{ count: 'exact' }
			);

			// Apply filters
			if (currentFilters.dealership)
				query = query.eq('dealership_id', currentFilters.dealership);
			if (currentFilters.make) query = query.eq('make', currentFilters.make);
			if (currentFilters.model) query = query.eq('model', currentFilters.model);
			if (currentFilters.condition)
				query = query.eq('condition', currentFilters.condition);
			if (currentFilters.year) query = query.eq('year', currentFilters.year);
			if (currentFilters.color) query = query.eq('color', currentFilters.color);
			if (currentFilters.transmission)
				query = query.eq('transmission', currentFilters.transmission);
			if (currentFilters.drivetrain)
				query = query.eq('drivetrain', currentFilters.drivetrain);

			query = query
				.gte('price', currentFilters.priceRange[0])
				.lte('price', currentFilters.priceRange[1]);
			query = query
				.gte('mileage', currentFilters.mileageRange[0])
				.lte('mileage', currentFilters.mileageRange[1]);

			if (searchQuery) {
				query = query.or(
					`make.ilike.%${searchQuery}%,model.ilike.%${searchQuery}%`
				);
			}

			// Apply sorting
			switch (sortOption) {
				case 'price_asc':
					query = query.order('price', { ascending: true });
					break;
				case 'price_desc':
					query = query.order('price', { ascending: false });
					break;
				case 'year_asc':
					query = query.order('year', { ascending: true });
					break;
				case 'year_desc':
					query = query.order('year', { ascending: false });
					break;
				case 'mileage_asc':
					query = query.order('mileage', { ascending: true });
					break;
				case 'mileage_desc':
					query = query.order('mileage', { ascending: false });
					break;
				default:
					query = query.order('listed_at', { ascending: false });
			}

			const { data, count, error } = await query.range(
				(page - 1) * ITEMS_PER_PAGE,
				page * ITEMS_PER_PAGE - 1
			);

			if (error) {
				console.error('Error fetching cars:', error);
			} else {
				const newCars =
					data?.map((item) => ({
						...item,
						dealership_name: item.dealerships.name,
						dealership_logo: item.dealerships.logo,
					})) || [];
				setCars((prevCars) => (page === 1 ? newCars : [...prevCars, ...newCars]));
				setTotalPages(Math.ceil((count || 0) / ITEMS_PER_PAGE));
				setCurrentPage(page);
			}
			setIsLoading(false);
		},
		[searchQuery, sortOption, filters]
	);

	const fetchDealerships = async () => {
		const { data, error } = await supabase.from('dealerships').select('id, name');
		if (error) {
			console.error('Error fetching dealerships:', error);
		} else {
			setDealerships(data || []);
		}
	};

	const fetchMakes = async () => {
		const { data, error } = await supabase.from('cars').select('make').order('make');
		if (error) {
			console.error('Error fetching makes:', error);
		} else {
			const uniqueMakes = [...new Set(data?.map((item) => item.make))];
			setMakes(uniqueMakes);
		}
	};

	const fetchModels = async (make: string) => {
		const { data, error } = await supabase
			.from('cars')
			.select('model')
			.eq('make', make)
			.order('model');
		if (error) {
			console.error('Error fetching models:', error);
		} else {
			const uniqueModels = [...new Set(data?.map((item) => item.model))];
			setModels(uniqueModels);
		}
	};

	const fetchColors = async () => {
		const { data, error } = await supabase.from('cars').select('color').order('color');
		if (error) {
			console.error('Error fetching colors:', error);
		} else {
			const uniqueColors = [...new Set(data?.map((item) => item.color))];
			setColors(uniqueColors);
		}
	};

	const fetchPriceRange = async () => {
		const { data, error } = await supabase
			.from('cars')
			.select('price')
			.order('price', { ascending: false })
			.limit(1);

		if (error) {
			console.error('Error fetching price range:', error);
		} else if (data && data.length > 0) {
			setPriceRange([0, data[0].price]);
			setFilters((prev) => ({ ...prev, priceRange: [0, data[0].price] }));
		}
	};

	const fetchMileageRange = async () => {
		const { data, error } = await supabase
			.from('cars')
			.select('mileage')
			.order('mileage', { ascending: false })
			.limit(1);

		if (error) {
			console.error('Error fetching mileage range:', error);
		} else if (data && data.length > 0) {
			setMileageRange([0, data[0].mileage]);
			setFilters((prev) => ({ ...prev, mileageRange: [0, data[0].mileage] }));
		}
	};

	const handleFavoritePress = async (carId: number) => {
		if (isFavorite(carId)) {
			await removeFavorite(carId);
		} else {
			await addFavorite(carId);
		}
	};

	const handleCarPress = (car: Car) => {
		setSelectedCar(car);
		setIsModalVisible(true);
	};

	const renderCarItem = ({ item }: { item: Car }) => (
		<CarCard
			car={item}
			onPress={() => handleCarPress(item)}
			onFavoritePress={() => handleFavoritePress(item.id)}
			isFavorite={isFavorite(item.id)}
			cardHeight={CAR_CARD_HEIGHT}
		/>
	);

	const FilterModal = () => {
		const [tempFilters, setTempFilters] = useState({ ...filters });

		useEffect(() => {
			if (isFilterModalVisible) {
				setTempFilters({ ...filters });
			}
		}, [isFilterModalVisible]);

		const applyFilters = () => {
			setFilters({ ...tempFilters });
			setIsFilterModalVisible(false);
			setCurrentPage(1);
			fetchCars(1, tempFilters); // Pass tempFilters directly to fetchCars
		};

		return (
			<Modal visible={isFilterModalVisible} animationType="slide" transparent={true}>
				<View className="flex-1 justify-center items-center bg-black bg-opacity-50">
					<View className="bg-white p-6 rounded-lg w-11/12 h-5/6">
						<Text className="text-2xl font-bold mb-4">Filter Results</Text>
						<ScrollView className="flex-1">
							<View className="space-y-4">
								{/* Dealership Filter */}
								<View>
									<Text className="font-semibold mb-2">Dealership</Text>
									<RNPickerSelect
										onValueChange={(value) =>
											setTempFilters({ ...tempFilters, dealership: value })
										}
										value={tempFilters.dealership}
										items={dealerships.map((dealership) => ({
											label: dealership.name,
											value: dealership.id.toString(),
										}))}
										placeholder={{ label: 'All Dealerships', value: null }}
										style={{
											inputIOS: {
												color: 'black',
												padding: 10,
												backgroundColor: '#f0f0f0',
												borderRadius: 5,
											},
											inputAndroid: {
												color: 'black',
												padding: 10,
												backgroundColor: '#f0f0f0',
												borderRadius: 5,
											},
										}}
									/>
								</View>

								{/* Make Filter */}
								<View>
									<Text className="font-semibold mb-2">Make</Text>
									<RNPickerSelect
										onValueChange={(value) => {
											setTempFilters({ ...tempFilters, make: value, model: '' });
											if (value) fetchModels(value);
										}}
										value={tempFilters.make}
										items={makes.map((make) => ({
											label: make,
											value: make,
										}))}
										placeholder={{ label: 'All Makes', value: null }}
										style={{
											inputIOS: {
												color: 'black',
												padding: 10,
												backgroundColor: '#f0f0f0',
												borderRadius: 5,
											},
											inputAndroid: {
												color: 'black',
												padding: 10,
												backgroundColor: '#f0f0f0',
												borderRadius: 5,
											},
										}}
									/>
								</View>

								{/* Model Filter */}
								<View>
									<Text className="font-semibold mb-2">Model</Text>
									<RNPickerSelect
										onValueChange={(value) =>
											setTempFilters({ ...tempFilters, model: value })
										}
										value={tempFilters.model}
										items={models.map((model) => ({
											label: model,
											value: model,
										}))}
										placeholder={{ label: 'All Models', value: null }}
										style={{
											inputIOS: {
												color: 'black',
												padding: 10,
												backgroundColor: '#f0f0f0',
												borderRadius: 5,
											},
											inputAndroid: {
												color: 'black',
												padding: 10,
												backgroundColor: '#f0f0f0',
												borderRadius: 5,
											},
										}}
									/>
								</View>

								{/* Condition Filter */}
								<View>
									<Text className="font-semibold mb-2">Condition</Text>
									<RNPickerSelect
										onValueChange={(value) =>
											setTempFilters({ ...tempFilters, condition: value })
										}
										value={tempFilters.condition}
										items={[
											{ label: 'New', value: 'New' },
											{ label: 'Used', value: 'Used' },
										]}
										placeholder={{ label: 'All Conditions', value: null }}
										style={{
											inputIOS: {
												color: 'black',
												padding: 10,
												backgroundColor: '#f0f0f0',
												borderRadius: 5,
											},
											inputAndroid: {
												color: 'black',
												padding: 10,
												backgroundColor: '#f0f0f0',
												borderRadius: 5,
											},
										}}
									/>
								</View>

								{/* Price Range Filter */}
								<View>
									<Text className="font-semibold mb-2">Price Range</Text>
									<CustomRangeSlider
										minValue={priceRange[0]}
										maxValue={priceRange[1]}
										currentMin={tempFilters.priceRange[0]}
										currentMax={tempFilters.priceRange[1]}
										onValuesChange={(values: any) =>
											setTempFilters({ ...tempFilters, priceRange: values })
										}
										step={1000}
										formatLabel={(value: { toLocaleString: () => any }) =>
											`$${value.toLocaleString()}`
										}
									/>
								</View>

								{/* Mileage Range Filter */}
								<View>
									<Text className="font-semibold mb-2">Mileage Range</Text>
									<CustomRangeSlider
										minValue={mileageRange[0]}
										maxValue={mileageRange[1]}
										currentMin={tempFilters.mileageRange[0]}
										currentMax={tempFilters.mileageRange[1]}
										onValuesChange={(values: any) =>
											setTempFilters({ ...tempFilters, mileageRange: values })
										}
										step={1000}
										formatLabel={(value: { toLocaleString: () => any }) =>
											`${value.toLocaleString()} miles`
										}
									/>
								</View>

								{/* Year Filter */}
								<View>
									<Text className="font-semibold mb-2">Year</Text>
									<RNPickerSelect
										onValueChange={(value) =>
											setTempFilters({ ...tempFilters, year: value })
										}
										value={tempFilters.year}
										items={Array.from({ length: 30 }, (_, i) => 2024 - i).map(
											(year) => ({
												label: year.toString(),
												value: year.toString(),
											})
										)}
										placeholder={{ label: 'All Years', value: null }}
										style={{
											inputIOS: {
												color: 'black',
												padding: 10,
												backgroundColor: '#f0f0f0',
												borderRadius: 5,
											},
											inputAndroid: {
												color: 'black',
												padding: 10,
												backgroundColor: '#f0f0f0',
												borderRadius: 5,
											},
										}}
									/>
								</View>

								{/* Color Filter */}
								<View>
									<Text className="font-semibold mb-2">Color</Text>
									<RNPickerSelect
										onValueChange={(value) =>
											setTempFilters({ ...tempFilters, color: value })
										}
										value={tempFilters.color}
										items={colors.map((color) => ({
											label: color,
											value: color,
										}))}
										placeholder={{ label: 'All Colors', value: null }}
										style={{
											inputIOS: {
												color: 'black',
												padding: 10,
												backgroundColor: '#f0f0f0',
												borderRadius: 5,
											},
											inputAndroid: {
												color: 'black',
												padding: 10,
												backgroundColor: '#f0f0f0',
												borderRadius: 5,
											},
										}}
									/>
								</View>

								{/* Transmission Filter */}
								<View>
									<Text className="font-semibold mb-2">Transmission</Text>
									<RNPickerSelect
										onValueChange={(value) =>
											setTempFilters({ ...tempFilters, transmission: value })
										}
										value={tempFilters.transmission}
										items={[
											{ label: 'Manual', value: 'Manual' },
											{ label: 'Automatic', value: 'Automatic' },
										]}
										placeholder={{ label: 'All Transmissions', value: null }}
										style={{
											inputIOS: {
												color: 'black',
												padding: 10,
												backgroundColor: '#f0f0f0',
												borderRadius: 5,
											},
											inputAndroid: {
												color: 'black',
												padding: 10,
												backgroundColor: '#f0f0f0',
												borderRadius: 5,
											},
										}}
									/>
								</View>

								{/* Drivetrain Filter */}
								<View>
									<Text className="font-semibold mb-2">Drivetrain</Text>
									<RNPickerSelect
										onValueChange={(value) =>
											setTempFilters({ ...tempFilters, drivetrain: value })
										}
										value={tempFilters.drivetrain}
										items={[
											{ label: 'FWD', value: 'FWD' },
											{ label: 'RWD', value: 'RWD' },
											{ label: 'AWD', value: 'AWD' },
											{ label: '4WD', value: '4WD' },
											{ label: '4x4', value: '4x4' },
										]}
										placeholder={{ label: 'All Drivetrains', value: null }}
										style={{
											inputIOS: {
												color: 'black',
												padding: 10,
												backgroundColor: '#f0f0f0',
												borderRadius: 5,
											},
											inputAndroid: {
												color: 'black',
												padding: 10,
												backgroundColor: '#f0f0f0',
												borderRadius: 5,
											},
										}}
									/>
								</View>
							</View>
						</ScrollView>
						<View className="flex-row justify-end mt-4">
							<TouchableOpacity
								className="bg-gray-300 py-2 px-4 rounded mr-2"
								onPress={() => setIsFilterModalVisible(false)}
							>
								<Text>Cancel</Text>
							</TouchableOpacity>
							<TouchableOpacity
								className="bg-blue-500 py-2 px-4 rounded"
								onPress={applyFilters}
							>
								<Text className="text-white">Apply Filters</Text>
							</TouchableOpacity>
						</View>
					</View>
				</View>
			</Modal>
		);
	};

	return (
		<View className="flex-1 bg-gray-100">
			<View className="p-2 bg-white">
				<View className="flex-row items-center">
					<TouchableOpacity
						className="bg-red p-2 rounded-full mr-2"
						onPress={() => {
							setFilters({ ...filters });
							setIsFilterModalVisible(true);
						}}
					>
						<FontAwesome name="filter" size={19} color="white" />
					</TouchableOpacity>

					<View className="flex-row flex-1 bg-gray-100 rounded-full items-center">
						<TextInput
							className="flex-1 text-black px-3 py-1"
							placeholder="Search cars..."
							value={searchQuery}
							onChangeText={(text) => {
								setSearchQuery(text);
								setCurrentPage(1);
							}}
							onSubmitEditing={() => fetchCars(1, filters)}
						/>
						<TouchableOpacity
							className="bg-red p-2 rounded-full mr-2"
							onPress={() => fetchCars(1, filters)}
						>
							<FontAwesome name="search" size={20} color="white" />
						</TouchableOpacity>
					</View>
				</View>

				<View className="mt-2">
					<RNPickerSelect
						onValueChange={(value) => {
							setSortOption(value);
							setCurrentPage(1);
							fetchCars(1, filters);
						}}
						items={[
							{ label: 'Price: Low to High', value: 'price_asc' },
							{ label: 'Price: High to Low', value: 'price_desc' },
							{ label: 'Year: New to Old', value: 'year_desc' },
							{ label: 'Year: Old to New', value: 'year_asc' },
							{ label: 'Mileage: Low to High', value: 'mileage_asc' },
							{ label: 'Mileage: High to Low', value: 'mileage_desc' },
						]}
						placeholder={{ label: 'Sort', value: null }}
						style={{
							inputIOS: {
								fontSize: 14,
								color: 'black',
								padding: 8,
								backgroundColor: 'white',
								borderRadius: 8,
							},
							inputAndroid: {
								fontSize: 14,
								color: 'black',
								padding: 8,
								backgroundColor: 'white',
								borderRadius: 8,
							},
							iconContainer: {
								top: 10,
								right: 10,
							},
						}}
					/>
				</View>
			</View>

			<FlatList
				data={cars}
				renderItem={renderCarItem}
				keyExtractor={(item) => item.id.toString()}
				snapToAlignment="start"
				decelerationRate="fast"
				snapToInterval={CAR_CARD_HEIGHT} // Ensure each item snaps to the full screen height
				showsVerticalScrollIndicator={false}
				onEndReached={() => {
					if (currentPage < totalPages && !isLoading) {
						fetchCars(currentPage + 1);
					}
				}}
				onEndReachedThreshold={0.1}
				ListFooterComponent={() =>
					isLoading ? (
						<View className="py-4">
							<ActivityIndicator size="large" color="#0000ff" />
						</View>
					) : null
				}
			/>

			<CarDetailModal
				isVisible={isModalVisible}
				car={selectedCar}
				onClose={() => setIsModalVisible(false)}
				onFavoritePress={() => selectedCar && handleFavoritePress(selectedCar.id)}
				isFavorite={!!selectedCar && isFavorite(selectedCar.id)}
			/>
			<FilterModal />
		</View>
	);
}
