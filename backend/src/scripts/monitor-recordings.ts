import mongoose from 'mongoose';
import AssessmentResult from '../models/AssessmentResult';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/oap';

async function monitorRecordings() {
  try {
    console.log('🔍 Monitoring Recording System');
    console.log('================================\n');

    await mongoose.connect(MONGO_URI);

    // Find the most recent assessment result
    const latestResult = await AssessmentResult.findOne()
      .sort({ startedAt: -1 })
      .select('invitationId status startedAt submittedAt proctoringReport');

    if (!latestResult) {
      console.log('❌ No assessment results found in database.');
      console.log('\nTo test recordings:');
      console.log('1. Create an assessment as recruiter');
      console.log('2. Create an invitation');
      console.log('3. Take the assessment as candidate');
      console.log('4. Grant camera, microphone, and screen permissions');
      console.log('5. Wait 30 seconds');
      console.log('6. Run this script again\n');
      await mongoose.disconnect();
      return;
    }

    console.log(`📊 Latest Assessment Result: ${latestResult._id}`);
    console.log(`Status: ${latestResult.status}`);
    console.log(`Started: ${latestResult.startedAt}`);
    console.log(`Submitted: ${latestResult.submittedAt || 'In Progress'}\n`);

    if (!latestResult.proctoringReport) {
      console.log('⚠️  No proctoring report found for this result.');
      await mongoose.disconnect();
      return;
    }

    const report = latestResult.proctoringReport;
    const mediaSegments = report.mediaSegments || [];
    const webcamSegments = mediaSegments.filter(s => s.type === 'webcam');
    const screenSegments = mediaSegments.filter(s => s.type === 'screen');

    console.log('📹 Recording Status');
    console.log('───────────────────');
    console.log(`Total Media Segments: ${mediaSegments.length}`);
    console.log(`  - Webcam: ${webcamSegments.length}`);
    console.log(`  - Screen: ${screenSegments.length}`);
    console.log(`Events Logged: ${report.events?.length || 0}`);
    console.log(`Trust Score: ${report.trustScore}`);
    console.log(`Risk Level: ${report.riskLevel}\n`);

    // Check recording URLs
    console.log('🎥 Recording URLs');
    console.log('─────────────────');
    if (report.recordingUrls) {
      const webcamUrl = report.recordingUrls.webcam;
      const screenUrl = report.recordingUrls.screen;

      console.log(`Webcam URL: ${webcamUrl ? '✅ ' + webcamUrl : '❌ Missing'}`);
      console.log(`Screen URL: ${screenUrl ? '✅ ' + screenUrl : '❌ Missing'}\n`);
    } else {
      console.log('❌ No recording URLs object found\n');
    }

    // Check segment details
    if (mediaSegments.length > 0) {
      console.log('💿 Latest Segments (last 3)');
      console.log('───────────────────────────');

      const latest = mediaSegments.slice(-3);
      latest.forEach((segment, idx) => {
        const sizeKB = segment.size ? (segment.size / 1024).toFixed(2) : 'unknown';
        const duration = segment.durationMs ? (segment.durationMs / 1000).toFixed(1) : 'unknown';

        console.log(`\n[${idx + 1}] ${segment.type.toUpperCase()}`);
        console.log(`    Segment ID: ${segment.segmentId}`);
        console.log(`    Storage: ${segment.storage || '❌ Unknown'}`);
        console.log(`    Size: ${sizeKB} KB ${parseFloat(sizeKB) < 10 ? '⚠️  (Too small!)' : ''}`);
        console.log(`    Duration: ${duration}s`);
        console.log(`    Sequence: ${segment.sequence ?? 'N/A'}`);
        console.log(`    Recorded: ${new Date(segment.recordedAt).toLocaleTimeString()}`);

        if (segment.storage === 'r2') {
          console.log(`    Public URL: ${segment.publicUrl || '❌ Missing'}`);
        } else if (segment.storage === 'local') {
          console.log(`    File Path: ${segment.filePath || '❌ Missing'}`);
        }
      });
      console.log('');
    }

    // Analysis & Recommendations
    console.log('📋 Analysis');
    console.log('───────────');

    const issues: string[] = [];
    const success: string[] = [];

    // Check if recordings exist
    if (mediaSegments.length === 0) {
      issues.push('No media segments captured');
    } else {
      success.push(`${mediaSegments.length} media segments captured`);
    }

    // Check webcam recording
    if (webcamSegments.length === 0) {
      issues.push('Webcam recording not working');
    } else {
      success.push(`${webcamSegments.length} webcam segments`);
    }

    // Check screen recording
    if (screenSegments.length === 0) {
      issues.push('Screen recording not working');
    } else {
      success.push(`${screenSegments.length} screen segments`);
    }

    // Check file sizes
    const smallSegments = mediaSegments.filter(s => s.size && s.size < 1000);
    if (smallSegments.length > 0) {
      issues.push(`${smallSegments.length} segments are suspiciously small (< 1KB)`);
    }

    // Check recording URLs
    if (!report.recordingUrls || (!report.recordingUrls.webcam && !report.recordingUrls.screen)) {
      issues.push('Recording URLs not populated');
    } else {
      if (report.recordingUrls.webcam) success.push('Webcam URL populated');
      if (report.recordingUrls.screen) success.push('Screen URL populated');
    }

    // Check storage metadata
    const unknownStorage = mediaSegments.filter(s => !s.storage);
    if (unknownStorage.length > 0) {
      issues.push(`${unknownStorage.length} segments missing storage metadata`);
    }

    // Print results
    if (success.length > 0) {
      console.log('\n✅ Working:');
      success.forEach(s => console.log(`   - ${s}`));
    }

    if (issues.length > 0) {
      console.log('\n❌ Issues:');
      issues.forEach(i => console.log(`   - ${i}`));
    }

    if (issues.length === 0 && success.length > 0) {
      console.log('\n🎉 Everything looks good!');
    }

    // Recommendations
    if (issues.length > 0) {
      console.log('\n💡 Recommendations:');
      console.log('───────────────────');

      if (mediaSegments.length === 0) {
        console.log('1. Check browser console for recording errors');
        console.log('2. Ensure camera/mic/screen permissions granted');
        console.log('3. Check network tab for failed API calls');
        console.log('4. Verify backend logs for upload attempts');
      }

      if (webcamSegments.length === 0 && mediaSegments.length > 0) {
        console.log('1. Check if getUserMedia() is being called');
        console.log('2. Look for MediaRecorder errors in browser console');
        console.log('3. Verify webcam permission granted');
      }

      if (screenSegments.length === 0) {
        console.log('1. Check if getDisplayMedia() is being called');
        console.log('2. Look for screen share permission errors');
        console.log('3. Verify screen recording is enabled in assessment settings');
      }

      if (smallSegments.length > 0) {
        console.log('1. Check MediaRecorder.ondataavailable logs');
        console.log('2. Verify blob sizes in browser console');
        console.log('3. Check if MediaRecorder is recording properly');
      }

      if (!report.recordingUrls || (!report.recordingUrls.webcam && !report.recordingUrls.screen)) {
        console.log('1. Check candidateProctoringController.ts line 230-244');
        console.log('2. Verify storageInfo.storage is defined');
        console.log('3. Check backend logs for URL update messages');
      }
    }

    console.log('\n================================');
    console.log('Monitoring complete. Run again to check updates.\n');

    await mongoose.disconnect();
  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

// Run with watch mode if argument provided
const args = process.argv.slice(2);
if (args.includes('--watch')) {
  console.log('👀 Watch mode enabled. Monitoring every 5 seconds...\n');
  console.log('Press Ctrl+C to stop.\n');

  setInterval(() => {
    monitorRecordings().catch(console.error);
  }, 5000);
} else {
  monitorRecordings();
}
