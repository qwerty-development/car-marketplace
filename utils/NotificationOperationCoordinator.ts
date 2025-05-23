// utils/NotificationOperationCoordinator.ts

export class NotificationOperationCoordinator {
    private static instance: NotificationOperationCoordinator;
    private activeOperations: Map<string, AbortController> = new Map();
    private operationQueues: Map<string, Promise<any>> = new Map();
    private verificationDebounceTimers: Map<string, NodeJS.Timeout> = new Map();
    
    // Configuration
    private static readonly CONFIG = {
      VERIFICATION_DEBOUNCE_MS: 1000, // 1 second
      OPERATION_TIMEOUT_MS: 30000, // 30 seconds
      MAX_CONCURRENT_OPERATIONS: 3,
    } as const;
  
    private constructor() {}
  
    public static getInstance(): NotificationOperationCoordinator {
      if (!NotificationOperationCoordinator.instance) {
        NotificationOperationCoordinator.instance = new NotificationOperationCoordinator();
      }
      return NotificationOperationCoordinator.instance;
    }
  
    /**
     * RULE 1: Execute operations with automatic cancellation of previous attempts
     * 
     * @param operationKey - Unique identifier for the operation type
     * @param operation - Async operation to execute
     * @returns Promise resolving to operation result
     */
    public async executeExclusive<T>(
      operationKey: string,
      operation: (signal: AbortSignal) => Promise<T>
    ): Promise<T> {
      // Cancel any existing operation with the same key
      this.cancelOperation(operationKey);
  
      // Create new abort controller
      const abortController = new AbortController();
      this.activeOperations.set(operationKey, abortController);
  
      try {
        // Create operation with timeout
        const timeoutId = setTimeout(() => {
          abortController.abort(new Error('Operation timeout'));
        }, NotificationOperationCoordinator.CONFIG.OPERATION_TIMEOUT_MS);
  
        const result = await operation(abortController.signal);
        
        clearTimeout(timeoutId);
        return result;
      } finally {
        // Clean up
        this.activeOperations.delete(operationKey);
      }
    }
  
    /**
     * RULE 2: Queue operations to prevent concurrent execution
     * 
     * @param queueKey - Queue identifier (e.g., user ID)
     * @param operation - Async operation to queue
     * @returns Promise resolving to operation result
     */
    public async queueOperation<T>(
      queueKey: string,
      operation: () => Promise<T>
    ): Promise<T> {
      // Wait for any existing operation in the queue
      const existingOperation = this.operationQueues.get(queueKey);
      
      if (existingOperation) {
        // Wait for existing operation to complete (ignore its result/error)
        await existingOperation.catch(() => {});
      }
  
      // Create and store new operation promise
      const operationPromise = operation();
      this.operationQueues.set(queueKey, operationPromise);
  
      try {
        const result = await operationPromise;
        return result;
      } finally {
        // Remove from queue when complete
        if (this.operationQueues.get(queueKey) === operationPromise) {
          this.operationQueues.delete(queueKey);
        }
      }
    }
  
    /**
     * RULE 3: Debounce rapid verification requests
     * 
     * @param userId - User identifier
     * @param verificationFn - Verification function to debounce
     * @returns Promise resolving when verification completes
     */
    public async debounceVerification(
      userId: string,
      verificationFn: () => Promise<any>
    ): Promise<any> {
      const debounceKey = `verify_${userId}`;
      
      return new Promise((resolve, reject) => {
        // Clear existing timer
        const existingTimer = this.verificationDebounceTimers.get(debounceKey);
        if (existingTimer) {
          clearTimeout(existingTimer);
        }
  
        // Set new timer
        const timer = setTimeout(async () => {
          try {
            const result = await verificationFn();
            resolve(result);
          } catch (error) {
            reject(error);
          } finally {
            this.verificationDebounceTimers.delete(debounceKey);
          }
        }, NotificationOperationCoordinator.CONFIG.VERIFICATION_DEBOUNCE_MS);
  
        this.verificationDebounceTimers.set(debounceKey, timer);
      });
    }
  
    /**
     * RULE 4: Cancel operation and clean up resources
     * 
     * @param operationKey - Operation to cancel
     */
    public cancelOperation(operationKey: string): void {
      const controller = this.activeOperations.get(operationKey);
      
      if (controller) {
        controller.abort(new Error('Operation cancelled'));
        this.activeOperations.delete(operationKey);
      }
    }
  
    /**
     * RULE 5: Check if operation can be aborted
     * 
     * @param signal - AbortSignal to check
     * @throws Error if operation was aborted
     */
    public static checkAborted(signal: AbortSignal): void {
      if (signal.aborted) {
        throw new Error('Operation was aborted');
      }
    }
  
    /**
     * RULE 6: Clean up all resources
     */
    public cleanup(): void {
      // Cancel all active operations
      for (const [key, controller] of this.activeOperations) {
        controller.abort(new Error('Cleanup'));
      }
      this.activeOperations.clear();
  
      // Clear all queues
      this.operationQueues.clear();
  
      // Clear all timers
      for (const timer of this.verificationDebounceTimers.values()) {
        clearTimeout(timer);
      }
      this.verificationDebounceTimers.clear();
    }
  
    /**
     * RULE 7: Get operation status
     */
    public getStatus(): {
      activeOperations: number;
      queuedOperations: number;
      pendingVerifications: number;
    } {
      return {
        activeOperations: this.activeOperations.size,
        queuedOperations: this.operationQueues.size,
        pendingVerifications: this.verificationDebounceTimers.size,
      };
    }
  }
  
  // Export singleton instance
  export const notificationCoordinator = NotificationOperationCoordinator.getInstance();