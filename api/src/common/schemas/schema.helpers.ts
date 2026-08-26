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
