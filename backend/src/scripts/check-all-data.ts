import mongoose from 'mongoose';
import Assessment from '../models/Assessment';
import Invitation from '../models/Invitation';
import AssessmentResult from '../models/AssessmentResult';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/assessment-platform';

async function checkAllData() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB\n');

    // Check Assessments
    const assessments = await Assessment.find({}).select('title status createdAt');
    console.log(`=== ASSESSMENTS (${assessments.length}) ===`);
    assessments.forEach((a, i) => {
      console.log(`${i + 1}. ${a.title} (${a.status}) - Created: ${a.createdAt}`);
    });

    // Check Invitations
    const invitations = await Invitation.find({}).select('email status assessmentId createdAt');
    console.log(`\n=== INVITATIONS (${invitations.length}) ===`);
    invitations.forEach((inv, i) => {
      console.log(`${i + 1}. ${inv.email} - Status: ${inv.status} - Created: ${inv.createdAt}`);
    });

    // Check Assessment Results
    const results = await AssessmentResult.find({}).select('invitationId status startedAt submittedAt proctoringReport');
    console.log(`\n=== ASSESSMENT RESULTS (${results.length}) ===`);

    if (results.length === 0) {
      console.log('No assessment results found.');
    } else {
      results.forEach((r, i) => {
        console.log(`${i + 1}. Invitation: ${r.invitationId} - Status: ${r.status}`);
        console.log(`   Started: ${r.startedAt}`);
        console.log(`   Submitted: ${r.submittedAt || 'N/A'}`);
        console.log(`   Proctoring Events: ${r.proctoringReport?.events?.length || 0}`);
        console.log(`   Media Segments: ${r.proctoringReport?.mediaSegments?.length || 0}`);
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

checkAllData();
