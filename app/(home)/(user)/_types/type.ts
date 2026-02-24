export interface NotificationSettings {
    pushNotifications: boolean
    emailNotifications: boolean
    marketingUpdates: boolean
    newCarAlerts: boolean
  }
  
  export interface EditProfileModalProps {
    visible: boolean
    onClose: () => void
    firstName: string
    lastName: string
    email: string
    setFirstName: (name: string) => void
    setLastName: (name: string) => void
    onUpdate: () => Promise<void>
    isDarkMode: boolean
  }
  
  export interface SecuritySettingsModalProps {
    visible: boolean
    onClose: () => void
    isDarkMode: boolean
    onChangePassword: () => void
    onPrivacyPolicy: () => void
    onSecuritySettings: () => void
  }
  
  export interface NotificationSettingsModalProps {
    visible: boolean
    onClose: () => void
    isDarkMode: boolean
    notificationSettings: NotificationSettings
    onToggleNotification: (key: keyof NotificationSettings) => void
  }
  