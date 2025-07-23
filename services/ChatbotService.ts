export interface ChatMessage {
  id: string;
  message: string;
  isUser: boolean;
  timestamp: Date;
  car_ids?: number[];
}

export interface ChatbotAPIResponse {
  success: boolean;
  data?: {
    message: string;
    car_ids: number[];
  };
  error?: string;
  message?: string;
}

/**
 * Service for chatbot communication and message management
 */
export class ChatbotService {
  // Configure your AI backend URL here
  private static readonly API_BASE_URL = 'https://ai-python-ashy.vercel.app/'; // <-- PUT YOUR API URL HERE
  
  // Store conversation history in memory (in production, you might want to use AsyncStorage)
  private static conversationHistory: ChatMessage[] = [];
  
  /**
   * Get the full conversation history
   */
  static getConversationHistory(): ChatMessage[] {
    return [...this.conversationHistory];
  }
  
  /**
   * Clear conversation history
   */
  static clearConversationHistory(): void {
    this.conversationHistory = [];
  }
  
  /**
   * Add a message to conversation history
   */
  static addMessage(message: string, isUser: boolean, car_ids?: number[]): ChatMessage {
    const chatMessage: ChatMessage = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      message,
      isUser,
      timestamp: new Date(),
      car_ids
    };
    
    this.conversationHistory.push(chatMessage);
    return chatMessage;
  }
  
  /**
   * Send message to chatbot and get response
   */
  static async sendMessage(userMessage: string): Promise<{
    success: boolean;
    userMessage: ChatMessage;
    botMessage?: ChatMessage;
    error?: string;
  }> {
    try {
      console.log('🤖 Sending message to chatbot API...');
      
      // Add user message to history first
      const userChatMessage = this.addMessage(userMessage, true);
      
      // Call chatbot API
      const response = await fetch(`${this.API_BASE_URL}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: userMessage
        }),
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status} ${response.statusText}`);
      }

      const apiResult: ChatbotAPIResponse = await response.json();
      
      if (!apiResult.success || !apiResult.data) {
        throw new Error(apiResult.error || 'Chatbot API failed');
      }

      console.log('✅ Chatbot response received successfully');

      // Add bot response to history
      const botMessage = this.addMessage(
        apiResult.data.message, 
        false, 
        apiResult.data.car_ids
      );

      return {
        success: true,
        userMessage: userChatMessage,
        botMessage,
      };

    } catch (error) {
      console.error('❌ Chatbot API call failed:', error);
      
      // Add error response to history
      const errorMessage = `Sorry, I'm having trouble connecting to the chatbot service. Please try again later. Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
      const botMessage = this.addMessage(errorMessage, false);
      
      return {
        success: false,
        userMessage: this.addMessage(userMessage, true),
        botMessage,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
  
  /**
   * Send conversation context to chatbot (for stateful conversations)
   * This sends the entire conversation history for context
   */
  static async sendMessageWithContext(userMessage: string): Promise<{
    success: boolean;
    userMessage: ChatMessage;
    botMessage?: ChatMessage;
    error?: string;
  }> {
    try {
      console.log('🤖 Sending message with conversation context...');
      
      // Add user message to history first
      const userChatMessage = this.addMessage(userMessage, true);
      
      // Prepare conversation history for the new API format
      const conversationHistory = (this.conversationHistory || [])
        .slice(-10) // Only send last 10 messages to avoid token limits
        .map(msg => ({
          role: msg.isUser ? 'user' : 'assistant',
          content: msg.message
        }));
      
      const contextualMessage = conversationHistory.length > 0 
        ? `Conversation context:\n${conversationHistory.map(msg => `${msg.role}: ${msg.content}`).join('\n')}\n\nCurrent message: ${userMessage}`
        : userMessage;
      
      // Call chatbot API with context
      const response = await fetch(`${this.API_BASE_URL}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: contextualMessage
        }),
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status} ${response.statusText}`);
      }

      const apiResult: ChatbotAPIResponse = await response.json();
      
      if (!apiResult.success || !apiResult.data) {
        throw new Error(apiResult.error || 'Chatbot API failed');
      }

      console.log('✅ Contextual chatbot response received successfully');

      // Add bot response to history
      const botMessage = this.addMessage(
        apiResult.data.message, 
        false, 
        apiResult.data.car_ids
      );

      return {
        success: true,
        userMessage: userChatMessage,
        botMessage,
      };

    } catch (error) {
      console.error('❌ Contextual chatbot API call failed:', error);
      
      // Add error response to history
      const errorMessage = `Sorry, I'm having trouble connecting to the chatbot service. Please try again later. Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
      const botMessage = this.addMessage(errorMessage, false);
      
      return {
        success: false,
        userMessage: this.addMessage(userMessage, true),
        botMessage,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
  
  /**
   * Export conversation history for debugging or saving
   */
  static exportConversation(): string {
    const conversation = this.conversationHistory
      .map(msg => {
        const timestamp = msg.timestamp.toLocaleString();
        const sender = msg.isUser ? 'User' : 'Bot';
        const carIds = msg.car_ids && msg.car_ids.length > 0 ? ` [Car IDs: ${msg.car_ids.join(', ')}]` : '';
        return `[${timestamp}] ${sender}: ${msg.message}${carIds}`;
      })
      .join('\n\n');
    
    return conversation;
  }
  
  /**
   * Get conversation statistics
   */
  static getConversationStats(): {
    totalMessages: number;
    userMessages: number;
    botMessages: number;
    carsRecommended: number;
    uniqueCarIds: number[];
  } {
    const userMessages = this.conversationHistory.filter(msg => msg.isUser).length;
    const botMessages = this.conversationHistory.filter(msg => !msg.isUser).length;
    
    const allCarIds = this.conversationHistory
      .filter(msg => msg.car_ids && msg.car_ids.length > 0)
      .flatMap(msg => msg.car_ids || []);
    
    const uniqueCarIds = [...new Set(allCarIds)];
    
    return {
      totalMessages: this.conversationHistory.length,
      userMessages,
      botMessages,
      carsRecommended: allCarIds.length,
      uniqueCarIds
    };
  }
} 