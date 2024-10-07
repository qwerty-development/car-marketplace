import React, { useEffect, useRef, useState } from 'react'
import { useSignUp } from '@clerk/clerk-expo'
import { useRouter } from 'expo-router'
import {
	Text,
	TextInput,
	TouchableOpacity,
	View,
	KeyboardAvoidingView,
	Platform,
	Animated,
	Dimensions,
	ScrollView,
	Alert
} from 'react-native'
import { supabase } from '@/utils/supabase'
import { Ionicons } from '@expo/vector-icons'

const { width, height } = Dimensions.get('window')

const AnimatedLine: React.FC<{
	startPos: { x: number; y: number }
	duration: number
}> = ({ startPos, duration }) => {
	const position = useRef(new Animated.Value(0)).current

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
			style={{
				position: 'absolute',
				left: startPos.x,
				top: startPos.y,
				width: 1,
				height: 100,
				backgroundColor: '#D55004',
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

const FadingCircle: React.FC<{
	position: { x: number; y: number }
	size: number
}> = ({ position, size }) => {
	const opacity = useRef(new Animated.Value(0)).current

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

export default function SignUpScreen() {
	const { isLoaded, signUp, setActive } = useSignUp()
	const router = useRouter()

	const [name, setName] = useState('')
	const [emailAddress, setEmailAddress] = useState('')
	const [password, setPassword] = useState('')
	const [pendingVerification, setPendingVerification] = useState(false)
	const [code, setCode] = useState('')
	const [errors, setErrors] = useState({
		name: '',
		email: '',
		password: '',
		code: '',
		general: ''
	})
	const [showPassword, setShowPassword] = useState(false)

	const togglePasswordVisibility = () => setShowPassword(!showPassword)

	const validateInputs = () => {
		let isValid = true
		const newErrors = {
			name: '',
			email: '',
			password: '',
			code: '',
			general: ''
		}

		if (!name.trim()) {
			newErrors.name = 'Name is required'
			isValid = false
		}

		if (!emailAddress.trim()) {
			newErrors.email = 'Email is required'
			isValid = false
		} else if (!/\S+@\S+\.\S+/.test(emailAddress)) {
			newErrors.email = 'Invalid email format'
			isValid = false
		}

		if (!password) {
			newErrors.password = 'Password is required'
			isValid = false
		} else if (password.length < 8) {
			newErrors.password = 'Password must be at least 8 characters long'
			isValid = false
		}

		setErrors(newErrors)
		return isValid
	}

	const onSignUpPress = async () => {
		if (!isLoaded) return
		if (!validateInputs()) return

		try {
			await signUp.create({
				emailAddress,
				password
			})
			await signUp.prepareEmailAddressVerification({ strategy: 'email_code' })
			setPendingVerification(true)
		} catch (err: any) {
			console.error(JSON.stringify(err, null, 2))
			setErrors(prev => ({
				...prev,
				general: err.errors?.[0]?.message || 'Sign up failed. Please try again.'
			}))
		}
	}

	const onPressVerify = async () => {
		if (!isLoaded) return
		if (!code.trim()) {
			setErrors(prev => ({ ...prev, code: 'Verification code is required' }))
			return
		}

		try {
			const completeSignUp = await signUp.attemptEmailAddressVerification({
				code
			})

			if (completeSignUp.status !== 'complete') {
				setErrors(prev => ({
					...prev,
					code: 'Verification failed. Please try again.'
				}))
				return
			}

			const { createdSessionId, createdUserId } = completeSignUp

			if (!createdSessionId || !createdUserId) {
				setErrors(prev => ({
					...prev,
					general: 'Failed to complete sign up. Please try again.'
				}))
				return
			}

			await setActive({ session: createdSessionId })

			const { error: supabaseError } = await supabase.from('users').insert({
				id: createdUserId,
				name: name,
				email: emailAddress,
				created_at: new Date().toISOString()
			})

			if (supabaseError) {
				console.error('Error creating user in Supabase:', supabaseError)
				Alert.alert(
					'Account Created',
					'Your account was created successfully, but there was an issue saving additional information. You can update your profile later.'
				)
			}

			router.replace('/')
		} catch (err: any) {
			console.error(JSON.stringify(err, null, 2))
			setErrors(prev => ({
				...prev,
				general:
					err.errors?.[0]?.message || 'An error occurred. Please try again.'
			}))
		}
	}

	return (
		<KeyboardAvoidingView
			behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
			className='flex-1 bg-black'>
			<ScrollView contentContainerStyle={{ flexGrow: 1 }}>
				<View style={{ position: 'absolute', width: '100%', height: '100%' }}>
					<AnimatedLine
						startPos={{ x: width * 0.2, y: -100 }}
						duration={15000}
					/>
					<AnimatedLine
						startPos={{ x: width * 0.5, y: -100 }}
						duration={20000}
					/>
					<AnimatedLine
						startPos={{ x: width * 0.8, y: -100 }}
						duration={18000}
					/>

					<FadingCircle
						position={{ x: width * 0.1, y: height * 0.1 }}
						size={100}
					/>
					<FadingCircle
						position={{ x: width * 0.7, y: height * 0.3 }}
						size={150}
					/>
					<FadingCircle
						position={{ x: width * 0.3, y: height * 0.8 }}
						size={120}
					/>
				</View>

				<View className='flex-1 justify-center px-8'>
					<Text className='text-4xl font-bold mb-8 text-[#D55004] text-center'>
						{pendingVerification ? 'Verify Email' : 'Sign Up'}
					</Text>
					<View className='space-y-4'>
						{!pendingVerification ? (
							<>
								<View>
									<TextInput
										className='w-full h-12 px-4 bg-gray text-white rounded-lg border border-red'
										value={name}
										placeholder='Full Name'
										placeholderTextColor='#6B7280'
										onChangeText={setName}
										autoCapitalize='words'
										autoComplete='name'
									/>
									{errors.name && (
										<Text className='text-red mt-1'>{errors.name}</Text>
									)}
								</View>
								<View>
									<TextInput
										className='w-full h-12 px-4 bg-gray text-white rounded-lg border border-red'
										autoCapitalize='none'
										value={emailAddress}
										placeholder='Email'
										placeholderTextColor='#6B7280'
										onChangeText={setEmailAddress}
										keyboardType='email-address'
										autoComplete='email'
									/>
									{errors.email && (
										<Text className='text-red mt-1'>{errors.email}</Text>
									)}
								</View>
								<View className='relative'>
									<TextInput
										className='w-full h-12 px-4 pr-12 bg-gray text-white rounded-lg border border-red'
										value={password}
										placeholder='Password'
										placeholderTextColor='#6B7280'
										secureTextEntry={!showPassword}
										onChangeText={setPassword}
										autoComplete='password'
									/>
									<TouchableOpacity
										className='absolute right-4 top-3'
										onPress={togglePasswordVisibility}>
										<Ionicons
											name={showPassword ? 'eye-off' : 'eye'}
											size={24}
											color='#6B7280'
										/>
									</TouchableOpacity>
									{errors.password && (
										<Text className='text-red mt-1'>{errors.password}</Text>
									)}
								</View>
							</>
						) : (
							<View>
								<TextInput
									className='w-full h-12 px-4 bg-gray text-white rounded-lg border border-red'
									value={code}
									placeholder='Verification Code'
									placeholderTextColor='#6B7280'
									onChangeText={setCode}
									keyboardType='number-pad'
								/>
								{errors.code && (
									<Text className='text-red mt-1'>{errors.code}</Text>
								)}
							</View>
						)}
					</View>
					{errors.general ? (
						<Text className='text-red mt-4 text-center'>{errors.general}</Text>
					) : null}
					<TouchableOpacity
						className='bg-[#D55004] py-3 rounded-lg mt-8'
						onPress={pendingVerification ? onPressVerify : onSignUpPress}>
						<Text className='text-white font-bold text-lg text-center'>
							{pendingVerification ? 'Verify Email' : 'Sign Up'}
						</Text>
					</TouchableOpacity>
					{!pendingVerification && (
						<View className='flex-row justify-center mt-6'>
							<Text className='text-gray'>Already have an account? </Text>
							<TouchableOpacity onPress={() => router.push('/sign-in')}>
								<Text className='text-[#D55004] font-bold'>Sign in</Text>
							</TouchableOpacity>
						</View>
					)}
				</View>
			</ScrollView>
		</KeyboardAvoidingView>
	)
}
