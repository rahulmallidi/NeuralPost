/**
 * posts.test.js
 * Integration tests for /api/posts endpoints covering full CRUD lifecycle.
 * A fresh user + post is created per suite and deleted in afterAll.
 */
import request from 'supertest';
import app from '../app.js';
import db from '../config/db.js';

const ts = Date.now();
const TEST_USER = {
  email:    `jest_posts_${ts}@example.test`,
  username: `jest_posts_${ts}`,
  password: 'TestPass123!',
};

let userId;
let accessToken;
let postId;
let postSlug;

// Register a test user and keep the token for the entire suite
beforeAll(async () => {
  const res = await request(app)
    .post('/api/auth/register')
    .send(TEST_USER)
    .expect(201);

  userId      = res.body.user.id;
  accessToken = res.body.accessToken;
});

// Cascade-delete user (removes all posts, tags, analytics etc.)
afterAll(async () => {
  if (userId) {
    await db.query('DELETE FROM users WHERE id = $1', [userId]);
  }
});

// ── Create ────────────────────────────────────────────────────────────────────

describe('POST /api/posts', () => {
  it('201 — creates a draft post', async () => {
    const res = await request(app)
      .post('/api/posts')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        title:   `Jest Post ${ts}`,
        content: '## Hello\nThis is a **test** post created by Jest.',
        excerpt: 'Auto-generated test post.',
        status:  'draft',
        tags:    ['jest', 'testing'],
      })
      .expect(201);

    expect(res.body.title).toBe(`Jest Post ${ts}`);
    expect(res.body.status).toBe('draft');
    expect(res.body.slug).toBeDefined();
    expect(res.body.reading_time_mins).toBeGreaterThan(0);

    postId   = res.body.id;
    postSlug = res.body.slug;
  });

  it('400 — rejects post with empty title', async () => {
    await request(app)
      .post('/api/posts')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ title: '', content: 'some content' })
      .expect(400);
  });

  it('401 — rejects unauthenticated creation', async () => {
    await request(app)
      .post('/api/posts')
      .send({ title: 'Sneaky Post', content: 'Sneaky content' })
      .expect(401);
  });
});

// ── Get single ────────────────────────────────────────────────────────────────

describe('GET /api/posts/:slug', () => {
  it('200 — returns the post by slug (owner can see their own draft)', async () => {
    const res = await request(app)
      .get(`/api/posts/${postSlug}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(res.body.id).toBe(postId);
    expect(res.body.title).toBe(`Jest Post ${ts}`);
    expect(res.body.username).toBe(TEST_USER.username);
  });

  it('200 — returns post by UUID', async () => {
    const res = await request(app)
      .get(`/api/posts/${postId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(res.body.id).toBe(postId);
  });

  it('404 — returns 404 for unknown slug', async () => {
    await request(app)
      .get('/api/posts/this-slug-does-not-exist-xyz987')
      .expect(404);
  });
});

// ── Get drafts ────────────────────────────────────────────────────────────────

describe('GET /api/posts/my/drafts', () => {
  it('200 — returns the authenticated user\'s drafts', async () => {
    const res = await request(app)
      .get('/api/posts/my/drafts')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    const match = res.body.find(p => p.id === postId);
    expect(match).toBeDefined();
  });

  it('401 — rejects unauthenticated access', async () => {
    await request(app)
      .get('/api/posts/my/drafts')
      .expect(401);
  });
});

// ── Update ────────────────────────────────────────────────────────────────────

describe('PUT /api/posts/:id', () => {
  it('200 — updates title and content', async () => {
    const res = await request(app)
      .put(`/api/posts/${postId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ title: `Updated Post ${ts}`, content: '## Updated\nContent changed by Jest.' })
      .expect(200);

    expect(res.body.title).toBe(`Updated Post ${ts}`);

    // Keep slug in sync; slug is re-generated from the new title
    postSlug = res.body.slug;
  });

  it('404 — returns 404 for a post the user does not own', async () => {
    // Use a random UUID that certainly doesn't belong to this user
    await request(app)
      .put('/api/posts/00000000-0000-4000-a000-000000000000')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ title: 'Hijack', content: 'Nope' })
      .expect(404);
  });
});

// ── Publish ───────────────────────────────────────────────────────────────────

describe('POST /api/posts/:id/publish', () => {
  it('200 — publishes the draft', async () => {
    const res = await request(app)
      .post(`/api/posts/${postId}/publish`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(res.body.status).toBe('published');
    expect(res.body.published_at).toBeDefined();
  });

  it('404 — cannot re-publish (post is no longer a draft)', async () => {
    await request(app)
      .post(`/api/posts/${postId}/publish`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(404);
  });
});

// ── List ─────────────────────────────────────────────────────────────────────

describe('GET /api/posts', () => {
  it('200 — returns paginated published posts list', async () => {
    const res = await request(app)
      .get('/api/posts')
      .expect(200);

    expect(res.body.posts).toBeInstanceOf(Array);
    expect(res.body.pagination).toMatchObject({
      page:  1,
      limit: expect.any(Number),
      total: expect.any(Number),
      pages: expect.any(Number),
    });
  });

  it('200 — the newly-published test post appears in the list', async () => {
    const res = await request(app)
      .get('/api/posts')
      .expect(200);

    const found = res.body.posts.find(p => p.id === postId);
    expect(found).toBeDefined();
  });

  it('200 — pagination params are respected', async () => {
    const res = await request(app)
      .get('/api/posts?page=1&limit=5')
      .expect(200);

    expect(res.body.posts.length).toBeLessThanOrEqual(5);
    expect(res.body.pagination.limit).toBe(5);
  });
});

// ── Delete ────────────────────────────────────────────────────────────────────

describe('DELETE /api/posts/:id', () => {
  it('200 — deletes the post', async () => {
    const res = await request(app)
      .delete(`/api/posts/${postId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(res.body.message).toMatch(/deleted/i);
  });

  it('404 — double-delete returns 404', async () => {
    await request(app)
      .delete(`/api/posts/${postId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(404);
  });
});
