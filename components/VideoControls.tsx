import React, { useState, useEffect, useCallback } from 'react'
import { View, Text, TouchableOpacity, Animated } from 'react-native'
import { Volume2, VolumeX, SkipBack, SkipForward } from 'lucide-react-native'

const VideoControls = ({
	clipId,
	duration,
	currentTime,
	isPlaying,
	globalMute,
	onMutePress,
	onScrub,
	videoRef
}: any) => {
	const [showControls, setShowControls] = useState(true)
	const [progressWidth, setProgressWidth] = useState(0)
	const opacity = new Animated.Value(1)

	useEffect(() => {
		let timeout: string | number | NodeJS.Timeout | undefined
		if (isPlaying) {
			timeout = setTimeout(() => {
				Animated.timing(opacity, {
					toValue: 0,
					duration: 1000,
					useNativeDriver: true
				}).start()
				setShowControls(false)
			}, 3000)
		}
		return () => clearTimeout(timeout)
	}, [isPlaying])

	const toggleControls = useCallback(() => {
		setShowControls(prev => !prev)
		Animated.timing(opacity, {
			toValue: showControls ? 0 : 1,
			duration: 300,
			useNativeDriver: true
		}).start()
	}, [showControls])

	const formatTime = (timeInSeconds: number) => {
		const minutes = Math.floor(timeInSeconds / 60)
		const seconds = Math.floor(timeInSeconds % 60)
		return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`
	}

	const handleScrubbing = (event: { nativeEvent: { locationX: any } }) => {
		const { locationX } = event.nativeEvent
		const percentage = Math.max(0, Math.min(1, locationX / progressWidth))
		const newTime = percentage * duration
		onScrub(clipId, newTime)
	}

	return (
		<Animated.View
			className='absolute  left-0 right-0 bg-black/50 p-4 z-50'
			style={{ opacity }}
			onLayout={e => setProgressWidth(e.nativeEvent.layout.width - 32)}>
			{/* Progress Bar */}
			<View className='mb-4'>
				<TouchableOpacity
					className='h-8 justify-center -mt-2' // Increased touch target
					onPress={handleScrubbing}
					activeOpacity={1}>
					<View className='h-1 w-full bg-gray-600 rounded-full overflow-hidden'>
						<View
							className='h-full bg-red'
							style={{ width: `${(currentTime / duration) * 100}%` }}
						/>
						<View
							className='absolute top-1/2 -mt-2 h-4 w-4 bg-red rounded-full shadow-lg'
							style={{ left: `${(currentTime / duration) * 100}%` }}
						/>
					</View>
				</TouchableOpacity>

				<View className='flex-row justify-between mt-2'>
					<Text className='text-white text-xs'>{formatTime(currentTime)}</Text>
					<Text className='text-white text-xs'>{formatTime(duration)}</Text>
				</View>
			</View>

			{/* Control Buttons */}
			<View className='flex-row items-center justify-between px-4'>
				<TouchableOpacity
					onPress={e => onMutePress(clipId, e)}
					className='bg-red/20 p-3 rounded-full'>
					{globalMute ? (
						<VolumeX color='white' size={24} />
					) : (
						<Volume2 color='white' size={24} />
					)}
				</TouchableOpacity>
			</View>
		</Animated.View>
	)
}

export default React.memo(VideoControls)
