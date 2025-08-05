/**
 * Common database operation utilities
 */

import { db } from '../db.server';
import { createLogger } from './logger';

const logger = createLogger('Database');

/**
 * Base repository interface for common database operations
 */
export interface BaseRepository<T, CreateInput, UpdateInput> {
  create(data: CreateInput): Promise<T>;
  findMany(where?: any, options?: any): Promise<T[]>;
  findUnique(where: any): Promise<T | null>;
  update(where: any, data: UpdateInput): Promise<T>;
  delete(where: any): Promise<T>;
  count(where?: any): Promise<number>;
}

/**
 * Thread repository
 */
export const threadRepository = {
  async create(data: Prisma.ThreadCreateInput) {
    try {
      logger.debug('Creating thread', { threadId: data.threadId });
      const thread = await db.thread.create({ data });
      logger.info(`Thread created: ${thread.threadId}`);
      return thread;
    } catch (error) {
      logger.error('Failed to create thread', error);
      throw error;
    }
  },

  async findMany(
    where?: Prisma.ThreadWhereInput,
    options?: {
      orderBy?: Prisma.ThreadOrderByWithRelationInput;
      include?: Prisma.ThreadInclude;
      take?: number;
      skip?: number;
    }
  ) {
    try {
      logger.debug('Finding threads', { where });
      const threads = await db.thread.findMany({
        where,
        ...options,
      });
      logger.debug(`Found ${threads.length} threads`);
      return threads;
    } catch (error) {
      logger.error('Failed to find threads', error);
      throw error;
    }
  },

  async findUnique(where: Prisma.ThreadWhereUniqueInput) {
    try {
      logger.debug('Finding thread', { where });
      const thread = await db.thread.findUnique({ where });
      if (thread) {
        logger.debug(`Found thread: ${thread.threadId}`);
      } else {
        logger.debug('Thread not found');
      }
      return thread;
    } catch (error) {
      logger.error('Failed to find thread', error);
      throw error;
    }
  },

  async findUniqueWithMessages(threadId: string) {
    try {
      logger.debug('Finding thread with messages', { threadId });
      const thread = await db.thread.findUnique({
        where: { threadId },
        include: { messages: true },
      });
      if (thread) {
        logger.debug(`Found thread with ${thread.messages.length} messages`);
      }
      return thread;
    } catch (error) {
      logger.error('Failed to find thread with messages', error);
      throw error;
    }
  },

  async update(
    where: Prisma.ThreadWhereUniqueInput,
    data: Prisma.ThreadUpdateInput
  ) {
    try {
      logger.debug('Updating thread', { where });
      const thread = await db.thread.update({ where, data });
      logger.info(`Thread updated: ${thread.threadId}`);
      return thread;
    } catch (error) {
      logger.error('Failed to update thread', error);
      throw error;
    }
  },

  async delete(where: Prisma.ThreadWhereUniqueInput) {
    try {
      logger.debug('Deleting thread', { where });
      const thread = await db.thread.delete({ where });
      logger.info(`Thread deleted: ${thread.threadId}`);
      return thread;
    } catch (error) {
      logger.error('Failed to delete thread', error);
      throw error;
    }
  },

  async count(where?: Prisma.ThreadWhereInput) {
    try {
      logger.debug('Counting threads', { where });
      const count = await db.thread.count({ where });
      logger.debug(`Thread count: ${count}`);
      return count;
    } catch (error) {
      logger.error('Failed to count threads', error);
      throw error;
    }
  },
};

/**
 * Message repository
 */
export const messageRepository = {
  async create(data: Prisma.MessageCreateInput) {
    try {
      logger.debug('Creating message', { role: data.role, threadId: data.threadId });
      const message = await db.message.create({ data });
      logger.info(`Message created in thread ${data.threadId}`);
      return message;
    } catch (error) {
      logger.error('Failed to create message', error);
      throw error;
    }
  },

  async findMany(
    where?: Prisma.MessageWhereInput,
    options?: {
      orderBy?: Prisma.MessageOrderByWithRelationInput;
      take?: number;
      skip?: number;
    }
  ) {
    try {
      logger.debug('Finding messages', { where });
      const messages = await db.message.findMany({
        where,
        ...options,
      });
      logger.debug(`Found ${messages.length} messages`);
      return messages;
    } catch (error) {
      logger.error('Failed to find messages', error);
      throw error;
    }
  },

  async findByThread(threadId: string) {
    try {
      logger.debug('Finding messages by thread', { threadId });
      const messages = await db.message.findMany({
        where: { threadId },
        orderBy: { createdAt: 'asc' },
      });
      logger.debug(`Found ${messages.length} messages for thread ${threadId}`);
      return messages;
    } catch (error) {
      logger.error('Failed to find messages by thread', error);
      throw error;
    }
  },

  async deleteByThread(threadId: string) {
    try {
      logger.debug('Deleting messages by thread', { threadId });
      const result = await db.message.deleteMany({
        where: { threadId },
      });
      logger.info(`Deleted ${result.count} messages from thread ${threadId}`);
      return result;
    } catch (error) {
      logger.error('Failed to delete messages by thread', error);
      throw error;
    }
  },
};

