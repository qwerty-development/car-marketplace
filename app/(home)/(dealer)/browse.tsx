import React, { useState, useEffect, useCallback } from 'react'
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  SafeAreaView,
  StatusBar
} from 'react-native'
import { supabase } from '@/utils/supabase'
import { useUser } from '@clerk/clerk-expo'
import CarCard from '@/components/CarCard'
import CarDetailModal from '@/app/(home)/(user)/CarDetailModal'
import RNPickerSelect from 'react-native-picker-select'
import { FontAwesome } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import { useTheme } from '@/utils/ThemeContext'

const ITEMS_PER_PAGE = 10

interface Car {
  id: number
  make: string
  model: string
  year: number
  price: number
  dealership_name: string
  images: string[]
  description: string
}

interface Dealership {
  id: number
  name: string
}

export default function BrowseCarsPage() {
  const { isDarkMode } = useTheme()
  const { user } = useUser()
  const [cars, setCars] = useState<Car[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState('listed_at')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [filterDealership, setFilterDealership] = useState('')
  const [filterMake, setFilterMake] = useState('')
  const [filterModel, setFilterModel] = useState('')
  const [dealerships, setDealerships] = useState<Dealership[]>([])
  const [makes, setMakes] = useState<string[]>([])
  const [models, setModels] = useState<string[]>([])
  const [selectedCar, setSelectedCar] = useState<Car | null>(null)
  const [isModalVisible, setIsModalVisible] = useState(false)
  const [filtersChanged, setFiltersChanged] = useState(false)

  useEffect(() => {
    if (filtersChanged) {
      setCurrentPage(1)
      setFiltersChanged(false)
    }
    fetchCars()
    fetchDealerships()
    fetchMakes()
  }, [currentPage, sortBy, sortOrder, filterDealership, filterMake, filterModel, searchQuery, user, filtersChanged])

  const fetchCars = useCallback(async () => {
    let query = supabase
      .from('cars')
      .select('*, dealerships (name)', { count: 'exact' })

    if (filterDealership) query = query.eq('dealership_id', filterDealership)
    if (filterMake) query = query.eq('make', filterMake)
    if (filterModel) query = query.eq('model', filterModel)

    if (searchQuery) {
      query = query.or(`make.ilike.%${searchQuery}%,model.ilike.%${searchQuery}%,year.eq.${searchQuery},price.eq.${searchQuery}`)
    }

    const { count, error: countError } = await query

    if (countError) {
      console.error('Error fetching count:', countError)
      Alert.alert('Error', 'Failed to fetch listings count')
      return
    }

    const totalPages = Math.ceil((count || 0) / ITEMS_PER_PAGE)
    const safeCurrentPage = Math.min(currentPage, totalPages || 1)
    const from = (safeCurrentPage - 1) * ITEMS_PER_PAGE
    const to = from + ITEMS_PER_PAGE - 1

    query = query
      .range(from, to)
      .order(sortBy, { ascending: sortOrder === 'asc' })

    const { data, error } = await query

    if (error) {
      console.error('Error fetching listings:', error)
      Alert.alert('Error', 'Failed to fetch listings')
    } else {
      setCars(data?.map(item => ({
        ...item,
        dealership_name: item.dealerships.name
      })) || [])
      setTotalPages(totalPages)
      setCurrentPage(safeCurrentPage)
    }
  }, [currentPage, sortBy, sortOrder, filterDealership, filterMake, filterModel, searchQuery])

  const fetchDealerships = async () => {
    const { data, error } = await supabase.from('dealerships').select('id, name')
    if (error) {
      console.error('Error fetching dealerships:', error)
    } else {
      setDealerships(data || [])
    }
  }

  const fetchMakes = async () => {
    const { data, error } = await supabase.from('cars').select('make').order('make')
    if (error) {
      console.error('Error fetching makes:', error)
    } else {
      const uniqueMakes = [...new Set(data?.map(item => item.make))]
      setMakes(uniqueMakes)
    }
  }

  const fetchModels = async (make: string) => {
    const { data, error } = await supabase.from('cars').select('model').eq('make', make).order('model')
    if (error) {
      console.error('Error fetching models:', error)
    } else {
      const uniqueModels = [...new Set(data?.map(item => item.model))]
      setModels(uniqueModels)
    }
  }

  const handleCarPress = (car: Car) => {
    setSelectedCar(car)
    setIsModalVisible(true)
  }

  const handleSearch = (text: string) => {
    setSearchQuery(text)
    setFiltersChanged(true)
  }

  const handleDealershipFilter = (value: string) => {
    setFilterDealership(value)
    setFiltersChanged(true)
  }

  const handleMakeFilter = (value: string) => {
    setFilterMake(value)
    fetchModels(value)
    setFiltersChanged(true)
  }

  const handleModelFilter = (value: string) => {
    setFilterModel(value)
    setFiltersChanged(true)
  }

  const handleSort = (newSortBy: string) => {
    if (sortBy === newSortBy) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(newSortBy)
      setSortOrder('asc')
    }
    setFiltersChanged(true)
  }

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage)
  }

  const renderCarItem = useCallback(({ item }: { item: Car }) => (
    <CarCard car={item} onPress={() => handleCarPress(item)} />
  ), [])

  return (
    <LinearGradient
      colors={isDarkMode ? ['#1E1E1E', '#2D2D2D'] : ['#F5F5F5', '#E0E0E0']}
      style={styles.gradient}
    >
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
        <View style={styles.container}>
          
          <View style={styles.searchContainer}>
            <TextInput
              style={[styles.searchInput, isDarkMode && styles.darkSearchInput]}
              placeholder='Search cars...'
              placeholderTextColor={isDarkMode ? '#999' : '#666'}
              value={searchQuery}
              onChangeText={handleSearch}
            />
            <TouchableOpacity style={styles.searchButton} onPress={() => fetchCars()}>
              <FontAwesome name="search" size={20} color="white" />
            </TouchableOpacity>
          </View>

          <View style={styles.filtersContainer}>
            <RNPickerSelect
              onValueChange={handleDealershipFilter}
              items={dealerships.map(d => ({ label: d.name, value: d.id.toString() }))}
              style={pickerSelectStyles}
              value={filterDealership}
              placeholder={{ label: 'All Dealerships', value: null }}
            />
            <RNPickerSelect
              onValueChange={handleMakeFilter}
              items={makes.map(make => ({ label: make, value: make }))}
              style={pickerSelectStyles}
              value={filterMake}
              placeholder={{ label: 'All Makes', value: null }}
            />
            <RNPickerSelect
              onValueChange={handleModelFilter}
              items={models.map(model => ({ label: model, value: model }))}
              style={pickerSelectStyles}
              value={filterModel}
              placeholder={{ label: 'All Models', value: null }}
            />
          </View>

          <View style={styles.sortContainer}>
            <TouchableOpacity onPress={() => handleSort('price')} style={styles.sortButton}>
              <Text style={[styles.sortButtonText, isDarkMode && styles.darkText]}>
                Price {sortBy === 'price' && (sortOrder === 'asc' ? '↑' : '↓')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => handleSort('year')} style={styles.sortButton}>
              <Text style={[styles.sortButtonText, isDarkMode && styles.darkText]}>
                Year {sortBy === 'year' && (sortOrder === 'asc' ? '↑' : '↓')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => handleSort('listed_at')} style={styles.sortButton}>
              <Text style={[styles.sortButtonText, isDarkMode && styles.darkText]}>
                Date Listed {sortBy === 'listed_at' && (sortOrder === 'asc' ? '↑' : '↓')}
              </Text>
            </TouchableOpacity>
          </View>

          <FlatList
            data={cars}
            renderItem={renderCarItem}
            keyExtractor={item => item.id.toString()}
            contentContainerStyle={styles.listContainer}
          />

          <View style={styles.paginationContainer}>
            <TouchableOpacity
              onPress={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
              style={[styles.paginationButton, currentPage === 1 && styles.disabledButton]}
            >
              <Text style={[styles.paginationButtonText, isDarkMode && styles.darkText]}>Previous</Text>
            </TouchableOpacity>
            <Text style={[styles.pageInfo, isDarkMode && styles.darkText]}>
              Page {currentPage} of {totalPages}
            </Text>
            <TouchableOpacity
              onPress={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              style={[styles.paginationButton, currentPage === totalPages && styles.disabledButton]}
            >
              <Text style={[styles.paginationButtonText, isDarkMode && styles.darkText]}>Next</Text>
            </TouchableOpacity>
          </View>

          <CarDetailModal
            isVisible={isModalVisible}
            car={selectedCar}
            onClose={() => setIsModalVisible(false)}
            onViewUpdate={(carId: number, newViewCount: any) => {
              setCars(prevCars =>
                prevCars.map(car =>
                  car.id === carId ? { ...car, views: newViewCount } : car
                )
              )
            }}
          />
        </View>
      </SafeAreaView>
    </LinearGradient>
  )
}

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#333',
  },
  darkText: {
    color: '#FFF',
  },
  searchContainer: {
    flexDirection: 'row',
    marginBottom: 15,
  },
  searchInput: {
    flex: 1,
    backgroundColor: 'white',
    padding: 10,
    borderRadius: 5,
    marginRight: 10,
  },
  darkSearchInput: {
    backgroundColor: '#444',
    color: '#FFF',
  },
  searchButton: {
    backgroundColor: '#D55004',
    padding: 10,
    borderRadius: 5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filtersContainer: {
    marginBottom: 15,
  },
  sortContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  sortButton: {
    padding: 10,
    borderRadius: 5,
    backgroundColor: '#D55004',
  },
  sortButtonText: {
    color: '#FFF',
    fontWeight: 'bold',
  },
  listContainer: {
    paddingBottom: 20,
  },
  paginationContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 15,
  },
  paginationButton: {
    padding: 10,
    borderRadius: 5,
    backgroundColor: '#D55004',
  },
  paginationButtonText: {
    color: '#FFF',
    fontWeight: 'bold',
  },
  disabledButton: {
    opacity: 0.5,
  },
  pageInfo: {
    fontSize: 16,
  },
})

const pickerSelectStyles = StyleSheet.create({
  inputIOS: {
    fontSize: 16,
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: 'gray',
    borderRadius: 4,
    color: 'black',
    paddingRight: 30,
    backgroundColor: 'white',
    marginBottom: 10,
  },
  inputAndroid: {
    fontSize: 16,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 0.5,
    borderColor: 'gray',
    borderRadius: 8,
    color: 'black',
    paddingRight: 30,
    backgroundColor: 'white',
    marginBottom: 10,
  },
})