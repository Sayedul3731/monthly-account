import type { Collection } from 'mongoose';

/** Replace only the old global category index, after its replacement is ready. */
export async function ensureCategoryOwnershipIndex(
  collection: Pick<Collection, 'createIndex' | 'indexes' | 'dropIndex'>,
): Promise<void> {
  await collection.createIndex(
    { userId: 1, type: 1, name: 1 },
    { unique: true, partialFilterExpression: { deletedAt: null } },
  );

  const indexes = await collection.indexes();
  const legacy = indexes.find(
    (index) =>
      index.name === 'type_1_name_1' &&
      Object.keys(index.key).length === 2 &&
      index.key.type === 1 &&
      index.key.name === 1,
  );
  if (!legacy?.name) return;
  try {
    await collection.dropIndex(legacy.name);
  } catch (error: unknown) {
    // Another API instance can finish the same migration during startup.
    if (
      !(
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 27
      )
    ) {
      throw error;
    }
  }
}
