import { buildRagContext } from './ragService.js';

const HF_API_URL = 'https://router.huggingface.co/models';

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

// ── HuggingFace Chat Completions (Llama 3.3 70B via Inference Providers) ──────
// Uses the OpenAI-compatible endpoint; routed to Fireworks/Together backends
// which support up to 16k output tokens — no Groq-style hard cap.
async function hfChatRequest(messages, options = {}) {
  if (!process.env.HF_API_KEY) throw new Error('HF_API_KEY not set');
  const maxTokens = Math.min(options.maxTokens || 2000, 16000);
  const res = await fetch('https://router.huggingface.co/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.HF_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'meta-llama/Llama-3.3-70B-Instruct',
      messages,
      max_tokens: maxTokens,
      temperature: options.temperature ?? 0.7,
    }),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`HF Chat API error (${res.status}): ${errText}`);
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim() || '';
}

const CANDIDATE_LABELS = [
  // Languages & runtimes
  'javascript', 'typescript', 'python', 'rust', 'go', 'java', 'c++', 'sql',
  // Frontend
  'react', 'vue', 'angular', 'svelte', 'css', 'html', 'web development', 'ui design',
  // Backend & infra
  'nodejs', 'express', 'fastapi', 'django', 'rest api', 'graphql', 'websockets',
  'docker', 'kubernetes', 'devops', 'ci/cd', 'linux', 'nginx',
  // Cloud & data
  'cloud', 'aws', 'azure', 'database', 'postgresql', 'mongodb', 'redis', 'data engineering',
  // AI / ML
  'ai', 'machine learning', 'deep learning', 'llm', 'rag', 'prompt engineering',
  'computer vision', 'nlp', 'neural networks', 'generative ai',
  // Security & architecture
  'security', 'authentication', 'architecture', 'microservices', 'performance',
  // Meta / editorial
  'tutorial', 'opinion', 'career', 'productivity', 'open source', 'tools', 'news',
];

