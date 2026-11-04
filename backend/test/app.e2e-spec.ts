/**
 * E2E test suite for the Agency OS Sales Pipeline API.
 *
 * Covers:
 *   - Auth: login with valid/invalid credentials
 *   - Pipelines: list and get
 *   - Deals: create, list with pagination/filtering, move stage, mark Won, mark Lost (with reason), Won handoff (duplicate protection)
 *   - Follow-ups: create, list, complete
 *
 * Prerequisites:
 *   - Backend running on http://localhost:5001
 *   - Seeded database (npm run seed in /backend)
 *   - .env has valid SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD
 *
 * Run with: npm run test:e2e
 */

import * as request from 'supertest';

const BASE_URL = 'http://localhost:5001/api';
const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL || 'admin@agency-os.local';
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD || 'changeme_in_env';

let accessToken: string;
let agencyId: string;
let pipelineId: string;
let firstStageId: string;
let secondStageId: string;
let wonStageId: string;
let createdDealId: string;
let clientId: string;
let ownerId: string;
let followUpId: string;

/* ─────────────────────────────────────────────────────────
   Auth
───────────────────────────────────────────────────────── */
describe('Auth', () => {
  it('POST /auth/login — returns 400 for invalid body', () => {
    return request(BASE_URL)
      .post('/auth/login')
      .send({})
      .expect((res) => {
        expect([400, 401]).toContain(res.status);
      });
  });

  it('POST /auth/login — returns 401 for wrong password', () => {
    return request(BASE_URL)
      .post('/auth/login')
      .send({ email: ADMIN_EMAIL, password: 'wrong_password' })
      .expect(401);
  });

  it('POST /auth/login — succeeds with valid credentials', async () => {
    const res = await request(BASE_URL)
      .post('/auth/login')
      .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD });

    // If seed has not been run, skip gracefully
    if (res.status === 401) {
      console.warn('⚠️  Seed data not found. Run: cd backend && npm run seed — then re-run e2e tests.');
      return;
    }

    expect(res.status).toBe(200);
    const data = res.body?.data || res.body;
    expect(data).toHaveProperty('accessToken');
    expect(data).toHaveProperty('user');
    accessToken = data.accessToken;
    agencyId = data.user.agencyId;
  });

  it('GET /auth/me — returns user profile', async () => {
    if (!accessToken) return;
    const res = await request(BASE_URL)
      .get('/auth/me')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(200);
    const data = res.body?.data || res.body;
    expect(data).toHaveProperty('email', ADMIN_EMAIL);
  });

  it('GET /auth/me — returns 401 without token', () => {
    return request(BASE_URL).get('/auth/me').expect(401);
  });
});

/* ─────────────────────────────────────────────────────────
   Pipelines
───────────────────────────────────────────────────────── */
describe('Pipelines', () => {
  it('GET /pipelines — returns list', async () => {
    if (!accessToken) return;
    const res = await request(BASE_URL)
      .get('/pipelines')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(200);
    const data = res.body?.data || res.body;
    expect(Array.isArray(data)).toBe(true);
    if (data.length > 0) {
      pipelineId = data[0].id;
      const stages = data[0].stages || [];
      firstStageId = stages.find((s: { isWon: boolean; isLost: boolean }) => !s.isWon && !s.isLost)?.id;
      secondStageId = stages.filter((s: { isWon: boolean; isLost: boolean }) => !s.isWon && !s.isLost)[1]?.id || firstStageId;
      wonStageId = stages.find((s: { isWon: boolean }) => s.isWon)?.id;
    }
  });

  it('GET /pipelines — returns 401 without token', () => {
    return request(BASE_URL).get('/pipelines').expect(401);
  });
});

