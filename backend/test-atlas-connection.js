const mongoose = require('mongoose');
require('dotenv').config();

const testAtlasConnection = async () => {
  try {
    console.log('🔄 Testing MongoDB Atlas connection...\n');

    const uri = process.env.MONGODB_URI || process.env.MONGODB_ATLAS_URI;

    if (!uri) {
      console.error('❌ No MongoDB URI found in environment variables');
      process.exit(1);
    }

    // Hide password in logs
    const safeUri = uri.replace(/\/\/([^:]+):([^@]+)@/, '//$1:****@');
    console.log('📡 Connecting to:', safeUri);

    await mongoose.connect(uri);

    console.log('✅ Successfully connected to MongoDB Atlas!\n');

    // Test database operations
    console.log('📊 Database Statistics:');
    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();

    console.log(`\n📁 Collections found: ${collections.length}`);

    for (const collection of collections) {
      const count = await db.collection(collection.name).countDocuments();
      console.log(`   - ${collection.name}: ${count} documents`);
    }

    console.log('\n✅ Migration successful! All data is accessible from Atlas.');

    await mongoose.disconnect();
    console.log('\n👋 Disconnected from MongoDB Atlas');

  } catch (error) {
    console.error('❌ Connection failed:', error.message);
    process.exit(1);
  }
};

testAtlasConnection();
