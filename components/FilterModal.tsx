import React from 'react'
import { View, Text, TouchableOpacity, Modal, ScrollView, I18nManager } from 'react-native'
import RNPickerSelect from 'react-native-picker-select'
import Slider from '@react-native-community/slider'
import { useTranslation } from 'react-i18next'

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
}: any) => {
	const { t } = useTranslation()
	const isRTL = I18nManager.isRTL

	return (
		<Modal visible={isVisible} animationType='slide' transparent={true}>
			<View className='flex-1 justify-end'>
				<View className='bg-white rounded-t-3xl h-5/6 p-6'>
					<View className={`flex-row justify-between items-center mb-4 ${isRTL ? 'flex-row-reverse' : ''}`}>
						<Text className={`text-2xl font-bold ${isRTL ? 'text-right' : 'text-left'}`}>{t('filters.filter_results')}</Text>
						<TouchableOpacity onPress={resetFilters}>
							<Text className='text-blue-500 text-lg'>{t('filters.reset')}</Text>
						</TouchableOpacity>
					</View>
				<ScrollView className='flex-grow'>
					<View className='space-y-4'>
						<View>
							<Text className={`font-semibold mb-2 ${isRTL ? 'text-right' : 'text-left'}`}>{t('filters.dealership')}</Text>
							<RNPickerSelect
								onValueChange={value => handleFilterChange('dealership', value)}
								items={dealerships.map((dealership: { name: any; id: { toString: () => any } }) => ({
									label: dealership.name,
									value: dealership.id.toString()
								}))}
								value={tempFilters.dealership}
								placeholder={{ label: t('filters.all_dealerships'), value: null }}
								style={{
									inputIOS: { textAlign: isRTL ? 'right' : 'left' },
									inputAndroid: { textAlign: isRTL ? 'right' : 'left' }
								}}
							/>
						</View>

						<View>
							<Text className={`font-semibold mb-2 ${isRTL ? 'text-right' : 'text-left'}`}>{t('filters.make')}</Text>
							<RNPickerSelect
								onValueChange={value => handleFilterChange('make', value)}
								items={makes.map((make: any) => ({ label: make, value: make }))}
								value={tempFilters.make}
								placeholder={{ label: t('filters.all_makes'), value: null }}
								style={{
									inputIOS: { textAlign: isRTL ? 'right' : 'left' },
									inputAndroid: { textAlign: isRTL ? 'right' : 'left' }
								}}
							/>
						</View>

						<View>
							<Text className={`font-semibold mb-2 ${isRTL ? 'text-right' : 'text-left'}`}>{t('filters.model')}</Text>
							<RNPickerSelect
								onValueChange={value => handleFilterChange('model', value)}
								items={models.map((model: any) => ({ label: model, value: model }))}
								value={tempFilters.model}
								placeholder={{ label: t('filters.all_models'), value: null }}
								style={{
									inputIOS: { textAlign: isRTL ? 'right' : 'left' },
									inputAndroid: { textAlign: isRTL ? 'right' : 'left' }
								}}
							/>
						</View>

						<View>
							<Text className={`font-semibold mb-2 ${isRTL ? 'text-right' : 'text-left'}`}>{t('filters.condition')}</Text>
							<RNPickerSelect
								onValueChange={value => handleFilterChange('condition', value)}
								items={[
									{ label: t('filters.new'), value: 'New' },
									{ label: t('filters.used'), value: 'Used' }
								]}
								value={tempFilters.condition}
								placeholder={{ label: t('filters.all_conditions'), value: null }}
								style={{
									inputIOS: { textAlign: isRTL ? 'right' : 'left' },
									inputAndroid: { textAlign: isRTL ? 'right' : 'left' }
								}}
							/>
						</View>

						<View>
							<Text className={`font-semibold mb-2 ${isRTL ? 'text-right' : 'text-left'}`}>{t('filters.price_range')}</Text>
							<View className={`flex-row justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
								<Text className={isRTL ? 'text-right' : 'text-left'}>${tempFilters.priceRange[0]}</Text>
								<Text className={isRTL ? 'text-right' : 'text-left'}>${tempFilters.priceRange[1]}</Text>
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
							<Text className={`font-semibold mb-2 ${isRTL ? 'text-right' : 'text-left'}`}>{t('filters.mileage_range')}</Text>
							<View className={`flex-row justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
								<Text className={isRTL ? 'text-right' : 'text-left'}>{tempFilters.mileageRange[0]} {t('filters.mi')}</Text>
								<Text className={isRTL ? 'text-right' : 'text-left'}>{tempFilters.mileageRange[1]} {t('filters.mi')}</Text>
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
							<Text className={`font-semibold mb-2 ${isRTL ? 'text-right' : 'text-left'}`}>{t('filters.year')}</Text>
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
								placeholder={{ label: t('filters.all_years'), value: null }}
								style={{
									inputIOS: { textAlign: isRTL ? 'right' : 'left' },
									inputAndroid: { textAlign: isRTL ? 'right' : 'left' }
								}}
							/>
						</View>

						<View>
							<Text className={`font-semibold mb-2 ${isRTL ? 'text-right' : 'text-left'}`}>{t('filters.exterior_color')}</Text>
							<RNPickerSelect
								onValueChange={value => handleFilterChange('color', value)}
								items={colors.map((color: any) => ({ label: color, value: color }))}
								value={tempFilters.color}
								placeholder={{ label: t('filters.all_colors'), value: null }}
								style={{
									inputIOS: { textAlign: isRTL ? 'right' : 'left' },
									inputAndroid: { textAlign: isRTL ? 'right' : 'left' }
								}}
							/>
						</View>

						<View>
							<Text className={`font-semibold mb-2 ${isRTL ? 'text-right' : 'text-left'}`}>{t('filters.transmission')}</Text>
							<RNPickerSelect
								onValueChange={value =>
									handleFilterChange('transmission', value)
								}
								items={[
									{ label: t('filters.manual'), value: 'Manual' },
									{ label: t('filters.automatic'), value: 'Automatic' }
								]}
								value={tempFilters.transmission}
								placeholder={{ label: t('filters.all_transmissions'), value: null }}
								style={{
									inputIOS: { textAlign: isRTL ? 'right' : 'left' },
									inputAndroid: { textAlign: isRTL ? 'right' : 'left' }
								}}
							/>
						</View>

						<View>
							<Text className={`font-semibold mb-2 ${isRTL ? 'text-right' : 'text-left'}`}>{t('filters.drivetrain')}</Text>
							<RNPickerSelect
								onValueChange={value => handleFilterChange('drivetrain', value)}
								items={[
									{ label: t('filters.fwd'), value: 'FWD' },
									{ label: t('filters.rwd'), value: 'RWD' },
									{ label: t('filters.awd'), value: 'AWD' },
									{ label: t('filters.4wd'), value: '4WD' },
									{ label: t('filters.4x4'), value: '4x4' }
								]}
								value={tempFilters.drivetrain}
								placeholder={{ label: t('filters.all_drivetrains'), value: null }}
								style={{
									inputIOS: { textAlign: isRTL ? 'right' : 'left' },
									inputAndroid: { textAlign: isRTL ? 'right' : 'left' }
								}}
							/>
						</View>
					</View>
				</ScrollView>
				<View className={`flex-row justify-end mt-4 ${isRTL ? 'flex-row-reverse' : ''}`}>
					<TouchableOpacity
						className={`bg-gray-300 py-2 px-4 rounded-full ${isRTL ? 'ml-2' : 'mr-2'}`}
						onPress={closeModal}>
						<Text className={isRTL ? 'text-right' : 'text-left'}>{t('common.cancel')}</Text>
					</TouchableOpacity>
					<TouchableOpacity
						className='bg-red-500 py-2 px-4 rounded-full'
						onPress={applyFilters}>
						<Text className={`text-white ${isRTL ? 'text-right' : 'text-left'}`}>{t('filters.apply_filters')}</Text>
					</TouchableOpacity>
				</View>
			</View>
		</View>
	</Modal>
	)
}

export default FilterModal
