/**
 * ragService.js — Real-Time RAG Pipeline
 *
 * Retrieves live context from up to three sources, merges and deduplicates
 * them, then returns a formatted string ready to inject into an LLM prompt.
 *
 * Sources (tried in parallel):
 *   1. The Guardian API  — live news articles       (GUARDIAN_API_KEY required)
 *   2. Tavily Search API — broader live web search  (TAVILY_API_KEY optional)
 *   3. Local DB          — platform's own posts     (always available)
 */

import db from '../config/db.js';

// ── Guardian Live News ─────────────────────────────────────────────────────────

async function fetchGuardianContext(topic) {
  const key = process.env.GUARDIAN_API_KEY;
  if (!key) return [];

  try {
    const params = new URLSearchParams({
      q: topic,
      'api-key': key,
      'show-fields': 'headline,trailText,bodyText,firstPublicationDate,shortUrl',
      'order-by': 'newest',
      'page-size': '8',
    });

    const res = await fetch(
      `https://content.guardianapis.com/search?${params}`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (!res.ok) throw new Error(`Guardian ${res.status}`);

    const data = await res.json();
    return (data.response?.results || []).map(a => {
      // prefer trailText, fall back to first 400 chars of bodyText
      const snippet =
        a.fields?.trailText ||
        (a.fields?.bodyText ? a.fields.bodyText.replace(/\s+/g, ' ').slice(0, 400) : '');
      return {
        source: 'The Guardian',
        title: a.fields?.headline || a.webTitle,
        snippet,
        date: a.fields?.firstPublicationDate?.slice(0, 10) || a.webPublicationDate?.slice(0, 10),
        url: a.fields?.shortUrl || a.webUrl,
      };
    }).filter(a => a.snippet); // drop articles with no usable text
  } catch (err) {
    console.warn('RAG Guardian fetch failed:', err.message);
    return [];
  }
}

// ── Tavily Web Search ──────────────────────────────────────────────────────────

async function fetchTavilyContext(topic) {
  const key = process.env.TAVILY_API_KEY;
  if (!key) return [];

  try {
    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: key,
        query: topic,
        search_depth: 'basic',
        max_results: 5,
        include_answer: true,
      }),
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) throw new Error(`Tavily ${res.status}`);

    const data = await res.json();
    const chunks = [];

    // Tavily answer — a direct synthesised summary
    if (data.answer) {
      chunks.push({
        source: 'Tavily Answer',
        title: `Summary: ${topic}`,
        snippet: data.answer,
        date: new Date().toISOString().slice(0, 10),
        url: null,
      });
    }

    // Individual results
    for (const r of data.results || []) {
      chunks.push({
        source: r.source || new URL(r.url).hostname,
        title: r.title,
        snippet: r.content?.slice(0, 300) || '',
        date: r.published_date?.slice(0, 10) || null,
        url: r.url,
      });
    }

    return chunks;
  } catch (err) {
    console.warn('RAG Tavily fetch failed:', err.message);
    return [];
  }
}

// ── Local DB Posts ─────────────────────────────────────────────────────────────

async function fetchDbContext(topic) {
  try {
    const result = await db.query(`
      SELECT title,
             COALESCE(excerpt, LEFT(content, 300)) AS snippet,
             published_at::date AS date
      FROM posts
      WHERE status = 'published'
        AND to_tsvector('english', title || ' ' || COALESCE(excerpt,'') || ' ' || content)
            @@ plainto_tsquery('english', $1)
      ORDER BY ts_rank(
        to_tsvector('english', title || ' ' || COALESCE(excerpt,'') || ' ' || content),
        plainto_tsquery('english', $1)
      ) DESC
      LIMIT 3
    `, [topic]);

    return result.rows.map(r => ({
      source: 'NeuralPost',
      title: r.title,
      snippet: r.snippet,
      date: r.date,
      url: null,
    }));
  } catch {
    return [];
  }
}

// ── Deduplication ──────────────────────────────────────────────────────────────

function dedupe(chunks) {
  const seen = new Set();
  return chunks.filter(c => {
    const key = c.title?.toLowerCase().trim().slice(0, 60);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Fetch real-time context for a topic from all available sources in parallel.
 * Returns an array of source chunks and a pre-formatted prompt string.
 *
 * @param {string} topic
 * @returns {{ chunks: Array, promptBlock: string, sourceNames: string[] }}
 */
export async function buildRagContext(topic) {
  const [guardian, tavily, db_] = await Promise.all([
    fetchGuardianContext(topic),
    fetchTavilyContext(topic),
    fetchDbContext(topic),
  ]);

  // Source quality ranking: Tavily (live web synthesis) > Guardian (news) > NeuralPost (local)
  const SOURCE_RANK = { 'Tavily Answer': 3, 'The Guardian': 2, 'NeuralPost': 1 };
  const getRank = c => SOURCE_RANK[c.source] ?? (c.source === 'Tavily Answer' ? 3 : 2);

  // Dedupe, filter low-quality (< 80 chars), trim snippets, sort by quality, take top 5
  const all = dedupe([...tavily, ...guardian, ...db_])
    .filter(c => c.snippet && c.snippet.trim().length >= 80)
    .map(c => ({ ...c, snippet: c.snippet.trim().slice(0, 300) }))
    .sort((a, b) => getRank(b) - getRank(a))
    .slice(0, 5);

  if (all.length === 0) {
    console.log('📚 RAG: no usable chunks found');
    return { chunks: [], promptBlock: '', sourceNames: [] };
  }

  const sourceNames = [...new Set(all.map(c => c.source))];

  const promptBlock =
    `\n\n--- REAL-TIME CONTEXT (retrieved live — use as factual grounding, cite naturally) ---\n` +
    all.map((c, i) => {
      const meta = [c.source, c.date].filter(Boolean).join(', ');
      return `[${i + 1}] ${c.title}${meta ? ` (${meta})` : ''}\n${c.snippet}`;
    }).join('\n\n') +
    `\n--- END CONTEXT ---`;

  console.log(`📚 RAG: ${all.length} chunks kept (filtered from ${dedupe([...tavily, ...guardian, ...db_]).length} total) | sources: [${sourceNames.join(', ')}]`);

  return { chunks: all, promptBlock, sourceNames };
}
