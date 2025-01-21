// app/(auth)/index.tsx
import React, { useEffect, useState } from 'react'
import {
	View,
	Text,
	TouchableOpacity,
	Dimensions,
	Animated,
	Image,
	ActivityIndicator,
	Alert
} from 'react-native'
import { useRouter } from 'expo-router'
import { useOAuth } from '@clerk/clerk-expo'
import { Ionicons } from '@expo/vector-icons'
import { BlurView } from 'expo-blur'

const { width, height } = Dimensions.get('window')

// Animated components from your existing pages
const AnimatedLine = ({ startPos, duration }: any) => {
	const position = new Animated.Value(0)

	useEffect(() => {
		Animated.loop(
			Animated.timing(position, {
				toValue: 1,
				duration: duration,
				useNativeDriver: true
			})
		).start()
	}, [duration])

	return (
		<Animated.View
			className='absolute w-[1px] h-[100px] bg-red'
			style={{
				left: startPos.x,
				top: startPos.y,
				transform: [
					{
						translateY: position.interpolate({
							inputRange: [0, 1],
							outputRange: [0, height + 100]
						})
					}
				]
			}}
		/>
	)
}

const FadingCircle = ({ position, size }: any) => {
	const opacity = new Animated.Value(0)

	useEffect(() => {
		Animated.loop(
			Animated.sequence([
				Animated.timing(opacity, {
					toValue: 0.5,
					duration: 2000,
					useNativeDriver: true
				}),
				Animated.timing(opacity, {
					toValue: 0,
					duration: 2000,
					useNativeDriver: true
				})
			])
		).start()
	}, [])

	return (
		<Animated.View
			style={{
				position: 'absolute',
				left: position.x,
				top: position.y,
				width: size,
				height: size,
				borderRadius: size / 2,
				backgroundColor: '#D55004',
				opacity: opacity
			}}
		/>
	)
}

const SocialAuthButton = ({
	onPress,
	isLoading,
	platform
}: {
	onPress: () => void
	isLoading: boolean
	platform: 'google' | 'apple'
}) => (
	<TouchableOpacity
		onPress={onPress}
		disabled={isLoading}
		className='w-full h-14 rounded-full bg-black border border-white/20 flex-row items-center justify-center mb-4'>
		{isLoading ? (
			<ActivityIndicator color='#FFF' />
		) : (
			<>
				<Ionicons
					name={`logo-${platform}`}
					size={24}
					color='#FFF'
					style={{ marginRight: 8 }}
				/>
				<Text className='text-white font-semibold text-lg'>
					Continue with {platform.charAt(0).toUpperCase() + platform.slice(1)}
				</Text>
			</>
		)}
	</TouchableOpacity>
)

export default function LandingPage() {
	const router = useRouter()
	const [isLoading, setIsLoading] = useState({
		google: false,
		apple: false
	})

	const { startOAuthFlow: googleAuth } = useOAuth({ strategy: 'oauth_google' })
	const { startOAuthFlow: appleAuth } = useOAuth({ strategy: 'oauth_apple' })

	const handleSocialAuth = async (platform: 'google' | 'apple') => {
		try {
			setIsLoading(prev => ({ ...prev, [platform]: true }))
			const auth = platform === 'google' ? googleAuth : appleAuth
			const { createdSessionId, setActive } = await auth()

			if (createdSessionId) {
				setActive && (await setActive({ session: createdSessionId }))
				router.replace('/(home)')
			}
		} catch (err) {
			console.error(`${platform} OAuth error:`, err)
			Alert.alert(
				'Authentication Error',
				`Failed to authenticate with ${
					platform.charAt(0).toUpperCase() + platform.slice(1)
				}`
			)
		} finally {
			setIsLoading(prev => ({ ...prev, [platform]: false }))
		}
	}

	return (
		<View className='flex-1 bg-black'>
			{/* Animated background elements */}
			<AnimatedLine startPos={{ x: width * 0.2, y: -100 }} duration={15000} />
			<AnimatedLine startPos={{ x: width * 0.5, y: -100 }} duration={20000} />
			<AnimatedLine startPos={{ x: width * 0.8, y: -100 }} duration={18000} />
			<FadingCircle position={{ x: width * 0.1, y: height * 0.1 }} size={100} />
			<FadingCircle position={{ x: width * 0.7, y: height * 0.3 }} size={150} />
			<FadingCircle position={{ x: width * 0.3, y: height * 0.8 }} size={120} />

			<View className='flex-1 justify-between px-8 py-12'>
				{/* Logo Section */}
				<View className='items-center mt-12'>
					<Image
						source={require('@/assets/types/convertible.png')}
						className='w-32 h-32'
						resizeMode='contain'
					/>
					<Text className='text-4xl font-bold text-red mt-4 text-center'>
						Welcome to QWERTY
					</Text>
					<Text className='text-gray text-lg mt-2 text-center'>
						Find your perfect car
					</Text>
				</View>

				{/* Buttons Section */}
				<View className='w-full space-y-4'>
					{/* Social Auth Buttons */}
					<SocialAuthButton
						platform='google'
						isLoading={isLoading.google}
						onPress={() => handleSocialAuth('google')}
					/>
					<SocialAuthButton
						platform='apple'
						isLoading={isLoading.apple}
						onPress={() => handleSocialAuth('apple')}
					/>

					{/* Divider */}
					<View className='flex-row items-center my-4'>
						<View className='flex-1 h-[1px] bg-white/20' />
						<Text className='text-white/60 mx-4'>OR</Text>
						<View className='flex-1 h-[1px] bg-white/20' />
					</View>

					{/* Regular Auth Buttons */}
					<TouchableOpacity
						onPress={() => router.push('/sign-in')}
						className='w-full h-14 rounded-full bg-red flex-row items-center justify-center'>
						<Text className='text-white font-semibold text-lg'>Sign In</Text>
					</TouchableOpacity>

					<TouchableOpacity
						onPress={() => router.push('/sign-up')}
						className='w-full h-14 rounded-full border-2 border-red flex-row items-center justify-center'>
						<Text className='text-red font-semibold text-lg'>
							Create Account
						</Text>
					</TouchableOpacity>

					<TouchableOpacity
						onPress={() => router.push('/forgot-password')}
						className='mt-4'>
						<Text className='text-white text-center underline'>
							Forgot Password?
						</Text>
					</TouchableOpacity>
				</View>

				{/* Terms & Privacy */}
				<Text className='text-white/60 text-center text-sm mt-8'>
					By continuing, you agree to our{' '}
					<Text className='text-red'>Terms of Service</Text> and{' '}
					<Text className='text-red'>Privacy Policy</Text>
				</Text>
			</View>
		</View>
	)
}
