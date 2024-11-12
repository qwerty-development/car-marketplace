//carselector
import React from 'react'
import { View, Text } from 'react-native'
import RNPickerSelect from 'react-native-picker-select'
import { useTheme } from '@/utils/ThemeContext'
import { Car } from '@/types/autoclip'

interface CarSelectorProps {
  cars: Car[]
  selectedCarId: number | null
  onCarSelect: (carId: number) => void
}

export default function CarSelector({ cars, selectedCarId, onCarSelect }: CarSelectorProps) {
  const { isDarkMode } = useTheme()

  const carOptions = cars.map(car => ({
    label: `${car.year} ${car.make} ${car.model}`,
    value: car.id
  }))

  return (
    <View className="my-2">
      <Text className={`mb-2 font-semibold ${isDarkMode ? 'text-white' : 'text-black'}`}>
        Select Car
      </Text>
      <RNPickerSelect
        onValueChange={(value) => onCarSelect(value)}
        items={carOptions}
        value={selectedCarId}
        style={{
          inputIOS: {
            fontSize: 16,
            paddingVertical: 12,
            paddingHorizontal: 10,
            borderWidth: 1,
            borderColor: '#D55004',
            borderRadius: 4,
            color: isDarkMode ? 'white' : 'black',
            paddingRight: 30,
            backgroundColor: isDarkMode ? '#1A1A1A' : '#FFFFFF'
          },
          inputAndroid: {
            fontSize: 16,
            paddingHorizontal: 10,
            paddingVertical: 8,
            borderWidth: 1,
            borderColor: '#D55004',
            borderRadius: 8,
            color: isDarkMode ? 'white' : 'black',
            paddingRight: 30,
            backgroundColor: isDarkMode ? '#1A1A1A' : '#FFFFFF'
          }
        }}
        placeholder={{
          label: 'Select a car...',
          value: null
        }}
      />
    </View>
  )
}