import 'dotenv/config';
import mongoose from 'mongoose';
import { validateRuntimeSecurityConfig } from '../infrastructure/config/security-config.validation';

async function checkLaunch(): Promise<void> {
  const failures: string[] = [];
  if (process.env.NODE_ENV !== 'production')
    failures.push('NODE_ENV must be production.');
  try {
    validateRuntimeSecurityConfig({
      nodeEnv: 'production',
      jwtSecret: process.env.JWT_SECRET,
      jwtRefreshSecret: process.env.JWT_REFRESH_SECRET,
    });
  } catch (error: unknown) {
    failures.push(
      error instanceof Error ? error.message : 'JWT configuration invalid.',
    );
  }
  for (const name of [
    'MONGODB_URI',
    'SMTP_HOST',
    'SMTP_USER',
    'SMTP_PASS',
    'SMTP_FROM',
    'NAGAD_PAYMENT_NUMBER',
  ]) {
    if (!process.env[name]?.trim()) failures.push(`${name} is required.`);
  }
  for (const name of ['FRONTEND_URL', 'API_URL']) {
    try {
      const values = process.env[name]?.split(',') ?? [];
      if (
        !values.length ||
        values.some((value) => new URL(value.trim()).protocol !== 'https:')
      )
        throw new Error();
    } catch {
      failures.push(`${name} must contain valid HTTPS URLs.`);
    }
  }
  const cronSecret = process.env.CRON_SECRET;
  if (
    !cronSecret ||
    cronSecret.length < 32 ||
    cronSecret.startsWith('replace-with-')
  )
    failures.push(
      'CRON_SECRET must be a random secret of at least 32 characters.',
    );
  if (process.env.GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_SECRET) {
    try {
      if (
        !process.env.GOOGLE_CLIENT_ID ||
        !process.env.GOOGLE_CLIENT_SECRET ||
        new URL(process.env.GOOGLE_CALLBACK_URL ?? '').protocol !== 'https:'
      )
        throw new Error();
    } catch {
      failures.push(
        'Google OAuth needs both credentials and an HTTPS callback URL.',
      );
    }
  }
  if (failures.length) throw new Error(failures.join('\n'));
  await mongoose.connect(process.env.MONGODB_URI!, {
    serverSelectionTimeoutMS: 10_000,
  });
  const db = mongoose.connection.db!;
  const topology = await db
    .admin()
    .command({ hello: 1, maxTimeMS: 3000 }, { timeoutMS: 3000 });
  if (!topology.setName && topology.msg !== 'isdbgrid')
    failures.push(
      'MongoDB must support transactions (replica set or sharded cluster).',
    );
  const legacyBudgets = await db
    .collection('budgets')
    .countDocuments({
      $or: [{ userId: { $exists: false } }, { userId: null }],
    });
  if (legacyBudgets)
    failures.push('Run the budget ownership migration before deployment.');
  const adminRole = await db
    .collection('app_roles')
    .findOne({ name: 'admin', deletedAt: null });
  if (
    !adminRole ||
    !(await db
      .collection('users')
      .countDocuments({ roleId: adminRole._id, deletedAt: null }))
  )
    failures.push('Bootstrap the first administrator.');
  for (const [collectionName, indexName] of [
    ['transactions', 'userId_1_clientRequestId_1'],
    ['manual_payments', 'one_pending_payment_per_user'],
    ['categories', 'userId_1_type_1_name_1'],
    ['budgets', 'userId_1_year_1_month_1_category_1'],
  ]) {
    const indexes = (await db
      .collection(collectionName)
      .listIndexes()
      .toArray()
      .catch(() => [])) as Array<{ name: string; unique?: boolean }>;
    if (
      !indexes.some(
        (index) => index.name === indexName && index.unique === true,
      )
    )
      failures.push(
        `${collectionName} is missing its required unique index. Start the updated API or run its migration.`,
      );
  }
  const pendingDuplicates = await db
    .collection('manual_payments')
    .aggregate([
      { $match: { status: 'pending', deletedAt: null } },
      { $group: { _id: '$userId', count: { $sum: 1 } } },
      { $match: { count: { $gt: 1 } } },
      { $count: 'groups' },
    ])
    .toArray();
  if (pendingDuplicates.length)
    failures.push(
      'Review existing duplicate pending payments before starting the updated API.',
    );
  if (failures.length) throw new Error(failures.join('\n'));
  console.log(
    'Production configuration and database checks passed. Verify SMTP delivery, OAuth, backup restoration, and monitoring on staging before public launch.',
  );
}

void checkLaunch()
  .catch((error: unknown) => {
    console.error(
      error instanceof Error ? error.message : 'Launch checks failed.',
    );
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
