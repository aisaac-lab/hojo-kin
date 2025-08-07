/**
 * Thread Pool Manager for OpenAI Assistant threads
 * Pre-creates threads and manages their lifecycle for better performance
 */

import type { AssistantService } from '~/services/assistant.service';

interface PooledThread {
  id: string;
  userId: string | null;
  inUse: boolean;
  createdAt: number;
  lastUsedAt: number;
  messageCount: number;
}

export class ThreadPoolManager {
  private pool: Map<string, PooledThread> = new Map();
  private readonly maxPoolSize: number;
  private readonly maxThreadAge: number; // in milliseconds
  private readonly maxMessagesPerThread: number;
  private assistantService: AssistantService | null = null;

  constructor(
    maxPoolSize = 10,
    maxThreadAgeMinutes = 30,
    maxMessagesPerThread = 20
  ) {
    this.maxPoolSize = maxPoolSize;
    this.maxThreadAge = maxThreadAgeMinutes * 60 * 1000;
    this.maxMessagesPerThread = maxMessagesPerThread;
  }

  /**
   * Initialize the pool with pre-created threads
   */
  async initialize(assistantService: AssistantService): Promise<void> {
    this.assistantService = assistantService;
    
    // Pre-create initial threads
    const initialPoolSize = Math.min(3, this.maxPoolSize);
    const promises = [];
    
    for (let i = 0; i < initialPoolSize; i++) {
      promises.push(this.createNewThread());
    }
    
    await Promise.all(promises);
    console.log(`[ThreadPool] Initialized with ${initialPoolSize} threads`);
    
    // Set up periodic cleanup
    setInterval(() => this.cleanup(), 5 * 60 * 1000); // Every 5 minutes
  }

  /**
   * Get an available thread from the pool or create a new one
   */
  async getThread(userId?: string): Promise<string> {
    if (!this.assistantService) {
      throw new Error('ThreadPool not initialized');
    }

    // Try to find an available thread
    for (const [threadId, thread] of this.pool.entries()) {
      if (!thread.inUse && this.isThreadValid(thread)) {
        // Reuse this thread
        thread.inUse = true;
        thread.userId = userId || null;
        thread.lastUsedAt = Date.now();
        
        console.log(`[ThreadPool] Reusing thread ${threadId} for user ${userId}`);
        return threadId;
      }
    }

    // No available thread, create a new one if pool not full
    if (this.pool.size < this.maxPoolSize) {
      const threadId = await this.createNewThread(userId);
      return threadId;
    }

    // Pool is full, clean up old threads and try again
    await this.cleanup();
    
    // If still no space, forcibly recycle the oldest thread
    const oldestThread = this.findOldestThread();
    if (oldestThread) {
      console.log(`[ThreadPool] Recycling oldest thread ${oldestThread.id}`);
      oldestThread.inUse = true;
      oldestThread.userId = userId || null;
      oldestThread.lastUsedAt = Date.now();
      oldestThread.messageCount = 0;
      return oldestThread.id;
    }

    // Last resort: create new thread anyway
    const threadId = await this.createNewThread(userId);
    return threadId;
  }

  /**
   * Release a thread back to the pool
   */
  releaseThread(threadId: string, messageCount: number = 1): void {
    const thread = this.pool.get(threadId);
    if (thread) {
      thread.inUse = false;
      thread.messageCount += messageCount;
      thread.lastUsedAt = Date.now();
      
      console.log(
        `[ThreadPool] Released thread ${threadId}, ` +
        `total messages: ${thread.messageCount}`
      );
      
      // Check if thread should be recycled
      if (!this.isThreadValid(thread)) {
        this.pool.delete(threadId);
        console.log(`[ThreadPool] Removed invalid thread ${threadId}`);
        
        // Create replacement thread asynchronously
        this.createNewThread().catch(console.error);
      }
    }
  }

  /**
   * Create a new thread and add to pool
   */
  private async createNewThread(userId?: string): Promise<string> {
    if (!this.assistantService) {
      throw new Error('ThreadPool not initialized');
    }

    const thread = await this.assistantService.createThread(userId || 'pool');
    const pooledThread: PooledThread = {
      id: thread.id,
      userId: userId || null,
      inUse: true,
      createdAt: Date.now(),
      lastUsedAt: Date.now(),
      messageCount: 0,
    };
    
    this.pool.set(thread.id, pooledThread);
    console.log(`[ThreadPool] Created new thread ${thread.id}`);
    
    return thread.id;
  }

  /**
   * Check if a thread is still valid for use
   */
  private isThreadValid(thread: PooledThread): boolean {
    const age = Date.now() - thread.createdAt;
    return (
      age < this.maxThreadAge &&
      thread.messageCount < this.maxMessagesPerThread
    );
  }

  /**
   * Find the oldest unused thread
   */
  private findOldestThread(): PooledThread | null {
    let oldest: PooledThread | null = null;
    
    for (const thread of this.pool.values()) {
      if (!thread.inUse) {
        if (!oldest || thread.lastUsedAt < oldest.lastUsedAt) {
          oldest = thread;
        }
      }
    }
    
    return oldest;
  }

  /**
   * Clean up old or invalid threads
   */
  private async cleanup(): Promise<void> {
    const toRemove: string[] = [];
    
    for (const [threadId, thread] of this.pool.entries()) {
      if (!thread.inUse && !this.isThreadValid(thread)) {
        toRemove.push(threadId);
      }
    }
    
    for (const threadId of toRemove) {
      this.pool.delete(threadId);
    }
    
    if (toRemove.length > 0) {
      console.log(`[ThreadPool] Cleaned up ${toRemove.length} threads`);
      
      // Maintain minimum pool size
      const currentSize = this.pool.size;
      const minSize = Math.min(3, this.maxPoolSize);
      
      if (currentSize < minSize) {
        const toCreate = minSize - currentSize;
        const promises = [];
        
        for (let i = 0; i < toCreate; i++) {
          promises.push(this.createNewThread().catch(console.error));
        }
        
        await Promise.all(promises);
      }
    }
  }

  /**
   * Get pool statistics
   */
  getStats(): {
    totalThreads: number;
    inUse: number;
    available: number;
    avgMessageCount: number;
    avgAge: number;
  } {
    const threads = Array.from(this.pool.values());
    const now = Date.now();
    
    const inUse = threads.filter(t => t.inUse).length;
    const totalMessages = threads.reduce((sum, t) => sum + t.messageCount, 0);
    const totalAge = threads.reduce((sum, t) => sum + (now - t.createdAt), 0);
    
    return {
      totalThreads: threads.length,
      inUse,
      available: threads.length - inUse,
      avgMessageCount: threads.length > 0 ? totalMessages / threads.length : 0,
      avgAge: threads.length > 0 ? totalAge / threads.length / 1000 : 0, // in seconds
    };
  }
}

// Singleton instance
let threadPool: ThreadPoolManager | null = null;

export function getThreadPool(): ThreadPoolManager {
  if (!threadPool) {
    threadPool = new ThreadPoolManager(
      parseInt(process.env.THREAD_POOL_SIZE || '10'),
      parseInt(process.env.THREAD_MAX_AGE_MINUTES || '30'),
      parseInt(process.env.THREAD_MAX_MESSAGES || '20')
    );
  }
  return threadPool;
}