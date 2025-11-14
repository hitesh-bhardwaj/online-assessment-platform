require('dotenv').config();
const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGODB_URI || process.env.MONGODB_ATLAS_URI;

async function cleanupStalePaths() {
  await mongoose.connect(MONGO_URI);

  const AssessmentResult = mongoose.model('AssessmentResult', new mongoose.Schema({}, { strict: false }));

  const results = await AssessmentResult.find({
    'proctoringReport.mediaSegments.0': { $exists: true }
  });

  console.log(`Found ${results.length} results with segments\n`);

  let totalCleaned = 0;

  for (const result of results) {
    const segments = result.proctoringReport?.mediaSegments || [];
    let modified = false;

    for (const segment of segments) {
      // If segment is stored in R2 but has a filePath set, remove it
      if (segment.storage === 'r2' && segment.filePath) {
        console.log(`Cleaning stale filePath from R2 segment: ${segment.segmentId}`);
        delete segment.filePath;
        modified = true;
        totalCleaned++;
      }
    }

    if (modified) {
      result.markModified('proctoringReport');
      await result.save();
      console.log(`✅ Cleaned result ${result._id}`);
    }
  }

  console.log(`\n✅ Total segments cleaned: ${totalCleaned}`);
  await mongoose.disconnect();
}

cleanupStalePaths().catch(console.error);
