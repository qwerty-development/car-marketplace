// (home)/(user)/filter.tsx
import React, { useState, useEffect } from 'react'
import {
	View,
	Text,
	ScrollView,
	TouchableOpacity,
	Dimensions
} from 'react-native'
import { useRouter, useLocalSearchParams, Stack } from 'expo-router'
import RNPickerSelect from 'react-native-picker-select'
import Slider from '@react-native-community/slider'
import { supabase } from '@/utils/supabase'
import { Ionicons } from '@expo/vector-icons'

const { width: SCREEN_WIDTH } = Dimensions.get('window')

const CustomRangeSlider = ({
	minValue,
	maxValue,
	currentMin,
	currentMax,
	onValuesChange,
	step,
	formatLabel
}: any) => (
	<View className='w-full'>
		<View className='flex-row justify-between mb-2'>
			<Text>{formatLabel(currentMin)}</Text>
			<Text>{formatLabel(currentMax)}</Text>
		</View>
		<View className='flex-row justify-between'>
			<Slider
				style={{ width: SCREEN_WIDTH * 0.4 }}
				minimumValue={minValue}
				maximumValue={maxValue}
				step={step}
				value={currentMin}
				onValueChange={value => onValuesChange([value, currentMax])}
			/>
			<Slider
				style={{ width: SCREEN_WIDTH * 0.4 }}
				minimumValue={currentMin}
				maximumValue={maxValue}
				step={step}
				value={currentMax}
				onValueChange={value => onValuesChange([currentMin, value])}
			/>
		</View>
	</View>
)