export async function suggestTags(title = '', content) {
  const fullText = `${title}\n\n${content}`.replace(/#+\s/g, '').replace(/\*+/g, '');
  const snippet = fullText.substring(0, 1500);

  // Primary: Groq/Llama with semantic analysis
  if (process.env.GROQ_API_KEY) {
    try {
      const raw = await groqChat([
        {
          role: 'system',
          content:
            'You are a precise content classifier for a tech blog. ' +
            'Your job: read the content carefully and pick the 2-4 tags that BEST describe its primary topic and secondary themes. ' +
            'Rules: (1) Prefer tags from the provided list, but you may suggest a free-form tag if the content clearly covers a topic not in the list. ' +
            '(2) Prefer specific tags over generic ones (e.g. "react" over "web development" if the post is about React). ' +
            '(3) Only include a tag if the content meaningfully covers that topic — do not guess. ' +
            '(4) All tags must be lowercase. Respond with ONLY a raw JSON array, no explanation, no markdown, no code fences.',
        },
        {
          role: 'user',
          content:
            `Allowed tags:\n${CANDIDATE_LABELS.join(', ')}\n\n` +
            `Content to classify:\n${snippet}\n\n` +
            `Respond with a JSON array of 2-4 tags. Example: ["react", "typescript", "tutorial"]`,
        },
      ], { maxTokens: 60, temperature: 0.1 });

      // Extract JSON array from response (handle any surrounding text)
      const match = raw.match(/\[\s*[\s\S]*?\]/);
      if (match) {
        const tags = JSON.parse(match[0])
          .map(t => String(t).toLowerCase().trim())
          // allow any well-formed tag (letters, digits, spaces, common tech chars)
          .filter(t => t.length >= 2 && t.length <= 40 && /^[a-z0-9 .#+\-/]+$/.test(t));
        if (tags.length > 0) return tags.slice(0, 4);
      }
    } catch (err) {
      console.warn('Groq tag suggestion failed:', err.message);
    }
  }

  // Fallback: HuggingFace zero-shot classification
  if (process.env.HF_API_KEY) {
    try {
      const data = await hfRequest('facebook/bart-large-mnli', {
        inputs: snippet.substring(0, 1000),
        parameters: { candidate_labels: CANDIDATE_LABELS },
      });
      return data.labels
        .map((label, i) => ({ label, score: data.scores[i] }))
        .filter(t => t.score > 0.25)
        .slice(0, 4)
        .map(t => t.label);
    } catch (err) {
      console.warn('HF tag suggestion failed:', err.message);
    }
  }

  // Last resort: keyword frequency match
  const lower = snippet.toLowerCase();
  const escRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return CANDIDATE_LABELS
    .map(l => ({ label: l, count: (lower.match(new RegExp(escRe(l), 'g')) || []).length }))
    .filter(x => x.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 3)
    .map(x => x.label);
}

// ── Groq (Llama 3.3) — free tier, no credit card needed ──────────────────────
// Sign up at https://console.groq.com  |  14,400 req/day, 30 RPM free
const GROQ_MODELS = ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant'];

async function groqRequest(messages, options = {}) {
  if (!process.env.GROQ_API_KEY) throw new Error('GROQ_API_KEY not set');
  const maxRetries = options.retries ?? 2;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: options.model || GROQ_MODELS[0],
        messages,
        max_tokens: options.maxTokens || 1000,
        temperature: options.temperature ?? 0.7,
      }),
    });

    if (res.status === 429) {
      const text = await res.text();
      if (attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * 5000; // 5s, 10s
        console.warn(`Groq 429 (attempt ${attempt + 1}) — retrying in ${delay / 1000}s...`);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
      throw new Error(`Groq rate limit exceeded: ${text}`);
    }
    if (!res.ok) throw new Error(`Groq API error (${res.status}): ${await res.text()}`);
    const data = await res.json();
    return data.choices?.[0]?.message?.content?.trim() || '';
  }
}

async function groqChat(messages, options = {}) {
  let lastErr;
  for (const model of GROQ_MODELS) {
    try {
      return await groqRequest(messages, { ...options, model });
    } catch (err) {
      console.warn(`Groq model ${model} failed: ${err.message}`);
      lastErr = err;
    }
  }
  throw lastErr;
}

// ── Gemini (fallback) ──────────────────────────────────────────────────────────
// Models in priority order — lite has higher RPM, 8b has a separate daily quota pool
const GEMINI_MODELS = ['gemini-2.0-flash-lite', 'gemini-1.5-flash-8b', 'gemini-2.0-flash'];

function geminiUrl(model) {
  return `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`;
}

function parseRetryDelay(body) {
  try {
    const parsed = typeof body === 'string' ? JSON.parse(body) : body;
    const details = parsed?.error?.details || [];
    for (const d of details) {
      if (d['@type']?.includes('RetryInfo') && d.retryDelay) {
        return (parseInt(d.retryDelay) || 30) * 1000;
      }
    }
  } catch {}
  return 30000;
}

async function callGemini(model, body, retries = 2) {
  const res = await fetch(geminiUrl(model), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (res.status === 429) {
    const text = await res.text();
    if (retries > 0) {
      const delay = parseRetryDelay(text);
      console.warn(`Gemini 429 on ${model} — retrying in ${delay / 1000}s...`);
      await new Promise(r => setTimeout(r, delay));
      return callGemini(model, body, retries - 1);
    }
    throw new Error(`Gemini rate limit exceeded: ${text}`);
  }
  if (!res.ok) throw new Error(`Gemini API error (${res.status}): ${await res.text()}`);
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
}

async function geminiRequest(prompt, genConfig = { maxOutputTokens: 500, temperature: 0.7 }) {
  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: genConfig,
  };
  let lastErr;
  for (const model of GEMINI_MODELS) {
    try {
      return await callGemini(model, body);
    } catch (err) {
      console.warn(`Gemini model ${model} failed: ${err.message}`);
      lastErr = err;
    }
  }
  throw lastErr;
}

