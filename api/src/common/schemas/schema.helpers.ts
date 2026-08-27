import { SchemaOptions } from 'mongoose';

/**
 * Shared JSON shape: expose `id` (string) instead of `_id`, drop `__v`.
 * Also stringify common ObjectId foreign-key fields.
 */
export function documentToJson(
  _doc: unknown,
  ret: Record<string, unknown>,
): Record<string, unknown> {
  const rawId = ret._id;
  ret.id =
    rawId != null && typeof rawId === 'object' && 'toString' in rawId
      ? (rawId as { toString: () => string }).toString()
      : rawId;
  delete ret._id;
  delete ret.__v;

  for (const key of [
    'roleId',
    'membershipId',
    'userId',
    'categoryId',
    'transactionTypeId',
  ] as const) {
    const value = ret[key];
    if (value != null && typeof value === 'object' && 'toString' in value) {
      ret[key] = (value as { toString: () => string }).toString();
    }
  }

  return ret;
}

export const baseSchemaOptions: SchemaOptions = {
  timestamps: true,
  toJSON: {
    virtuals: true,
    versionKey: false,
    transform: documentToJson,
  },
  toObject: {
    virtuals: true,
    versionKey: false,
    transform: documentToJson,
  },
};

/** Filter that excludes soft-deleted documents. */
export const notDeleted = <T extends Record<string, unknown>>(
  filter: T = {} as T,
): T & { deletedAt: null } => ({
  ...filter,
  deletedAt: null,
});

/** Apply schema toJSON transforms so Nest does not leak Mongoose internals. */
export function asPlain<T>(doc: { toJSON: () => unknown }): T {
  return doc.toJSON() as T;
}

export function asPlainList<T>(docs: Array<{ toJSON: () => unknown }>): T[] {
  return docs.map((doc) => asPlain<T>(doc));
}
