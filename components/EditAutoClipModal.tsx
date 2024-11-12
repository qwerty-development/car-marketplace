//EditAutoclipmodal
import React, { useState, useEffect } from 'react'
import {
    View,
    Text,
    TextInput,
    Modal,
    TouchableOpacity,
    Alert,
    ScrollView,
} from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { FontAwesome } from '@expo/vector-icons'
import { useTheme } from '@/utils/ThemeContext'
import { supabase } from '@/utils/supabase'
import { Video } from 'expo-av'
import VideoPickerButton from '@/components/VideoPickerComponent'
import CarSelector from '@/components/CarSelector'
import { useUser } from '@clerk/clerk-expo'
import { Car } from '@/types/autoclip'

interface EditAutoClipModalProps {
    clip: AutoClip
    isVisible: boolean
    onClose: () => void
    onSuccess: () => void
}

interface AutoClip {
    id: number
    title: string
    description: string
    video_url: string
    car_id: number
    car: {
        id: number
        year: number
        make: string
        model: string
    } | null
}

export default function EditAutoClipModal({
    clip,
    isVisible,
    onClose,
    onSuccess
}: EditAutoClipModalProps) {
    const { isDarkMode } = useTheme()
    const { user } = useUser()
    const [title, setTitle] = useState(clip.title)
    const [description, setDescription] = useState(clip.description)
    const [videoUri, setVideoUri] = useState(clip.video_url)
    const [selectedCarId, setSelectedCarId] = useState<number | null>(clip.car_id)
    const [loading, setLoading] = useState(false)
    const [cars, setCars] = useState<Car[]>([])
    const [videoRef, setVideoRef] = useState<Video | null>(null)

    useEffect(() => {
        if (isVisible) {
            setTitle(clip.title)
            setDescription(clip.description)
            setVideoUri(clip.video_url)
            setSelectedCarId(clip.car_id)
            fetchCars()
        }
    }, [isVisible, clip])

    const fetchCars = async () => {
        if (!user) return

        try {
            // Get dealership first
            const { data: dealershipData, error: dealershipError } = await supabase
                .from('dealerships')
                .select('id')
                .eq('user_id', user.id)
                .single()

            if (dealershipError) throw dealershipError

            // Then get cars for this dealership
            const { data: carsData, error: carsError } = await supabase
                .from('cars')
                .select('*')
                .eq('dealership_id', dealershipData.id)

            if (carsError) throw carsError
            
            setCars(carsData || [])
        } catch (error) {
            console.error('Error fetching cars:', error)
            Alert.alert('Error', 'Failed to load cars')
        }
    }

    const handleSubmit = async () => {
        if (!title.trim()) {
            Alert.alert('Error', 'Please enter a title')
            return
        }

        if (!selectedCarId) {
            Alert.alert('Error', 'Please select a car')
            return
        }

        setLoading(true)
        try {
            const updates = {
                title: title.trim(),
                description: description.trim(),
                video_url: videoUri,
                car_id: selectedCarId,
                updated_at: new Date().toISOString()
            }

            const { error } = await supabase
                .from('auto_clips')
                .update(updates)
                .eq('id', clip.id)

            if (error) throw error

            Alert.alert('Success', 'AutoClip updated successfully')
            onSuccess()
        } catch (error) {
            console.error('Error:', error)
            Alert.alert('Error', 'Failed to update AutoClip')
        } finally {
            setLoading(false)
        }
    }

    const handleVideoSelected = (uri: string) => {
        setVideoUri(uri)
    }

    return (
        <Modal
            visible={isVisible}
            onRequestClose={onClose}
            animationType="slide"
            presentationStyle="fullScreen"
        >
            <LinearGradient
                colors={isDarkMode ? ['#000000', '#1A1A1A'] : ['#FFFFFF', '#F0F0F0']}
                className="flex-1"
            >
                <View className="flex-row justify-between items-center p-4 mt-12 border-b border-red">
                    <TouchableOpacity onPress={onClose}>
                        <FontAwesome 
                            name="close" 
                            size={24} 
                            color={isDarkMode ? 'white' : 'black'} 
                        />
                    </TouchableOpacity>
                    <Text className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-black'}`}>
                        Edit AutoClip
                    </Text>
                    <TouchableOpacity 
                        onPress={handleSubmit}
                        disabled={loading}
                    >
                        <Text className={`text-red ${loading ? 'opacity-50' : ''}`}>
                            {loading ? 'Saving...' : 'Save'}
                        </Text>
                    </TouchableOpacity>
                </View>

                <ScrollView className="flex-1 p-4">
                    {/* Video Preview */}
                    <View className="bg-black rounded-lg overflow-hidden mb-4">
                        <Video
                            ref={(ref) => setVideoRef(ref)}
                            source={{ uri: videoUri }}
                            style={{ width: '100%', aspectRatio: 16/9 }}
                            resizeMode="cover"
                            useNativeControls
                            isLooping
                        />
                    </View>

                    {/* Video Picker */}
                    <VideoPickerButton onVideoSelected={handleVideoSelected} />

                    {/* Car Selector */}
                    <CarSelector
                        cars={cars}
                        selectedCarId={selectedCarId}
                        onCarSelect={setSelectedCarId}
                    />

                    {/* Title Input */}
                    <View className="mb-4">
                        <Text className={`text-sm mb-2 ${isDarkMode ? 'text-white' : 'text-black'}`}>
                            Title
                        </Text>
                        <TextInput
                            value={title}
                            onChangeText={setTitle}
                            placeholder="Enter title"
                            placeholderTextColor={isDarkMode ? '#666' : '#999'}
                            className={`p-3 rounded-lg ${isDarkMode ? 'bg-gray-800 text-white' : 'bg-gray-100 text-black'}`}
                        />
                    </View>

                    {/* Description Input */}
                    <View className="mb-4">
                        <Text className={`text-sm mb-2 ${isDarkMode ? 'text-white' : 'text-black'}`}>
                            Description
                        </Text>
                        <TextInput
                            value={description}
                            onChangeText={setDescription}
                            placeholder="Enter description"
                            placeholderTextColor={isDarkMode ? '#666' : '#999'}
                            multiline
                            numberOfLines={4}
                            className={`p-3 rounded-lg ${isDarkMode ? 'bg-gray-800 text-white' : 'bg-gray-100 text-black'}`}
                            style={{ textAlignVertical: 'top' }}
                        />
                    </View>
                </ScrollView>
            </LinearGradient>
        </Modal>
    )
}