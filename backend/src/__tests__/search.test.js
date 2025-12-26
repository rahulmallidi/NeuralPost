/**
 * search.test.js
 * Integration tests for /api/search endpoints: keyword, semantic, hybrid.
 * Creates a published post with known content so searches can find it,
 * then cleans up in afterAll.
 */
import request from 'supertest';
import app from '../app.js';
import db from '../config/db.js';

const ts = Date.now();
const SEARCH_TERM = `neuralposttesttoken${ts}`;  // unique enough that only our post matches

const TEST_USER = {
  email:    `jest_search_${ts}@example.test`,
  username: `jest_search_${ts}`,
  password: 'TestPass123!',
};

let userId;
let accessToken;
let postId;

beforeAll(async () => {
  // Register user
  const reg = await request(app)
    .post('/api/auth/register')
    .send(TEST_USER)
    .expect(201);

  userId      = reg.body.user.id;
  accessToken = reg.body.accessToken;

  // Create a published post containing our unique search token
  const post = await request(app)
    .post('/api/posts')
    .set('Authorization', `Bearer ${accessToken}`)
    .send({
      title:   `Search Test ${SEARCH_TERM}`,
      content: `This post is about ${SEARCH_TERM} and is used for Jest search integration tests.`,
      status:  'published',
    })
    .expect(201);

  postId = post.body.id;
});

afterAll(async () => {
  if (userId) {
    await db.query('DELETE FROM users WHERE id = $1', [userId]);
  }
});

// ── Response shape helper ─────────────────────────────────────────────────────
// All three search endpoints return { query: string, results: Post[] }
function expectSearchShape(body) {
  expect(body).toHaveProperty('results');
  expect(Array.isArray(body.results)).toBe(true);
  if (body.results.length > 0) {
    const item = body.results[0];
    expect(item).toHaveProperty('id');
    expect(item).toHaveProperty('title');
    expect(item).toHaveProperty('slug');
  }
}

// ── Keyword search ────────────────────────────────────────────────────────────

describe('GET /api/search/keyword', () => {
  it('400 — requires q param', async () => {
    await request(app).get('/api/search/keyword').expect(400);
  });

  it('200 — returns array with correct shape', async () => {
    const res = await request(app)
      .get('/api/search/keyword')
      .query({ q: SEARCH_TERM })
      .expect(200);

    expectSearchShape(res.body);
  });

  it('200 — finds our published post by unique token', async () => {
    const res = await request(app)
      .get('/api/search/keyword')
      .query({ q: SEARCH_TERM })
      .expect(200);

    const found = res.body.results.some(p => p.id === postId);
    expect(found).toBe(true);
  });

  it('200 — returns empty array for nonsense query', async () => {
    const res = await request(app)
      .get('/api/search/keyword')
      .query({ q: 'xyzzy_no_such_content_ever_12345' })
      .expect(200);

    expect(Array.isArray(res.body.results)).toBe(true);
    expect(res.body.results.length).toBe(0);
  });

  it('200 — sets X-Response-Time header', async () => {
    const res = await request(app)
      .get('/api/search/keyword')
      .query({ q: SEARCH_TERM })
      .expect(200);

    expect(res.headers['x-response-time']).toBeDefined();
  });
});

// ── Semantic search ───────────────────────────────────────────────────────────

describe('GET /api/search/semantic', () => {
  it('400 — requires q param', async () => {
    await request(app).get('/api/search/semantic').expect(400);
  });

  it('200 — returns array with correct shape', async () => {
    const res = await request(app)
      .get('/api/search/semantic')
      .query({ q: 'javascript testing' })
      .expect(200);

    expectSearchShape(res.body);
  });

  it('200 — sets X-Cache header (HIT or MISS)', async () => {
    const res = await request(app)
      .get('/api/search/semantic')
      .query({ q: 'react hooks' })
      .expect(200);

    expect(['HIT', 'MISS']).toContain(res.headers['x-cache']);
  });
});

// ── Hybrid search ─────────────────────────────────────────────────────────────

describe('GET /api/search/hybrid', () => {
  it('400 — requires q param', async () => {
    await request(app).get('/api/search/hybrid').expect(400);
  });

  it('200 — returns array with correct shape', async () => {
    const res = await request(app)
      .get('/api/search/hybrid')
      .query({ q: 'machine learning' })
      .expect(200);

    expectSearchShape(res.body);
  });

  it('200 — second call is a cache HIT', async () => {
    const q = `hybrid_cache_test_${ts}`;
    // First call — populates cache
    await request(app).get('/api/search/hybrid').query({ q }).expect(200);
    // Second call — should be served from Redis
    const res = await request(app).get('/api/search/hybrid').query({ q }).expect(200);
    expect(res.headers['x-cache']).toBe('HIT');
  });
});

// ── Related posts ─────────────────────────────────────────────────────────────

describe('GET /api/search/related/:postId', () => {
  it('200 — returns array for a valid post id', async () => {
    const res = await request(app)
      .get(`/api/search/related/${postId}`)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
  });

  it('200 — returns empty array for a non-existent post id', async () => {
    const res = await request(app)
      .get('/api/search/related/00000000-0000-4000-8000-000000000000')
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(0);
  });
});