// ── Excerpt ────────────────────────────────────────────────────────────────────
export async function generateExcerpt(content, title = '') {
  if (process.env.GROQ_API_KEY) {
    try {
      return await groqChat([{
        role: 'user',
        content: `Write a compelling SEO meta description (max 160 chars) for a blog post titled "${title}". Respond with only the description, no quotes:\n\n${content.substring(0, 800)}`,
      }], { maxTokens: 80 });
    } catch (err) {
      console.warn('Groq excerpt failed:', err.message);
    }
  }
  if (process.env.GEMINI_API_KEY) {
    try {
      return await geminiRequest(
        `Write a compelling SEO meta description (max 160 chars) for this blog post titled "${title}". Respond with only the description, no quotes:\n\n${content.substring(0, 800)}`
      );
    } catch (err) {
      console.warn('Gemini excerpt failed:', err.message);
    }
  }
  const sentences = content.replace(/#+\s/g, '').split(/[.!?]+/).filter(Boolean);
  return sentences.slice(0, 2).join('. ').trim() + '.';
}

// ── Writing Assist ─────────────────────────────────────────────────────────────
export async function writingAssist(text, instruction = 'Improve this paragraph for clarity and engagement') {
  if (process.env.GROQ_API_KEY) {
    try {
      return await groqChat([
        { role: 'system', content: 'You are a helpful writing assistant for a tech blog. Respond with only the improved text, no explanations or preamble.' },
        { role: 'user', content: `${instruction}:\n\n${text}` },
      ], { maxTokens: 600 });
    } catch (err) {
      console.warn('Groq writing assist failed:', err.message);
    }
  }
  if (process.env.GEMINI_API_KEY) {
    try {
      return await geminiRequest(
        `You are a helpful writing assistant for a tech blog. Respond with only the improved text, no explanations.\n\n${instruction}:\n\n${text}`
      );
    } catch (err) {
      console.error('Gemini writing assist failed:', err.message);
    }
  }
  return text;
}

// ── Generate Post (primary: Groq/Llama + RAG, fallback: Gemini) ───────────────
// Tone → prose style instructions + temperature
const TONE_GUIDES = {
  Professional: {
    guide: 'Clear, authoritative, and well-structured. Use industry terminology where appropriate. Be direct and confident.',
    temp: 0.5,
  },
  Casual: {
    guide: 'Conversational and approachable — write like you\'re explaining to a smart friend. Use contractions, short sentences, occasional humour.',
    temp: 0.7,
  },
  Technical: {
    guide: 'Precise and technically rigorous. Include implementation details, exact terminology, and concrete examples or pseudocode where useful.',
    temp: 0.45,
  },
  Creative: {
    guide: 'Narrative-driven with vivid metaphors and engaging storytelling. Hook the reader in the first sentence. Build intrigue, use analogies, and make the subject feel exciting.',
    temp: 0.75,
  },
};

export async function generatePost(topic, tone = 'Professional', length = 'Medium', wordCount = null) {
  const wordTargets = { Short: 400, Medium: 900, Long: 1800, 'Extra Long': 3500 };
  const words = wordCount && Number.isFinite(Number(wordCount))
    ? Math.max(100, Math.min(10000, Number(wordCount)))
    : (wordTargets[length] || 900);

  const { guide: toneGuide, temp: temperature } = TONE_GUIDES[tone] || TONE_GUIDES.Professional;

  if (!process.env.GROQ_API_KEY && !process.env.GEMINI_API_KEY) {
    return {
      title: `A Guide to ${topic}`,
      content: `# A Guide to ${topic}\n\nAdd a **GROQ_API_KEY** (free at [console.groq.com](https://console.groq.com)) to your .env file to enable AI post generation.`,
    };
  }

  try {
    // ── Step 1: Fetch real-time context ─────────────────────────────────────
    const { chunks, sourceNames } = await buildRagContext(topic);

    // ── Step 2: Extract facts into structured bullets (fast 8B model) ───────
    let factBullets = '';
    if (chunks.length > 0 && process.env.GROQ_API_KEY) {
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const rawFacts = await groqRequest([
            {
              role: 'system',
              content:
                'You are a research analyst. Extract verifiable facts from news snippets and return them as a JSON array.\n\n' +
                'MANDATORY RULES:\n' +
                '1. Each fact must be under 20 words.\n' +
                '2. ALWAYS paraphrase — NEVER copy a sentence verbatim from the source.\n' +
                '3. Only include: names, dates, numbers, events, product names, measurable claims.\n' +
                '4. No opinions, no filler, no commentary.\n' +
                '5. Return ONLY valid JSON: {"facts": ["fact 1", "fact 2", ...]}\n\n' +
                'EXAMPLE — source: "Apple unveiled the iPhone 17 with a 48MP camera on September 9, 2025."\n' +
                'CORRECT output: {"facts": ["Apple launched iPhone 17 in September 2025", "iPhone 17 includes a 48MP camera"]}\n' +
                'WRONG output: {"facts": ["Apple unveiled the iPhone 17 with a 48MP camera on September 9, 2025."]}',
            },
            {
              role: 'user',
              content:
                `Topic: "${topic}"\n\nSource snippets:\n\n` +
                chunks.map((c, i) => `[${i + 1}] ${c.title}\n${c.snippet}`).join('\n\n') +
                '\n\nReturn up to 10 paraphrased facts as JSON: {"facts": [...]}',
            },
          ], { model: 'llama-3.1-8b-instant', maxTokens: 400, temperature: 0.3 });

          const match = rawFacts.match(/\{[\s\S]*"facts"[\s\S]*\}/);
          if (!match) throw new Error('No JSON block in fact extraction response');
          const parsed = JSON.parse(match[0]);
          if (!Array.isArray(parsed.facts) || parsed.facts.length === 0) throw new Error('facts array is empty');
          factBullets = parsed.facts.map(f => `• ${f}`).join('\n');
          console.log(`📋 Extracted ${parsed.facts.length} facts from ${chunks.length} RAG chunks`);
          break;
        } catch (err) {
          console.warn(`Fact extraction attempt ${attempt + 1} failed: ${err.message}`);
          if (attempt === 1) console.warn('Generating without grounding facts');
        }
      }
    }

    const factContext = factBullets
      ? `FACTS (transform — never copy verbatim):\n${factBullets}\n\n`
      : '';

    const systemBase =
      `You are an expert blog writer. Tone guide: ${toneGuide}\n\n` +
      `ANTI-PLAGIARISM: Transform all facts — never copy source phrasing verbatim. Add your own analysis and insights.\n\n` +
      `FORMAT: Markdown — ## headings, **bold** key terms, bullet/numbered lists where they aid clarity.`;

    // ── Short posts (≤1500 words): single-pass ───────────────────────────────
    if (words <= 1500) {
      const tokensNeeded = Math.min(Math.round(words * 1.7) + 600, 32000);
      const userPrompt =
        `Write an original blog post about "${topic}".\n\n` +
        `WORD COUNT: Exactly ${words} words (±5%). Do NOT stop early.\n\n` +
        factContext +
        `OUTPUT: Return ONLY valid JSON: {"title": "...", "content": "..."}`;

      const raw = await callBestProvider(
        [{ role: 'system', content: systemBase }, { role: 'user', content: userPrompt }],
        systemBase + '\n\n' + userPrompt,
        tokensNeeded, temperature
      );
      const post = parseJsonPost(raw);
      post._sources = sourceNames;
      console.log(`✅ Post generated (single-pass) — target: ${words} words`);
      return post;
    }

    // ── Long posts (>1500 words): outline → per-section generation ───────────
    // Step A: generate outline with per-section word budgets
    const sectionCount = words <= 3000 ? 4 : words <= 6000 ? 6 : 8;
    const introWords   = Math.round(words * 0.12);
    const outroWords   = Math.round(words * 0.10);
    const bodyWords    = words - introWords - outroWords;
    const perSection   = Math.round(bodyWords / (sectionCount - 2)); // -2 for intro+outro

    const outlinePrompt =
      `Create a detailed outline for a ${words}-word blog post about "${topic}".\n\n` +
      factContext +
      `Return ONLY valid JSON:\n` +
      `{"title": "...", "sections": [\n` +
      `  {"heading": "Introduction", "targetWords": ${introWords}, "notes": "hook and overview"},\n` +
      `  ... ${sectionCount - 2} body sections, each ~${perSection} words ...\n` +
      `  {"heading": "Conclusion", "targetWords": ${outroWords}, "notes": "summary and call to action"}\n` +
      `]}\n\n` +
      `TOTAL of all targetWords across ALL sections MUST equal exactly ${words}.`;

    const outlineRaw = await callBestProvider(
      [{ role: 'system', content: systemBase }, { role: 'user', content: outlinePrompt }],
      systemBase + '\n\n' + outlinePrompt,
      800, 0.4
    );

    let outline;
    try {
      outline = parseJsonPost(outlineRaw);
      if (!Array.isArray(outline.sections) || outline.sections.length < 2) throw new Error('invalid sections');
    } catch (err) {
      console.warn('Outline parse failed, using fallback outline:', err.message);
      // Build a simple fallback outline
      const sections = [{ heading: 'Introduction', targetWords: introWords, notes: 'hook' }];
      for (let i = 1; i <= sectionCount - 2; i++) {
        sections.push({ heading: `Section ${i}`, targetWords: perSection, notes: '' });
      }
      sections.push({ heading: 'Conclusion', targetWords: outroWords, notes: 'wrap up' });
      outline = { title: `${topic}`, sections };
    }

    console.log(`✅ Outline ready: ${outline.sections.length} sections, target ${words} words`);

    // Step B: generate each section individually
    const sectionContents = [];
    for (let i = 0; i < outline.sections.length; i++) {
      const sec = outline.sections[i];
      const isFirst = i === 0;
      const isLast = i === outline.sections.length - 1;
      const prevHeadings = outline.sections.slice(0, i).map(s => s.heading).join(', ');

      const secPrompt =
        `You are writing section ${i + 1} of ${outline.sections.length} for a blog post titled "${outline.title}".\n\n` +
        `Section heading: ## ${sec.heading}\n` +
        `Target: EXACTLY ${sec.targetWords} words (±5%). Count carefully and do not stop until you hit ${sec.targetWords} words.\n` +
        (sec.notes ? `Notes: ${sec.notes}\n` : '') +
        (prevHeadings ? `Sections already written: ${prevHeadings}\n` : '') +
        (isFirst ? `\nThis is the opening section — hook the reader immediately.\n` : '') +
        (isLast ? `\nThis is the final section — conclude strongly and give a clear call to action.\n` : '') +
        `\n${factContext}` +
        `Tone: ${toneGuide}\n\n` +
        `IMPORTANT: Write ONLY the section body in Markdown (no title, no other sections). ` +
        `Start with "## ${sec.heading}". Output plain Markdown, no JSON.`;

      // token budget per section: targetWords * 1.7 + 200, max 8000 (HF supports up to 16k)
      const secTokens = Math.min(Math.round(sec.targetWords * 1.7) + 200, 8000);

      try {
        const secContent = await callBestProvider(
          [{ role: 'system', content: `You are an expert blog writer. Tone: ${toneGuide}` },
           { role: 'user', content: secPrompt }],
          `You are an expert blog writer. Tone: ${toneGuide}\n\n${secPrompt}`,
          secTokens, temperature
        );
        sectionContents.push(secContent.trim());
        console.log(`  ✓ Section ${i + 1}/${outline.sections.length}: "${sec.heading}"`);
      } catch (err) {
        console.warn(`Section ${i + 1} failed: ${err.message}`);
        sectionContents.push(`## ${sec.heading}\n\n[Section generation failed — please regenerate.]`);
      }

      // Small delay between sections to respect Groq rate limits
      if (i < outline.sections.length - 1) {
        await new Promise(r => setTimeout(r, 800));
      }
    }

    const fullContent = sectionContents.join('\n\n');
    const actualWords = fullContent.trim().replace(/[#*`_>~!\[\]()]/g, ' ').replace(/\s+/g, ' ').trim().split(/\s+/).length;
    console.log(`✅ Post assembled: ${actualWords} words across ${outline.sections.length} sections`);

    return { title: outline.title, content: fullContent, _sources: sourceNames };

  } catch (err) {
    console.error('generatePost failed:', err.message);
    throw err;
  }
}

// ── Shared helpers ────────────────────────────────────────────────────────────

// Priority: HF Llama 3.3 70B (highest output limit) → Groq → Gemini
async function callBestProvider(groqMessages, geminiPrompt, maxTokens, temperature) {
  // 1️⃣  HuggingFace Llama 3.3 70B — up to 16k output tokens via Fireworks/Together
  if (process.env.HF_API_KEY) {
    try {
      const raw = await hfChatRequest(groqMessages, { maxTokens, temperature });
      return raw;
    } catch (err) {
      console.warn('HF Chat failed, trying Groq:', err.message);
    }
  }
  // 2️⃣  Groq — fast but output-limited in practice
  if (process.env.GROQ_API_KEY) {
    try {
      const raw = await groqChat(groqMessages, { maxTokens: Math.min(maxTokens, 32000), temperature });
      return raw;
    } catch (err) {
      console.warn('Groq failed, trying Gemini:', err.message);
    }
  }
  // 3️⃣  Gemini flash — final fallback
  if (process.env.GEMINI_API_KEY) {
    const body = {
      contents: [{ parts: [{ text: geminiPrompt }] }],
      generationConfig: { maxOutputTokens: Math.min(maxTokens, 8192), temperature: Math.min(temperature, 1.0) },
    };
    let lastErr;
    for (const model of GEMINI_MODELS) {
      try {
        return await callGemini(model, body);
      } catch (err) {
        console.warn(`Gemini ${model} failed: ${err.message}`);
        lastErr = err;
      }
    }
    throw lastErr || new Error('All Gemini models failed');
  }
  throw new Error('No AI provider available.');
}

function parseJsonPost(raw) {
  // Strip code fences
  const stripped = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
  // Extract outermost {...} block
  const start = stripped.indexOf('{');
  const end   = stripped.lastIndexOf('}');
  const jsonBlock = start !== -1 && end !== -1 ? stripped.slice(start, end + 1) : stripped;

  // Sanitize literal control chars inside JSON string values
  function sanitizeJson(str) {
    let inStr = false, esc = false, out = '';
    for (const ch of str) {
      if (esc)               { out += ch; esc = false; continue; }
      if (ch === '\\' && inStr) { out += ch; esc = true; continue; }
      if (ch === '"')        { inStr = !inStr; out += ch; continue; }
      if (inStr) {
        const code = ch.charCodeAt(0);
        if (code < 0x20) {
          if      (ch === '\n') out += '\\n';
          else if (ch === '\r') out += '\\r';
          else if (ch === '\t') out += '\\t';
          else out += `\\u${code.toString(16).padStart(4, '0')}`;
          continue;
        }
      }
      out += ch;
    }
    return out;
  }
  return JSON.parse(sanitizeJson(jsonBlock));
}
