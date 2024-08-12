import React from 'react'
import {
	View,
	Text,
	StyleSheet,
	TouchableOpacity,
	Linking,
	Platform
} from 'react-native'
import { Feather } from '@expo/vector-icons'

const WHATSAPP_NUMBER = '+1234567890' // Replace with your actual WhatsApp number
const SUPPORT_EMAIL = 'support@example.com' // Replace with your actual support email
const EMAIL_SUBJECT = 'Support Request' // You can customize this subject line

export default function ContactUsPage() {
	const openWhatsApp = () => {
		let url = `whatsapp://send?phone=${WHATSAPP_NUMBER}`
		Linking.canOpenURL(url).then(supported => {
			if (supported) {
				return Linking.openURL(url)
			} else {
				// If WhatsApp is not installed, open in browser
				return Linking.openURL(`https://wa.me/${WHATSAPP_NUMBER}`)
			}
		})
	}

	const openEmail = () => {
		const subject = encodeURIComponent(EMAIL_SUBJECT)
		Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=${subject}`)
	}

	return (
		<View style={styles.container}>
			<Text style={styles.title}>Contact Support</Text>
			<Text style={styles.subtitle}>
				We're here to help! Choose your preferred method of contact:
			</Text>

			<TouchableOpacity style={styles.contactButton} onPress={openWhatsApp}>
				<Feather name='message-circle' size={24} color='#25D366' />
				<Text style={styles.buttonText}>Chat on WhatsApp</Text>
			</TouchableOpacity>

			<TouchableOpacity style={styles.contactButton} onPress={openEmail}>
				<Feather name='mail' size={24} color='#D44638' />
				<Text style={styles.buttonText}>Send an Email</Text>
			</TouchableOpacity>

			<View style={styles.infoContainer}>
				<Text style={styles.infoText}>Our support team is available:</Text>
				<Text style={styles.infoText}>Monday - Friday: 9AM - 6PM</Text>
				<Text style={styles.infoText}>Saturday: 10AM - 4PM</Text>
				<Text style={styles.infoText}>Sunday: Closed</Text>
			</View>
		</View>
	)
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		padding: 20,
		backgroundColor: '#f5f5f5',
		alignItems: 'center'
	},
	title: {
		fontSize: 28,
		fontWeight: 'bold',
		color: '#333',
		marginBottom: 10
	},
	subtitle: {
		fontSize: 16,
		color: '#666',
		textAlign: 'center',
		marginBottom: 30
	},
	contactButton: {
		flexDirection: 'row',
		alignItems: 'center',
		backgroundColor: '#fff',
		borderRadius: 10,
		padding: 15,
		marginBottom: 15,
		width: '100%',
		shadowColor: '#000',
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.1,
		shadowRadius: 4,
		elevation: 3
	},
	buttonText: {
		fontSize: 18,
		marginLeft: 15,
		color: '#333'
	},
	infoContainer: {
		marginTop: 30,
		alignItems: 'center'
	},
	infoText: {
		fontSize: 14,
		color: '#666',
		marginBottom: 5
	}
})
