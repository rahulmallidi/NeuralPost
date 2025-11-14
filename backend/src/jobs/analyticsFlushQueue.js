import { Queue, Worker } from 'bullmq';
import redisConnection from '../config/redis.js';
import { refreshAnalyticsSummary } from '../services/analyticsService.js';

export const analyticsQueue = new Queue('analytics', {
  connection: redisConnection,
  defaultJobOptions: {
    removeOnComplete: 50,
    removeOnFail: 20,
  },
});

// Schedule a periodic refresh of the materialized view
export async function scheduleAnalyticsRefresh() {
  await analyticsQueue.add(
    'refresh-summary',
    {},
    {
      repeat: { every: 5 * 60 * 1000 }, // every 5 minutes
      jobId: 'analytics-refresh',
    }
  );
}

const worker = new Worker('analytics', async (job) => {
  if (job.name === 'refresh-summary') {
    await refreshAnalyticsSummary();
  }
}, { connection: redisConnection });

worker.on('failed', (job, err) => {
  console.error(`Analytics job ${job?.id} failed:`, err.message);
});
