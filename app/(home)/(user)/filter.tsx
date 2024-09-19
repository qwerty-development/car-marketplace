import React, { useState, useEffect, useCallback, useRef } from 'react'
import {
	View,
	Text,
	ScrollView,
	TouchableOpacity,
	TextInput,
	Animated,
	FlatList
} from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '@/utils/ThemeContext'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import CategorySelector from '@/components/Category'
import { supabase } from '@/utils/supabase'
import Slider from '@react-native-community/slider'

const CustomHeader = ({ title, onBack }: any) => {
	const { isDarkMode } = useTheme()
	const insets = useSafeAreaInsets()
	const iconColor = isDarkMode ? '#D55004' : '#FF8C00'

	return (
		<View
			style={{
				paddingTop: insets.top - 10,
				backgroundColor: isDarkMode ? '#000000' : '#FFFFFF'
			}}>
			<View className='flex-row items-center py-4 px-4'>
				<TouchableOpacity onPress={onBack}>
					<Ionicons name='arrow-back' size={24} color={iconColor} />
				</TouchableOpacity>
				<Text
					className={`ml-4 text-lg font-bold ${
						isDarkMode ? 'text-white' : 'text-black'
					}`}>
					{title}
				</Text>
			</View>
		</View>
	)
}

const CollapsibleSection = ({ title, children }: any) => {
	const [isCollapsed, setIsCollapsed] = useState(false)
	const animatedHeight = useRef(new Animated.Value(0)).current
	const { isDarkMode } = useTheme()

	useEffect(() => {
		Animated.timing(animatedHeight, {
			toValue: isCollapsed ? 0 : 1,
			duration: 300,
			useNativeDriver: false
		}).start()
	}, [isCollapsed])

	return (
		<View className='mb-6'>
			<TouchableOpacity
				onPress={() => setIsCollapsed(!isCollapsed)}
				className='flex-row justify-between items-center mb-2'>
				<Text
					className={`font-semibold ${
						isDarkMode ? 'text-white' : 'text-night'
					} text-lg`}>
					{title}
				</Text>
				<Ionicons
					name={isCollapsed ? 'chevron-down' : 'chevron-up'}
					size={24}
					color='#D55004'
				/>
			</TouchableOpacity>
			<Animated.View
				style={{
					maxHeight: animatedHeight.interpolate({
						inputRange: [0, 1],
						outputRange: [0, 1000]
					}),
					overflow: 'hidden'
				}}>
				{children}
			</Animated.View>
		</View>
	)
}

