import { Queue, Worker } from 'bullmq';
import redisConnection from '../config/redis.js';
import { generateEmbedding } from '../services/embeddingService.js';
import db from '../config/db.js';

export const embeddingQueue = new Queue('embeddings', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: 100,
    removeOnFail: 50,
  },
});

export async function queueEmbeddingGeneration(postId, content) {
  await embeddingQueue.add('generate', { postId, content }, {
    jobId: `embed-${postId}-${Date.now()}`,
  });
  console.log(`Queued embedding job for post ${postId}`);
}

const worker = new Worker('embeddings', async (job) => {
  const { postId, content } = job.data;
  console.log(`Generating embedding for post ${postId}...`);

  const embedding = await generateEmbedding(content);
  const vectorStr = `[${embedding.join(',')}]`;

  await db.query(
    'UPDATE posts SET embedding = $1::vector WHERE id = $2',
    [vectorStr, postId]
  );

  console.log(`✅ Embedding generated for post ${postId}`);
  return { postId, dimensions: embedding.length };
}, {
  connection: redisConnection,
  concurrency: 5,
});

worker.on('completed', (job, result) => {
  console.log(`Job ${job.id} completed:`, result);
});

worker.on('failed', (job, err) => {
  console.error(`Job ${job?.id} failed:`, err.message);
});
