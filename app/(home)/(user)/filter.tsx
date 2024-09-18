import React, { useState, useEffect, useCallback } from 'react'
import {
	View,
	Text,
	ScrollView,
	TouchableOpacity,
	TextInput,
	StatusBar
} from 'react-native'
import { useRouter, useLocalSearchParams, Stack } from 'expo-router'
import RNPickerSelect from 'react-native-picker-select'
import { supabase } from '@/utils/supabase'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '@/utils/ThemeContext'
import { SafeAreaView } from 'react-native-safe-area-context'
import CategorySelector from '@/components/Category'

const CustomHeader = ({ title, onBack }: any) => {
	const { isDarkMode } = useTheme()
	const iconColor = isDarkMode ? '#D55004' : '#FF8C00'

	return (
		<SafeAreaView
			edges={['top']}
			style={{ backgroundColor: isDarkMode ? '#000000' : '#FFFFFF' }}>
			<StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
			<View
				style={{
					flexDirection: 'row',
					alignItems: 'center',
					paddingBottom: 14,
					paddingHorizontal: 16
				}}>
				<TouchableOpacity onPress={onBack}>
					<Ionicons name='arrow-back' size={24} color={iconColor} />
				</TouchableOpacity>
				<Text
					style={{
						marginLeft: 16,
						fontSize: 18,
						fontWeight: 'bold',
						color: isDarkMode ? '#FFFFFF' : '#000000'
					}}>
					{title}
				</Text>
			</View>
		</SafeAreaView>
	)
}

