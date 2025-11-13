const HF_API_URL = 'https://api-inference.huggingface.co/models/sentence-transformers/all-MiniLM-L6-v2';

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
