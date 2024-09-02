import React, { useState, useEffect, useCallback } from 'react'
import {
  View,
  Text,
  FlatList,
  Image,
  TouchableOpacity,
  TextInput,
  Alert,
  StyleSheet,
  SafeAreaView,
  StatusBar
} from 'react-native'
import { Picker } from '@react-native-picker/picker'
import { supabase } from '@/utils/supabase'
import { useUser } from '@clerk/clerk-expo'
import { FontAwesome } from '@expo/vector-icons'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { LinearGradient } from 'expo-linear-gradient'
import { useTheme } from '@/utils/ThemeContext'
import ListingModal from '@/components/ListingModal'

interface CarListing {
  id: number
  make: string
  model: string
  year: number
  price: number
  description: string
  images: string[]
  views: number
  likes: number
  dealership_id: number
  condition: 'New' | 'Used'
  color: string
  transmission: 'Manual' | 'Automatic'
  drivetrain: 'FWD' | 'RWD' | 'AWD' | '4WD' | '4x4'
  mileage: number
  status: 'available' | 'pending' | 'sold'
  type: 'Benzine' | 'Diesel' | 'Electric' | 'Hybrid'
  category: 'Sedan' | 'SUV' | 'Hatchback' | 'Convertible' | 'Coupe' | 'Sports' | 'Other'
}

interface Dealership {
  id: number
  name: string
  user_id: string
}

const ITEMS_PER_PAGE = 10

