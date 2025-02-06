// types.ts
interface Dealership {
  id: string
  name: string
  location: string
  phone: string
  logo: string
  latitude: number | null
  longitude: number | null
  subscription_end_date: string | null
}

interface FormData {
  name: string
  location: string
  phone: string
  logo: string
  latitude: string
  longitude: string
}

interface PasswordData {
  currentPassword: string
  newPassword: string
  confirmPassword: string
}