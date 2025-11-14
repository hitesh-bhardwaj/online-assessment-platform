/**
 * Simple in-memory queue for recording merge jobs
 * For production, consider using Bull/BullMQ with Redis for persistent queues
 */

import mongoose from 'mongoose';
import { mergeRecordingsForResult } from '../scripts/merge-recording-chunks';

type MergeJob = {
  resultId: string;
  retries: number;
  maxRetries: number;
  addedAt: Date;
  lastAttempt?: Date;
  error?: string;
};

const queue: MergeJob[] = [];
const processing = new Set<string>();
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 60000; // 1 minute between retries
let isProcessing = false;

/**
 * Add a recording merge job to the queue
 */
export function queueRecordingMerge(resultId: string): void {
  // Check if already queued or processing
  const alreadyQueued = queue.some((job) => job.resultId === resultId);
  const alreadyProcessing = processing.has(resultId);

  if (alreadyQueued || alreadyProcessing) {
    console.log(`[RecordingQueue] Result ${resultId} already queued or processing`);
    return;
  }

  const job: MergeJob = {
    resultId,
    retries: 0,
    maxRetries: MAX_RETRIES,
    addedAt: new Date(),
  };

  queue.push(job);
  console.log(`[RecordingQueue] Added merge job for result: ${resultId} (queue size: ${queue.length})`);

  // Start processing if not already running
  if (!isProcessing) {
    processQueue();
  }
}

/**
 * Ensure MongoDB connection is ready before processing
 */
async function ensureConnection(): Promise<void> {
  // Check if connection is already established
  if (mongoose.connection.readyState === 1) {
    return; // Connected
  }

  // If connecting or disconnecting, wait for it to complete
  if (mongoose.connection.readyState === 2 || mongoose.connection.readyState === 3) {
    console.log('[RecordingQueue] Waiting for MongoDB connection...');
    // Wait up to 10 seconds for connection to be ready
    for (let i = 0; i < 100; i++) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      if (mongoose.connection.readyState === 1) {
        console.log('[RecordingQueue] MongoDB connection ready');
        return;
      }
    }
  }

  // If still not connected, throw error
  if (mongoose.connection.readyState !== 1) {
    throw new Error(
      `MongoDB connection not ready (state: ${mongoose.connection.readyState}). ` +
      `Queue processing requires an active database connection.`
    );
  }
}

/**
 * Process jobs in the queue sequentially
 */
async function processQueue(): Promise<void> {
  if (isProcessing) {
    return;
  }

  isProcessing = true;

  // Ensure MongoDB connection is ready before processing any jobs
  try {
    await ensureConnection();
  } catch (error) {
    console.error('[RecordingQueue] Failed to ensure MongoDB connection:', error);
    isProcessing = false;
    // Re-check connection after a delay
    setTimeout(() => {
      if (queue.length > 0) {
        processQueue();
      }
    }, RETRY_DELAY_MS);
    return;
  }

  while (queue.length > 0) {
    const job = queue[0]; // Peek at first job

    // Check if job should be retried (retry delay passed)
    if (job.lastAttempt) {
      const timeSinceLastAttempt = Date.now() - job.lastAttempt.getTime();
      if (timeSinceLastAttempt < RETRY_DELAY_MS) {
        // Wait before retrying this job
        console.log(`[RecordingQueue] Job ${job.resultId} waiting for retry delay (${Math.round((RETRY_DELAY_MS - timeSinceLastAttempt) / 1000)}s remaining)`);
        break; // Stop processing, will resume after delay
      }
    }

    // Remove from queue and mark as processing
    queue.shift();
    processing.add(job.resultId);

    console.log(`[RecordingQueue] Processing merge job for result: ${job.resultId} (attempt ${job.retries + 1}/${job.maxRetries + 1})`);

    try {
      // Execute the merge
      await mergeRecordingsForResult(job.resultId);
      console.log(`[RecordingQueue] ✅ Successfully merged recordings for result: ${job.resultId}`);
      processing.delete(job.resultId);
    } catch (error) {
      console.error(`[RecordingQueue] ❌ Failed to merge recordings for result: ${job.resultId}`, error);

      job.retries += 1;
      job.lastAttempt = new Date();
      job.error = error instanceof Error ? error.message : String(error);

      if (job.retries < job.maxRetries) {
        // Re-queue for retry
        queue.push(job);
        console.log(`[RecordingQueue] Re-queued job for retry: ${job.resultId} (${job.retries}/${job.maxRetries} retries)`);
      } else {
        console.error(`[RecordingQueue] ❌ Job failed after ${job.maxRetries} retries: ${job.resultId}`);
      }

      processing.delete(job.resultId);
    }

    // Small delay between jobs to avoid overwhelming the system
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  isProcessing = false;

  // If there are pending retries, schedule next check
  if (queue.length > 0) {
    setTimeout(() => {
      processQueue();
    }, RETRY_DELAY_MS);
  }
}

/**
 * Get current queue status (for monitoring)
 */
export function getQueueStatus() {
  return {
    queued: queue.length,
    processing: processing.size,
    jobs: queue.map((job) => ({
      resultId: job.resultId,
      retries: job.retries,
      addedAt: job.addedAt,
      lastAttempt: job.lastAttempt,
      error: job.error,
    })),
  };
}

/**
 * Clear all jobs from queue (use with caution)
 */
export function clearQueue(): void {
  queue.length = 0;
  processing.clear();
  console.log('[RecordingQueue] Queue cleared');
}
