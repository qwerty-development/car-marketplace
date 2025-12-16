import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Pressable,
  ScrollView,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '@/utils/ThemeContext';
import { useRouter } from 'expo-router';

export type ListingType = 'vehicle' | 'plate';
export type VehicleSubcategory = 'car' | 'bike' | 'truck';

interface AddListingModalProps {
  visible: boolean;
  onClose: () => void;
  userId?: string;
}

const AddListingModal: React.FC<AddListingModalProps> = ({
  visible,
  onClose,
  userId,
}) => {
  const { isDarkMode } = useTheme();
  const router = useRouter();
  const [selectedTab, setSelectedTab] = useState<ListingType>('vehicle');
  const [selectedSubcategory, setSelectedSubcategory] = useState<VehicleSubcategory>('car');

  const handlePublish = () => {
    onClose();
    if (selectedTab === 'vehicle') {
      // Map subcategory to category value for the database
      let category = 'Sedan'; // default
      if (selectedSubcategory === 'bike') {
        category = 'Motorcycle';
      } else if (selectedSubcategory === 'truck') {
        category = 'Truck';
      }
      
      router.push({
        pathname: '/(home)/(dealer)/AddEditListing',
        params: { 
          userId: userId,
          vehicleCategory: category,
          isUserListing: 'true'
        }
      });
    } else {
      router.push('/(home)/(user)/NumberPlatesManager');
    }
  };

  const handleModalClose = () => {
    setSelectedTab('vehicle');
    setSelectedSubcategory('car');
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleModalClose}
    >
      <BlurView 
        intensity={80} 
        tint={isDarkMode ? 'dark' : 'light'} 
        style={styles.blurContainer}
      >
        <Pressable style={styles.backdrop} onPress={handleModalClose}>
          <Pressable 
            style={[
              styles.modalContent,
              isDarkMode ? styles.modalContentDark : styles.modalContentLight
            ]}
            onPress={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <View style={styles.header}>
              <Text 
                style={[
                  styles.title,
                  isDarkMode ? styles.titleDark : styles.titleLight
                ]}
              >
                Add New Listing
              </Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={handleModalClose}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons 
                  name="close" 
                  size={24} 
                  color={isDarkMode ? '#fff' : '#000'} 
                />
              </TouchableOpacity>
            </View>

            {/* Tab Pills */}
            <View style={styles.tabContainer}>
              <TouchableOpacity
                style={[
                  styles.tab,
                  selectedTab === 'vehicle' && styles.tabActive,
                  isDarkMode && selectedTab !== 'vehicle' && styles.tabDark,
                  !isDarkMode && selectedTab !== 'vehicle' && styles.tabLight
                ]}
                onPress={() => setSelectedTab('vehicle')}
              >
                <Ionicons 
                  name="car-sport" 
                  size={18} 
                  color={selectedTab === 'vehicle' ? '#fff' : isDarkMode ? '#999' : '#666'} 
                  style={{ marginRight: 8 }}
                />
                <Text
                  style={[
                    styles.tabText,
                    selectedTab === 'vehicle' && styles.tabTextActive,
                    isDarkMode && selectedTab !== 'vehicle' && styles.tabTextDark
                  ]}
                >
                  Vehicle
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.tab,
                  selectedTab === 'plate' && styles.tabActive,
                  isDarkMode && selectedTab !== 'plate' && styles.tabDark,
                  !isDarkMode && selectedTab !== 'plate' && styles.tabLight
                ]}
                onPress={() => setSelectedTab('plate')}
              >
                <MaterialCommunityIcons 
                  name="card-text-outline" 
                  size={18} 
                  color={selectedTab === 'plate' ? '#fff' : isDarkMode ? '#999' : '#666'} 
                  style={{ marginRight: 8 }}
                />
                <Text
                  style={[
                    styles.tabText,
                    selectedTab === 'plate' && styles.tabTextActive,
                    isDarkMode && selectedTab !== 'plate' && styles.tabTextDark
                  ]}
                >
                  License Plate
                </Text>
              </TouchableOpacity>
            </View>

            <ScrollView 
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.scrollContent}
            >
              {selectedTab === 'vehicle' ? (
                <View>
                  {/* Vehicle Subcategory Pills */}
                  <View style={styles.subcategoryPills}>
                    <TouchableOpacity
                      style={[
                        styles.pill,
                        selectedSubcategory === 'car' && styles.pillActive,
                        isDarkMode && selectedSubcategory !== 'car' && styles.pillDark
                      ]}
                      onPress={() => setSelectedSubcategory('car')}
                    >
                      <Ionicons 
                        name="car" 
                        size={16} 
                        color={selectedSubcategory === 'car' ? '#fff' : isDarkMode ? '#999' : '#666'} 
                        style={{ marginRight: 6 }}
                      />
                      <Text
                        style={[
                          styles.pillText,
                          selectedSubcategory === 'car' && styles.pillTextActive
                        ]}
                      >
                        Car
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.pill,
                        selectedSubcategory === 'bike' && styles.pillActive,
                        isDarkMode && selectedSubcategory !== 'bike' && styles.pillDark
                      ]}
                      onPress={() => setSelectedSubcategory('bike')}
                    >
                      <MaterialCommunityIcons 
                        name="motorbike" 
                        size={16} 
                        color={selectedSubcategory === 'bike' ? '#fff' : isDarkMode ? '#999' : '#666'} 
                        style={{ marginRight: 6 }}
                      />
                      <Text
                        style={[
                          styles.pillText,
                          selectedSubcategory === 'bike' && styles.pillTextActive
                        ]}
                      >
                        Bike
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.pill,
                        selectedSubcategory === 'truck' && styles.pillActive,
                        isDarkMode && selectedSubcategory !== 'truck' && styles.pillDark
                      ]}
                      onPress={() => setSelectedSubcategory('truck')}
                    >
                      <MaterialCommunityIcons 
                        name="truck" 
                        size={16} 
                        color={selectedSubcategory === 'truck' ? '#fff' : isDarkMode ? '#999' : '#666'} 
                        style={{ marginRight: 6 }}
                      />
                      <Text
                        style={[
                          styles.pillText,
                          selectedSubcategory === 'truck' && styles.pillTextActive
                        ]}
                      >
                        Truck
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <View style={styles.plateContent}>
                  <View style={[styles.uploadBox, isDarkMode && styles.uploadBoxDark, { height: 200 }]}>
                    <MaterialCommunityIcons 
                      name="card-text-outline" 
                      size={64} 
                      color={isDarkMode ? '#666' : '#999'} 
                    />
                    <Text style={[styles.uploadText, isDarkMode && styles.uploadTextDark]}>
                      Create your license plate listing
                    </Text>
                  </View>
                </View>
              )}
            </ScrollView>

            {/* Publish Button */}
            <View style={styles.footer}>
              <TouchableOpacity
                style={styles.publishButton}
                onPress={handlePublish}
                activeOpacity={0.8}
              >
                <Text style={styles.publishButtonText}>
                  {selectedTab === 'vehicle' ? 'Continue to Add Vehicle' : 'Continue to Add Plate'}
                </Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </BlurView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  blurContainer: {
    flex: 1,
  },
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 500,
    borderRadius: 24,
    overflow: 'hidden',
    maxHeight: '85%',
  },
  modalContentLight: {
    backgroundColor: '#fff',
  },
  modalContentDark: {
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#333',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  titleLight: {
    color: '#000',
  },
  titleDark: {
    color: '#fff',
  },
  headerButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  headerButtonText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  closeButton: {
    padding: 4,
  },
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 12,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabLight: {
    backgroundColor: '#f0f0f0',
  },
  tabDark: {
    backgroundColor: '#1a1a1a',
  },
  tabActive: {
    backgroundColor: '#D55004',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  tabTextActive: {
    color: '#fff',
  },
  tabTextDark: {
    color: '#999',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
  },
  subcategoryPills: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 24,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
  },
  pillDark: {
    backgroundColor: '#1a1a1a',
  },
  pillActive: {
    backgroundColor: '#D55004',
  },
  pillText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  pillTextActive: {
    color: '#fff',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    color: '#000',
  },
  sectionTitleDark: {
    color: '#fff',
  },
  uploadBox: {
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 150,
  },
  uploadBoxDark: {
    backgroundColor: '#1a1a1a',
  },
  uploadText: {
    marginTop: 12,
    fontSize: 14,
    color: '#666',
  },
  uploadTextDark: {
    color: '#999',
  },
  selectBox: {
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectBoxDark: {
    backgroundColor: '#1a1a1a',
  },
  selectText: {
    fontSize: 14,
    color: '#666',
  },
  selectTextDark: {
    color: '#999',
  },
  plateContent: {
    paddingTop: 20,
  },
  footer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#333',
  },
  publishButton: {
    backgroundColor: '#D55004',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  publishButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default AddListingModal;
