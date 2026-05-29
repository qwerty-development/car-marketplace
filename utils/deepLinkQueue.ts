// Shared deep-link queue.
//
// Extracted from app/_layout.tsx so that notification handlers
// (hooks/useNotifications.ts, app/(home)/(user)/notifications.tsx) can feed
// URLs into the SAME battle-tested deep-link pipeline used for real links —
// without creating an import cycle (useNotifications is imported by _layout).
//
// The queue holds URLs until the app marks itself ready, then drains them
// through the processUrl callback (wired to DeepLinkHandler.processDeepLink in
// app/_layout.tsx). This is what makes cold-start notification taps work.

// CRITICAL CLASS: DeepLinkQueue with timeout protection
class DeepLinkQueue {
  private queue: string[] = [];
  private processing = false;
  private readyToProcess = false;
  private processTimeout: NodeJS.Timeout | null = null;
  private processUrlCallback: ((url: string) => Promise<void>) | null = null;
  private onReadyCallback: (() => void) | null = null;

  // METHOD: Add URL to queue
  enqueue(url: string) {
    this.queue.push(url);
    this.processNextIfReady();
  }

  // METHOD: Mark queue as ready
  setReady() {
    this.readyToProcess = true;
    // Notify the host (e.g. InitializationManager) that deep links are ready.
    this.onReadyCallback?.();
    this.processNextIfReady();
  }

  // METHOD: Register a callback fired when the queue becomes ready.
  // app/_layout.tsx wires this to initManager.setReady("deepLinks").
  setOnReadyCallback(callback: () => void) {
    this.onReadyCallback = callback;
  }

  // PRIVATE METHOD: Process next URL if ready
  private async processNextIfReady() {
    if (!this.readyToProcess || this.processing || this.queue.length === 0) {
      return;
    }

    this.processing = true;
    const url = this.queue.shift();

    if (url && this.processUrlCallback) {
      try {
        this.processTimeout = setTimeout(() => {
          console.warn(
            "[DeepLinkQueue] TIMEOUT: Processing timeout, skipping URL:",
            url
          );
          this.processing = false;
          this.processNextIfReady();
        }, 5000);

        await this.processUrlCallback(url);

        if (this.processTimeout) {
          clearTimeout(this.processTimeout);
          this.processTimeout = null;
        }
      } catch (error) {
        console.error("Error processing queued deep link:", error);
      }
    }

    this.processing = false;

    if (this.queue.length > 0) {
      setTimeout(() => this.processNextIfReady(), 100);
    }
  }

  // METHOD: Set URL processing callback
  setProcessUrlCallback(callback: (url: string) => Promise<void>) {
    this.processUrlCallback = callback;
  }
}

export { DeepLinkQueue };

// GLOBAL INSTANCE: Deep link queue (shared by linking + notification handlers)
export const deepLinkQueue = new DeepLinkQueue();

// Convenience helper for notification tap handlers: feed a deep-link URL into
// the same pipeline real links use (auth-gating, canonical routing, ready-queue).
export function enqueueDeepLink(url: string) {
  deepLinkQueue.enqueue(url);
}
