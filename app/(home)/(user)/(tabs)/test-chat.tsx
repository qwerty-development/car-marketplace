import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/utils/ThemeContext';
import { ChatbotService, ChatMessage } from '@/services/ChatbotService';

export default function TestChatScreen() {
  const { isDarkMode } = useTheme();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);

  // Load conversation history on component mount
  useEffect(() => {
    const history = ChatbotService.getConversationHistory();
    setMessages(history);
  }, []);

  // Auto-scroll to bottom when new messages are added
  useEffect(() => {
    scrollViewRef.current?.scrollToEnd({ animated: true });
  }, [messages]);

  const sendMessage = async () => {
    if (!inputText.trim() || isLoading) return;

    const messageText = inputText.trim();
    setInputText('');
    setIsLoading(true);

    try {
      const result = await ChatbotService.sendMessageWithContext(messageText);
      
      // Update messages with the latest history
      const updatedHistory = ChatbotService.getConversationHistory();
      setMessages(updatedHistory);

      if (!result.success && result.error) {
        // Show error alert but keep the error message in chat
        Alert.alert('Connection Error', 'There was an issue connecting to the chatbot service.');
      }
    } catch (error) {
      console.error('Error sending message:', error);
      Alert.alert('Error', 'Failed to send message. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const clearConversation = () => {
    Alert.alert(
      'Clear Conversation',
      'Are you sure you want to clear all messages?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: () => {
            ChatbotService.clearConversationHistory();
            setMessages([]);
          },
        },
      ]
    );
  };

  const showStats = () => {
    const stats = ChatbotService.getConversationStats();
    Alert.alert(
      'Conversation Stats',
      `Total Messages: ${stats.totalMessages}
User Messages: ${stats.userMessages}
Bot Messages: ${stats.botMessages}
Cars Recommended: ${stats.carsRecommended}
Unique Car IDs: ${stats.uniqueCarIds.length}

Car IDs: ${stats.uniqueCarIds.join(', ') || 'None'}`
    );
  };

  const exportConversation = () => {
    const exported = ChatbotService.exportConversation();
    console.log('Exported Conversation:', exported);
    Alert.alert(
      'Conversation Exported',
      'Conversation has been exported to console. Check your development console to view it.'
    );
  };

  const renderMessage = (message: ChatMessage, index: number) => {
    const isUser = message.isUser;
    const messageStyle = isUser ? styles.userMessage : styles.botMessage;
    const bubbleStyle = isUser 
      ? [styles.userBubble, { backgroundColor: '#D55004' }]
      : [styles.botBubble, { backgroundColor: isDarkMode ? '#333' : '#f0f0f0' }];

    return (
      <View key={message.id} style={[styles.messageContainer, messageStyle]}>
        <View style={bubbleStyle}>
          <Text style={[
            styles.messageText,
            { color: isUser ? 'white' : (isDarkMode ? 'white' : 'black') }
          ]}>
            {message.message}
          </Text>
          {message.car_ids && message.car_ids.length > 0 && (
            <View style={styles.carIdsContainer}>
              <Text style={[
                styles.carIdsText,
                { color: isUser ? 'rgba(255,255,255,0.8)' : (isDarkMode ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)') }
              ]}>
                🚗 Car IDs: {message.car_ids.join(', ')}
              </Text>
            </View>
          )}
          <Text style={[
            styles.timestamp,
            { color: isUser ? 'rgba(255,255,255,0.7)' : (isDarkMode ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)') }
          ]}>
            {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: isDarkMode ? '#121212' : '#ffffff' }]}>
      <KeyboardAvoidingView 
        style={styles.keyboardContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={100}
      >
        {/* Header */}
        <View style={[styles.header, { backgroundColor: isDarkMode ? '#1a1a1a' : '#f8f8f8' }]}>
          <Text style={[styles.headerTitle, { color: isDarkMode ? 'white' : 'black' }]}>
            🤖 AI Chatbot Test
          </Text>
          <View style={styles.headerButtons}>
            <TouchableOpacity onPress={showStats} style={styles.headerButton}>
              <Ionicons name="stats-chart" size={20} color="#D55004" />
            </TouchableOpacity>
            <TouchableOpacity onPress={exportConversation} style={styles.headerButton}>
              <Ionicons name="download" size={20} color="#D55004" />
            </TouchableOpacity>
            <TouchableOpacity onPress={clearConversation} style={styles.headerButton}>
              <Ionicons name="trash" size={20} color="#D55004" />
            </TouchableOpacity>
          </View>
        </View>

        {/* API Configuration Notice */}
        <View style={[styles.apiNotice, { backgroundColor: isDarkMode ? '#2a2a2a' : '#e8f4fd' }]}>
          <Text style={[styles.apiNoticeText, { color: isDarkMode ? '#87CEEB' : '#0066cc' }]}>
            💡 API URL configured in: services/ChatbotService.ts (Line 25)
          </Text>
        </View>

        {/* Messages */}
        <ScrollView
          ref={scrollViewRef}
          style={styles.messagesContainer}
          contentContainerStyle={styles.messagesContent}
          showsVerticalScrollIndicator={false}
        >
          {messages.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="chatbubbles-outline" size={48} color={isDarkMode ? '#666' : '#ccc'} />
              <Text style={[styles.emptyText, { color: isDarkMode ? '#666' : '#999' }]}>
                Start a conversation with the AI chatbot!
              </Text>
              <Text style={[styles.emptySubtext, { color: isDarkMode ? '#555' : '#bbb' }]}>
                Try asking: "Show me BMW cars under $30,000"
              </Text>
            </View>
          ) : (
            messages.map((message, index) => renderMessage(message, index))
          )}
          
          {isLoading && (
            <View style={[styles.messageContainer, styles.botMessage]}>
              <View style={[styles.botBubble, { backgroundColor: isDarkMode ? '#333' : '#f0f0f0' }]}>
                <ActivityIndicator size="small" color="#D55004" />
                <Text style={[styles.loadingText, { color: isDarkMode ? 'white' : 'black' }]}>
                  AI is thinking...
                </Text>
              </View>
            </View>
          )}
        </ScrollView>

        {/* Input */}
        <View style={[styles.inputContainer, { backgroundColor: isDarkMode ? '#1a1a1a' : '#f8f8f8' }]}>
          <TextInput
            style={[
              styles.textInput,
              { 
                backgroundColor: isDarkMode ? '#2a2a2a' : 'white',
                color: isDarkMode ? 'white' : 'black',
                borderColor: isDarkMode ? '#444' : '#ddd'
              }
            ]}
            value={inputText}
            onChangeText={setInputText}
            placeholder="Type your message..."
            placeholderTextColor={isDarkMode ? '#666' : '#999'}
            multiline
            maxLength={500}
            editable={!isLoading}
            onSubmitEditing={sendMessage}
            blurOnSubmit={false}
          />
          <TouchableOpacity
            style={[
              styles.sendButton,
              { 
                backgroundColor: (inputText.trim() && !isLoading) ? '#D55004' : (isDarkMode ? '#444' : '#ccc')
              }
            ]}
            onPress={sendMessage}
            disabled={!inputText.trim() || isLoading}
          >
            <Ionicons 
              name="send" 
              size={20} 
              color={(inputText.trim() && !isLoading) ? 'white' : (isDarkMode ? '#666' : '#999')} 
            />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardContainer: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  headerButtons: {
    flexDirection: 'row',
  },
  headerButton: {
    marginLeft: 16,
    padding: 4,
  },
  apiNotice: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 8,
  },
  apiNoticeText: {
    fontSize: 12,
    fontWeight: '500',
  },
  messagesContainer: {
    flex: 1,
    paddingHorizontal: 16,
  },
  messagesContent: {
    paddingVertical: 16,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '500',
    marginTop: 16,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  messageContainer: {
    marginVertical: 4,
  },
  userMessage: {
    alignItems: 'flex-end',
  },
  botMessage: {
    alignItems: 'flex-start',
  },
  userBubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 18,
    borderBottomRightRadius: 4,
  },
  botBubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 18,
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 20,
  },
  carIdsContainer: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.2)',
  },
  carIdsText: {
    fontSize: 12,
    fontWeight: '500',
  },
  timestamp: {
    fontSize: 11,
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  loadingText: {
    fontSize: 14,
    marginLeft: 8,
    fontStyle: 'italic',
  },
  inputContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: 'flex-end',
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
  },
  textInput: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 16,
    marginRight: 8,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
}); 