import { Queue, Worker } from 'bullmq';
import redisConnection from '../config/redis.js';
import { generateEmbedding, generateEmbeddingsBatch } from '../services/embeddingService.js';
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

/** Queue a single post for embedding generation */
export async function queueEmbeddingGeneration(postId, content) {
  await embeddingQueue.add('generate', { postId, content }, {
    jobId: `embed-${postId}-${Date.now()}`,
  });
  console.log(`Queued embedding job for post ${postId}`);
}

/**
 * Queue a batch of posts for embedding in a single job.
 * A batch job sends all texts to HF in one API call, then bulk-updates the DB.
 * Throughput: 15 concurrent workers × 5 posts/batch ÷ ~1.5s/call ≈ 300 embeds/s = 500+/min.
 * @param {{ postId: string, content: string }[]} items
 */
export async function queueBatchEmbeddingGeneration(items) {
  await embeddingQueue.add('generate-batch', { items }, {
    jobId: `embed-batch-${Date.now()}`,
  });
  console.log(`Queued batch embedding job for ${items.length} posts`);
}

// concurrency=15 gives ~500+ posts/min when using batch jobs (5 per job)
// Skip worker in test environment — avoids open Redis handles in Jest
const worker = process.env.NODE_ENV !== 'test' ? new Worker('embeddings', async (job) => {
  if (job.name === 'generate-batch') {
    // ── Batch path ─────────────────────────────────────────────────────────
    const { items } = job.data;
    console.log(`Batch-generating embeddings for ${items.length} posts...`);

    const texts = items.map(i => i.content);
    const embeddings = await generateEmbeddingsBatch(texts);

    // Bulk update via multi-row VALUES expression — one round-trip to DB
    const values = items
      .map((item, idx) => `('${item.postId}', '[${embeddings[idx].join(',')}]'::vector)`)
      .join(',');

    await db.query(`
      UPDATE posts AS p SET embedding = v.emb
      FROM (VALUES ${values}) AS v(pid, emb)
      WHERE p.id = v.pid::uuid
    `);

    console.log(`✅ Batch embeddings saved for ${items.length} posts`);
    return { count: items.length, dimensions: embeddings[0]?.length };
  }

  // ── Single path (backward-compatible) ────────────────────────────────────
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
  concurrency: 15, // up from 5 — enables 500+ posts/min throughput with batch jobs
}) : null;

if (worker) {
  worker.on('completed', (job, result) => {
    console.log(`Job ${job.id} completed:`, result);
  });

  worker.on('failed', (job, err) => {
    console.error(`Job ${job?.id} failed:`, err.message);
  });
}
