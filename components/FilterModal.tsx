import React from 'react'
import { View, Text, TouchableOpacity, Modal, ScrollView } from 'react-native'
import RNPickerSelect from 'react-native-picker-select'
import Slider from '@react-native-community/slider'

const FilterModal = ({
	isVisible,
	tempFilters,
	handleFilterChange,
	applyFilters,
	resetFilters,
	closeModal,
	dealerships,
	makes,
	models,
	colors
}: any) => (
	<Modal visible={isVisible} animationType='slide' transparent={true}>
		<View className='flex-1 justify-end'>
			<View className='bg-white rounded-t-3xl h-5/6 p-6'>
				<View className='flex-row justify-between items-center mb-4'>
					<Text className='text-2xl font-bold'>Filter Results</Text>
					<TouchableOpacity onPress={resetFilters}>
						<Text className='text-blue-500 text-lg'>Reset</Text>
					</TouchableOpacity>
				</View>
				<ScrollView className='flex-grow'>
					<View className='space-y-4'>
						<View>
							<Text className='font-semibold mb-2'>Dealership</Text>
							<RNPickerSelect
								onValueChange={value => handleFilterChange('dealership', value)}
								items={dealerships.map((dealership: { name: any; id: { toString: () => any } }) => ({
									label: dealership.name,
									value: dealership.id.toString()
								}))}
								value={tempFilters.dealership}
								placeholder={{ label: 'All Dealerships', value: null }}
							/>
						</View>

						<View>
							<Text className='font-semibold mb-2'>Make</Text>
							<RNPickerSelect
								onValueChange={value => handleFilterChange('make', value)}
								items={makes.map((make: any) => ({ label: make, value: make }))}
								value={tempFilters.make}
								placeholder={{ label: 'All Makes', value: null }}
							/>
						</View>

						<View>
							<Text className='font-semibold mb-2'>Model</Text>
							<RNPickerSelect
								onValueChange={value => handleFilterChange('model', value)}
								items={models.map((model: any) => ({ label: model, value: model }))}
								value={tempFilters.model}
								placeholder={{ label: 'All Models', value: null }}
							/>
						</View>

						<View>
							<Text className='font-semibold mb-2'>Condition</Text>
							<RNPickerSelect
								onValueChange={value => handleFilterChange('condition', value)}
								items={[
									{ label: 'New', value: 'New' },
									{ label: 'Used', value: 'Used' }
								]}
								value={tempFilters.condition}
								placeholder={{ label: 'All Conditions', value: null }}
							/>
						</View>

						<View>
							<Text className='font-semibold mb-2'>Price Range</Text>
							<View className='flex-row justify-between'>
								<Text>${tempFilters.priceRange[0]}</Text>
								<Text>${tempFilters.priceRange[1]}</Text>
							</View>
							<Slider
								minimumValue={0}
								maximumValue={1000000}
								step={1000}
								value={tempFilters.priceRange[1]}
								onValueChange={value =>
									handleFilterChange('priceRange', [
										tempFilters.priceRange[0],
										value
									])
								}
							/>
							<Slider
								minimumValue={0}
								maximumValue={1000000}
								step={1000}
								value={tempFilters.priceRange[0]}
								onValueChange={value =>
									handleFilterChange('priceRange', [
										value,
										tempFilters.priceRange[1]
									])
								}
							/>
						</View>

						<View>
							<Text className='font-semibold mb-2'>Mileage Range</Text>
							<View className='flex-row justify-between'>
								<Text>{tempFilters.mileageRange[0]} mi</Text>
								<Text>{tempFilters.mileageRange[1]} mi</Text>
							</View>
							<Slider
								minimumValue={0}
								maximumValue={500000}
								step={1000}
								value={tempFilters.mileageRange[1]}
								onValueChange={value =>
									handleFilterChange('mileageRange', [
										tempFilters.mileageRange[0],
										value
									])
								}
							/>
							<Slider
								minimumValue={0}
								maximumValue={500000}
								step={1000}
								value={tempFilters.mileageRange[0]}
								onValueChange={value =>
									handleFilterChange('mileageRange', [
										value,
										tempFilters.mileageRange[1]
									])
								}
							/>
						</View>

						<View>
							<Text className='font-semibold mb-2'>Year</Text>
							<RNPickerSelect
								onValueChange={value => handleFilterChange('year', value)}
								items={Array.from({ length: 30 }, (_, i) => {
									const year = 2024 - i
									return {
										label: year.toString(),
										value: year.toString(),
										key: `year-${year}`
									}
								})}
								value={tempFilters.year}
								placeholder={{ label: 'All Years', value: null }}
							/>
						</View>

						<View>
							<Text className='font-semibold mb-2'>Color</Text>
							<RNPickerSelect
								onValueChange={value => handleFilterChange('color', value)}
								items={colors.map((color: any) => ({ label: color, value: color }))}
								value={tempFilters.color}
								placeholder={{ label: 'All Colors', value: null }}
							/>
						</View>

						<View>
							<Text className='font-semibold mb-2'>Transmission</Text>
							<RNPickerSelect
								onValueChange={value =>
									handleFilterChange('transmission', value)
								}
								items={[
									{ label: 'Manual', value: 'Manual' },
									{ label: 'Automatic', value: 'Automatic' }
								]}
								value={tempFilters.transmission}
								placeholder={{ label: 'All Transmissions', value: null }}
							/>
						</View>

						<View>
							<Text className='font-semibold mb-2'>Drivetrain</Text>
							<RNPickerSelect
								onValueChange={value => handleFilterChange('drivetrain', value)}
								items={[
									{ label: 'FWD', value: 'FWD' },
									{ label: 'RWD', value: 'RWD' },
									{ label: 'AWD', value: 'AWD' },
									{ label: '4WD', value: '4WD' },
									{ label: '4x4', value: '4x4' }
								]}
								value={tempFilters.drivetrain}
								placeholder={{ label: 'All Drivetrains', value: null }}
							/>
						</View>
					</View>
				</ScrollView>
				<View className='flex-row justify-end mt-4'>
					<TouchableOpacity
						className='bg-gray-300 py-2 px-4 rounded-full mr-2'
						onPress={closeModal}>
						<Text>Cancel</Text>
					</TouchableOpacity>
					<TouchableOpacity
						className='bg-red-500 py-2 px-4 rounded-full'
						onPress={applyFilters}>
						<Text className='text-white'>Apply Filters</Text>
					</TouchableOpacity>
				</View>
			</View>
		</View>
	</Modal>
)

export default FilterModal