const FilterPage = () => {
	const { isDarkMode } = useTheme()
	const router = useRouter()
	const params = useLocalSearchParams()
	const [filters, setFilters] = useState(() => {
		try {
			return (
				JSON.parse(params.filters as string) || {
					dealership: '',
					dealershipName: '',
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
			)
		} catch {
			return {
				dealership: '',
				dealershipName: '',
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

	const RangeSlider = ({ label, min, max, value, onChange, step = 1 }: any) => {
		const { isDarkMode } = useTheme()

		return (
			<View className='mb-6'>
				<View className='flex-row justify-between items-center mb-2'>
					<Text
						className={`font-semibold ${
							isDarkMode ? 'text-white' : 'text-night'
						}`}>
						{label}
					</Text>
				</View>
				<View className='flex-row justify-between mb-2'>
					<Text className={isDarkMode ? 'text-gray' : 'text-gray'}>
						{value[0].toLocaleString()}
					</Text>
					<Text className={isDarkMode ? 'text-gray' : 'text-gray'}>
						{value[1].toLocaleString()}
					</Text>
				</View>
				<Slider
					style={{ width: '100%', height: 40 }}
					minimumValue={min}
					maximumValue={max}
					step={step}
					value={value[0]}
					onValueChange={newValue => onChange([Math.round(newValue), value[1]])}
					minimumTrackTintColor='#D55004'
					maximumTrackTintColor={isDarkMode ? 'gray' : 'light-secondary'}
					thumbTintColor='#D55004'
				/>
				<Slider
					style={{ width: '100%', height: 40 }}
					minimumValue={min}
					maximumValue={max}
					step={step}
					value={value[1]}
					onValueChange={newValue => onChange([value[0], Math.round(newValue)])}
					minimumTrackTintColor='#D55004'
					maximumTrackTintColor={isDarkMode ? 'gray' : 'light-secondary'}
					thumbTintColor='#D55004'
				/>
			</View>
		)
	}

	const SearchableSelect = ({
		label,
		items,
		value,
		onChange,
		placeholder
	}: any) => {
		const [searchQuery, setSearchQuery] = useState('')
		const [isDropdownOpen, setIsDropdownOpen] = useState(false)
		const filteredItems = items.filter((item: string) =>
			item?.toLowerCase()?.includes(searchQuery?.toLowerCase())
		)

		return (
			<View className='mb-6'>
				<View className='flex-row justify-between items-center mb-2'>
					<Text
						className={`font-semibold ${
							isDarkMode ? 'text-white' : 'text-night'
						}`}>
						{label}
					</Text>
					{value && (
						<TouchableOpacity onPress={() => onChange('')}>
							<Ionicons name='close-circle' size={24} color='red' />
						</TouchableOpacity>
					)}
				</View>
				<View
					className={`border rounded-md ${
						isDarkMode ? 'border-gray' : 'border-light-secondary'
					}`}>
					<TouchableOpacity
						onPress={() => setIsDropdownOpen(!isDropdownOpen)}
						className={`p-2 flex-row justify-between items-center ${
							value ? 'bg-red' : isDarkMode ? 'bg-gray' : 'bg-light-secondary'
						}`}>
						<Text className={isDarkMode ? 'text-white' : 'text-night'}>
							{value || `Select ${placeholder}`}
						</Text>
						<Ionicons
							name={isDropdownOpen ? 'chevron-up' : 'chevron-down'}
							size={24}
							color={isDarkMode ? 'white' : 'night'}
						/>
					</TouchableOpacity>
					{isDropdownOpen && (
						<View>
							<TextInput
								className={`p-2 ${
									isDarkMode
										? 'text-white bg-gray'
										: 'text-night bg-light-secondary'
								}`}
								placeholder={`Search ${placeholder}`}
								placeholderTextColor={isDarkMode ? 'light-text' : 'gray'}
								value={searchQuery}
								onChangeText={setSearchQuery}
							/>
							<FlatList
								data={filteredItems}
								keyExtractor={(item, index) => index.toString()}
								renderItem={({ item }) => (
									<TouchableOpacity
										onPress={() => {
											onChange(item)
											setIsDropdownOpen(false)
											setSearchQuery('')
										}}
										className={`p-2 ${
											item === value
												? 'bg-red'
												: isDarkMode
												? 'bg-gray'
												: 'bg-light-secondary'
										}`}>
										<Text className={isDarkMode ? 'text-white' : 'text-night'}>
											{item}
										</Text>
									</TouchableOpacity>
								)}
								style={{ maxHeight: 200 }}
								nestedScrollEnabled={true}
							/>
						</View>
					)}
				</View>
			</View>
		)
	}

	const PopularFilters = () => {
		const popularFilters = [
			{ label: 'SUVs', filter: { categories: ['SUV'] } },
			{ label: 'Under $30,000', filter: { priceRange: [0, 30000] } },
			{ label: 'Low Mileage', filter: { mileageRange: [0, 50000] } }
		]

		return (
			<View className='mb-6'>
				<Text
					className={`font-semibold ${
						isDarkMode ? 'text-white' : 'text-night'
					} text-lg mb-2`}>
					Popular Filters
				</Text>
				<View className='flex-row flex-wrap'>
					{popularFilters.map((item, index) => (
						<TouchableOpacity
							key={index}
							onPress={() =>
								setFilters((prev: any) => ({ ...prev, ...item.filter }))
							}
							className={`mr-2 mb-2 px-3 py-1 rounded-full ${
								isDarkMode ? 'bg-gray' : 'bg-light-secondary'
							}`}>
							<Text className={isDarkMode ? 'text-white' : 'text-night'}>
								{item.label}
							</Text>
						</TouchableOpacity>
					))}
				</View>
			</View>
		)
	}

	return (
		<SafeAreaView className={`flex-1 ${isDarkMode ? 'bg-night' : 'bg-white'}`}>
			<CustomHeader title='Filters' onBack={() => router.back()} />
			<ScrollView className='flex-1 p-4'>
				<PopularFilters />

				<CollapsibleSection title='Basic Filters'>
					<SearchableSelect
						label='Dealership'
						items={dealerships.map((d:any) => d.name)}
						value={filters.dealershipName}
						onChange={(value: any) => {
							const selectedDealership = dealerships.find((d:any) => d.name === value)
							setFilters({
								...filters,
								dealership: selectedDealership ? selectedDealership.id : '',
								dealershipName: value
							})
						}}
						placeholder='dealerships'
					/>
					<SearchableSelect
						label='Make'
						items={makes}
						value={filters.make}
						onChange={(value: any) => {
							setFilters({ ...filters, make: value, model: '' })
							fetchModels(value)
						}}
						placeholder='makes'
					/>
					{filters.make && (
						<SearchableSelect
							label='Model'
							items={models}
							value={filters.model}
							onChange={(value: any) =>
								setFilters({ ...filters, model: value })
							}
							placeholder='models'
						/>
					)}
					<RangeSlider
						label='Price Range'
						min={0}
						max={1000000}
						step={1000}
						value={filters.priceRange || [0, 1000000]}
						onChange={(value: any) =>
							setFilters({ ...filters, priceRange: value })
						}
					/>
				</CollapsibleSection>

				<CollapsibleSection title='Advanced Filters'>
					<RangeSlider
						label='Mileage Range'
						min={0}
						max={500000}
						step={1000}
						value={filters.mileageRange || [0, 500000]}
						onChange={(value: any) =>
							setFilters({ ...filters, mileageRange: value })
						}
					/>
					<RangeSlider
						label='Year Range'
						min={1900}
						max={new Date().getFullYear()}
						step={1}
						value={filters.yearRange || [1900, new Date().getFullYear()]}
						onChange={(value: any) =>
							setFilters({ ...filters, yearRange: value })
						}
					/>
					<SearchableSelect
						label='Color'
						items={colors}
						value={filters.color}
						onChange={(value: any) => setFilters({ ...filters, color: value })}
						placeholder='colors'
					/>
					<SearchableSelect
						label='Transmission'
						items={['Automatic', 'Manual']}
						value={filters.transmission}
						onChange={(value: any) =>
							setFilters({ ...filters, transmission: value })
						}
						placeholder='transmission types'
					/>
					<SearchableSelect
						label='Drivetrain'
						items={['FWD', 'RWD', 'AWD', '4WD', '4x4']}
						value={filters.drivetrain}
						onChange={(value: any) =>
							setFilters({ ...filters, drivetrain: value })
						}
						placeholder='drivetrain types'
					/>
				</CollapsibleSection>

				<CollapsibleSection title='Categories'>
					<CategorySelector
						selectedCategories={filters.categories || []}
						onCategoryPress={category => {
							const updatedCategories = filters.categories?.includes(category)
								? filters.categories.filter((c: string) => c !== category)
								: [...(filters.categories || []), category]
							setFilters({ ...filters, categories: updatedCategories })
						}}
					/>
				</CollapsibleSection>
			</ScrollView>
			<View
				className={`flex-row justify-between p-4 ${
					isDarkMode ? 'bg-gray' : 'bg-light-secondary'
				}`}>
				<TouchableOpacity
					className={`py-2 px-4 rounded ${
						isDarkMode ? 'bg-night' : 'bg-white'
					}`}
					onPress={() => {
						setFilters({
							dealership: '',
							dealershipName: '',
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
						})
						router.push({
							pathname: '/(home)/(user)',
							params: { filters: JSON.stringify({}) }
						})
					}}>
					<Text className={isDarkMode ? 'text-white' : 'text-night'}>
						Clear All
					</Text>
				</TouchableOpacity>
				<TouchableOpacity
					className='bg-red py-2 px-4 rounded'
					onPress={() => {
						router.push({
							pathname: '/(home)/(user)',
							params: { filters: JSON.stringify(filters) }
						})
					}}>
					<Text className='text-white'>Apply Filters</Text>
				</TouchableOpacity>
			</View>
		</SafeAreaView>
	)
}

export default FilterPage
