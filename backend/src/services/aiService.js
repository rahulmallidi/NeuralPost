const HF_API_URL = 'https://api-inference.huggingface.co/models';

async function hfRequest(model, body) {
  const res = await fetch(`${HF_API_URL}/${model}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.HF_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`HF API error: ${await res.text()}`);
  return res.json();
}

const CANDIDATE_LABELS = [
  'javascript', 'python', 'machine learning', 'web development',
  'devops', 'career', 'tutorial', 'opinion', 'database', 'security',
  'react', 'nodejs', 'typescript', 'cloud', 'ai', 'productivity',
];

export async function suggestTags(content) {
  if (!process.env.HF_API_KEY) {
    return ['tutorial', 'web development'];
  }

  try {
    const data = await hfRequest('facebook/bart-large-mnli', {
      inputs: content.substring(0, 1000),
      parameters: { candidate_labels: CANDIDATE_LABELS },
    });

    return data.labels
      .map((label, i) => ({ label, score: data.scores[i] }))
      .filter(t => t.score > 0.3)
      .slice(0, 3)
      .map(t => t.label);
  } catch (err) {
    console.error('Tag suggestion failed:', err.message);
    return [];
  }
}

export async function generateExcerpt(content, title = '') {
  if (process.env.OPENAI_API_KEY) {
    return generateExcerptOpenAI(content, title);
  }

  // Fallback: extract first 2 sentences
  const sentences = content.replace(/#+\s/g, '').split(/[.!?]+/).filter(Boolean);
  return sentences.slice(0, 2).join('. ').trim() + '.';
}

async function generateExcerptOpenAI(content, title) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'user',
          content: `Write a compelling SEO meta description (max 160 chars) for this blog post titled "${title}":\n\n${content.substring(0, 800)}`,
        },
      ],
      max_tokens: 100,
    }),
  });
  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim() || '';
}

export async function writingAssist(text, instruction = 'Improve this paragraph for clarity and engagement') {
  if (!process.env.OPENAI_API_KEY) {
    return text; // No-op without API key
  }

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are a helpful writing assistant for a tech blog. Respond with only the improved text.' },
        { role: 'user', content: `${instruction}:\n\n${text}` },
      ],
      max_tokens: 500,
    }),
  });
  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim() || text;
}
