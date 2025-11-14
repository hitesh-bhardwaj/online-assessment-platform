require('dotenv').config();
const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGODB_URI || process.env.MONGODB_ATLAS_URI;

async function checkSegments() {
  await mongoose.connect(MONGO_URI);

  const AssessmentResult = mongoose.model('AssessmentResult', new mongoose.Schema({}, { strict: false }));

  const results = await AssessmentResult.find({
    'proctoringReport.mediaSegments.0': { $exists: true }
  }).sort({ startedAt: -1 }).limit(1);

  if (results.length === 0) {
    console.log('No results with segments found');
    await mongoose.disconnect();
    return;
  }

  const result = results[0];
  const segments = result.proctoringReport?.mediaSegments || [];

  console.log(`\n📊 Segment Analysis for Result: ${result._id}`);
  console.log(`Total segments: ${segments.length}\n`);

  segments.forEach((seg, i) => {
    console.log(`Segment ${i + 1}:`);
    console.log(`  Type: ${seg.type}`);
    console.log(`  Storage: ${seg.storage}`);
    console.log(`  Sequence: ${seg.sequence !== undefined ? seg.sequence : 'UNDEFINED ❌'}`);
    console.log(`  FileKey: ${seg.fileKey || 'N/A'}`);
    console.log(`  FilePath: ${seg.filePath || 'N/A'}`);
    console.log(`  Size: ${seg.size ? (seg.size / 1024).toFixed(2) + ' KB' : 'N/A'}`);
    console.log('');
  });

  // Check how many would pass the filter
  const validSegments = segments.filter(s => (s.filePath || s.fileKey) && s.sequence !== undefined);
  console.log(`\n✅ Segments that would pass filter: ${validSegments.length}`);
  console.log(`❌ Segments filtered out: ${segments.length - validSegments.length}`);

  if (segments.length - validSegments.length > 0) {
    console.log('\n⚠️  Filtered out segments:');
    segments.filter(s => !((s.filePath || s.fileKey) && s.sequence !== undefined)).forEach((seg, i) => {
      const missing = [];
      if (!seg.filePath && !seg.fileKey) missing.push('storage location');
      if (seg.sequence === undefined) missing.push('sequence number');
      console.log(`  - Segment missing: ${missing.join(', ')}`);
    });
  }

  await mongoose.disconnect();
}

checkSegments().catch(console.error);
