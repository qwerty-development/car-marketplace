import * as React from 'react'
import {
	TextInput,
	TouchableOpacity,
	View,
	Text,
	StyleSheet,
	KeyboardAvoidingView,
	Platform
} from 'react-native'
import { useSignUp } from '@clerk/clerk-expo'
import { useRouter } from 'expo-router'
import { supabase } from '@/utils/supabase'

export default function SignUpScreen() {
	const { isLoaded, signUp, setActive } = useSignUp()
	const router = useRouter()

	const [name, setName] = React.useState('')
	const [emailAddress, setEmailAddress] = React.useState('')
	const [password, setPassword] = React.useState('')
	const [pendingVerification, setPendingVerification] = React.useState(false)
	const [code, setCode] = React.useState('')
	const [error, setError] = React.useState('')

	const onSignUpPress = async () => {
		if (!isLoaded) return

		try {
			await signUp.create({
				emailAddress,
				password
			})
			await signUp.prepareEmailAddressVerification({ strategy: 'email_code' })
			setPendingVerification(true)
		} catch (err: any) {
			console.error(JSON.stringify(err, null, 2))
			setError('Sign up failed. Please try again.')
		}
	}

	const onPressVerify = async () => {
		if (!isLoaded) return

		try {
			const completeSignUp = await signUp.attemptEmailAddressVerification({
				code
			})

			if (completeSignUp.status !== 'complete') {
				setError('Verification failed. Please try again.')
				return
			}

			const { createdSessionId, createdUserId } = completeSignUp

			if (!createdSessionId || !createdUserId) {
				setError('Failed to complete sign up. Please try again.')
				return
			}

			// Set the active session
			await setActive({ session: createdSessionId })

			// Create a new entry in the users table
			const { data, error: supabaseError } = await supabase
				.from('users')
				.insert({
					id: createdUserId,
					name: name,
					email: emailAddress,
					created_at: new Date().toISOString()
				})

			if (supabaseError) {
				console.error('Error creating user in Supabase:', supabaseError)
				setError(
					'An error occurred while creating your account. Please try again.'
				)
				return
			}

			router.replace('/')
		} catch (err: any) {
			console.error(JSON.stringify(err, null, 2))
			setError('An error occurred. Please try again.')
		}
	}

	return (
		<KeyboardAvoidingView
			behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
			style={styles.container}>
			<View style={styles.innerContainer}>
				<Text style={styles.title}>
					{pendingVerification ? 'Verify Email' : 'Sign Up'}
				</Text>
				{!pendingVerification ? (
					<>
						<TextInput
							style={styles.input}
							value={name}
							placeholder='Full Name'
							onChangeText={setName}
						/>
						<TextInput
							style={styles.input}
							autoCapitalize='none'
							value={emailAddress}
							placeholder='Email'
							onChangeText={setEmailAddress}
							keyboardType='email-address'
						/>
						<TextInput
							style={styles.input}
							value={password}
							placeholder='Password'
							secureTextEntry={true}
							onChangeText={setPassword}
						/>
						{error ? <Text style={styles.errorText}>{error}</Text> : null}
						<TouchableOpacity style={styles.button} onPress={onSignUpPress}>
							<Text style={styles.buttonText}>Sign Up</Text>
						</TouchableOpacity>
					</>
				) : (
					<>
						<TextInput
							style={styles.input}
							value={code}
							placeholder='Verification Code'
							onChangeText={setCode}
							keyboardType='number-pad'
						/>
						{error ? <Text style={styles.errorText}>{error}</Text> : null}
						<TouchableOpacity style={styles.button} onPress={onPressVerify}>
							<Text style={styles.buttonText}>Verify Email</Text>
						</TouchableOpacity>
					</>
				)}
			</View>
		</KeyboardAvoidingView>
	)
}

// ... (styles remain the same)

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: '#f5f5f5'
	},
	innerContainer: {
		flex: 1,
		justifyContent: 'center',
		alignItems: 'center',
		padding: 20
	},
	title: {
		fontSize: 24,
		fontWeight: 'bold',
		marginBottom: 20
	},
	input: {
		width: '100%',
		height: 50,
		borderColor: '#ddd',
		borderWidth: 1,
		borderRadius: 5,
		paddingHorizontal: 10,
		marginBottom: 15,
		backgroundColor: '#fff'
	},
	button: {
		width: '100%',
		height: 50,
		backgroundColor: '#007AFF',
		justifyContent: 'center',
		alignItems: 'center',
		borderRadius: 5
	},
	buttonText: {
		color: '#fff',
		fontSize: 16,
		fontWeight: 'bold'
	},
	errorText: {
		color: 'red',
		marginBottom: 10
	}
})
