require('dotenv').config();
const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGODB_URI || process.env.MONGODB_ATLAS_URI;

async function testAPIResponse() {
  await mongoose.connect(MONGO_URI);

  const AssessmentResult = mongoose.model('AssessmentResult', new mongoose.Schema({}, { strict: false }));

  const resultId = '6916fb8c520b10976be858a0';
  const result = await AssessmentResult.findById(resultId);

  if (!result) {
    console.log('Result not found');
    await mongoose.disconnect();
    return;
  }

  console.log('\n📊 Database State for Result:', resultId);
  console.log('=====================================\n');

  console.log('Merge Status:');
  console.log('  Webcam:', result.proctoringReport?.mergeStatus?.webcam || 'not set');
  console.log('  Screen:', result.proctoringReport?.mergeStatus?.screen || 'not set');
  console.log('');

  console.log('Recording URLs:');
  console.log('  Webcam:', result.proctoringReport?.recordingUrls?.webcam || 'not set');
  console.log('  Screen:', result.proctoringReport?.recordingUrls?.screen || 'not set');
  console.log('');

  console.log('Media Segments:', result.proctoringReport?.mediaSegments?.length || 0);
  if (result.proctoringReport?.mediaSegments?.length > 0) {
    console.log('  First 3 segments:');
    result.proctoringReport.mediaSegments.slice(0, 3).forEach((seg, i) => {
      console.log(`    ${i + 1}. Type: ${seg.type}, Sequence: ${seg.sequence}, Storage: ${seg.storage}`);
    });
  }
  console.log('');

  console.log('What Frontend API Should Return:');
  console.log('=====================================');
  console.log(JSON.stringify({
    proctoring: {
      recording: {
        latest: {
          webcam: result.proctoringReport?.recordingUrls?.webcam || null,
          screen: result.proctoringReport?.recordingUrls?.screen || null,
        }
      },
      mergeStatus: result.proctoringReport?.mergeStatus || null,
      mediaSegments: result.proctoringReport?.mediaSegments || []
    }
  }, null, 2));

  await mongoose.disconnect();
}

testAPIResponse().catch(console.error);
