import React, { useState, useEffect, useCallback, useRef } from 'react'
import {
    View,
    Text,
    TouchableOpacity,
    Dimensions,
    FlatList,
    Alert,
    Platform,
    AppState,
} from 'react-native'
import { Video, ResizeMode } from 'expo-av'
import { LinearGradient } from 'expo-linear-gradient'
import { useTheme } from '@/utils/ThemeContext'
import CarDetailsModalOSclip from '../CarDetailsModalOSclip'
import CarDetailsModalclip from '../CarDetailsModalclip'
import { supabase } from '@/utils/supabase'
import { useIsFocused } from '@react-navigation/native'

const { height, width } = Dimensions.get('window')

interface AutoClip {
    id: number
    title: string
    description: string
    video_url: string
    status: 'published' | 'draft'
    car_id: number
    car?: {
        id: string
        year: number
        make: string
        model: string
    }
}

export default function AutoClips() {
    const { isDarkMode } = useTheme()
    const [autoClips, setAutoClips] = useState<AutoClip[]>([])
    const [isModalVisible, setIsModalVisible] = useState(false)
    const [selectedCar, setSelectedCar] = useState<any>(null)
    const videoRefs = useRef<any[]>([])
    const tabBarHeight = 60
    const isFocused = useIsFocused()
    const [currentVideoIndex, setCurrentVideoIndex] = useState(0)

    // Fetch Auto Clips and Link Car Data
    const fetchAutoClips = async () => {
        try {
            const { data: autoClipsData, error: autoClipsError } = await supabase
                .from('auto_clips')
                .select('*')
                .eq('status', 'published')

            if (autoClipsError) {
                console.error('Error fetching auto clips:', autoClipsError)
                return
            }

            const carIds = autoClipsData?.map((clip: any) => clip.car_id) || []
            const { data: carsData, error: carsError } = await supabase
                .from('cars')
                .select('*')
                .in('id', carIds)

            if (carsError) {
                console.error('Error fetching cars:', carsError)
                return
            }

            const carsById = (carsData || []).reduce((acc: any, car: any) => {
                acc[car.id] = car
                return acc
            }, {})

            const mergedAutoClips = (autoClipsData || []).map((clip: any) => ({
                ...clip,
                car: carsById[clip.car_id]
            }))

            setAutoClips(mergedAutoClips)
        } catch (error) {
            console.error('Unexpected error:', error)
        }
    }

    useEffect(() => {
        fetchAutoClips()
    }, [])

    // Handle tab focus changes
    useEffect(() => {
        if (!isFocused) {
            videoRefs.current.forEach(ref => {
                if (ref) {
                    ref.pauseAsync().catch(console.error)
                }
            })
        } else if (videoRefs.current[currentVideoIndex]) {
            videoRefs.current[currentVideoIndex].playAsync().catch(console.error)
        }

        return () => {
            videoRefs.current.forEach(ref => {
                if (ref) {
                    ref.pauseAsync().catch(console.error)
                }
            })
        }
    }, [isFocused, currentVideoIndex])

    const handleCarLinkPress = (car: AutoClip['car']) => {
        if (car) {
            setSelectedCar(car)
            setIsModalVisible(true)
        } else {
            Alert.alert('Car information not available')
        }
    }

    const renderAutoClip = ({ item, index }: { item: AutoClip, index: number }) => (
        <View style={{ height, width }}>
            <Video
                ref={(ref) => ref && (videoRefs.current[index] = ref)}
                source={{ uri: item.video_url }}
                style={{ height, width }}
                resizeMode={ResizeMode.COVER}
                shouldPlay={isFocused && index === currentVideoIndex}
                isLooping
                isMuted={false}
            />

            <LinearGradient
                colors={['transparent', 'rgba(0,0,0,0.9)']}
                style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    paddingBottom: tabBarHeight,
                    height: 200, // Add fixed height for gradient
                }}
            >
                <View style={{ paddingHorizontal: 16, paddingBottom: tabBarHeight }}>
                    <Text style={{ color: 'white', fontSize: 18, fontWeight: 'bold' }}>{item.title}</Text>
                    <Text style={{ color: 'gray', marginBottom: 8 }} numberOfLines={2}>{item.description}</Text>

                    {item.car && (
                        <View>
                            <Text style={{ color: '#D55004', fontSize: 16 }}>
                                {item.car.year} {item.car.make} {item.car.model}
                            </Text>
                            <TouchableOpacity
                                onPress={() => handleCarLinkPress(item.car)}
                                style={{
                                    marginTop: 8,
                                    backgroundColor: '#D55004',
                                    padding: 10,
                                    borderRadius: 5,
                                }}
                            >
                                <Text style={{ color: 'white', textAlign: 'center' }}>Visit Car</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </View>
            </LinearGradient>
        </View>
    )

    const renderModal = useCallback(() => {
        const ModalComponent = Platform.OS === 'ios' ? CarDetailsModalOSclip : CarDetailsModalclip
        return (
            <ModalComponent
                isVisible={isModalVisible}
                car={selectedCar}
                onClose={() => {
                    setIsModalVisible(false)
                    setSelectedCar(null)
                }}
                setSelectedCar={setSelectedCar}
                setIsModalVisible={setIsModalVisible}
            />
        )
    }, [isModalVisible, selectedCar])

    if (!autoClips.length) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                <Text>Loading...</Text>
            </View>
        )
    }

    return (
        <View style={{ flex: 1, backgroundColor: isDarkMode ? '#111' : '#FFF' }}>
            <FlatList
                data={autoClips}
                renderItem={renderAutoClip}
                keyExtractor={(item) => item.id.toString()}
                pagingEnabled
                showsVerticalScrollIndicator={false}
                onScrollToIndexFailed={() => {}}
                onMomentumScrollEnd={(event) => {
                    const index = Math.round(event.nativeEvent.contentOffset.y / height)
                    setCurrentVideoIndex(index)
                }}
            />
            {renderModal()}
        </View>
    )
}