const FilterPage = () => {
	const router = useRouter()
	const params = useLocalSearchParams()
	const [filters, setFilters] = useState<any>(
		JSON.parse(params.filters as string)
	)
	const [dealerships, setDealerships] = useState<any>([])
	const [makes, setMakes] = useState<any>([])
	const [models, setModels] = useState<any>([])
	const [colors, setColors] = useState<any>([])
	const [priceRange, setPriceRange] = useState<any>([0, 1000000])
	const [mileageRange, setMileageRange] = useState<any>([0, 500000])

	useEffect(() => {
		fetchInitialData()
	}, [])

	const fetchInitialData = () => {
		fetchDealerships()
		fetchMakes()
		fetchColors()
		fetchPriceRange()
		fetchMileageRange()
	}

	const fetchDealerships = async () => {
		const { data, error } = await supabase
			.from('dealerships')
			.select('id, name')
		if (error) {
			console.error('Error fetching dealerships:', error)
		} else {
			setDealerships(data || [])
		}
	}

	const fetchMakes = async () => {
		const { data, error } = await supabase
			.from('cars')
			.select('make')
			.order('make')
		if (error) {
			console.error('Error fetching makes:', error)
		} else {
			const uniqueMakes = [...new Set(data?.map(item => item.make))]
			setMakes(uniqueMakes)
		}
	}

	const fetchModels = async (make: string) => {
		const { data, error } = await supabase
			.from('cars')
			.select('model')
			.eq('make', make)
			.order('model')
		if (error) {
			console.error('Error fetching models:', error)
		} else {
			const uniqueModels = [...new Set(data?.map(item => item.model))]
			setModels(uniqueModels)
		}
	}

	const fetchColors = async () => {
		const { data, error } = await supabase
			.from('cars')
			.select('color')
			.order('color')
		if (error) {
			console.error('Error fetching colors:', error)
		} else {
			const uniqueColors = [...new Set(data?.map(item => item.color))]
			setColors(uniqueColors)
		}
	}

	const fetchPriceRange = async () => {
		const { data, error } = await supabase
			.from('cars')
			.select('price')
			.order('price', { ascending: false })
			.limit(1)

		if (error) {
			console.error('Error fetching price range:', error)
		} else if (data && data.length > 0) {
			setPriceRange([0, data[0].price])
			setFilters((prev: any) => ({ ...prev, priceRange: [0, data[0].price] }))
		}
	}

	const fetchMileageRange = async () => {
		const { data, error } = await supabase
			.from('cars')
			.select('mileage')
			.order('mileage', { ascending: false })
			.limit(1)

		if (error) {
			console.error('Error fetching mileage range:', error)
		} else if (data && data.length > 0) {
			setMileageRange([0, data[0].mileage])
			setFilters((prev: any) => ({
				...prev,
				mileageRange: [0, data[0].mileage]
			}))
		}
	}

	const applyFilters = () => {
		router.push({
			pathname: '/(home)/(user)',
			params: { filters: JSON.stringify(filters) }
		})
	}

	return (
		<View className='flex-1 bg-white'>
			<Stack.Screen
				options={{
					presentation: 'modal',
					headerLeft: () => (
						<TouchableOpacity onPress={() => router.back()}>
							<Ionicons name='arrow-back' size={24} color='black' />
						</TouchableOpacity>
					),
					title: 'Filters'
				}}
			/>
			<ScrollView className='flex-1 p-4'>
				<View className='space-y-4'>
					{/* Dealership Filter */}
					<View>
						<Text className='font-semibold mb-2'>Dealership</Text>
						<RNPickerSelect
							onValueChange={value =>
								setFilters({ ...filters, dealership: value })
							}
							value={filters.dealership}
							items={dealerships.map(
								(dealership: { name: any; id: { toString: () => any } }) => ({
									label: dealership.name,
									value: dealership.id.toString()
								})
							)}
							placeholder={{ label: 'All Dealerships', value: null }}
							style={{
								inputIOS: {
									color: 'black',
									padding: 10,
									backgroundColor: '#f0f0f0',
									borderRadius: 5
								},
								inputAndroid: {
									color: 'black',
									padding: 10,
									backgroundColor: '#f0f0f0',
									borderRadius: 5
								}
							}}
						/>
					</View>

					{/* Make Filter */}
					<View>
						<Text className='font-semibold mb-2'>Make</Text>
						<RNPickerSelect
							onValueChange={value => {
								setFilters({ ...filters, make: value, model: '' })
								if (value) fetchModels(value)
							}}
							value={filters.make}
							items={makes.map((make: any) => ({
								label: make,
								value: make
							}))}
							placeholder={{ label: 'All Makes', value: null }}
							style={{
								inputIOS: {
									color: 'black',
									padding: 10,
									backgroundColor: '#f0f0f0',
									borderRadius: 5
								},
								inputAndroid: {
									color: 'black',
									padding: 10,
									backgroundColor: '#f0f0f0',
									borderRadius: 5
								}
							}}
						/>
					</View>

					{/* Model Filter */}
					<View>
						<Text className='font-semibold mb-2'>Model</Text>
						<RNPickerSelect
							onValueChange={value => setFilters({ ...filters, model: value })}
							value={filters.model}
							items={models.map((model: any) => ({
								label: model,
								value: model
							}))}
							placeholder={{ label: 'All Models', value: null }}
							style={{
								inputIOS: {
									color: 'black',
									padding: 10,
									backgroundColor: '#f0f0f0',
									borderRadius: 5
								},
								inputAndroid: {
									color: 'black',
									padding: 10,
									backgroundColor: '#f0f0f0',
									borderRadius: 5
								}
							}}
						/>
					</View>

					{/* Condition Filter */}
					<View>
						<Text className='font-semibold mb-2'>Condition</Text>
						<RNPickerSelect
							onValueChange={value =>
								setFilters({ ...filters, condition: value })
							}
							value={filters.condition}
							items={[
								{ label: 'New', value: 'New' },
								{ label: 'Used', value: 'Used' }
							]}
							placeholder={{ label: 'All Conditions', value: null }}
							style={{
								inputIOS: {
									color: 'black',
									padding: 10,
									backgroundColor: '#f0f0f0',
									borderRadius: 5
								},
								inputAndroid: {
									color: 'black',
									padding: 10,
									backgroundColor: '#f0f0f0',
									borderRadius: 5
								}
							}}
						/>
					</View>

					{/* Price Range Filter */}
					<View>
						<Text className='font-semibold mb-2'>Price Range</Text>
						<CustomRangeSlider
							minValue={priceRange[0]}
							maxValue={priceRange[1]}
							currentMin={filters.priceRange[0]}
							currentMax={filters.priceRange[1]}
							onValuesChange={(values: any) =>
								setFilters({ ...filters, priceRange: values })
							}
							step={1000}
							formatLabel={(value: { toLocaleString: () => any }) =>
								`$${value.toLocaleString()}`
							}
						/>
					</View>

					{/* Mileage Range Filter */}
					<View>
						<Text className='font-semibold mb-2'>Mileage Range</Text>
						<CustomRangeSlider
							minValue={mileageRange[0]}
							maxValue={mileageRange[1]}
							currentMin={filters.mileageRange[0]}
							currentMax={filters.mileageRange[1]}
							onValuesChange={(values: any) =>
								setFilters({ ...filters, mileageRange: values })
							}
							step={1000}
							formatLabel={(value: { toLocaleString: () => any }) =>
								`${value.toLocaleString()} miles`
							}
						/>
					</View>

					{/* Year Filter */}
					<View>
						<Text className='font-semibold mb-2'>Year</Text>
						<RNPickerSelect
							onValueChange={value => setFilters({ ...filters, year: value })}
							value={filters.year}
							items={Array.from({ length: 30 }, (_, i) => 2024 - i).map(
								year => ({
									label: year.toString(),
									value: year.toString()
								})
							)}
							placeholder={{ label: 'All Years', value: null }}
							style={{
								inputIOS: {
									color: 'black',
									padding: 10,
									backgroundColor: '#f0f0f0',
									borderRadius: 5
								},
								inputAndroid: {
									color: 'black',
									padding: 10,
									backgroundColor: '#f0f0f0',
									borderRadius: 5
								}
							}}
						/>
					</View>

					{/* Color Filter */}
					<View>
						<Text className='font-semibold mb-2'>Color</Text>
						<RNPickerSelect
							onValueChange={value => setFilters({ ...filters, color: value })}
							value={filters.color}
							items={colors.map((color: any) => ({
								label: color,
								value: color
							}))}
							placeholder={{ label: 'All Colors', value: null }}
							style={{
								inputIOS: {
									color: 'black',
									padding: 10,
									backgroundColor: '#f0f0f0',
									borderRadius: 5
								},
								inputAndroid: {
									color: 'black',
									padding: 10,
									backgroundColor: '#f0f0f0',
									borderRadius: 5
								}
							}}
						/>
					</View>

					{/* Transmission Filter */}
					<View>
						<Text className='font-semibold mb-2'>Transmission</Text>
						<RNPickerSelect
							onValueChange={value =>
								setFilters({ ...filters, transmission: value })
							}
							value={filters.transmission}
							items={[
								{ label: 'Manual', value: 'Manual' },
								{ label: 'Automatic', value: 'Automatic' }
							]}
							placeholder={{ label: 'All Transmissions', value: null }}
							style={{
								inputIOS: {
									color: 'black',
									padding: 10,
									backgroundColor: '#f0f0f0',
									borderRadius: 5
								},
								inputAndroid: {
									color: 'black',
									padding: 10,
									backgroundColor: '#f0f0f0',
									borderRadius: 5
								}
							}}
						/>
					</View>

					{/* Drivetrain Filter */}
					<View className='mb-12'>
						<Text className='font-semibold mb-2'>Drivetrain</Text>
						<RNPickerSelect
							onValueChange={value =>
								setFilters({ ...filters, drivetrain: value })
							}
							value={filters.drivetrain}
							items={[
								{ label: 'FWD', value: 'FWD' },
								{ label: 'RWD', value: 'RWD' },
								{ label: 'AWD', value: 'AWD' },
								{ label: '4WD', value: '4WD' },
								{ label: '4x4', value: '4x4' }
							]}
							placeholder={{ label: 'All Drivetrains', value: null }}
							style={{
								inputIOS: {
									color: 'black',
									padding: 10,
									backgroundColor: '#f0f0f0',
									borderRadius: 5
								},
								inputAndroid: {
									color: 'black',
									padding: 10,
									backgroundColor: '#f0f0f0',
									borderRadius: 5
								}
							}}
						/>
					</View>
				</View>
			</ScrollView>
			<View className='flex-row bg-gray-200  justify-end p-4'>
				<TouchableOpacity
					className='bg-gray-300 py-2 px-4 rounded mr-2'
					onPress={() => router.back()}>
					<Text>Cancel</Text>
				</TouchableOpacity>
				<TouchableOpacity
					className='bg-red py-2 px-4 rounded'
					onPress={applyFilters}>
					<Text className='text-white'>Apply Filters</Text>
				</TouchableOpacity>
			</View>
		</View>
	)
}

export default FilterPage