/**
 * Subsidy repository
 */
export const subsidyRepository = {
  async create(data: Prisma.SubsidyCreateInput) {
    try {
      logger.debug('Creating subsidy', { title: data.title });
      const subsidy = await db.subsidy.create({ data });
      logger.info(`Subsidy created: ${subsidy.id}`);
      return subsidy;
    } catch (error) {
      logger.error('Failed to create subsidy', error);
      throw error;
    }
  },

  async createMany(data: Prisma.SubsidyCreateManyInput[]) {
    try {
      logger.debug(`Creating ${data.length} subsidies`);
      const result = await db.subsidy.createMany({
        data,
        skipDuplicates: true,
      });
      logger.info(`Created ${result.count} subsidies`);
      return result;
    } catch (error) {
      logger.error('Failed to create subsidies', error);
      throw error;
    }
  },

  async findMany(
    where?: Prisma.SubsidyWhereInput,
    options?: {
      orderBy?: Prisma.SubsidyOrderByWithRelationInput;
      take?: number;
      skip?: number;
      select?: Prisma.SubsidySelect;
    }
  ) {
    try {
      logger.debug('Finding subsidies', { where });
      const subsidies = await db.subsidy.findMany({
        where,
        ...options,
      });
      logger.debug(`Found ${subsidies.length} subsidies`);
      return subsidies;
    } catch (error) {
      logger.error('Failed to find subsidies', error);
      throw error;
    }
  },

  async findUnique(where: Prisma.SubsidyWhereUniqueInput) {
    try {
      logger.debug('Finding subsidy', { where });
      const subsidy = await db.subsidy.findUnique({ where });
      if (subsidy) {
        logger.debug(`Found subsidy: ${subsidy.id}`);
      } else {
        logger.debug('Subsidy not found');
      }
      return subsidy;
    } catch (error) {
      logger.error('Failed to find subsidy', error);
      throw error;
    }
  },

  async update(
    where: Prisma.SubsidyWhereUniqueInput,
    data: Prisma.SubsidyUpdateInput
  ) {
    try {
      logger.debug('Updating subsidy', { where });
      const subsidy = await db.subsidy.update({ where, data });
      logger.info(`Subsidy updated: ${subsidy.id}`);
      return subsidy;
    } catch (error) {
      logger.error('Failed to update subsidy', error);
      throw error;
    }
  },

  async upsert(
    where: Prisma.SubsidyWhereUniqueInput,
    create: Prisma.SubsidyCreateInput,
    update: Prisma.SubsidyUpdateInput
  ) {
    try {
      logger.debug('Upserting subsidy', { where });
      const subsidy = await db.subsidy.upsert({ where, create, update });
      logger.info(`Subsidy upserted: ${subsidy.id}`);
      return subsidy;
    } catch (error) {
      logger.error('Failed to upsert subsidy', error);
      throw error;
    }
  },

  async delete(where: Prisma.SubsidyWhereUniqueInput) {
    try {
      logger.debug('Deleting subsidy', { where });
      const subsidy = await db.subsidy.delete({ where });
      logger.info(`Subsidy deleted: ${subsidy.id}`);
      return subsidy;
    } catch (error) {
      logger.error('Failed to delete subsidy', error);
      throw error;
    }
  },

  async deleteMany(where?: Prisma.SubsidyWhereInput) {
    try {
      logger.debug('Deleting subsidies', { where });
      const result = await db.subsidy.deleteMany({ where });
      logger.info(`Deleted ${result.count} subsidies`);
      return result;
    } catch (error) {
      logger.error('Failed to delete subsidies', error);
      throw error;
    }
  },

  async count(where?: Prisma.SubsidyWhereInput) {
    try {
      logger.debug('Counting subsidies', { where });
      const count = await db.subsidy.count({ where });
      logger.debug(`Subsidy count: ${count}`);
      return count;
    } catch (error) {
      logger.error('Failed to count subsidies', error);
      throw error;
    }
  },
};

/**
 * Transaction helper
 */
export async function withTransaction<T>(
  fn: (tx: Prisma.TransactionClient) => Promise<T>
): Promise<T> {
  try {
    logger.debug('Starting transaction');
    const result = await db.$transaction(fn);
    logger.debug('Transaction completed successfully');
    return result;
  } catch (error) {
    logger.error('Transaction failed', error);
    throw error;
  }
}

/**
 * Batch operation helper
 */
export async function batchOperation<T, R>(
  items: T[],
  batchSize: number,
  operation: (batch: T[]) => Promise<R>
): Promise<R[]> {
  const results: R[] = [];
  
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    logger.debug(`Processing batch ${Math.floor(i / batchSize) + 1} of ${Math.ceil(items.length / batchSize)}`);
    
    try {
      const result = await operation(batch);
      results.push(result);
    } catch (error) {
      logger.error(`Batch operation failed at batch ${Math.floor(i / batchSize) + 1}`, error);
      throw error;
    }
  }
  
  return results;
}