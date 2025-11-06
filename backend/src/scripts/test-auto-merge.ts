import 'dotenv/config';
import mongoose from 'mongoose';
import { startRecordingMergeJob } from '../utils/recording-merge';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/oap';

async function testAutoMerge() {
  try {
    console.log('🧪 Testing Automatic Recording Merge');
    console.log('====================================\n');

    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB\n');

    // Use the existing test result ID
    const testResultId = '69044ac94baf71f67325419f';

    console.log(`Testing with result ID: ${testResultId}`);
    console.log('Starting background merge job...\n');

    // This simulates what happens when a candidate submits
    startRecordingMergeJob(testResultId);

    console.log('✅ Background merge job started!');
    console.log('\nNote: The merge runs asynchronously in the background.');
    console.log('Check the console logs above for merge progress.\n');

    // Wait a bit for the merge to complete (for testing purposes)
    console.log('Waiting 60 seconds for merge to complete...\n');
    await new Promise(resolve => setTimeout(resolve, 60000));

    console.log('Test complete! Check the logs above for merge results.');

    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB');
    process.exit(0);
  } catch (error) {
    console.error('❌ Test failed:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

testAutoMerge();
