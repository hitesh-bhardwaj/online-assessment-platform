import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import User from '../models/User';
import Assessment from '../models/Assessment';
import Invitation from '../models/Invitation';
import AssessmentResult from '../models/AssessmentResult';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/assessment-platform';

async function checkRealData() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB\n');

    // Find the user
    const user = await User.findOne({ email: 'hitesh@weareenigma.com' });
    if (!user) {
      console.log('User not found!');
      await mongoose.disconnect();
      return;
    }

    console.log('=== USER FOUND ===');
    console.log(`Name: ${user.firstName} ${user.lastName}`);
    console.log(`Email: ${user.email}`);
    console.log(`Role: ${user.role}`);
    console.log(`Organization: ${user.organizationId}`);

    // Find assessments for this organization
    console.log('\n=== ASSESSMENTS ===');
    const assessments = await Assessment.find({ organizationId: user.organizationId })
      .select('title status createdAt')
      .sort({ createdAt: -1 });

    console.log(`Total Assessments: ${assessments.length}`);
    assessments.forEach((a, i) => {
      console.log(`${i + 1}. ${a.title} (${a.status}) - ${a.createdAt}`);
    });

    if (assessments.length === 0) {
      console.log('No assessments found for this organization.');
      await mongoose.disconnect();
      return;
    }

    // Find invitations
    console.log('\n=== INVITATIONS ===');
    const invitations = await Invitation.find({
      assessmentId: { $in: assessments.map(a => a._id) }
    }).select('email status assessmentId createdAt').sort({ createdAt: -1 }).limit(10);

    console.log(`Total Invitations: ${invitations.length}`);
    invitations.forEach((inv, i) => {
      console.log(`${i + 1}. ${inv.email} - Status: ${inv.status} - ${inv.createdAt}`);
    });

    if (invitations.length === 0) {
      console.log('No invitations found.');
      await mongoose.disconnect();
      return;
    }

    // Find assessment results
    console.log('\n=== ASSESSMENT RESULTS ===');
    const results = await AssessmentResult.find({
      invitationId: { $in: invitations.map(inv => inv._id) }
    }).select('invitationId status startedAt submittedAt proctoringReport').sort({ startedAt: -1 });

    console.log(`Total Assessment Results: ${results.length}\n`);

    if (results.length === 0) {
      console.log('No assessment results found.');
      await mongoose.disconnect();
      return;
    }

    // Detailed proctoring data analysis
    let totalWithProctoring = 0;
    let totalMediaSegments = 0;
    let totalLocalSegments = 0;
    let totalR2Segments = 0;
    let resultsWithRecordingUrls = 0;

    for (const result of results) {
      const hasProctoring = result.proctoringReport &&
        (result.proctoringReport.events?.length > 0 || result.proctoringReport.mediaSegments?.length > 0);

      if (hasProctoring) {
        totalWithProctoring++;
      }

      console.log(`\n━━━ Result ID: ${result._id} ━━━`);
      console.log(`Status: ${result.status}`);
      console.log(`Started: ${result.startedAt}`);
      console.log(`Submitted: ${result.submittedAt || 'N/A'}`);

      if (result.proctoringReport) {
        const report = result.proctoringReport;
        console.log(`\n📊 Proctoring Report:`);
        console.log(`  Events: ${report.events?.length || 0}`);
        console.log(`  Trust Score: ${report.trustScore}`);
        console.log(`  Risk Level: ${report.riskLevel}`);
        console.log(`  Summary: ${report.summary}`);

        // Check recording URLs
        if (report.recordingUrls) {
          resultsWithRecordingUrls++;
          console.log(`\n🎥 Recording URLs:`);
          console.log(`  Webcam: ${report.recordingUrls.webcam || 'MISSING'}`);
          console.log(`  Screen: ${report.recordingUrls.screen || 'MISSING'}`);
          console.log(`  Microphone: ${report.recordingUrls.microphone || 'N/A'}`);
        } else {
          console.log(`\n⚠️  NO RECORDING URLS FOUND`);
        }

        // Check media segments
        const mediaSegments = report.mediaSegments || [];
        totalMediaSegments += mediaSegments.length;

        if (mediaSegments.length > 0) {
          console.log(`\n💿 Media Segments (${mediaSegments.length} total):`);

          mediaSegments.forEach((segment, index) => {
            console.log(`\n  [${index + 1}] ${segment.type.toUpperCase()}`);
            console.log(`      Segment ID: ${segment.segmentId}`);
            console.log(`      Storage: ${segment.storage || 'UNKNOWN'}`);
            console.log(`      Size: ${segment.size ? `${(segment.size / 1024).toFixed(2)} KB` : 'UNKNOWN'}`);
            console.log(`      Duration: ${segment.durationMs ? `${(segment.durationMs / 1000).toFixed(1)}s` : 'UNKNOWN'}`);
            console.log(`      Recorded: ${segment.recordedAt}`);
            console.log(`      Sequence: ${segment.sequence ?? 'N/A'}`);

            if (segment.storage === 'local') {
              totalLocalSegments++;
              console.log(`      File Path: ${segment.filePath || 'MISSING'}`);
            } else if (segment.storage === 'r2') {
              totalR2Segments++;
              console.log(`      File Key: ${segment.fileKey || 'MISSING'}`);
              console.log(`      Public URL: ${segment.publicUrl || 'MISSING'}`);
            } else {
              console.log(`      ⚠️  STORAGE TYPE UNKNOWN OR MISSING`);
            }
          });
        } else {
          console.log(`\n⚠️  NO MEDIA SEGMENTS FOUND`);
        }
      } else {
        console.log(`\n⚠️  NO PROCTORING REPORT FOUND`);
      }
    }

    // Summary
    console.log('\n\n╔═══════════════════════════════════════════════════╗');
    console.log('║                    SUMMARY                        ║');
    console.log('╚═══════════════════════════════════════════════════╝');
    console.log(`Total Results: ${results.length}`);
    console.log(`Results with Proctoring Data: ${totalWithProctoring}`);
    console.log(`Results with Recording URLs: ${resultsWithRecordingUrls}`);
    console.log(`Total Media Segments: ${totalMediaSegments}`);
    console.log(`Local Storage Segments: ${totalLocalSegments}`);
    console.log(`R2 Storage Segments: ${totalR2Segments}`);

    if (totalMediaSegments === 0) {
      console.log('\n⚠️  CRITICAL: No media segments found in any assessment results!');
      console.log('This means recordings are NOT being saved to the database.');
    } else if (totalLocalSegments === 0 && totalR2Segments === 0) {
      console.log('\n⚠️  WARNING: Media segments exist but storage type is unknown!');
    } else {
      console.log('\n✅ Media segments are being saved to database.');
      if (totalR2Segments > 0) {
        console.log('✅ Some recordings are using R2 storage.');
      }
      if (totalLocalSegments > 0) {
        console.log('✅ Some recordings are using local storage.');
      }
    }

    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
  } catch (error) {
    console.error('Error:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

checkRealData();
