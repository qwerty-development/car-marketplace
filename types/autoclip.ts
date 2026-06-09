// types/autoclip.ts

export interface Car {
  id: number
  make: string
  model: string
  year: number
  price: number
  status: 'available' | 'pending' | 'sold' | 'deleted'
}
