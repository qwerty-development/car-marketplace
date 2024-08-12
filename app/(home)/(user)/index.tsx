import React, { useState, useEffect } from 'react';
import {
	View,
	Text,
	FlatList,
	TextInput,
	TouchableOpacity,
	Alert,
	Modal,
	ScrollView,
} from 'react-native';
import RNPickerSelect from 'react-native-picker-select';
import { supabase } from '@/utils/supabase';
import { useUser } from '@clerk/clerk-expo';
import CarCard from '@/components/CarCard';
import CarDetailModal from '@/components/CarDetailModal';
import { useFavorites } from '@/utils/useFavorites';
import { FontAwesome } from '@expo/vector-icons';

const ITEMS_PER_PAGE = 10;

interface Car {
	id: number;
	make: string;
	model: string;
	year: number;
	price: number;
	dealership_name: string;
	images: string[];
	description: string;
}

interface Dealership {
	id: number;
	name: string;
}

export default function BrowseCarsPage() {
	const { user } = useUser();
	const { favorites, addFavorite, removeFavorite, isFavorite } = useFavorites();
	const [cars, setCars] = useState<Car[]>([]);
	const [currentPage, setCurrentPage] = useState(1);
	const [totalPages, setTotalPages] = useState(1);
	const [searchQuery, setSearchQuery] = useState('');
	const [sortOption, setSortOption] = useState('');
	const [filterDealership, setFilterDealership] = useState('');
	const [filterMake, setFilterMake] = useState('');
	const [filterModel, setFilterModel] = useState('');
	const [dealerships, setDealerships] = useState<Dealership[]>([]);
	const [makes, setMakes] = useState<string[]>([]);
	const [models, setModels] = useState<string[]>([]);
	const [selectedCar, setSelectedCar] = useState<Car | null>(null);
	const [isModalVisible, setIsModalVisible] = useState(false);
	const [isFilterModalVisible, setIsFilterModalVisible] = useState(false);
	const [filtersChanged, setFiltersChanged] = useState(false);

	useEffect(() => {
		if (filtersChanged) {
			setCurrentPage(1);
			setFiltersChanged(false);
		}
		fetchCars();
		fetchDealerships();
		fetchMakes();
	}, [
		currentPage,
		sortOption,
		filterDealership,
		filterMake,
		filterModel,
		searchQuery,
		user,
		filtersChanged,
	]);

	const fetchCars = async () => {
		let query = supabase.from('cars').select(
			`
        *,
        dealerships (name)
      `,
			{ count: 'exact' }
		);

		if (filterDealership) query = query.eq('dealership_id', filterDealership);
		if (filterMake) query = query.eq('make', filterMake);
		if (filterModel) query = query.eq('model', filterModel);

		if (searchQuery) {
			const numericSearch = !isNaN(Number(searchQuery));

			let searchConditions = [
				`make.ilike.%${searchQuery}%`,
				`model.ilike.%${searchQuery}%`,
			];

			if (numericSearch) {
				searchConditions.push(`year.eq.${searchQuery}`);
				searchConditions.push(`price.eq.${searchQuery}`);
			}

			query = query.or(searchConditions.join(','));
		}

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
			case 'listed_at_asc':
				query = query.order('listed_at', { ascending: true });
				break;
			case 'listed_at_desc':
				query = query.order('listed_at', { ascending: false });
				break;
		}

		const { data, count, error } = await query.range(
			(currentPage - 1) * ITEMS_PER_PAGE,
			currentPage * ITEMS_PER_PAGE - 1
		);

		if (error) {
			console.error('Error fetching listings:', error);
			Alert.alert('Error', 'Failed to fetch car listings');
		} else {
			setCars(
				data?.map((item) => ({
					...item,
					dealership_name: item.dealerships.name,
				})) || []
			);
			setTotalPages(Math.ceil((count || 0) / ITEMS_PER_PAGE));
		}
	};

	const fetchDealerships = async () => {
		const { data, error } = await supabase
			.from('dealerships')
			.select('id, name');
		if (error) {
			console.error('Error fetching dealerships:', error);
		} else {
			setDealerships(data || []);
		}
	};

	const fetchMakes = async () => {
		const { data, error } = await supabase
			.from('cars')
			.select('make')
			.order('make');
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

	const handleSearch = (text: string) => {
		setSearchQuery(text);
		setFiltersChanged(true);
	};

	const handleDealershipFilter = (value: string) => {
		setFilterDealership(value);
		setFiltersChanged(true);
	};

	const handleMakeFilter = (value: string) => {
		setFilterMake(value);
		fetchModels(value);
		setFiltersChanged(true);
	};

	const handleModelFilter = (value: string) => {
		setFilterModel(value);
		setFiltersChanged(true);
	};

	const handleSortChange = (value: string) => {
		setSortOption(value);
		setFiltersChanged(true);
	};

	const handlePageChange = (newPage: number) => {
		setCurrentPage(newPage);
	};

	const renderCarItem = ({ item }: { item: Car }) => (
		<CarCard
			car={item}
			onPress={() => handleCarPress(item)}
			onFavoritePress={() => handleFavoritePress(item.id)}
			isFavorite={isFavorite(item.id)}
		/>
	);

	const FilterModal = () => (
		<Modal
			visible={isFilterModalVisible}
			animationType="slide"
			transparent={true}
		>
			<View className="flex-1 justify-center items-center bg-black bg-opacity-50">
				<View className="bg-white p-6 rounded-lg w-5/6">
					<Text className="text-2xl font-bold mb-4">Filter Results</Text>
					<ScrollView>
						<View className="mb-4 space-y-2">
							<View className="bg-white rounded-lg overflow-hidden h-12 justify-center">
								<RNPickerSelect
									onValueChange={handleDealershipFilter}
									items={dealerships.map((dealership) => ({
										label: dealership.name,
										value: dealership.id.toString(),
									}))}
									placeholder={{
										label: 'All Dealerships',
										value: '',
										color: 'black',  // Placeholder text color
									}}
									style={{
										inputIOS: { color: 'black', padding: 10 },  // iOS styling
										inputAndroid: { color: 'black', padding: 10 },  // Android styling
									}}
								/>
							</View>

							<View className="bg-white rounded-lg overflow-hidden h-12 justify-center">
								<RNPickerSelect
									onValueChange={handleMakeFilter}
									items={makes.map((make) => ({
										label: make,
										value: make,
									}))}
									placeholder={{
										label: 'All Makes',
										value: '',
										color: 'black',  // Placeholder text color
									}}
									style={{
										inputIOS: { color: 'black', padding: 10 },  // iOS styling
										inputAndroid: { color: 'black', padding: 10 },  // Android styling
									}}
								/>
							</View>

							<View className="bg-white rounded-lg overflow-hidden h-12 justify-center">
								<RNPickerSelect
									onValueChange={handleModelFilter}
									items={models.map((model) => ({
										label: model,
										value: model,
									}))}
									placeholder={{
										label: 'All Models',
										value: '',
										color: 'black',  // Placeholder text color
									}}
									style={{
										inputIOS: { color: 'black', padding: 10 },  // iOS styling
										inputAndroid: { color: 'black', padding: 10 },  // Android styling
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
							className="bg-red py-2 px-4 rounded"
							onPress={() => {
								setIsFilterModalVisible(false);
								setFiltersChanged(true);
							}}
						>
							<Text className="text-white">Apply</Text>
						</TouchableOpacity>
					</View>
				</View>
			</View>
		</Modal>
	);

	return (
		<View className="flex-1 p-4 bg-gray-300">
			<TextInput
				className="bg-white text-black p-3 rounded-lg mb-4"
				placeholder="Search cars..."
				value={searchQuery}
				onChangeText={handleSearch}
			/>
			<View className="mb-4 flex-row justify-between space-x-2">
				<TouchableOpacity
					className="bg-red px-5 rounded-xl  items-center justify-center flex-row"
					onPress={() => setIsFilterModalVisible(true)}
				>
					<FontAwesome name="filter" size={20} color="white" className="mr-2" />
					<Text className="text-white text-sm">Filter</Text>
				</TouchableOpacity>

				<View className="bg-white px-2 rounded-xl overflow-hidden justify-center flex-row items-center">
					<RNPickerSelect
						onValueChange={handleSortChange}
						items={[
							{ label: 'Price: Low to High', value: 'price_asc' },
							{ label: 'Price: High to Low', value: 'price_desc' },
							{ label: 'Year: Low to High', value: 'year_asc' },
							{ label: 'Year: High to Low', value: 'year_desc' },
							{ label: 'Date Listed: Low to High', value: 'listed_at_asc' },
							{ label: 'Date Listed: High to Low', value: 'listed_at_desc' },
						]}
						placeholder={{
							label: 'Most Relevant',
							value: '',
							color: 'black',  // Placeholder text color
						}}
						style={{
							inputIOS: { color: 'black', padding: 10 },  // iOS styling
							inputAndroid: { color: 'black', padding: 10 },  // Android styling
						}}
					/>
					<FontAwesome name="sort" size={20} color="black" className="mr-2" />
				</View>

			</View>


			<FlatList
				data={cars}
				renderItem={renderCarItem}
				keyExtractor={(item) => item.id.toString()}
				className="mb-4"
			/>
			<View className="flex-row justify-between items-center">
				<TouchableOpacity
					className="bg-red py-1 px-3 rounded-lg flex-1 mr-1 items-center"
					onPress={() => handlePageChange(currentPage - 1)}
					disabled={currentPage === 1}
				>
					<Text className="text-white text-sm">Previous</Text>
				</TouchableOpacity>
				<Text className="text-sm">{`Page ${currentPage} of ${totalPages}`}</Text>
				<TouchableOpacity
					className="bg-red py-1 px-3 rounded-lg flex-1 ml-1 items-center"
					onPress={() => handlePageChange(currentPage + 1)}
					disabled={currentPage === totalPages}
				>
					<Text className="text-white text-sm">Next</Text>
				</TouchableOpacity>
			</View>
			<CarDetailModal
				isVisible={isModalVisible}
				car={selectedCar}
				onClose={() => setIsModalVisible(false)}
				onFavoritePress={() =>
					selectedCar && handleFavoritePress(selectedCar.id)
				}
				isFavorite={!!selectedCar && isFavorite(selectedCar.id)}
			/>
			<FilterModal />
		</View>
	);
}
