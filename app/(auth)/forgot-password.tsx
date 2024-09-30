import React, { useState, useEffect } from 'react'
import {
	View,
	Text,
	TextInput,
	TouchableOpacity,
	Alert,
	Dimensions,
	Animated
} from 'react-native'
import { useSignIn } from '@clerk/clerk-expo'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '@/utils/ThemeContext'
import { SafeAreaView } from 'react-native-safe-area-context'

const { width, height } = Dimensions.get('window')

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

const CustomHeader = ({ title, onBack }: any) => {
	const { isDarkMode } = useTheme()
	return (
		<SafeAreaView
			edges={['top']}
			className={`${isDarkMode ? 'bg-black' : 'bg-white'} border-b border-red`}>
			<View className='flex-row items-center justify-between py-4 px-4'>
				<TouchableOpacity onPress={onBack}>
					<Ionicons
						name='chevron-back'
						size={24}
						color={isDarkMode ? 'white' : 'black'}
					/>
				</TouchableOpacity>
				<Text className='text-xl font-bold text-red'>{title}</Text>
				<View style={{ width: 24 }} />
			</View>
		</SafeAreaView>
	)
}

export default function ForgotPasswordPage() {
	const { isDarkMode } = useTheme()
	const router = useRouter()
	const { signIn, setActive } = useSignIn()
	const [emailAddress, setEmailAddress] = useState('')
	const [password, setPassword] = useState('')
	const [code, setCode] = useState('')
	const [successfulCreation, setSuccessfulCreation] = useState(false)
	const [showPassword, setShowPassword] = useState(false)

	const onRequestReset = async () => {
		try {
			await signIn?.create({
				strategy: 'reset_password_email_code',
				identifier: emailAddress
			})
			setSuccessfulCreation(true)
			Alert.alert('Success', 'Reset code sent to your email')
		} catch (err: any) {
			Alert.alert('Error', err.errors[0].message)
		}
	}

	const onReset = async () => {
		try {
			const result = await signIn?.attemptFirstFactor({
				strategy: 'reset_password_email_code',
				code,
				password
			})
			Alert.alert('Success', 'Password reset successfully')
			await setActive({ session: result!.createdSessionId })
			router.replace('/')
		} catch (err: any) {
			Alert.alert('Error', err.errors[0].message)
		}
	}

	return (
		<View className={`flex-1 ${isDarkMode ? 'bg-black' : 'bg-white'}`}>
			<CustomHeader title='Forgot Password' onBack={() => router.back()} />
			<AnimatedLine startPos={{ x: width * 0.2, y: -100 }} duration={15000} />
			<AnimatedLine startPos={{ x: width * 0.5, y: -100 }} duration={20000} />
			<AnimatedLine startPos={{ x: width * 0.8, y: -100 }} duration={18000} />

			<View className='flex-1 justify-center px-8'>
				{!successfulCreation ? (
					<>
						<Text
							className={`text-2xl font-bold mb-6 ${
								isDarkMode ? 'text-white' : 'text-black'
							}`}>
							Reset Your Password
						</Text>
						<TextInput
							className={`w-full h-12 px-4 mb-4 rounded-lg ${
								isDarkMode ? 'bg-gray-800 text-white' : 'bg-gray-200 text-black'
							}`}
							placeholder='Enter your email'
							placeholderTextColor={isDarkMode ? '#A0AEC0' : '#718096'}
							value={emailAddress}
							onChangeText={setEmailAddress}
							keyboardType='email-address'
							autoCapitalize='none'
						/>
						<TouchableOpacity
							className='bg-red py-3 rounded-lg'
							onPress={onRequestReset}>
							<Text className='text-white text-center font-bold'>
								Send Reset Code
							</Text>
						</TouchableOpacity>
					</>
				) : (
					<>
						<Text
							className={`text-2xl font-bold mb-6 ${
								isDarkMode ? 'text-white' : 'text-black'
							}`}>
							Enter New Password
						</Text>
						<TextInput
							className={`w-full h-12 px-4 mb-4 rounded-lg ${
								isDarkMode ? 'bg-gray-800 text-white' : 'bg-gray-200 text-black'
							}`}
							placeholder='Reset code'
							placeholderTextColor={isDarkMode ? '#A0AEC0' : '#718096'}
							value={code}
							onChangeText={setCode}
						/>
						<View className='relative mb-4'>
							<TextInput
								className={`w-full h-12 px-4 pr-12 rounded-lg ${
									isDarkMode
										? 'bg-gray-800 text-white'
										: 'bg-gray-200 text-black'
								}`}
								placeholder='New password'
								placeholderTextColor={isDarkMode ? '#A0AEC0' : '#718096'}
								value={password}
								onChangeText={setPassword}
								secureTextEntry={!showPassword}
							/>
							<TouchableOpacity
								className='absolute right-4 top-3'
								onPress={() => setShowPassword(!showPassword)}>
								<Ionicons
									name={showPassword ? 'eye-off' : 'eye'}
									size={24}
									color={isDarkMode ? '#A0AEC0' : '#718096'}
								/>
							</TouchableOpacity>
						</View>
						<TouchableOpacity
							className='bg-red py-3 rounded-lg'
							onPress={onReset}>
							<Text className='text-white text-center font-bold'>
								Reset Password
							</Text>
						</TouchableOpacity>
					</>
				)}
			</View>
		</View>
	)
}
