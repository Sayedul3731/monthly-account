import {
  ClassSerializerInterceptor,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { getConnectionToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { Connection, Types } from 'mongoose';
import request from 'supertest';
import { App } from 'supertest/types';
import { SmtpMailerService } from '../src/infrastructure/auth/smtp-mailer.service';
import type { Membership } from '../src/modules/memberships/membership.schema';
import { MembershipType } from '../src/modules/memberships/membership-type.enum';
import type { AppRole } from '../src/modules/roles/app-role.schema';

jest.setTimeout(180_000);

type Session = {
  agent: ReturnType<typeof request.agent>;
  id: string;
  csrf: string;
};
type ResponseBody = { id: string; csrfToken: string; user: { id: string } };
function body<T = ResponseBody>(response: request.Response): T {
  return response.body as T;
}

describe('Launch flows on an isolated MongoDB replica set', () => {
  let database: MongoMemoryReplSet;
  let app: INestApplication<App>;
  let connection: Connection;
  let alice: Session;
  let bob: Session;
  let admin: Session;
  let expenseTypeId: string;
  let personalCategoryId: string;
  const resetMessages: { email: string; url: string }[] = [];
  const mailer = {
    ensureConfigured: jest.fn(),
    sendPasswordReset: jest.fn((email: string, url: string) => {
      resetMessages.push({ email, url });
      return Promise.resolve();
    }),
    sendEmailChangeVerification: jest.fn().mockResolvedValue(undefined),
  };
  const password = 'original-password-123';
  const savedEnvironment = { ...process.env };

  async function register(name: string): Promise<Session> {
    const agent = request.agent(app.getHttpServer());
    const result = await agent
      .post('/auth/register')
      .send({ name, email: `${name}@launch.test`, password })
      .expect(201);
    expect(body(result).user).not.toHaveProperty('password');
    expect(body(result).user).not.toHaveProperty('authenticationVersion');
    return { agent, id: body(result).user.id, csrf: body(result).csrfToken };
  }

  function transaction(clientRequestId: string) {
    return {
      clientRequestId,
      transactionTypeId: expenseTypeId,
      categoryId: personalCategoryId,
      amount: 125.5,
      description: 'Test expense',
      date: '2026-10-04',
    };
  }

  beforeAll(async () => {
    database = new MongoMemoryReplSet({ replSet: { count: 1 } });
    await database.start();
    // Never fall back to .env or an operator's real database.
    Object.assign(process.env, {
      NODE_ENV: 'test',
      MONGODB_URI: database.getUri('launch_e2e'),
      MONGODB_DNS_SERVERS: '',
      JWT_SECRET: 'isolated-test-access-secret',
      JWT_REFRESH_SECRET: 'isolated-test-refresh-secret',
      FRONTEND_URL: 'http://localhost:3000',
      API_URL: 'http://localhost:3001',
      NAGAD_PAYMENT_NUMBER: '01000000000',
      CRON_SECRET: 'isolated-cron-test-secret',
      GOOGLE_CLIENT_ID: 'test-client',
      GOOGLE_CLIENT_SECRET: 'test-secret',
      GOOGLE_CALLBACK_URL: 'http://localhost:3000/api/auth/google/callback',
    });
    const { AppModule } = await import('../src/app/app.module.js');
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(SmtpMailerService)
      .useValue(mailer)
      .compile();
    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );
    app.useGlobalInterceptors(
      new ClassSerializerInterceptor(app.get(Reflector)),
    );
    await app.init();
    connection = app.get<Connection>(getConnectionToken());
    await Promise.all(
      Object.values(connection.models).map((model) => model.init()),
    );
    alice = await register('alice');
    bob = await register('bob');
    admin = await register('admin');
    const adminRole = await connection
      .model<AppRole>('AppRole')
      .findOne({ name: 'admin' })
      .exec();
    await connection
      .collection('users')
      .updateOne(
        { _id: new Types.ObjectId(admin.id) },
        { $set: { roleId: adminRole!._id } },
      );
    const types = await alice.agent.get('/transaction-types').expect(200);
    expenseTypeId = body<{ id: string; name: string }[]>(types).find(
      (type) => type.name === 'expense',
    )!.id;
  });

  afterAll(async () => {
    if (app) await app.close();
    if (database) await database.stop();
    process.env = savedEnvironment;
  });

  it('reports database readiness and rejects missing or invalid cron authorization', async () => {
    await request(app.getHttpServer()).get('/health').expect(200);
    await request(app.getHttpServer())
      .get('/health/ready')
      .expect(200)
      .expect((result) => {
        expect(body<{ transactions: string }>(result).transactions).toBe(
          'supported',
        );
      });
    await request(app.getHttpServer())
      .get('/internal/monthly-summaries/run')
      .expect(401);
    await request(app.getHttpServer())
      .get('/internal/monthly-summaries/run')
      .set('Authorization', 'Bearer wrong')
      .expect(401);
  });

  it('keeps personal categories private and blocks cross-account changes', async () => {
    const created = await alice.agent
      .post('/categories/mine')
      .set('X-CSRF-Token', alice.csrf)
      .send({ name: 'Private groceries', type: 'expense', icon: '🍎' })
      .expect(201);
    personalCategoryId = body(created).id;
    const own = await alice.agent.get('/categories/mine').expect(200);
    expect(
      body<{ id: string }[]>(own).some(
        (category) => category.id === personalCategoryId,
      ),
    ).toBe(true);
    const other = await bob.agent.get('/categories/mine').expect(200);
    expect(
      body<{ id: string }[]>(other).some(
        (category) => category.id === personalCategoryId,
      ),
    ).toBe(false);
    await request(app.getHttpServer())
      .get(`/categories/${personalCategoryId}`)
      .expect(404);
    await bob.agent
      .patch(`/categories/mine/${personalCategoryId}`)
      .set('X-CSRF-Token', bob.csrf)
      .send({ name: 'Stolen' })
      .expect(404);
    await bob.agent
      .delete(`/categories/mine/${personalCategoryId}`)
      .set('X-CSRF-Token', bob.csrf)
      .expect(404);
  });

  it('creates one transaction under concurrent retries, rejects key reuse, and scopes keys to users', async () => {
    for (const date of ['2026-02-30', '2026-13-01', '2026-10-04T12:00:00Z']) {
      await alice.agent
        .post('/transactions')
        .set('X-CSRF-Token', alice.csrf)
        .send({ ...transaction(crypto.randomUUID()), date })
        .expect(400);
    }
    const key = crypto.randomUUID();
    const results = await Promise.all(
      Array.from({ length: 4 }, () =>
        alice.agent
          .post('/transactions')
          .set('X-CSRF-Token', alice.csrf)
          .send(transaction(key)),
      ),
    );
    expect(results.map((result) => result.status)).toEqual([
      201, 201, 201, 201,
    ]);
    expect(new Set(results.map((result) => body(result).id)).size).toBe(1);
    const createdId = body(results[0]).id;
    expect(
      await connection.collection('transactions').countDocuments({
        userId: new Types.ObjectId(alice.id),
        clientRequestId: key,
      }),
    ).toBe(1);
    await alice.agent
      .post('/transactions')
      .set('X-CSRF-Token', alice.csrf)
      .send({ ...transaction(key), amount: 999 })
      .expect(409);
    await bob.agent.get(`/transactions/${createdId}`).expect(404);
    await bob.agent
      .patch(`/transactions/${createdId}`)
      .set('X-CSRF-Token', bob.csrf)
      .send({ amount: 10 })
      .expect(404);
    await bob.agent
      .delete(`/transactions/${createdId}`)
      .set('X-CSRF-Token', bob.csrf)
      .expect(404);
    await bob.agent
      .post('/transactions')
      .set('X-CSRF-Token', bob.csrf)
      .send(transaction(crypto.randomUUID()))
      .expect(404);
    const shared = await bob.agent.get('/categories?type=expense').expect(200);
    await bob.agent
      .post('/transactions')
      .set('X-CSRF-Token', bob.csrf)
      .send({
        ...transaction(key),
        categoryId: body<{ id: string }[]>(shared)[0].id,
      })
      .expect(201);
    await alice.agent
      .delete(`/transactions/${createdId}`)
      .set('X-CSRF-Token', alice.csrf)
      .expect(204);
    await alice.agent
      .post('/transactions')
      .set('X-CSRF-Token', alice.csrf)
      .send(transaction(key))
      .expect(409);
  });

  it('enforces CSRF, supports custom-category budgets, and preserves another user’s budget', async () => {
    await alice.agent
      .post('/budgets')
      .send({
        year: 2026,
        month: 9,
        category: 'Private groceries',
        amount: 1000,
      })
      .expect(403);
    const budget = await alice.agent
      .post('/budgets')
      .set('X-CSRF-Token', alice.csrf)
      .send({
        year: 2026,
        month: 9,
        category: 'Private groceries',
        amount: 1000,
      })
      .expect(201);
    const repeatedBudgets = await Promise.all(
      Array.from({ length: 4 }, () =>
        alice.agent
          .post('/budgets')
          .set('X-CSRF-Token', alice.csrf)
          .send({
            year: 2026,
            month: 9,
            category: 'Private groceries',
            amount: 1000,
          }),
      ),
    );
    expect(repeatedBudgets.map((result) => result.status)).toEqual([
      201, 201, 201, 201,
    ]);
    expect(new Set(repeatedBudgets.map((result) => body(result).id))).toEqual(
      new Set([body(budget).id]),
    );
    const other = await bob.agent.get('/budgets?year=2026&month=9').expect(200);
    expect(other.body).toEqual([]);
    await bob.agent
      .delete(`/budgets/${body(budget).id}`)
      .set('X-CSRF-Token', bob.csrf)
      .expect(204);
    expect(
      (await alice.agent.get('/budgets?year=2026&month=9')).body,
    ).toHaveLength(1);
    await alice.agent
      .patch(`/categories/mine/${personalCategoryId}`)
      .set('X-CSRF-Token', alice.csrf)
      .send({ name: 'Renamed' })
      .expect(409);
    await alice.agent
      .patch(`/categories/mine/${personalCategoryId}`)
      .set('X-CSRF-Token', alice.csrf)
      .send({ icon: '🥕' })
      .expect(200);
    await alice.agent
      .delete(`/categories/mine/${personalCategoryId}`)
      .set('X-CSRF-Token', alice.csrf)
      .expect(409);
  });

  it('allows personal category editing/deletion only for its owner', async () => {
    const category = await bob.agent
      .post('/categories/mine')
      .set('X-CSRF-Token', bob.csrf)
      .send({ name: 'Unused', type: 'expense' })
      .expect(201);
    await bob.agent
      .patch(`/categories/mine/${body(category).id}`)
      .set('X-CSRF-Token', bob.csrf)
      .send({ name: 'Renamed unused' })
      .expect(200);
    await bob.agent
      .delete(`/categories/mine/${body(category).id}`)
      .set('X-CSRF-Token', bob.csrf)
      .expect(204);
  });

  it('permits one pending payment during a race and activates a plan exactly once', async () => {
    const membership = await connection
      .model<Membership>('Membership')
      .findOne({ type: MembershipType.PAID, deletedAt: null })
      .exec();
    const results = await Promise.all(
      ['PAYMENT-A', 'PAYMENT-B'].map((transactionId) =>
        alice.agent
          .post('/manual-payments')
          .set('X-CSRF-Token', alice.csrf)
          .send({
            membershipId: membership!.id,
            billingInterval: 'monthly',
            transactionId,
          }),
      ),
    );
    expect(results.map((result) => result.status).sort()).toEqual([201, 409]);
    const paymentId = body(results.find((result) => result.status === 201)!).id;
    await bob.agent.get(`/manual-payments/${paymentId}`).expect(403);
    const reviews = await Promise.all(
      Array.from({ length: 2 }, () =>
        admin.agent
          .patch(`/manual-payments/${paymentId}/review`)
          .set('X-CSRF-Token', admin.csrf)
          .send({
            status: 'approved',
            reviewNote: 'Verified in isolated test',
          }),
      ),
    );
    expect(reviews.map((result) => result.status).sort()).toEqual([200, 409]);
    const user = await connection
      .collection<{
        _id: Types.ObjectId;
        membershipId: Types.ObjectId;
        planEndsAt: Date;
      }>('users')
      .findOne({ _id: new Types.ObjectId(alice.id) });
    const payment = await connection
      .collection('manual_payments')
      .findOne({ _id: new Types.ObjectId(paymentId) });
    expect(user!.planEndsAt).toEqual(payment!.planEndsAt);
    expect(user!.membershipId.toString()).toBe(membership!.id);
  });

  it('uses root-scoped cookies for direct and /api-proxied sessions', async () => {
    const result = await alice.agent.post('/auth/refresh').expect(200);
    alice.csrf = body(result).csrfToken;
    const cookies = result.headers['set-cookie'] as unknown as string[];
    const refresh = cookies.find(
      (cookie) =>
        cookie.startsWith('daily_hisab_refresh_token=') &&
        !cookie.includes('Expires=Thu, 01 Jan 1970'),
    )!;
    expect(refresh).toContain('Path=/;');
    expect(refresh).toContain('HttpOnly');
    expect(refresh).toContain('SameSite=Lax');
    const state = await request(app.getHttpServer())
      .get('/auth/google')
      .expect(302);
    expect((state.headers['set-cookie'] as unknown as string[])[0]).toContain(
      'Path=/;',
    );
  });

  it('requests generic reset responses and atomically consumes a single-use token, revoking old sessions', async () => {
    const unknown = await request(app.getHttpServer())
      .post('/auth/forgot-password')
      .send({ email: 'unknown@launch.test' })
      .expect(202);
    const known = await request(app.getHttpServer())
      .post('/auth/forgot-password')
      .send({ email: 'alice@launch.test' })
      .expect(202);
    expect(known.body).toEqual(unknown.body);
    expect(resetMessages).toHaveLength(1);
    const token = new URL(resetMessages[0].url).searchParams.get('token')!;
    const stored = await connection
      .collection('users')
      .findOne({ _id: new Types.ObjectId(alice.id) });
    expect(stored!.passwordResetTokenHash).not.toBe(token);
    await request(app.getHttpServer())
      .post('/auth/reset-password')
      .send({ token, password: 'x'.repeat(65) })
      .expect(400);
    const resets = await Promise.all(
      Array.from({ length: 2 }, () =>
        request(app.getHttpServer())
          .post('/auth/reset-password')
          .send({ token, password: 'new-password-123' }),
      ),
    );
    expect(resets.map((result) => result.status).sort()).toEqual([204, 400]);
    await alice.agent.get('/auth/me').expect(401);
    await alice.agent.post('/auth/refresh').expect(401);
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'alice@launch.test', password })
      .expect(401);
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'alice@launch.test', password: 'new-password-123' })
      .expect(201);
    const expired = crypto.randomUUID().replace(/-/g, '').repeat(2);
    const { createHash } = await import('node:crypto');
    await connection.collection('users').updateOne(
      { _id: new Types.ObjectId(bob.id) },
      {
        $set: {
          passwordResetTokenHash: createHash('sha256')
            .update(expired)
            .digest('hex'),
          passwordResetExpiresAt: new Date(0),
        },
      },
    );
    await request(app.getHttpServer())
      .post('/auth/reset-password')
      .send({ token: expired, password: 'new-password-123' })
      .expect(400);
  });

  it('normalizes registration email and revokes captured access and refresh cookies at logout', async () => {
    await register('MixedCase');
    const agent = request.agent(app.getHttpServer());
    const login = await agent
      .post('/auth/login')
      .send({ email: 'mixedcase@launch.test', password })
      .expect(201);
    const capturedCookies = (login.headers['set-cookie'] as unknown as string[])
      .map((cookie) => cookie.split(';')[0])
      .join('; ');
    await agent
      .post('/auth/logout')
      .set('X-CSRF-Token', body(login).csrfToken)
      .expect(204);
    await request(app.getHttpServer())
      .get('/auth/me')
      .set('Cookie', capturedCookies)
      .expect(401);
    await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Cookie', capturedCookies)
      .expect(401);
  });
});
