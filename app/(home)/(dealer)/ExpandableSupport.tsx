import React, { useState } from 'react'
import { View, Text, TouchableOpacity, Linking } from 'react-native'
import { Ionicons, Feather } from '@expo/vector-icons'

interface ExpandableSupportProps {
  isDarkMode: boolean
}

const WHATSAPP_NUMBER = '70786818'
const SUPPORT_EMAIL = 'info@fleetapp.com'

export const ExpandableSupport: React.FC<ExpandableSupportProps> = ({ isDarkMode }) => {
  const [isExpanded, setIsExpanded] = useState(false)

  const openWhatsApp = () => {
    const url = `whatsapp://send?phone=${WHATSAPP_NUMBER}`
    Linking.canOpenURL(url).then(supported => {
      if (supported) {
        return Linking.openURL(url)
      } else {
        return Linking.openURL(`https://wa.me/${WHATSAPP_NUMBER}`)
      }
    })
  }

  const openEmail = () => {
    Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=Support Request`)
  }

  return (
    <View className="space-y-2">
      {/* Main Support Button */}
      <TouchableOpacity
        onPress={() => setIsExpanded(!isExpanded)}
        className={`${isDarkMode ? 'bg-neutral-800' : 'bg-white'} 
          p-4 rounded-xl shadow-sm flex-row items-center`}
      >
        <View className="bg-indigo-500/10 p-3 rounded-xl">
          <Ionicons name="help-circle-outline" size={24} color="#D55004" />
        </View>
        <View className="ml-4 flex-1">
          <Text className={`${isDarkMode ? 'text-white' : 'text-black'} font-semibold`}>
            Support & Help
          </Text>
          <Text className={`${isDarkMode ? 'text-white/60' : 'text-gray-500'} text-sm mt-1`}>
            Contact our support team
          </Text>
        </View>
        <Ionicons 
          name={isExpanded ? "chevron-up" : "chevron-down"} 
          size={24} 
          color={isDarkMode ? '#fff' : '#000'} 
        />
      </TouchableOpacity>

      {/* Expandable Contact Options */}
      {isExpanded && (
        <View className="pl-12 space-y-2">
          {/* WhatsApp Option */}
          <TouchableOpacity
            onPress={openWhatsApp}
            className={`${isDarkMode ? 'bg-neutral-800' : 'bg-white'} 
              p-4 rounded-xl flex-row items-center`}
          >
            <View className="bg-green-500/10 p-3 rounded-xl">
              <Feather name="message-circle" size={22} color="#22c55e" />
            </View>
            <View className="ml-4 flex-1">
              <Text className={`${isDarkMode ? 'text-white' : 'text-black'} font-semibold`}>
                WhatsApp Support
              </Text>
              <Text className={`${isDarkMode ? 'text-white/60' : 'text-gray-500'} text-sm mt-1`}>
                Available 24/7
              </Text>
            </View>
            <Ionicons 
              name="chevron-forward" 
              size={20} 
              color={isDarkMode ? '#fff' : '#000'} 
            />
          </TouchableOpacity>

          {/* Email Option */}
          <TouchableOpacity
            onPress={openEmail}
            className={`${isDarkMode ? 'bg-neutral-800' : 'bg-white'} 
              p-4 rounded-xl flex-row items-center`}
          >
            <View className="bg-blue-500/10 p-3 rounded-xl">
              <Feather name="mail" size={22} color="#3b82f6" />
            </View>
            <View className="ml-4 flex-1">
              <Text className={`${isDarkMode ? 'text-white' : 'text-black'} font-semibold`}>
                Email Support
              </Text>
              <Text className={`${isDarkMode ? 'text-white/60' : 'text-gray-500'} text-sm mt-1`}>
                Detailed inquiries
              </Text>
            </View>
            <Ionicons 
              name="chevron-forward" 
              size={20} 
              color={isDarkMode ? '#fff' : '#000'} 
            />
          </TouchableOpacity>
        </View>
      )}
    </View>
  )
}