// scripts/fix-user-email-indexes.ts
import mongoose from 'mongoose';
import User from '../models/User';

type IndexInfo = {
  name?: string;
  key: Record<string, number>;
  unique?: boolean;
  [k: string]: any;
};

async function run() {
  await mongoose.connect(process.env.MONGODB_URI as string);

  const before = (await User.collection.indexes()) as IndexInfo[];
  console.log('Indexes BEFORE:');
  console.table(
    before.map(i => ({
      name: i.name,
      key: JSON.stringify(i.key),
      unique: !!i.unique,
    }))
  );

  // Drop any UNIQUE index with key exactly { email: 1 }
  for (const idx of before) {
    const key = idx.key || {};
    const isEmailOnly =
      Object.keys(key).length === 1 && Object.prototype.hasOwnProperty.call(key, 'email') && key.email === 1;
    const isUnique = !!idx.unique;

    if (isEmailOnly && isUnique) {
      try {
        if (idx.name) {
          await User.collection.dropIndex(idx.name); // <- idx.name is now safe
          console.log(`Dropped global unique email index by name: ${idx.name}`);
        } else {
          // Fallback: drop by key spec (driver accepts a spec too)
          await User.collection.dropIndex({ email: 1 } as any);
          console.log('Dropped global unique email index by spec: { email: 1 }');
        }
      } catch (e: any) {
        console.warn(`Failed to drop email unique index (${idx.name ?? '{ email: 1 }'}): ${e?.message}`);
      }
    }
  }

  // Ensure the compound UNIQUE index from your schema exists
  // (models/user.ts should have: UserSchema.index({ organizationId: 1, email: 1 }, { unique: true }))
  await User.syncIndexes();
  console.log('Synced indexes from schema');

  const after = (await User.collection.indexes()) as IndexInfo[];
  console.log('Indexes AFTER:');
  console.table(
    after.map(i => ({
      name: i.name,
      key: JSON.stringify(i.key),
      unique: !!i.unique,
    }))
  );

  await mongoose.disconnect();
}

run().catch(async (e) => {
  console.error(e);
  try { await mongoose.disconnect(); } catch {}
  process.exit(1);
});
