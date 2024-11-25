// hooks/useFavorites.tsx
import React, { createContext, useState, useContext, useEffect } from 'react'
import { supabase } from '@/utils/supabase'
import { useUser } from '@clerk/clerk-expo'

interface FavoritesContextType {
	favorites: number[]
	toggleFavorite: any
	isFavorite: (carId: number) => boolean
}

const FavoritesContext = createContext<FavoritesContextType | undefined>(
	undefined
)

export const FavoritesProvider: React.FC<{ children: React.ReactNode }> = ({
	children
}) => {
	const [favorites, setFavorites] = useState<number[]>([])
	const { user } = useUser()

	useEffect(() => {
		if (user) {
			fetchFavorites()
		}
	}, [user])

	const fetchFavorites = async () => {
		if (!user) return

		try {
			const { data, error } = await supabase
				.from('users')
				.select('favorite')
				.eq('id', user.id)
				.single()

			if (error) {
				if (error.code === 'PGRST116') {
					// User doesn't exist yet, initialize with empty favorites
					setFavorites([])
				} else {
					console.error('Error fetching favorites:', error)
				}
			} else {
				setFavorites(data?.favorite || [])
			}
		} catch (error) {
			console.error('Error fetching favorites:', error)
		}
	}

	const toggleFavorite = async (carId: number): Promise<number> => {
		if (!user) return 0
		try {
			const { data, error } = await supabase.rpc('toggle_car_like', {
				car_id: carId,
				user_id: user.id
			})

			if (error) {
				console.error('Error toggling favorite:', error)
				return 0
			}

			// Update local favorites
			const newFavorites = isFavorite(carId)
				? favorites.filter(id => id !== carId)
				: [...favorites, carId]
			setFavorites(newFavorites)

			// Update user's favorites in the database
			const { error: updateError } = await supabase
				.from('users')
				.update({ favorite: newFavorites })
				.eq('id', user.id)

			if (updateError) {
				console.error('Error updating user favorites:', updateError)
			}

			return data as number
		} catch (error) {
			console.error('Unexpected error in toggleFavorite:', error)
			return 0
		}
	}

	const isFavorite = (carId: number) => favorites.includes(carId)

	return (
		<FavoritesContext.Provider
			value={{ favorites, toggleFavorite, isFavorite }}>
			{children}
		</FavoritesContext.Provider>
	)
}

export const useFavorites = () => {
	const context = useContext(FavoritesContext)
	if (context === undefined) {
		throw new Error('useFavorites must be used within a FavoritesProvider')
	}
	return context
}
