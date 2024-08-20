import React, { useState, useEffect, useMemo, useRef } from 'react'
import {
    View,
    Text,
    Image,
    TouchableOpacity,
    TextInput,
    SectionList,
    SectionListData,
    ActivityIndicator,
} from 'react-native'
import { supabase } from '@/utils/supabase'
import { useNavigation } from '@react-navigation/native'
import { FontAwesome } from '@expo/vector-icons'
import { useRouter } from 'expo-router'

interface Brand {
    name: string
    logoUrl: string
}

const getLogoUrl = (make: string) => {
    const formattedMake = make.toLowerCase().replace(/\s+/g, '-')
    console.log(formattedMake)
    // Handle special cases
    switch (formattedMake) {
        case 'range-rover':
            return 'https://www.carlogos.org/car-logos/land-rover-logo.png'
        case 'infiniti':
            return 'https://www.carlogos.org/car-logos/infiniti-logo.png'
        case 'audi':
            return 'https://cdn.freebiesupply.com/logos/large/2x/audi-1-logo-black-and-white.png'
        case 'nissan':
            return 'https://cdn.freebiesupply.com/logos/large/2x/nissan-6-logo-png-transparent.png'
        default:
            return `https://www.carlogos.org/car-logos/${formattedMake}-logo.png`
    }
}

export default function AllBrandsPage() {
    const [brands, setBrands] = useState<Brand[]>([])
    const [searchQuery, setSearchQuery] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const navigation = useNavigation()
    const router = useRouter()
    const sectionListRef = useRef<SectionList>(null)

    useEffect(() => {
        fetchBrands()
    }, [])

    useEffect(() => {
        navigation.setOptions({
            headerTitle: 'All Brands',
        })
    }, [navigation])

    const fetchBrands = async () => {
        setIsLoading(true)
        try {
            const { data, error } = await supabase
                .from('cars')
                .select('make')
                .order('make')

            if (error) throw error

            const uniqueBrands = Array.from(new Set(data.map((item: { make: string }) => item.make)))
            const brandsData = uniqueBrands.map((make: string) => ({
                name: make,
                logoUrl: getLogoUrl(make)
            }))

            setBrands(brandsData)
        } catch (error) {
            console.error('Error fetching brands:', error)
        }
        setIsLoading(false)
    }

    const filteredBrands = useMemo(() => {
        return brands.filter(brand =>
            brand.name.toLowerCase().includes(searchQuery.toLowerCase())
        )
    }, [brands, searchQuery])

    const groupedBrands = useMemo(() => {
        const groups: { title: string; data: Brand[] }[] = []
        const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')

        alphabet.forEach(letter => {
            const brandsForLetter = filteredBrands.filter(
                brand => brand.name.toUpperCase().startsWith(letter)
            )
            if (brandsForLetter.length > 0) {
                groups.push({ title: letter, data: brandsForLetter })
            }
        })

        return groups
    }, [filteredBrands])

    const handleBrandPress = (brand: string) => {
        router.push({
            pathname: '/(home)/(user)/CarsByBrand',
            params: { brand },
        })
    }

    const scrollToSection = (index: number) => {
        sectionListRef.current?.scrollToLocation({
            sectionIndex: index,
            itemIndex: 0,
            animated: true,
            viewPosition: 0,
        })
    }

    const renderBrandItem = ({ item }: { item: Brand }) => (
        <TouchableOpacity
            className="flex-row items-center py-4 border-b border-gray-700"
            onPress={() => handleBrandPress(item.name)}
        >
            <Image
                source={{ uri: item.logoUrl }}
                style={{ width: 50, height: 50 }}
                resizeMode="contain"
            />
            <Text className="ml-4 text-lg text-white">{item.name}</Text>
        </TouchableOpacity>
    )

    const renderSectionHeader = ({ section }: { section: SectionListData<Brand> }) => (
        <View className="bg-black py-2">
            <Text className="text-white font-bold">{section.title}</Text>
        </View>
    )

    const AlphabetIndex = () => (
        <View className="absolute right-0 top-0 bottom-0 justify-center bg-black bg-opacity-50 px-1">
            {groupedBrands.map((group, index) => (
                <TouchableOpacity
                    key={group.title}
                    onPress={() => scrollToSection(index)}
                >

                </TouchableOpacity>
            ))}
        </View>
    )

    return (
        <View className="flex-1 bg-black">
            <View className='border mt-4 mx-4 border-red rounded-full z-50 flex-row items-center'>
                <FontAwesome name="search" size={20} color='gray' className='mx-3' />
                <TextInput
                    className="p-2 text-white flex-1"
                    placeholder="Search brands..."
                    placeholderTextColor="gray"
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                />
            </View>
            {isLoading ? (
                <ActivityIndicator size="large" color="#D55004" className="mt-4" />
            ) : (
                <>
                    <SectionList
                        ref={sectionListRef}
                        sections={groupedBrands}
                        renderItem={renderBrandItem}
                        renderSectionHeader={renderSectionHeader}
                        keyExtractor={(item) => item.name}
                        stickySectionHeadersEnabled={true}
                        className="mt-4"
                    />
                    <AlphabetIndex />
                </>
            )}
        </View>
    )
}