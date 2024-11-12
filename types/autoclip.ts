// types/autoclip.ts

export interface AutoClip {
  id: number
  dealership_id: number
  car_id: number
  title: string
  description?: string
  video_url: string
  thumbnail_url: string
  duration: number
  views: number
  likes: number
  status: 'draft' | 'published'
  created_at: string
  published_at?: string
  viewed_users: string[]
  liked_users: string[]
  car?: Car | null  // Add this for the joined car data
}

export interface Car {
  id: number
  make: string
  model: string
  year: number
  price: number
  status: 'available' | 'pending' | 'sold'
}

export interface VideoAsset {
  uri: string
  width: number
  height: number
  duration: number
  type?: string
  fileSize?: number
}

export interface CreateAutoClipFormData {
  title: string
  description: string
  car_id: number
  video: VideoAsset
}