const FilterPage = () => {
	const { isDarkMode } = useTheme()
	const router = useRouter()

	const params = useLocalSearchParams()
	const [filters, setFilters] = useState<any>(() => {
		try {
			return JSON.parse(params.filters as string) || {}
		} catch {
			return {
				dealership: '',
				make: '',
				model: '',
				condition: '',
				priceRange: [0, 1000000],
				mileageRange: [0, 500000],
				yearRange: [1900, new Date().getFullYear()],
				color: '',
				transmission: '',
				drivetrain: '',
				categories: []
			}
		}
	})

	const [dealerships, setDealerships] = useState<any>([])
	const [makes, setMakes] = useState<any>([])
	const [models, setModels] = useState<any>([])
	const [colors, setColors] = useState<any>([])
	const textColor = isDarkMode ? 'text-white' : 'text-black'
	const bgColor = isDarkMode ? 'bg-night' : 'bg-white'
	const inputBgColor = isDarkMode ? 'bg-gray' : 'bg-light-secondary'
	const buttonBgColor = isDarkMode ? 'bg-red' : 'bg-red'
	const cancelBgColor = isDarkMode ? 'bg-gray' : 'bg-light-secondary'

	useEffect(() => {
		fetchInitialData()
	}, [])

	const fetchInitialData = async () => {
		await Promise.all([fetchDealerships(), fetchMakes(), fetchColors()])
	}

	const fetchDealerships = async () => {
		const { data, error } = await supabase
			.from('dealerships')
			.select('id, name')
		if (!error) setDealerships(data || [])
	}

	const fetchMakes = async () => {
		const { data, error } = await supabase
			.from('cars')
			.select('make')
			.order('make')
		if (!error) setMakes([...new Set(data?.map(item => item.make))])
	}

	const fetchModels = async (make: any) => {
		const { data, error } = await supabase
			.from('cars')
			.select('model')
			.eq('make', make)
			.order('model')
		if (!error) setModels([...new Set(data?.map(item => item.model))])
	}

	const fetchColors = async () => {
		const { data, error } = await supabase
			.from('cars')
			.select('color')
			.order('color')
		if (!error) setColors([...new Set(data?.map(item => item.color))])
	}

	const clearFilters = async () => {
		setFilters({
			dealership: null,
			make: null,
			model: null,
			condition: '',
			priceRange: [0, 1000000],
			mileageRange: [0, 500000],
			yearRange: [1900, new Date().getFullYear()],
			color: null,
			transmission: null,
			drivetrain: null,
			categories: []
		})

		await new Promise(resolve => setTimeout(resolve, 100))

		router.replace({
			pathname: '/(home)/(user)',
			params: { filters: JSON.stringify({}) }
		})
		await new Promise(resolve => setTimeout(resolve, 200))
	}

	const applyFilters = async () => {
		await new Promise(resolve => setTimeout(resolve, 100))
		router.replace({
			pathname: '/(home)/(user)',
			params: { filters: JSON.stringify(filters) }
		})
	}

	const handleCategoryPress = (category: string) => {
		setFilters((prevFilters: any) => {
			const updatedCategories = prevFilters.categories.includes(category)
				? prevFilters.categories.filter((c: string) => c !== category)
				: [...prevFilters.categories, category]

			return {
				...prevFilters,
				categories: updatedCategories
			}
		})
	}

	const RangeInput = useCallback(
		({ label, min, max, value, onChange }: any) => (
			<View>
				<Text className={`font-semibold ${textColor} mb-2`}>{label}</Text>
				<View className='flex-row justify-between'>
					<TextInput
						style={{
							width: '48%',
							paddingVertical: 0,
							paddingTop: 3,
							paddingLeft: 10,
							backgroundColor: isDarkMode ? '#4C4C4C' : '#F5F5F5',
							color: isDarkMode ? 'white' : 'black',
							borderRadius: 5,
							textAlignVertical: 'center' // Align text vertically
						}}
						keyboardType='numeric'
						value={value[0].toString()}
						onChangeText={text => onChange([parseInt(text) || min, value[1]])}
						placeholder={`Min ${min}`}
						placeholderTextColor={isDarkMode ? '#A0A0A0' : '#606060'}
					/>
					<TextInput
						style={{
							width: '48%',
							paddingVertical: 0,
							paddingTop: 3,
							paddingLeft: 10,
							backgroundColor: isDarkMode ? '#4C4C4C' : '#F5F5F5',
							color: isDarkMode ? 'white' : 'black',
							borderRadius: 5,
							textAlignVertical: 'center' // Align text vertically
						}}
						keyboardType='numeric'
						value={value[1].toString()}
						onChangeText={text => onChange([value[0], parseInt(text) || max])}
						placeholder={`Max ${max}`}
						placeholderTextColor={isDarkMode ? '#A0A0A0' : '#606060'}
					/>
				</View>
			</View>
		),
		[isDarkMode, textColor]
	)

	return (
		<View className={`flex-1 ${bgColor}`}>
			<CustomHeader title='Filters' onBack={() => router.back()} />
			<Stack.Screen
				options={{
					presentation: 'modal',
					headerLeft: () => (
						<TouchableOpacity onPress={() => router.back()}>
							<Ionicons
								name='arrow-back'
								size={24}
								color={isDarkMode ? 'white' : 'black'}
							/>
						</TouchableOpacity>
					),
					title: 'Filters',
					headerStyle: {
						backgroundColor: isDarkMode ? '#0D0D0D' : '#FFFFFF'
					},
					headerTintColor: isDarkMode ? '#FFFFFF' : '#333333'
				}}
			/>
			<ScrollView className='flex-1 p-4'>
				<View className='space-y-4'>
					{/* Dealership Filter */}
					<View>
						<Text className={`font-semibold ${textColor} mb-2`}>
							Dealership
						</Text>
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
									color: isDarkMode ? 'white' : 'black',
									paddingVertical: 0, // Even vertical padding,
									paddingTop: 15,
									backgroundColor: isDarkMode ? '#4C4C4C' : '#F5F5F5',
									borderRadius: 5,
									textAlignVertical: 'center' // Align text vertically
								},
								inputAndroid: {
									color: isDarkMode ? 'white' : 'black',
									paddingVertical: 0, // Even vertical padding,
									paddingTop: 15,
									backgroundColor: isDarkMode ? '#4C4C4C' : '#F5F5F5',
									borderRadius: 5,
									textAlignVertical: 'center' // Align text vertically
								}
							}}
						/>
					</View>

					{/* Make Filter */}
					<View>
						<Text className={`font-semibold ${textColor} mb-2`}>Make</Text>
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
									color: isDarkMode ? 'white' : 'black',
									paddingVertical: 0, // Even vertical padding,
									paddingTop: 15,
									backgroundColor: isDarkMode ? '#4C4C4C' : '#F5F5F5',
									borderRadius: 5,
									textAlignVertical: 'center' // Align text vertically
								},
								inputAndroid: {
									color: isDarkMode ? 'white' : 'black',
									paddingVertical: 0, // Even vertical padding,
									paddingTop: 15,
									backgroundColor: isDarkMode ? '#4C4C4C' : '#F5F5F5',
									borderRadius: 5,
									textAlignVertical: 'center' // Align text vertically
								}
							}}
						/>
					</View>

					{/* Model Filter */}
					<View>
						<Text className={`font-semibold ${textColor} mb-2`}>Model</Text>
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
									color: isDarkMode ? 'white' : 'black',
									paddingVertical: 0, // Even vertical padding,
									paddingTop: 15,
									backgroundColor: isDarkMode ? '#4C4C4C' : '#F5F5F5',
									borderRadius: 5,
									textAlignVertical: 'center' // Align text vertically
								},
								inputAndroid: {
									color: isDarkMode ? 'white' : 'black',
									paddingVertical: 0, // Even vertical padding,
									paddingTop: 15,
									backgroundColor: isDarkMode ? '#4C4C4C' : '#F5F5F5',
									borderRadius: 5,
									textAlignVertical: 'center' // Align text vertically
								}
							}}
						/>
					</View>

					{/* Condition Filter */}
					<View>
						<Text className={`font-semibold ${textColor} mb-2`}>Condition</Text>
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
									color: isDarkMode ? 'white' : 'black',
									paddingVertical: 0, // Even vertical padding,
									paddingTop: 15,
									backgroundColor: isDarkMode ? '#4C4C4C' : '#F5F5F5',
									borderRadius: 5,
									textAlignVertical: 'center' // Align text vertically
								},
								inputAndroid: {
									color: isDarkMode ? 'white' : 'black',
									paddingVertical: 0, // Even vertical padding,
									paddingTop: 15,
									backgroundColor: isDarkMode ? '#4C4C4C' : '#F5F5F5',
									borderRadius: 5,
									textAlignVertical: 'center' // Align text vertically
								}
							}}
						/>
					</View>

					{/* Price Range Filter */}
					<RangeInput
						label='Price Range'
						min={0}
						max={1000000}
						value={filters.priceRange || [0, 1000000]}
						onChange={(value: any) =>
							setFilters({ ...filters, priceRange: value })
						}
					/>

					<RangeInput
						label='Mileage Range'
						min={0}
						max={500000}
						value={filters.mileageRange || [0, 500000]}
						onChange={(value: any) =>
							setFilters({ ...filters, mileageRange: value })
						}
					/>

					<RangeInput
						label='Year Range'
						min={1900}
						max={new Date().getFullYear()}
						value={filters.yearRange || [1900, new Date().getFullYear()]}
						onChange={(value: any) =>
							setFilters({ ...filters, yearRange: value })
						}
					/>

					{/* Color Filter */}
					<View>
						<Text className={`font-semibold ${textColor} mb-2`}>Color</Text>
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
									color: isDarkMode ? 'white' : 'black',
									paddingVertical: 0, // Even vertical padding,
									paddingTop: 15,
									backgroundColor: isDarkMode ? '#4C4C4C' : '#F5F5F5',
									borderRadius: 5,
									textAlignVertical: 'center' // Align text vertically
								},
								inputAndroid: {
									color: isDarkMode ? 'white' : 'black',
									paddingVertical: 0, // Even vertical padding,
									paddingTop: 15,
									backgroundColor: isDarkMode ? '#4C4C4C' : '#F5F5F5',
									borderRadius: 5,
									textAlignVertical: 'center' // Align text vertically
								}
							}}
						/>
					</View>

					{/* Transmission Filter */}
					<View>
						<Text className={`font-semibold ${textColor} mb-2`}>
							Transmission
						</Text>
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
									color: isDarkMode ? 'white' : 'black',
									paddingVertical: 0, // Even vertical padding,
									paddingTop: 15,
									backgroundColor: isDarkMode ? '#4C4C4C' : '#F5F5F5',
									borderRadius: 5,
									textAlignVertical: 'center' // Align text vertically
								},
								inputAndroid: {
									color: isDarkMode ? 'white' : 'black',
									paddingVertical: 0, // Even vertical padding,
									paddingTop: 15,
									backgroundColor: isDarkMode ? '#4C4C4C' : '#F5F5F5',
									borderRadius: 5,
									textAlignVertical: 'center' // Align text vertically
								}
							}}
						/>
					</View>

					{/* Drivetrain Filter */}
					<View className='mb-12'>
						<Text className={`font-semibold ${textColor} mb-2`}>
							Drivetrain
						</Text>
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
									color: isDarkMode ? 'white' : 'black',
									paddingVertical: 0, // Even vertical padding,
									paddingTop: 15,
									backgroundColor: isDarkMode ? '#4C4C4C' : '#F5F5F5',
									borderRadius: 5,
									textAlignVertical: 'center' // Align text vertically
								},
								inputAndroid: {
									color: isDarkMode ? 'white' : 'black',
									paddingVertical: 0, // Even vertical padding,
									paddingTop: 15,
									backgroundColor: isDarkMode ? '#4C4C4C' : '#F5F5F5',
									borderRadius: 5,
									textAlignVertical: 'center' // Align text vertically
								}
							}}
						/>
					</View>
					<View>
						<Text className={`font-semibold ${textColor} mb-2`}>
							Categories
						</Text>
						<CategorySelector
							selectedCategories={filters.categories || []}
							onCategoryPress={handleCategoryPress}
						/>
					</View>
				</View>
			</ScrollView>
			<View className={`flex-row ${inputBgColor} justify-between p-4 mb-10`}>
				<TouchableOpacity
					className={`${cancelBgColor} py-2 px-4 rounded`}
					onPress={clearFilters}>
					<Text className={textColor}>Clear Filters</Text>
				</TouchableOpacity>
				<View className='flex-row'>
					<TouchableOpacity
						className={`${cancelBgColor} py-2 px-4 rounded mr-2`}
						onPress={() => router.back()}>
						<Text className={textColor}>Cancel</Text>
					</TouchableOpacity>
					<TouchableOpacity
						className={`${buttonBgColor} py-2 px-4 rounded`}
						onPress={applyFilters}>
						<Text className={textColor}>Apply Filters</Text>
					</TouchableOpacity>
				</View>
			</View>
		</View>
	)
}

export default FilterPage
