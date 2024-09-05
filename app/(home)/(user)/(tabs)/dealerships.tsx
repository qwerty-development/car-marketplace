import React, { useState, useEffect, useMemo, useRef } from 'react'
import {
	View,
	Text,
	Image,
	TouchableOpacity,
	TextInput,
	SectionList,
	SectionListData,
	Alert,
	StatusBar
} from 'react-native'
import { supabase } from '@/utils/supabase'
import { useNavigation } from '@react-navigation/native'
import { FontAwesome } from '@expo/vector-icons'
import { useTheme } from '@/utils/ThemeContext'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'

interface Dealership {
	id: number
	name: string
	logo: string
}

const CustomHeader = ({ title, onBack }: any) => {
	const { isDarkMode } = useTheme()

	return (
		<SafeAreaView
			edges={['top']}
			style={{
				backgroundColor: isDarkMode ? 'black' : 'white',
				borderBottomWidth: 0,
				borderBottomColor: '#D55004',
				borderTopWidth: 0,
				borderWidth: 0,

				borderColor: '#D55004',
			}}
		>
			<StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
			<View
				style={{
					flexDirection: 'row',
					alignItems: 'center',
					justifyContent: 'center', // Centers the content horizontally
					paddingHorizontal: 0,
					paddingBottom: 9,
				}}
			>
				<Text
					style={{
						fontSize: 20,
						textAlign: 'center',
						color: '#D55004',
						fontWeight: '600',

					}}
				>
					{title}
				</Text>
			</View>
		</SafeAreaView>
	)
}

export default function DealershipListPage() {
	const { isDarkMode } = useTheme()
	const [dealerships, setDealerships] = useState<Dealership[]>([])
	const [searchQuery, setSearchQuery] = useState('')
	const navigation = useNavigation()
	const sectionListRef = useRef<SectionList>(null)
	const router = useRouter()

	const bgColor = isDarkMode ? 'bg-night' : 'bg-white'
	const textColor = isDarkMode ? 'text-white' : 'text-black'
	const borderColor = isDarkMode ? 'border-gray-700' : 'border-gray-300'
	const inputBgColor = isDarkMode ? 'bg-gray-800' : 'bg-gray-200'

	useEffect(() => {
		fetchDealerships()
	}, [])

	useEffect(() => {
		navigation.setOptions({
			headerTitle: 'Dealerships'
		})
	}, [navigation])

	const fetchDealerships = async () => {
		const { data, error } = await supabase
			.from('dealerships')
			.select('id, name, logo')
			.order('name')

		if (error) {
			console.error('Error fetching dealerships:', error)
			Alert.alert('Error', 'Failed to fetch dealerships')
		} else {
			setDealerships(data || [])
		}
	}

	const filteredDealerships = useMemo(() => {
		return dealerships.filter(dealership =>
			dealership.name.toLowerCase().includes(searchQuery.toLowerCase())
		)
	}, [dealerships, searchQuery])

	const groupedDealerships = useMemo(() => {
		const groups: { title: string; data: Dealership[] }[] = []
		const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')

		alphabet.forEach(letter => {
			const dealershipsForLetter = filteredDealerships.filter(dealership =>
				dealership.name.toUpperCase().startsWith(letter)
			)
			if (dealershipsForLetter.length > 0) {
				groups.push({ title: letter, data: dealershipsForLetter })
			}
		})

		return groups
	}, [filteredDealerships])

	const handleDealershipPress = (dealership: Dealership) => {
		router.push({
			pathname: '/(home)/(user)/DealershipDetails',
			params: { dealershipId: dealership.id }
		})
	}

	const renderDealershipItem = ({ item }: { item: Dealership }) => (
		<TouchableOpacity
			className={`flex-row items-center py-4 border-b ${borderColor}`}
			onPress={() => handleDealershipPress(item)}>
			<Image source={{ uri: item.logo }} className='w-12 h-12 rounded-full' />
			<Text className={`ml-4 text-lg ${textColor}`}>{item.name}</Text>
		</TouchableOpacity>
	)

	const renderSectionHeader = ({
		section
	}: {
		section: SectionListData<Dealership>
	}) => (
		<View className={`${bgColor} py-2`}>
			<Text className={`${textColor} font-bold`}>{section.title}</Text>
		</View>
	)

	return (
		<View className={`flex-1 ${bgColor}`}>
			<CustomHeader title='Dealerships' onBack={() => router.back()} />
			<View
				className={`border mt-4 mx-3 z-50 border-red rounded-full flex-row items-center ${inputBgColor}`}>
				<FontAwesome
					size={20}
					color={isDarkMode ? 'white' : 'black'}
					className='mx-3'
				/>
				<TextInput
					className={`p-2 ${textColor} justify-center`}
					placeholder='Search dealerships...'
					placeholderTextColor={isDarkMode ? 'lightgray' : 'gray'}
					value={searchQuery}
					onChangeText={setSearchQuery}
				/>
			</View>
			<SectionList
				ref={sectionListRef}
				sections={groupedDealerships}
				renderItem={renderDealershipItem}
				renderSectionHeader={renderSectionHeader}
				keyExtractor={item => {
					const id = item.id?.toString() || ''
					const make = item.name || ''
					const model = item.logo || ''
					return `${id}-${make}-${model}-${Math.random()}`
				}}
				stickySectionHeadersEnabled={true}
				className='px-2 mb-24'
			/>
		</View>
	)
}
