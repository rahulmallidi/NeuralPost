// Correct router path: /models/<model>/pipeline/feature-extraction
// The bare /models/ path routes to SentenceSimilarityPipeline (wrong format).
// The old api-inference.huggingface.co domain is deprecated.
const HF_API_URL = 'https://router.huggingface.co/hf-inference/models/sentence-transformers/all-MiniLM-L6-v2/pipeline/feature-extraction';

export async function generateEmbedding(text) {
  const apiKey = process.env.HF_API_KEY;

  if (!apiKey) {
    // Return a mock embedding for development without API key
    console.warn('HF_API_KEY not set — returning zero embedding');
    return new Array(384).fill(0);
  }

  const response = await fetch(HF_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ inputs: text.substring(0, 512) }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Hugging Face API error: ${error}`);
  }

  const data = await response.json();

  // Handle both single and batch responses
  if (Array.isArray(data) && Array.isArray(data[0])) {
    return data[0]; // batch response
  }
  return data; // single
}

/**
 * Batch embedding: sends up to `texts.length` inputs in a single HF API call.
 * HF feature-extraction accepts an array of strings and returns an array of vectors.
 * This is ~5x more throughput-efficient than individual calls.
 * @param {string[]} texts
 * @returns {Promise<number[][]>} array of 384-dim vectors, same order as input
 */
export async function generateEmbeddingsBatch(texts) {
  const apiKey = process.env.HF_API_KEY;

  if (!apiKey) {
    console.warn('HF_API_KEY not set — returning zero embeddings');
    return texts.map(() => new Array(384).fill(0));
  }

  const truncated = texts.map(t => t.substring(0, 512));

  const response = await fetch(HF_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ inputs: truncated }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Hugging Face batch API error: ${error}`);
  }

  const data = await response.json();

  // Batch response is a 2D array: [[vec0...], [vec1...], ...]
  if (Array.isArray(data) && Array.isArray(data[0])) {
    return data;
  }
  // Fallback: single vector returned for single-item batch
  return [data];
}
