import { Platform } from 'react-native';

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
  // Configure your AI backend URL here (remove trailing slash for iOS compatibility)
  private static readonly API_BASE_URL = 'https://ai-python-ashy.vercel.app';
  private static readonly REQUEST_TIMEOUT = 30000; // 30 seconds
  
  // Store conversation history in memory (in production, you might want to use AsyncStorage)
  private static conversationHistory: ChatMessage[] = [];
  
  /**
   * Create an AbortController for request timeout
   */
  private static createTimeoutController(): AbortController {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), this.REQUEST_TIMEOUT);
    return controller;
  }
  
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
   * Send message to chatbot and get response with improved error handling
   */
  static async sendMessage(userMessage: string): Promise<{
    success: boolean;
    userMessage: ChatMessage;
    botMessage?: ChatMessage;
    error?: string;
  }> {
    console.log('🔍 iOS Debug - Starting sendMessage function');
    
    // Input validation
    if (!userMessage?.trim()) {
      console.log('❌ iOS Debug - Empty message detected');
      return {
        success: false,
        userMessage: this.addMessage(userMessage, true),
        error: 'Empty message'
      };
    }

    console.log('🔍 iOS Debug - Message validation passed:', userMessage.trim());
    
    try {
      console.log('🤖 Sending message to chatbot API...');
      console.log('🔍 iOS Debug - API URL:', this.API_BASE_URL);
      
      // Add user message to history first
      const userChatMessage = this.addMessage(userMessage.trim(), true);
      console.log('🔍 iOS Debug - User message added to history');
      
      // Prepare request body
      const requestBody = JSON.stringify({
        message: userMessage.trim()
      });
      console.log('🔍 iOS Debug - Request body:', requestBody);
      
      // iOS-specific fetch implementation
      console.log('🔍 iOS Debug - About to make fetch request...');
      
      // Create fetch options with iOS-safe configuration
      const fetchOptions = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: requestBody,
      };
      
      console.log('🔍 iOS Debug - Fetch options:', JSON.stringify(fetchOptions, null, 2));
      
      let response: Response;
      
      try {
        // Try with minimal configuration first
        console.log('🔍 iOS Debug - Making fetch call...');
        response = await fetch(`${this.API_BASE_URL}/chat`, fetchOptions);
        console.log('🔍 iOS Debug - Fetch call completed successfully');
      } catch (fetchError) {
        console.error('❌ iOS Debug - Fetch call failed:', fetchError);
        
        // Try alternative approach for iOS
        console.log('🔍 iOS Debug - Trying alternative fetch approach...');
        try {
          response = await fetch(`${this.API_BASE_URL}/chat`, {
            method: 'POST',
            body: requestBody,
            headers: new Headers({
              'Content-Type': 'application/json',
            }),
          });
          console.log('🔍 iOS Debug - Alternative fetch succeeded');
        } catch (altError) {
          console.error('❌ iOS Debug - Alternative fetch also failed:', altError);
          throw new Error(`Fetch failed: ${altError instanceof Error ? altError.message : 'Unknown fetch error'}`);
        }
      }

      console.log('🔍 iOS Debug - Fetch completed, response status:', response.status);
      console.log('🔍 iOS Debug - Response ok:', response.ok);
      console.log('🔍 iOS Debug - Response headers:', JSON.stringify(response.headers));

      // Check if response is ok
      if (!response.ok) {
        console.log('❌ iOS Debug - Response not ok, attempting to read error text...');
        let errorText = 'Unknown error';
        try {
          errorText = await response.text();
          console.log('🔍 iOS Debug - Error response text:', errorText);
        } catch (textError) {
          console.log('❌ iOS Debug - Failed to read error text:', textError);
        }
        throw new Error(`API request failed: ${response.status} ${response.statusText}. ${errorText}`);
      }

      // Parse JSON response with error handling
      console.log('🔍 iOS Debug - About to read response text...');
      const responseText = await response.text();
      console.log('🔍 iOS Debug - Response text received, length:', responseText.length);
      console.log('🔍 iOS Debug - Response text preview:', responseText.substring(0, 200));
      
      let apiResult: ChatbotAPIResponse;
      try {
        console.log('🔍 iOS Debug - About to parse JSON...');
        apiResult = JSON.parse(responseText);
        console.log('🔍 iOS Debug - JSON parsed successfully:', apiResult);
      } catch (parseError) {
        console.error('❌ iOS Debug - JSON parse error:', parseError);
        console.log('🔍 iOS Debug - Raw response that failed to parse:', responseText);
        throw new Error('Invalid JSON response from server');
      }
      
      // Validate API response structure
      console.log('🔍 iOS Debug - Validating API response structure...');
      if (!apiResult || typeof apiResult.success !== 'boolean') {
        console.log('❌ iOS Debug - Invalid API response format:', apiResult);
        throw new Error('Invalid API response format');
      }
      
      if (!apiResult.success || !apiResult.data) {
        console.log('❌ iOS Debug - API returned error:', apiResult.error || apiResult.message);
        throw new Error(apiResult.error || apiResult.message || 'Chatbot API failed');
      }

      // Validate response data
      if (!apiResult.data.message || typeof apiResult.data.message !== 'string') {
        console.log('❌ iOS Debug - Invalid message in API response:', apiResult.data);
        throw new Error('Invalid message in API response');
      }

      console.log('✅ Chatbot response received successfully');
      console.log('🔍 iOS Debug - Bot message:', apiResult.data.message);

      // Add bot response to history
      const botMessage = this.addMessage(
        apiResult.data.message, 
        false, 
        Array.isArray(apiResult.data.car_ids) ? apiResult.data.car_ids : []
      );

      console.log('🔍 iOS Debug - Bot message added to history, returning success');

      return {
        success: true,
        userMessage: userChatMessage,
        botMessage,
      };

    } catch (error) {
      console.error('❌ Chatbot API call failed:', error);
      console.log('🔍 iOS Debug - Error details:', {
        name: error instanceof Error ? error.name : 'Unknown',
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : 'No stack trace'
      });
      
      let errorMessage = 'Sorry, I\'m having trouble connecting to the chatbot service. Please try again later.';
      
      // Provide more specific error messages
      if (error instanceof Error) {
        console.log('🔍 iOS Debug - Error is instance of Error');
        if (error.name === 'AbortError' || error.message.includes('timeout')) {
          errorMessage = 'The request timed out. Please check your internet connection and try again.';
          console.log('🔍 iOS Debug - Timeout error detected');
        } else if (error.message.includes('Network request failed') || error.message.includes('fetch')) {
          errorMessage = 'Network connection failed. Please check your internet connection.';
          console.log('🔍 iOS Debug - Network error detected');
        } else if (error.message.includes('JSON')) {
          errorMessage = 'Received invalid response from server. Please try again.';
          console.log('🔍 iOS Debug - JSON error detected');
        }
      }
      
      console.log('🔍 iOS Debug - Adding error message to chat:', errorMessage);
      
      // Add error response to history
      const botMessage = this.addMessage(errorMessage, false);
      
      return {
        success: false,
        userMessage: this.addMessage(userMessage.trim(), true),
        botMessage,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
  
  /**
   * iOS-specific sendMessage with XMLHttpRequest fallback
   */
  static async sendMessageIOS(userMessage: string): Promise<{
    success: boolean;
    userMessage: ChatMessage;
    botMessage?: ChatMessage;
    error?: string;
  }> {
    console.log('🍎 iOS-specific sendMessage starting...');
    
    // Input validation
    if (!userMessage?.trim()) {
      return {
        success: false,
        userMessage: this.addMessage(userMessage, true),
        error: 'Empty message'
      };
    }

    try {
      const userChatMessage = this.addMessage(userMessage.trim(), true);
      console.log('🍎 iOS - User message added to history');
      
      // Use XMLHttpRequest for iOS compatibility
      const response = await new Promise<{success: boolean, data?: any, error?: string}>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        
        xhr.open('POST', `${this.API_BASE_URL}/chat`, true);
        xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.setRequestHeader('Accept', 'application/json');
        
        xhr.timeout = this.REQUEST_TIMEOUT;
        
        xhr.onload = function() {
          console.log('🍎 iOS XHR - Response received, status:', xhr.status);
          try {
            if (xhr.status >= 200 && xhr.status < 300) {
              const result = JSON.parse(xhr.responseText);
              console.log('🍎 iOS XHR - Parsed response:', result);
              resolve(result);
            } else {
              reject(new Error(`XHR request failed: ${xhr.status}`));
            }
          } catch (parseError) {
            reject(new Error('Failed to parse XHR response'));
          }
        };
        
        xhr.onerror = function() {
          console.error('🍎 iOS XHR - Network error');
          reject(new Error('XHR network error'));
        };
        
        xhr.ontimeout = function() {
          console.error('🍎 iOS XHR - Timeout');
          reject(new Error('XHR timeout'));
        };
        
        const requestData = JSON.stringify({ message: userMessage.trim() });
        console.log('🍎 iOS XHR - Sending request:', requestData);
        xhr.send(requestData);
      });
      
      console.log('🍎 iOS XHR - Request completed successfully');
      
      if (!response.success || !response.data) {
        throw new Error(response.error || 'API returned error');
      }
      
      const botMessage = this.addMessage(
        response.data.message, 
        false, 
        Array.isArray(response.data.car_ids) ? response.data.car_ids : []
      );

      return {
        success: true,
        userMessage: userChatMessage,
        botMessage,
      };
      
    } catch (error) {
      console.error('🍎 iOS sendMessage failed:', error);
      
      const errorMessage = 'Sorry, I\'m having trouble connecting. Please try again.';
      const botMessage = this.addMessage(errorMessage, false);
      
      return {
        success: false,
        userMessage: this.addMessage(userMessage.trim(), true),
        botMessage,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Send conversation context to chatbot with dealership-like memory (last 5 messages)
   */
  static async sendMessageWithContext(userMessage: string): Promise<{
    success: boolean;
    userMessage: ChatMessage;
    botMessage?: ChatMessage;
    error?: string;
  }> {
    // Input validation
    if (!userMessage?.trim()) {
      return {
        success: false,
        userMessage: this.addMessage(userMessage, true),
        error: 'Empty message'
      };
    }

    try {
      console.log('🤖 Sending message with dealership conversation context...');
      
      // Add user message to history first
      const userChatMessage = this.addMessage(userMessage.trim(), true);
      
      // Get last 5 messages for conversation memory (like a dealership conversation)
      const recentMessages = this.conversationHistory
        .slice(-5) // Only last 5 messages for focused context
        .map(msg => ({
          role: msg.isUser ? 'user' : 'assistant',
          content: msg.message
        }));
      
      // Create a dealership-focused prompt with conversation context
      let contextualPrompt = `You are a professional car dealership assistant helping customers find their perfect car. You have access to a comprehensive car database and should provide personalized recommendations.

IMPORTANT INSTRUCTIONS:
- Maintain conversation context and remember what the customer mentioned previously
- Ask follow-up questions to understand their specific needs (budget, car type, features, etc.)
- When recommending cars, provide EXACTLY 5-8 car recommendations maximum
- Focus on matching customer preferences from the conversation
- Be friendly, professional, and helpful like a real dealership salesperson
- If asked about specific features, explain how they benefit the customer

`;

      // Add conversation history if available
      if (recentMessages.length > 0) {
        contextualPrompt += `RECENT CONVERSATION CONTEXT:\n`;
        recentMessages.forEach(msg => {
          contextualPrompt += `${msg.role.toUpperCase()}: ${msg.content}\n`;
        });
        contextualPrompt += `\nCURRENT CUSTOMER MESSAGE: ${userMessage.trim()}\n\n`;
      } else {
        contextualPrompt += `CUSTOMER MESSAGE: ${userMessage.trim()}\n\n`;
      }

      contextualPrompt += `Based on the conversation context above, respond as a helpful car dealership assistant. If recommending cars, provide car_ids in your response data.

Your response should be conversational, reference previous messages when relevant, and help guide the customer toward finding their ideal car.`;

      // Use iOS-specific method based on platform
      let response: Response;
      
      if (Platform.OS === 'ios') {
        // Use XMLHttpRequest for iOS
        const apiResponse = await new Promise<{success: boolean, data?: any, error?: string}>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          
          xhr.open('POST', `${this.API_BASE_URL}/chat`, true);
          xhr.setRequestHeader('Content-Type', 'application/json');
          xhr.setRequestHeader('Accept', 'application/json');
          xhr.timeout = this.REQUEST_TIMEOUT;
          
          xhr.onload = function() {
            try {
              if (xhr.status >= 200 && xhr.status < 300) {
                const result = JSON.parse(xhr.responseText);
                resolve(result);
              } else {
                reject(new Error(`XHR request failed: ${xhr.status}`));
              }
            } catch (parseError) {
              reject(new Error('Failed to parse XHR response'));
            }
          };
          
          xhr.onerror = () => reject(new Error('XHR network error'));
          xhr.ontimeout = () => reject(new Error('XHR timeout'));
          
          xhr.send(JSON.stringify({ message: contextualPrompt }));
        });

        if (!apiResponse.success || !apiResponse.data) {
          throw new Error(apiResponse.error || 'API returned error');
        }

        console.log('✅ Contextual dealership response received successfully (iOS)');

        // Add bot response to history
        const botMessage = this.addMessage(
          apiResponse.data.message, 
          false, 
          Array.isArray(apiResponse.data.car_ids) ? apiResponse.data.car_ids : []
        );

        return {
          success: true,
          userMessage: userChatMessage,
          botMessage,
        };

      } else {
        // Use fetch for Android
        response = await fetch(`${this.API_BASE_URL}/chat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          body: JSON.stringify({
            message: contextualPrompt
          })
        });

        if (!response.ok) {
          const errorText = await response.text().catch(() => 'Unknown error');
          throw new Error(`API request failed: ${response.status} ${response.statusText}. ${errorText}`);
        }

        // Parse JSON response with error handling
        let apiResult: ChatbotAPIResponse;
        try {
          const responseText = await response.text();
          apiResult = JSON.parse(responseText);
        } catch (parseError) {
          throw new Error('Invalid JSON response from server');
        }
        
        if (!apiResult || typeof apiResult.success !== 'boolean') {
          throw new Error('Invalid API response format');
        }
        
        if (!apiResult.success || !apiResult.data) {
          throw new Error(apiResult.error || apiResult.message || 'Chatbot API failed');
        }

        if (!apiResult.data.message || typeof apiResult.data.message !== 'string') {
          throw new Error('Invalid message in API response');
        }

        console.log('✅ Contextual dealership response received successfully (Android)');

        // Add bot response to history
        const botMessage = this.addMessage(
          apiResult.data.message, 
          false, 
          Array.isArray(apiResult.data.car_ids) ? apiResult.data.car_ids : []
        );

        return {
          success: true,
          userMessage: userChatMessage,
          botMessage,
        };
      }

    } catch (error) {
      console.error('❌ Contextual dealership chat failed:', error);
      
      let errorMessage = 'I apologize, but I\'m having trouble connecting to our system right now. Please try again in a moment, and I\'ll be happy to help you find the perfect car.';
      
      if (error instanceof Error) {
        if (error.name === 'AbortError' || error.message.includes('timeout')) {
          errorMessage = 'The connection is taking longer than usual. Please check your internet connection and try again.';
        } else if (error.message.includes('Network request failed') || error.message.includes('fetch')) {
          errorMessage = 'Network connection issue. Please check your internet connection and try again.';
        } else if (error.message.includes('JSON')) {
          errorMessage = 'There was an issue processing the response. Please try again.';
        }
      }
      
      // Add error response to history
      const botMessage = this.addMessage(errorMessage, false);
      
      return {
        success: false,
        userMessage: this.addMessage(userMessage.trim(), true),
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
   * Simple test method to isolate iOS fetch issues
   */
  static async testAPIConnection(): Promise<{
    success: boolean;
    message: string;
    details?: any;
  }> {
    console.log('🧪 Testing API connection...');
    
    try {
      // Test 1: Basic fetch to a reliable endpoint
      console.log('🧪 Test 1: Basic fetch test...');
      const testResponse = await fetch('https://httpbin.org/json', {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        }
      });
      
      if (!testResponse.ok) {
        throw new Error('Basic fetch test failed');
      }
      
      console.log('✅ Basic fetch test passed');
      
      // Test 2: Your API endpoint availability
      console.log('🧪 Test 2: Testing your API endpoint...');
      const apiResponse = await fetch(this.API_BASE_URL, {
        method: 'GET',
      });
      
      console.log('🧪 API endpoint response status:', apiResponse.status);
      
      // Test 3: Simple POST to your API
      console.log('🧪 Test 3: Testing POST to your API...');
      const postResponse = await fetch(`${this.API_BASE_URL}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          message: 'test'
        })
      });
      
      console.log('🧪 POST test response status:', postResponse.status);
      const postText = await postResponse.text();
      console.log('🧪 POST test response text:', postText.substring(0, 200));
      
      return {
        success: true,
        message: 'All API tests passed',
        details: {
          basicFetch: 'OK',
          apiEndpoint: apiResponse.status,
          postTest: postResponse.status
        }
      };
      
    } catch (error) {
      console.error('🧪 API test failed:', error);
      return {
        success: false,
        message: `API test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        details: error
      };
    }
  }

  /**
   * Minimal send message for testing
   */
  static async sendMessageMinimal(userMessage: string): Promise<{
    success: boolean;
    message: string;
    error?: string;
  }> {
    console.log('🧪 Minimal send message test...');
    
    try {
      const response = await fetch(`${this.API_BASE_URL}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: userMessage })
      });
      
      const text = await response.text();
      console.log('🧪 Raw response:', text);
      
      return {
        success: true,
        message: text
      };
      
    } catch (error) {
      console.error('🧪 Minimal test failed:', error);
      return {
        success: false,
        message: 'Failed',
        error: error instanceof Error ? error.message : 'Unknown'
      };
    }
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