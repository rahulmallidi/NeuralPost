/**
 * auth.test.js
 * Integration tests for /api/auth endpoints.
 * Uses a unique timestamp-suffixed email so runs never collide.
 * Cleans up by deleting the test user (cascades to all related rows).
 */
import request from 'supertest';
import app from '../app.js';
import db from '../config/db.js';

const ts = Date.now();
const TEST_USER = {
  email:    `jest_auth_${ts}@example.test`,
  username: `jest_auth_${ts}`,
  password: 'TestPass123!',
  blogName: 'Jest Auth Blog',
};

let userId;
let accessToken;
let refreshToken;

afterAll(async () => {
  if (userId) {
    // CASCADE removes all posts, tokens, analytics etc.
    await db.query('DELETE FROM users WHERE id = $1', [userId]);
  }
});

// ── Register ────────────────────────────────────────────────────────────────

describe('POST /api/auth/register', () => {
  it('201 — creates user and returns tokens', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send(TEST_USER)
      .expect(201);

    expect(res.body.user.email).toBe(TEST_USER.email);
    expect(res.body.user.username).toBe(TEST_USER.username);
    expect(res.body.user.password_hash).toBeUndefined();
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.refreshToken).toBeDefined();

    userId       = res.body.user.id;
    accessToken  = res.body.accessToken;
    refreshToken = res.body.refreshToken;
  });

  it('409 — rejects duplicate email', async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ ...TEST_USER, username: `${TEST_USER.username}_dup` })
      .expect(409);
  });

  it('409 — rejects duplicate username', async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ ...TEST_USER, email: `dup_${TEST_USER.email}` })
      .expect(409);
  });

  it('400 — rejects invalid email format', async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ email: 'not-an-email', username: 'validuser123', password: 'Password1!' })
      .expect(400);
  });

  it('400 — rejects short password', async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ email: 'short@example.test', username: 'shortpwuser', password: '123' })
      .expect(400);
  });
});

// ── Login ────────────────────────────────────────────────────────────────────

describe('POST /api/auth/login', () => {
  it('200 — returns user + tokens on valid credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: TEST_USER.email, password: TEST_USER.password })
      .expect(200);

    expect(res.body.user.email).toBe(TEST_USER.email);
    expect(res.body.user.password_hash).toBeUndefined();
    expect(res.body.accessToken).toBeDefined();

    accessToken  = res.body.accessToken;
    refreshToken = res.body.refreshToken;
  });

  it('401 — rejects wrong password', async () => {
    await request(app)
      .post('/api/auth/login')
      .send({ email: TEST_USER.email, password: 'WrongPassword99!' })
      .expect(401);
  });

  it('401 — rejects unknown email', async () => {
    await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@example.test', password: TEST_USER.password })
      .expect(401);
  });
});

// ── Refresh ───────────────────────────────────────────────────────────────────

describe('POST /api/auth/refresh', () => {
  it('200 — returns new access + refresh tokens', async () => {
    const res = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken })
      .expect(200);

    expect(res.body.accessToken).toBeDefined();
    expect(res.body.refreshToken).toBeDefined();

    // Update tokens for subsequent tests
    accessToken  = res.body.accessToken;
    refreshToken = res.body.refreshToken;
  });

  it('401 — rejects missing token body', async () => {
    await request(app)
      .post('/api/auth/refresh')
      .send({})
      .expect(401);
  });

  it('403 — rejects a tampered refresh token', async () => {
    await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: 'this.is.not.valid' })
      .expect(403);
  });
});

// ── /me ───────────────────────────────────────────────────────────────────────

describe('GET /api/auth/me', () => {
  it('200 — returns authenticated user profile', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(res.body.email).toBe(TEST_USER.email);
    expect(res.body.id).toBe(userId);
    expect(res.body.password_hash).toBeUndefined();
  });

  it('401 — rejects unauthenticated request', async () => {
    await request(app)
      .get('/api/auth/me')
      .expect(401);
  });

  it('403 — rejects a tampered access token', async () => {
    await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer bad.token.value')
      .expect(403);
  });
});

// ── Logout ────────────────────────────────────────────────────────────────────

describe('POST /api/auth/logout', () => {
  it('200 — logs out the authenticated user', async () => {
    const res = await request(app)
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(res.body.message).toMatch(/logged out/i);
  });

  it('401 — rejects unauthenticated logout', async () => {
    await request(app)
      .post('/api/auth/logout')
      .expect(401);
  });
});