export default function DealerListings() {
  const { isDarkMode } = useTheme()
  const { user } = useUser()
  const [dealership, setDealership] = useState<Dealership | null>(null)
  const [listings, setListings] = useState<CarListing[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [sortBy, setSortBy] = useState('listed_at')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [filterStatus, setFilterStatus] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedListing, setSelectedListing] = useState<CarListing | null>(null)
  const [isListingModalVisible, setIsListingModalVisible] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (user) {
      fetchDealership()
    }
  }, [user])

  useEffect(() => {
    if (dealership) {
      fetchListings()
    }
  }, [dealership, currentPage, sortBy, sortOrder, filterStatus, searchQuery])

  const fetchDealership = async () => {
    if (!user) return

    const { data, error } = await supabase
      .from('dealerships')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (error) {
      console.error('Error fetching dealership:', error)
      setError('Failed to fetch dealership information')
    } else if (data) {
      setDealership(data)
    } else {
      setError('You do not have a dealership associated with your account')
    }
  }

  const fetchListings = async () => {
    if (!dealership) return

    let query = supabase
      .from('cars')
      .select('*', { count: 'exact' })
      .eq('dealership_id', dealership.id)
      .range(
        (currentPage - 1) * ITEMS_PER_PAGE,
        currentPage * ITEMS_PER_PAGE - 1
      )
      .order(sortBy, { ascending: sortOrder === 'asc' })

    if (filterStatus !== 'all') {
      query = query.eq('status', filterStatus)
    }

    if (searchQuery) {
      query = query.or(
        `make.ilike.%${searchQuery}%,model.ilike.%${searchQuery}%`
      )
    }

    const { data, count, error } = await query

    if (error) {
      console.error('Error fetching listings:', error)
      setError('Failed to fetch car listings')
    } else {
      setListings(data || [])
      setTotalPages(Math.ceil((count || 0) / ITEMS_PER_PAGE))
    }
  }

  const handleDeleteListing = async (id: number) => {
    if (!dealership) return

    Alert.alert(
      "Delete Listing",
      "Are you sure you want to delete this listing?",
      [
        {
          text: "Cancel",
          style: "cancel"
        },
        { 
          text: "Delete", 
          onPress: async () => {
            try {
              const { data: listing, error: fetchError } = await supabase
                .from('cars')
                .select('images')
                .eq('id', id)
                .eq('dealership_id', dealership.id)
                .single()

              if (fetchError) throw fetchError

              if (listing && listing.images && listing.images.length > 0) {
                const imagePaths = listing.images.map((url: string) => {
                  const urlParts = url.split('/')
                  return urlParts.slice(urlParts.indexOf('cars') + 1).join('/')
                })

                const { error: storageError } = await supabase.storage
                  .from('cars')
                  .remove(imagePaths)

                if (storageError) {
                  console.error('Error deleting images from storage:', storageError)
                }
              }

              const { error: deleteError } = await supabase
                .from('cars')
                .delete()
                .eq('id', id)
                .eq('dealership_id', dealership.id)

              if (deleteError) throw deleteError

              fetchListings()
              Alert.alert('Success', 'Listing deleted successfully')
            } catch (error) {
              console.error('Error in handleDeleteListing:', error)
              Alert.alert('Error', 'Failed to delete listing')
            }
          },
          style: "destructive"
        }
      ]
    )
  }

  const handleSubmitListing = async (formData: Partial<CarListing>) => {
    if (!dealership) return

    try {
      if (selectedListing) {
        const { error } = await supabase
          .from('cars')
          .update(formData)
          .eq('id', selectedListing.id)
          .eq('dealership_id', dealership.id)

        if (error) throw error

        Alert.alert('Success', 'Listing updated successfully')
      } else {
        const { error } = await supabase.from('cars').insert({
          ...formData,
          dealership_id: dealership.id,
          viewed_users: [],
          liked_users: []
        })

        if (error) throw error

        Alert.alert('Success', 'New listing created successfully')
      }

      fetchListings()
      setIsListingModalVisible(false)
      setSelectedListing(null)
    } catch (error) {
      console.error('Error submitting listing:', error)
      Alert.alert('Error', 'Failed to submit listing. Please try again.')
    }
  }

  const ListingCard = ({ item }: { item: CarListing }) => (
    <View style={[styles.listingCard, isDarkMode && styles.darkListingCard]}>
      <Image
        source={{ uri: item.images?.[0] || 'default_image_url' }}
        style={styles.listingImage}
      />
      <View style={styles.listingDetails}>
        <Text style={[styles.listingTitle, isDarkMode && styles.darkText]}>{`${
          item.year || 'N/A'
        } ${item.make || 'N/A'} ${item.model || 'N/A'}`}</Text>
        <Text style={[styles.listingPrice, isDarkMode && styles.darkText]}>
          ${item.price != null ? item.price.toLocaleString() : 'N/A'}
        </Text>
        <Text style={[styles.listingInfo, isDarkMode && styles.darkText]}>
          Condition: {item.condition || 'N/A'}
        </Text>
        <Text style={[styles.listingInfo, isDarkMode && styles.darkText]}>
          Mileage: {item.mileage != null ? item.mileage.toLocaleString() : 'N/A'} miles
        </Text>
        <View style={styles.statsContainer}>
          <View style={styles.stat}>
            <FontAwesome name='eye' size={16} color={isDarkMode ? '#FFFFFF' : '#888888'} />
            <Text style={[styles.statText, isDarkMode && styles.darkText]}>{item.views || 0}</Text>
          </View>
          <View style={styles.stat}>
            <FontAwesome name='heart' size={16} color={isDarkMode ? '#FFFFFF' : '#888888'} />
            <Text style={[styles.statText, isDarkMode && styles.darkText]}>{item.likes || 0}</Text>
          </View>
        </View>
        <View style={styles.actionContainer}>
          <TouchableOpacity
            style={[styles.actionButton, styles.editButton]}
            onPress={() => {
              setSelectedListing(item)
              setIsListingModalVisible(true)
            }}>
            <Text style={styles.actionButtonText}>Edit</Text>
          </TouchableOpacity>
          {item.status !== 'sold' && (
            <TouchableOpacity
              style={[styles.actionButton, styles.markSoldButton]}
              onPress={() => {
                // Implement mark as sold functionality
                Alert.alert('Mark as Sold', 'Implement this functionality')
              }}>
              <Text style={styles.actionButtonText}>Mark Sold</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.actionButton, styles.deleteButton]}
            onPress={() => handleDeleteListing(item.id)}>
            <Text style={styles.actionButtonText}>Delete</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  )

  if (!dealership) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading dealership information...</Text>
      </View>
    )
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <LinearGradient
        colors={isDarkMode ? ['#1E1E1E', '#2D2D2D'] : ['#F5F5F5', '#E0E0E0']}
        style={styles.gradient}
      >
        <SafeAreaView style={styles.safeArea}>
          <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
          <View style={styles.container}>
            {error && (
              <Text style={styles.errorText}>{error}</Text>
            )}

            <View style={styles.headerContainer}>
              <TextInput
                style={[styles.searchInput, isDarkMode && styles.darkSearchInput]}
                placeholder='Search listings...'
                placeholderTextColor={isDarkMode ? '#999999' : '#666666'}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              <TouchableOpacity
                style={styles.addButton}
                onPress={() => {
                  setSelectedListing(null)
                  setIsListingModalVisible(true)
                }}>
                <FontAwesome name='plus' size={20} color='white' />
              </TouchableOpacity>
            </View>

            <View style={styles.filterContainer}>
              <TouchableOpacity
                style={styles.filterButton}
                onPress={() => {
                  setFilterStatus(filterStatus === 'all' ? 'available' : 'all')
                }}>
                <Text style={styles.filterButtonText}>
                  {filterStatus === 'all' ? 'Show Available' : 'Show All'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.filterButton}
                onPress={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}>
                <Text style={styles.filterButtonText}>
                  Sort: {sortBy} {sortOrder === 'asc' ? '↑' : '↓'}
                </Text>
              </TouchableOpacity>
            </View>

            <FlatList
              data={listings}
              renderItem={({ item }) => <ListingCard item={item} />}
              keyExtractor={item => item.id.toString()}
              style={styles.listContainer}
            />

            <View style={styles.paginationContainer}>
              <TouchableOpacity
                style={[styles.paginationButton, currentPage === 1 && styles.disabledButton]}
                onPress={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}>
                <Text style={styles.paginationButtonText}>Previous</Text>
              </TouchableOpacity>
              <Text style={[styles.paginationText, isDarkMode && styles.darkText]}>{`${currentPage} of ${totalPages}`}</Text>
              <TouchableOpacity
                style={[styles.paginationButton, currentPage === totalPages && styles.disabledButton]}
                onPress={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}>
                <Text style={styles.paginationButtonText}>Next</Text>
              </TouchableOpacity>
            </View>

            <ListingModal
              isVisible={isListingModalVisible}
              onClose={() => {
                setIsListingModalVisible(false)
                setSelectedListing(null)
              }}
              onSubmit={handleSubmitListing}
              initialData={selectedListing}
              dealership={dealership}
            />
          </View>
        </SafeAreaView>
      </LinearGradient>
    </GestureHandlerRootView>
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
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 18,
    color: '#666666',
  },
  errorText: {
    color: '#FF3B30',
    marginBottom: 16,
    fontSize: 16,
  },
  headerContainer: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  searchInput: {
    flex: 1,
    height: 40,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingHorizontal: 16,
    marginRight: 8,
    color: '#000000',
  },
  darkSearchInput: {
    backgroundColor: '#333333',
    color: '#FFFFFF',
  },
  addButton: {
    backgroundColor: '#D55004',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  filterButton: {
    backgroundColor: '#D55004',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  filterButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  listContainer: {
    flex: 1,
  },
  listingCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    marginBottom: 16,
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  darkListingCard: {
    backgroundColor: '#2D2D2D',
  },
  listingImage: {
    width: '100%',
    height: 200,
    resizeMode: 'cover',
  },
  listingDetails: {
    padding: 16,
  },
  listingTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#000000',
  },
  darkText: {
    color: '#FFFFFF',
  },
  listingPrice: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#D55004',
    marginBottom: 8,
  },
  listingInfo: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 4,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    marginBottom: 16,
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statText: {
    marginLeft: 4,
    color: '#666666',
  },
  actionContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actionButton: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 4,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  editButton: {
    backgroundColor: '#007AFF',
  },
  markSoldButton: {
    backgroundColor: '#34C759',
  },
  deleteButton: {
    backgroundColor: '#FF3B30',
  },
  paginationContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
  },
  paginationButton: {
    backgroundColor: '#D55004',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  paginationButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  paginationText: {
    fontSize: 14,
    color: '#666666',
  },
  disabledButton: {
    opacity: 0.5,
  },
});