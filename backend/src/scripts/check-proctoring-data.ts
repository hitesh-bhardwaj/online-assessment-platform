import mongoose from 'mongoose';
import AssessmentResult from '../models/AssessmentResult';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/assessment-platform';

async function checkProctoringData() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB\n');

    // Find all assessment results
    const results = await AssessmentResult.find({}).select('proctoringReport status startedAt');

    console.log(`Total Assessment Results: ${results.length}\n`);

    if (results.length === 0) {
      console.log('No assessment results found in database.');
      await mongoose.disconnect();
      return;
    }

    let totalWithProctoring = 0;
    let totalMediaSegments = 0;
    let totalLocalSegments = 0;
    let totalR2Segments = 0;

    for (const result of results) {
      if (result.proctoringReport) {
        totalWithProctoring++;
        const mediaSegments = result.proctoringReport.mediaSegments || [];
        totalMediaSegments += mediaSegments.length;

        console.log(`\n--- Result ID: ${result._id} ---`);
        console.log(`Status: ${result.status}`);
        console.log(`Started At: ${result.startedAt}`);
        console.log(`Proctoring Events: ${result.proctoringReport.events?.length || 0}`);
        console.log(`Media Segments: ${mediaSegments.length}`);
        console.log(`Trust Score: ${result.proctoringReport.trustScore}`);
        console.log(`Risk Level: ${result.proctoringReport.riskLevel}`);

        if (mediaSegments.length > 0) {
          console.log('\nMedia Segments:');
          mediaSegments.forEach((segment, index) => {
            console.log(`  ${index + 1}. Type: ${segment.type}`);
            console.log(`     Storage: ${segment.storage || 'unknown'}`);
            console.log(`     Segment ID: ${segment.segmentId}`);
            console.log(`     Size: ${segment.size ? `${(segment.size / 1024).toFixed(2)} KB` : 'unknown'}`);
            console.log(`     Duration: ${segment.durationMs ? `${(segment.durationMs / 1000).toFixed(2)}s` : 'unknown'}`);

            if (segment.storage === 'local') {
              totalLocalSegments++;
              console.log(`     File Path: ${segment.filePath || 'N/A'}`);
            } else if (segment.storage === 'r2') {
              totalR2Segments++;
              console.log(`     File Key: ${segment.fileKey || 'N/A'}`);
              console.log(`     Public URL: ${segment.publicUrl || 'N/A'}`);
            }
            console.log('');
          });
        }

        if (result.proctoringReport.recordingUrls) {
          console.log('Recording URLs:');
          console.log(`  Screen: ${result.proctoringReport.recordingUrls.screen || 'N/A'}`);
          console.log(`  Webcam: ${result.proctoringReport.recordingUrls.webcam || 'N/A'}`);
          console.log(`  Microphone: ${result.proctoringReport.recordingUrls.microphone || 'N/A'}`);
        }
      }
    }

    console.log('\n\n=== SUMMARY ===');
    console.log(`Total Results: ${results.length}`);
    console.log(`Results with Proctoring: ${totalWithProctoring}`);
    console.log(`Total Media Segments: ${totalMediaSegments}`);
    console.log(`Local Storage Segments: ${totalLocalSegments}`);
    console.log(`R2 Storage Segments: ${totalR2Segments}`);

    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
  } catch (error) {
    console.error('Error:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

checkProctoringData();
