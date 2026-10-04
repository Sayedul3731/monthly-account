import { Types } from 'mongoose';

/** MongoDB's null match also includes legacy shared categories without an owner. */
export function visibleCategories(userId: string) {
  return { $or: [{ userId: null }, { userId: new Types.ObjectId(userId) }] };
}
