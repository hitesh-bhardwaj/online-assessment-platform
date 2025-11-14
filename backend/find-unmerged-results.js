require('dotenv').config();
const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGODB_URI || process.env.MONGODB_ATLAS_URI;

async function findUnmergedResults() {
  await mongoose.connect(MONGO_URI);

  const AssessmentResult = mongoose.model('AssessmentResult', new mongoose.Schema({}, { strict: false }));

  // Find results with segments but no merge status or pending/processing merge
  const results = await AssessmentResult.find({
    'proctoringReport.mediaSegments.0': { $exists: true },
    $or: [
      { 'proctoringReport.mergeStatus': { $exists: false } },
      { 'proctoringReport.mergeStatus.webcam': 'pending' },
      { 'proctoringReport.mergeStatus.webcam': 'processing' },
      { 'proctoringReport.mergeStatus.screen': 'pending' },
      { 'proctoringReport.mergeStatus.screen': 'processing' },
    ]
  }).sort({ startedAt: -1 }).limit(5);

  console.log(`\n📊 Found ${results.length} unmerged results:\n`);

  results.forEach((r, i) => {
    const segCount = r.proctoringReport?.mediaSegments?.length || 0;
    const webcamStatus = r.proctoringReport?.mergeStatus?.webcam || 'not started';
    const screenStatus = r.proctoringReport?.mergeStatus?.screen || 'not started';
    console.log(`${i + 1}. Result ID: ${r._id}`);
    console.log(`   Segments: ${segCount}`);
    console.log(`   Webcam merge: ${webcamStatus}`);
    console.log(`   Screen merge: ${screenStatus}`);
    console.log(`   Started: ${r.startedAt}`);
    console.log('');
  });

  await mongoose.disconnect();
}

findUnmergedResults().catch(console.error);
