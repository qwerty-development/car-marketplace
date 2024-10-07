import React, { useState, useEffect, useCallback, useRef } from 'react'
import {
	View,
	Text,
	ScrollView,
	TouchableOpacity,
	TextInput,
	Animated,
	FlatList,
	StatusBar
} from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '@/utils/ThemeContext'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import CategorySelector from '@/components/Category'
import { supabase } from '@/utils/supabase'

const CustomHeader = ({ title, onBack }: any) => {
	const { isDarkMode } = useTheme()
	const iconColor = isDarkMode ? '#D55004' : '#FF8C00'

	return (
		<View className={`${isDarkMode ? 'bg-black' : 'bg-white'} top-0 mt-0 p-3`}>
			<StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
			<View className='flex-row items-center justify-between py-0 px-4 -mb-1 top-0 '>
				<TouchableOpacity onPress={onBack} className='p-2'>
					<Ionicons name='arrow-back' size={24} color={iconColor} />
				</TouchableOpacity>
				<Text
					className={`text-xl font-bold ${
						isDarkMode ? 'text-white' : 'text-black'
					}`}>
					{title}
				</Text>
				<View style={{ width: 24 }} />
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
				className='flex-row justify-between items-center mb-3'>
				<Text
					className={`text-lg font-semibold ${
						isDarkMode ? 'text-white' : 'text-gray'
					}`}>
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

const RangeInput = ({ label, min, max, value, onChange, step = 1 }: any) => {
	const { isDarkMode } = useTheme()

	const handleChange = (index: number, newValue: string) => {
		const parsedValue = parseInt(newValue) || 0
		const clampedValue = Math.max(min, Math.min(max, parsedValue))
		const newRange = [...value]
		newRange[index] = clampedValue
		onChange(newRange)
	}

	return (
		<View className='mb-4'>
			<Text
				className={`text-base font-semibold mb-2 ${
					isDarkMode ? 'text-white' : 'text-gray'
				}`}>
				{label}
			</Text>
			<View className='flex-row justify-between'>
				<View className='flex-1 mr-2'>
					<Text
						className={`text-sm ${isDarkMode ? 'text-white' : 'text-gray'}`}>
						Min
					</Text>
					<TextInput
						className={`border rounded-md p-2 mt-1 ${
							isDarkMode
								? 'text-white border-red bg-gray'
								: 'text-gray border-gray bg-white'
						}`}
						keyboardType='numeric'
						value={value[0].toString()}
						onChangeText={newValue => handleChange(0, newValue)}
					/>
				</View>
				<View className='flex-1 ml-2'>
					<Text
						className={`text-sm ${isDarkMode ? 'text-white' : 'text-gray'}`}>
						Max
					</Text>
					<TextInput
						className={`border rounded-md p-2 mt-1 ${
							isDarkMode
								? 'text-white border-red bg-gray'
								: 'text-gray border-gray bg-white'
						}`}
						keyboardType='numeric'
						value={value[1].toString()}
						onChangeText={newValue => handleChange(1, newValue)}
					/>
				</View>
			</View>
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
	const { isDarkMode } = useTheme()
	const filteredItems = items.filter((item: string) =>
		item?.toLowerCase()?.includes(searchQuery?.toLowerCase())
	)

	return (
		<View className='mb-4'>
			<View className='flex-row justify-between items-center mb-2'>
				<Text
					className={`text-base font-semibold ${
						isDarkMode ? 'text-white' : 'text-gray'
					}`}>
					{label}
				</Text>
				{value && (
					<TouchableOpacity onPress={() => onChange('')}>
						<Ionicons name='close-circle' size={24} color='#D55004' />
					</TouchableOpacity>
				)}
			</View>
			<View
				className={`border ${
					isDarkMode ? 'border-red' : 'border-gray'
				}`}>
				<TouchableOpacity
					onPress={() => setIsDropdownOpen(!isDropdownOpen)}
					className={`p-3 flex-row justify-between items-center ${
						value ? 'bg-red' : isDarkMode ? 'bg-gray' : 'bg-white'
					}`}>
					<Text
						className={`${isDarkMode ? 'text-white' : 'text-gray'} ${
							value ? 'font-semibold' : ''
						}`}>
						{value || `Select ${placeholder}`}
					</Text>
					<Ionicons
						name={isDropdownOpen ? 'chevron-up' : 'chevron-down'}
						size={24}
						color={isDarkMode ? 'white' : 'black'}
					/>
				</TouchableOpacity>
				{isDropdownOpen && (
					<View>
						<TextInput
							className={`p-3 ${
								isDarkMode ? 'text-white bg-red' : 'text-white bg-red'
							}`}
							placeholder={`Search ${placeholder}`}
							placeholderTextColor={isDarkMode ? '#F2F2F2' : '#F2F2F2'}
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
									className={`p-3 ${
										item === value
											? 'bg-red'
											: isDarkMode
											? 'bg-gray'
											: 'bg-white'
									}`}>
									<Text className={isDarkMode ? 'text-white' : 'text-gray'}>
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

const PopularFilters = ({ onApply }: any) => {
	const { isDarkMode } = useTheme()
	const popularFilters = [
		{ label: 'SUVs', filter: { categories: ['SUV'] } },
		{ label: 'Under $30,000', filter: { priceRange: [0, 30000] } },
		{ label: 'Low Mileage', filter: { mileageRange: [0, 50000] } }
	]

	return (
		<View className='mb-6'>
			<Text
				className={`text-lg font-semibold mb-3 ${
					isDarkMode ? 'text-white' : 'text-gray'
				}`}>
				Popular Filters
			</Text>
			<View className='flex-row flex-wrap'>
				{popularFilters.map((item, index) => (
					<TouchableOpacity
						key={index}
						onPress={() => onApply(item.filter)}
						className={`mr-2 mb-2 px-4 py-2 rounded-full ${
							isDarkMode ? 'bg-gray' : 'bg-gray'
						}`}>
						<Text className={isDarkMode ? 'text-white' : 'text-white'}>
							{item.label}
						</Text>
					</TouchableOpacity>
				))}
			</View>
		</View>
	)
}

const FilterPage = () => {
	const { isDarkMode } = useTheme()
	const router = useRouter()
	const params: any = useLocalSearchParams()
	const [filters, setFilters] = useState<any>(() => {
		try {
			return (
				JSON.parse(params.filters) || {
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

	const handlePopularFilterApply = (newFilter: any) => {
		setFilters((prev: any) => ({ ...prev, ...newFilter }))
	}

	return (
		<View className={`flex-1 ${isDarkMode ? 'bg-black' : 'bg-white'}`}>
			<CustomHeader title='Filters' onBack={() => router.back()} />
			<ScrollView className='flex-1  px-4 py-6'>
				<PopularFilters onApply={handlePopularFilterApply} />

				<CollapsibleSection title='Basic Filters'>
					<SearchableSelect
						label='Dealership'
						items={dealerships.map((d: any) => d.name)}
						value={filters.dealershipName}
						onChange={(value: any) => {
							const selectedDealership: any = dealerships.find(
								(d: any) => d.name === value
							)
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
					<RangeInput
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
					<RangeInput
						label='Mileage Range'
						min={0}
						max={500000}
						step={1000}
						value={filters.mileageRange || [0, 500000]}
						onChange={(value: any) =>
							setFilters({ ...filters, mileageRange: value })
						}
					/>
					<RangeInput
						label='Year Range'
						min={1900}
						max={new Date().getFullYear() + 1}
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
					isDarkMode ? 'bg-gray' : 'bg-white'
				} border-t  ${isDarkMode ? 'border-night' : 'border-white'}`}>
				<TouchableOpacity
					className={`py-3 px-6 rounded-full ${
						isDarkMode ? 'bg-night' : 'bg-night'
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
						router.replace({
							pathname: '/(home)/(user)',
							params: { filters: JSON.stringify({}) }
						})
					}}>
					<Text className={isDarkMode ? 'text-white' : 'text-white'}>
						Clear All
					</Text>
				</TouchableOpacity>
				<TouchableOpacity
					className='bg-red py-3 px-6 rounded-full'
					onPress={() => {
						router.replace({
							pathname: '/(home)/(user)',
							params: { filters: JSON.stringify(filters) }
						})
					}}>
					<Text className='text-white font-semibold'>Apply Filters</Text>
				</TouchableOpacity>
			</View>
		</View>
	)
}

export default FilterPage