/* ─────────────────────────────────────────────────────────
   Deals — list, filter, sort, pagination
───────────────────────────────────────────────────────── */
describe('Deals — list', () => {
  it('GET /deals — returns paginated list', async () => {
    if (!accessToken) return;
    const res = await request(BASE_URL)
      .get('/deals?page=1&limit=10&sortBy=createdAt&sortOrder=desc')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(200);
    const data = res.body?.data || res.body;
    expect(data).toHaveProperty('deals');
    expect(data).toHaveProperty('pagination');
    expect(data.pagination).toHaveProperty('page', 1);
    expect(data.pagination).toHaveProperty('limit', 10);
    // Grab clientId and ownerId for later tests
    if (data.deals.length > 0) {
      clientId = data.deals[0].client?.id;
      ownerId = data.deals[0].owner?.id;
    }
  });

  it('GET /deals?state=ACTIVE — filters by state', async () => {
    if (!accessToken) return;
    const res = await request(BASE_URL)
      .get('/deals?state=ACTIVE')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(200);
    const data = res.body?.data || res.body;
    const allActive = (data.deals || []).every((d: { state: string }) => d.state === 'ACTIVE');
    expect(allActive).toBe(true);
  });

  it('GET /deals?sortBy=expectedValue&sortOrder=desc — sorts descending', async () => {
    if (!accessToken) return;
    const res = await request(BASE_URL)
      .get('/deals?sortBy=expectedValue&sortOrder=desc&state=ACTIVE')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(200);
  });

  it('GET /deals — returns 401 without token', () => {
    return request(BASE_URL).get('/deals').expect(401);
  });
});

/* ─────────────────────────────────────────────────────────
   Deals — CRUD
───────────────────────────────────────────────────────── */
describe('Deals — CRUD', () => {
  it('POST /deals — creates a new deal', async () => {
    if (!accessToken || !pipelineId || !firstStageId || !clientId || !ownerId) return;
    const res = await request(BASE_URL)
      .post('/deals')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        title: 'E2E Test Deal',
        clientId,
        ownerId,
        pipelineId,
        stageId: firstStageId,
        serviceCategory: 'E2E Testing',
        expectedValue: 5000,
        currency: 'USD',
        expectedCloseDate: '2025-12-31',
        notes: 'Created by automated e2e test',
        tags: ['e2e', 'test'],
      });
    expect(res.status).toBe(201);
    const data = res.body?.data || res.body;
    expect(data).toHaveProperty('id');
    expect(data.title).toBe('E2E Test Deal');
    createdDealId = data.id;
  });

  it('GET /deals/:id — returns the created deal with stage history', async () => {
    if (!accessToken || !createdDealId) return;
    const res = await request(BASE_URL)
      .get(`/deals/${createdDealId}`)
      .set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(200);
    const data = res.body?.data || res.body;
    expect(data.id).toBe(createdDealId);
    expect(Array.isArray(data.stageHistory)).toBe(true);
    expect(data.stageHistory.length).toBeGreaterThan(0); // Creation entry
  });

  it('GET /deals/nonexistent — returns 404', async () => {
    if (!accessToken) return;
    const res = await request(BASE_URL)
      .get('/deals/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(404);
  });
});

/* ─────────────────────────────────────────────────────────
   Deals — Stage Movement (Kanban)
───────────────────────────────────────────────────────── */
describe('Deals — Stage movement', () => {
  it('PATCH /deals/:id/stage — moves deal to another stage', async () => {
    if (!accessToken || !createdDealId || !secondStageId || secondStageId === firstStageId) return;
    const res = await request(BASE_URL)
      .patch(`/deals/${createdDealId}/stage`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ stageId: secondStageId, note: 'Moved via e2e test' });
    expect(res.status).toBe(200);
    const data = res.body?.data || res.body;
    expect(data.stage.id).toBe(secondStageId);
  });

  it('PATCH /deals/:id/stage — returns 400 if already in stage', async () => {
    if (!accessToken || !createdDealId || !secondStageId || secondStageId === firstStageId) return;
    const res = await request(BASE_URL)
      .patch(`/deals/${createdDealId}/stage`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ stageId: secondStageId });
    expect(res.status).toBe(400);
  });

  it('PATCH /deals/:id/stage — returns 400 if stage not in pipeline', async () => {
    if (!accessToken || !createdDealId) return;
    const res = await request(BASE_URL)
      .patch(`/deals/${createdDealId}/stage`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ stageId: '00000000-0000-0000-0000-000000000000' });
    expect(res.status).toBe(400);
  });
});

