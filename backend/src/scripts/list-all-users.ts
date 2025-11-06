import mongoose from 'mongoose';
import User from '../models/User';
import Assessment from '../models/Assessment';
import Invitation from '../models/Invitation';
import AssessmentResult from '../models/AssessmentResult';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/assessment-platform';

async function listAllData() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB\n');

    // List all users
    const users = await User.find({}).select('email firstName lastName role organizationId');
    console.log(`=== ALL USERS (${users.length}) ===`);
    users.forEach((u, i) => {
      console.log(`${i + 1}. ${u.email} - ${u.firstName} ${u.lastName} - Role: ${u.role}`);
    });

    // List all assessments
    const assessments = await Assessment.find({}).select('title status organizationId createdAt');
    console.log(`\n=== ALL ASSESSMENTS (${assessments.length}) ===`);
    assessments.forEach((a, i) => {
      console.log(`${i + 1}. ${a.title} - ${a.status} - ${a.createdAt}`);
    });

    // List all invitations
    const invitations = await Invitation.find({}).select('email status assessmentId createdAt');
    console.log(`\n=== ALL INVITATIONS (${invitations.length}) ===`);
    invitations.forEach((inv, i) => {
      console.log(`${i + 1}. ${inv.email} - ${inv.status} - ${inv.createdAt}`);
    });

    // List all assessment results with proctoring data
    const results = await AssessmentResult.find({});
    console.log(`\n=== ALL ASSESSMENT RESULTS (${results.length}) ===`);

    if (results.length > 0) {
      results.forEach((r, i) => {
        console.log(`\n${i + 1}. Result ID: ${r._id}`);
        console.log(`   Status: ${r.status}`);
        console.log(`   Started: ${r.startedAt}`);
        console.log(`   Proctoring Events: ${r.proctoringReport?.events?.length || 0}`);
        console.log(`   Media Segments: ${r.proctoringReport?.mediaSegments?.length || 0}`);

        if (r.proctoringReport?.recordingUrls) {
          console.log(`   Recording URLs:`);
          console.log(`     - Webcam: ${r.proctoringReport.recordingUrls.webcam ? 'YES' : 'NO'}`);
          console.log(`     - Screen: ${r.proctoringReport.recordingUrls.screen ? 'YES' : 'NO'}`);
        }
      });
    }

    await mongoose.disconnect();
    console.log('\n\nDisconnected from MongoDB');
  } catch (error) {
    console.error('Error:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

listAllData();
