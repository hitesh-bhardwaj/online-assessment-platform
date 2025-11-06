import mongoose from 'mongoose';
import AssessmentResult from '../models/AssessmentResult';

const MONGO_URI = 'mongodb://localhost:27017/oap';  // Using the correct database!

async function checkOapData() {
  try {
    console.log('Connecting to MongoDB (oap database)...');
    await mongoose.connect(MONGO_URI);
    console.log('Connected successfully\n');

    // Find all assessment results with proctoring data
    const results = await AssessmentResult.find({});
    console.log(`=== ASSESSMENT RESULTS (${results.length}) ===\n`);

    if (results.length === 0) {
      console.log('No assessment results found.');
      await mongoose.disconnect();
      return;
    }

    let totalWithProctoring = 0;
    let totalMediaSegments = 0;
    let totalLocalSegments = 0;
    let totalR2Segments = 0;
    let resultsWithRecordingUrls = 0;
    let resultsWithMissingUrls = 0;

    for (const result of results) {
      const hasProctoring = result.proctoringReport &&
        (result.proctoringReport.events?.length > 0 || result.proctoringReport.mediaSegments?.length > 0);

      if (hasProctoring) {
        totalWithProctoring++;
      }

      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`Result ID: ${result._id}`);
      console.log(`Status: ${result.status}`);
      console.log(`Started: ${result.startedAt}`);
      console.log(`Submitted: ${result.submittedAt || 'N/A'}`);

      if (result.proctoringReport) {
        const report = result.proctoringReport;
        console.log(`\n📊 Proctoring Report:`);
        console.log(`  Events: ${report.events?.length || 0}`);
        console.log(`  Trust Score: ${report.trustScore}`);
        console.log(`  Risk Level: ${report.riskLevel}`);

        // Check recording URLs
        console.log(`\n🎥 Recording URLs:`);
        if (report.recordingUrls) {
          resultsWithRecordingUrls++;
          const hasWebcam = report.recordingUrls.webcam;
          const hasScreen = report.recordingUrls.screen;

          console.log(`  Webcam: ${hasWebcam || '❌ MISSING'}`);
          console.log(`  Screen: ${hasScreen || '❌ MISSING'}`);

          if (!hasWebcam || !hasScreen) {
            resultsWithMissingUrls++;
          }
        } else {
          resultsWithMissingUrls++;
          console.log(`  ❌ NO RECORDING URLS OBJECT FOUND`);
        }

        // Check media segments
        const mediaSegments = report.mediaSegments || [];
        totalMediaSegments += mediaSegments.length;

        console.log(`\n💿 Media Segments: ${mediaSegments.length} total`);

        if (mediaSegments.length > 0) {
          // Group by type
          const webcamSegments = mediaSegments.filter(s => s.type === 'webcam');
          const screenSegments = mediaSegments.filter(s => s.type === 'screen');

          console.log(`  - Webcam segments: ${webcamSegments.length}`);
          console.log(`  - Screen segments: ${screenSegments.length}`);

          // Show first few segments
          console.log(`\n  Showing first 3 segments:`);
          mediaSegments.slice(0, 3).forEach((segment, index) => {
            console.log(`\n    [${index + 1}] ${segment.type.toUpperCase()}`);
            console.log(`        Segment ID: ${segment.segmentId}`);
            console.log(`        Storage: ${segment.storage || '❌ UNKNOWN'}`);
            console.log(`        Size: ${segment.size ? `${(segment.size / 1024).toFixed(2)} KB` : '❌ UNKNOWN'}`);
            console.log(`        Duration: ${segment.durationMs ? `${(segment.durationMs / 1000).toFixed(1)}s` : '❌ UNKNOWN'}`);

            if (segment.storage === 'local') {
              totalLocalSegments++;
              console.log(`        File Path: ${segment.filePath || '❌ MISSING'}`);
            } else if (segment.storage === 'r2') {
              totalR2Segments++;
              console.log(`        File Key: ${segment.fileKey || '❌ MISSING'}`);
              console.log(`        Public URL: ${segment.publicUrl || '❌ MISSING'}`);
            } else {
              console.log(`        ⚠️  NO STORAGE INFO`);
            }
          });

          if (mediaSegments.length > 3) {
            console.log(`\n    ... and ${mediaSegments.length - 3} more segments`);
          }
        } else {
          console.log(`  ❌ NO MEDIA SEGMENTS FOUND!`);
        }
      } else {
        console.log(`\n❌ NO PROCTORING REPORT FOUND`);
      }

      console.log(''); // Empty line between results
    }

    // Summary
    console.log('\n\n╔═══════════════════════════════════════════════════╗');
    console.log('║                    SUMMARY                        ║');
    console.log('╚═══════════════════════════════════════════════════╝');
    console.log(`Total Results: ${results.length}`);
    console.log(`Results with Proctoring Data: ${totalWithProctoring}`);
    console.log(`Results with Recording URLs: ${resultsWithRecordingUrls}`);
    console.log(`Results with Missing URLs: ${resultsWithMissingUrls}`);
    console.log(`Total Media Segments: ${totalMediaSegments}`);
    console.log(`  - Local Storage: ${totalLocalSegments}`);
    console.log(`  - R2 Storage: ${totalR2Segments}`);
    console.log(`  - Unknown Storage: ${totalMediaSegments - totalLocalSegments - totalR2Segments}`);

    console.log('\n╔═══════════════════════════════════════════════════╗');
    console.log('║                  DIAGNOSIS                        ║');
    console.log('╚═══════════════════════════════════════════════════╝');

    if (totalMediaSegments === 0) {
      console.log('❌ CRITICAL: No media segments found in any assessment results!');
      console.log('   → Recordings are NOT being saved to the database.');
      console.log('   → Check if frontend is uploading to /api/candidate/proctoring/media');
      console.log('   → Check backend logs for upload errors');
    } else {
      console.log('✅ Media segments ARE being saved to database.');

      if (resultsWithMissingUrls > 0) {
        console.log(`⚠️  WARNING: ${resultsWithMissingUrls} results have segments but missing recording URLs`);
        console.log('   → recordingUrls object is not being populated correctly');
        console.log('   → Check candidateProctoringController.ts line 228-233');
      }

      if (totalR2Segments === 0 && totalLocalSegments === 0) {
        console.log('⚠️  WARNING: Media segments exist but storage type is unknown!');
        console.log('   → Check if storage.ts is returning storage info correctly');
      } else {
        if (totalR2Segments > 0) {
          console.log(`✅ ${totalR2Segments} recordings using R2 storage.`);
        }
        if (totalLocalSegments > 0) {
          console.log(`✅ ${totalLocalSegments} recordings using local storage.`);
        }
      }
    }

    await mongoose.disconnect();
    console.log('\n\nDisconnected from MongoDB');
  } catch (error) {
    console.error('Error:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

checkOapData();
