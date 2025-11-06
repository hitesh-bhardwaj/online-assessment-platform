import mongoose from 'mongoose';

export const toObjectId = (value: unknown): mongoose.Types.ObjectId | undefined => {
  if (!value) {
    return undefined;
  }
  if (value instanceof mongoose.Types.ObjectId) {
    return value;
  }
  if (typeof value === 'string' && mongoose.Types.ObjectId.isValid(value)) {
    return new mongoose.Types.ObjectId(value);
  }
  if (typeof value === 'object' && '_id' in (value as Record<string, unknown>)) {
    return toObjectId((value as { _id?: unknown })._id);
  }
  return undefined;
};

export const toObjectIdString = (value: unknown): string | undefined => {
  return toObjectId(value)?.toHexString();
};

export default toObjectId;