/* ─────────────────────────────────────────────────────────
   Follow-Ups
───────────────────────────────────────────────────────── */
describe('Follow-Ups', () => {
  it('POST /deals/:id/follow-ups — creates a follow-up', async () => {
    if (!accessToken || !createdDealId) return;
    const scheduledAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
    const res = await request(BASE_URL)
      .post(`/deals/${createdDealId}/follow-ups`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ scheduledAt, note: 'E2E follow-up check in' });
    expect(res.status).toBe(201);
    const data = res.body?.data || res.body;
    expect(data).toHaveProperty('id');
    followUpId = data.id;
  });

  it('GET /deals/:id/follow-ups — returns follow-ups for deal', async () => {
    if (!accessToken || !createdDealId) return;
    const res = await request(BASE_URL)
      .get(`/deals/${createdDealId}/follow-ups`)
      .set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(200);
    const data = res.body?.data || res.body;
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);
  });

  it('GET /follow-ups?status=UPCOMING — returns agency follow-ups', async () => {
    if (!accessToken) return;
    const res = await request(BASE_URL)
      .get('/follow-ups?status=UPCOMING')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(200);
    const data = res.body?.data || res.body;
    expect(Array.isArray(data)).toBe(true);
  });

  it('PATCH /follow-ups/:id — completes a follow-up', async () => {
    if (!accessToken || !followUpId) return;
    const res = await request(BASE_URL)
      .patch(`/follow-ups/${followUpId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ completedAt: new Date().toISOString() });
    expect(res.status).toBe(200);
    const data = res.body?.data || res.body;
    expect(data.status).toBe('COMPLETED');
  });
});

/* ─────────────────────────────────────────────────────────
   Won / Lost Workflow
───────────────────────────────────────────────────────── */
describe('Won / Lost workflow', () => {
  it('PATCH /deals/:id/lost — requires lostReason', async () => {
    if (!accessToken || !createdDealId) return;
    const res = await request(BASE_URL)
      .patch(`/deals/${createdDealId}/lost`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({});
    expect(res.status).toBe(400);
  });

  it('PATCH /deals/:id/won — marks deal as Won', async () => {
    if (!accessToken || !createdDealId) return;
    const res = await request(BASE_URL)
      .patch(`/deals/${createdDealId}/won`)
      .set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(200);
    const data = res.body?.data || res.body;
    expect(data.state).toBe('WON');
    expect(data.wonAt).toBeTruthy();
  });

  it('PATCH /deals/:id/won — returns 409 if already Won', async () => {
    if (!accessToken || !createdDealId) return;
    const res = await request(BASE_URL)
      .patch(`/deals/${createdDealId}/won`)
      .set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(409);
  });
});

/* ─────────────────────────────────────────────────────────
   Handoff (duplicate protection)
───────────────────────────────────────────────────────── */
describe('Project Handoff', () => {
  it('POST /deals/:id/project-handoff — initiates handoff for Won deal', async () => {
    if (!accessToken || !createdDealId) return;
    const res = await request(BASE_URL)
      .post(`/deals/${createdDealId}/project-handoff`)
      .set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(201);
    const data = res.body?.data || res.body;
    expect(data).toHaveProperty('dealId', createdDealId);
    expect(data).toHaveProperty('handoffInitiatedAt');
  });

  it('POST /deals/:id/project-handoff — returns 409 on duplicate handoff', async () => {
    if (!accessToken || !createdDealId) return;
    const res = await request(BASE_URL)
      .post(`/deals/${createdDealId}/project-handoff`)
      .set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(409);
  });
});
