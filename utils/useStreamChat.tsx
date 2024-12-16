import { useEffect, useState } from 'react'
import { useUser } from '@clerk/clerk-expo'
import { chatClient } from './chatConfig'
import { supabase } from './supabase'

export const useStreamChat = () => {
	const { user } = useUser()
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState<Error | null>(null)

	useEffect(() => {
		const initChat = async () => {
			if (!user) return // Wait until user is defined.

			try {
				const response = await fetch(
					'https://backend-car-marketplace.vercel.app/api/stream-token',
					{
						method: 'POST',
						headers: {
							'Content-Type': 'application/json'
						},
						body: JSON.stringify({ userId: user.id })
					}
				)

				if (!response.ok) throw new Error('Failed to get Stream token')
				const { token } = await response.json()

				// Connect user to Stream
				await chatClient.connectUser(
					{
						id: user.id,
						name: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
						image: user.imageUrl || undefined
					},
					token
				)

				setLoading(false)
			} catch (err) {
				setError(err as Error)
				setLoading(false)
			}
		}

		initChat()

		return () => {
			chatClient.disconnectUser()
		}
	}, [user])

	const startDealershipChat = async (dealershipId: string, carId?: string) => {
		// Fetch dealership details from your DB to show dealership name/logo in channel
		const { data: dealershipData, error: dealershipError } = await supabase
			.from('dealerships')
			.select('name, logo')
			.eq('id', dealershipId)
			.single()

		if (dealershipError) {
			throw new Error('Failed to fetch dealership info')
		}

		const channelId = carId
			? `dealer_${dealershipId}_car_${carId}_user_${user?.id}`
			: `dealer_${dealershipId}_user_${user?.id}`

		const channel = chatClient.channel('messaging', channelId, {
			members: [user?.id, dealershipId],
			dealership_id: dealershipId,
			car_id: carId,
			dealership_name: dealershipData?.name,
			dealership_logo: dealershipData?.logo
		})

		// Use channel.watch() to create if doesn't exist or watch if it does
		await channel.watch()
		return channel
	}

	return { chatClient, loading, error, startDealershipChat }
}
