import 'dotenv/config';
import mongoose, { Types } from 'mongoose';
import { setServers } from 'node:dns';

async function migrate() {
  const uri = process.env.MONGODB_URI;
  const ownerId = process.env.LEGACY_BUDGET_OWNER_ID;

  if (!uri) throw new Error('MONGODB_URI is required.');

  const dnsServers = (process.env.MONGODB_DNS_SERVERS ?? '')
    .split(',')
    .map((server) => server.trim())
    .filter(Boolean);
  if (uri.startsWith('mongodb+srv://') && dnsServers.length > 0) {
    setServers(dnsServers);
  }

  await mongoose.connect(uri);
  const budgets = mongoose.connection.collection('budgets');
  const missingOwner = await budgets.countDocuments({ userId: { $exists: false } });

  if (missingOwner > 0) {
    if (!ownerId || !Types.ObjectId.isValid(ownerId)) {
      throw new Error(
        'LEGACY_BUDGET_OWNER_ID must be the ObjectId of the account that owns existing budgets.',
      );
    }

    const owner = await mongoose.connection
      .collection('users')
      .findOne({ _id: new Types.ObjectId(ownerId), deletedAt: null });
    if (!owner) {
      throw new Error('LEGACY_BUDGET_OWNER_ID does not identify an active user.');
    }

    await budgets.updateMany(
      { userId: { $exists: false } },
      { $set: { userId: new Types.ObjectId(ownerId) } },
    );
  }

  const indexes = await budgets.indexes();
  const legacyIndex = indexes.find(
    (index) =>
      index.name === 'year_1_month_1_category_1' &&
      JSON.stringify(index.key) === JSON.stringify({ year: 1, month: 1, category: 1 }),
  );
  if (legacyIndex?.name) await budgets.dropIndex(legacyIndex.name);

  await budgets.createIndex(
    { userId: 1, year: 1, month: 1, category: 1 },
    {
      unique: true,
      partialFilterExpression: { deletedAt: null },
      name: 'userId_1_year_1_month_1_category_1',
    },
  );

  console.log(
    missingOwner
      ? `Migrated ${missingOwner} legacy budget(s) to user ${ownerId}.`
      : 'No legacy budgets found; replaced the budget index.',
  );
}

migrate()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
