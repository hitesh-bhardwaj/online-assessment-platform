import mongoose from 'mongoose';
import Assessment from '../models/Assessment';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/oap';

async function enableProctoring() {
  try {
    console.log('Connecting to MongoDB (oap database)...');
    await mongoose.connect(MONGO_URI);
    console.log('Connected successfully\n');

    // Find all assessments
    const assessments = await Assessment.find({});

    console.log(`Found ${assessments.length} assessment(s)\n`);

    if (assessments.length === 0) {
      console.log('No assessments found.');
      await mongoose.disconnect();
      return;
    }

    // Update each assessment to enable proctoring
    for (const assessment of assessments) {
      console.log(`📝 Assessment: ${assessment.title} (${assessment._id})`);
      console.log(`   Current proctoring enabled: ${assessment.settings?.proctoringSettings?.enabled || false}`);

      // Update proctoring settings
      if (!assessment.settings) {
        assessment.settings = {} as any;
      }

      if (!assessment.settings.proctoringSettings) {
        assessment.settings.proctoringSettings = {} as any;
      }

      const oldSettings = { ...assessment.settings.proctoringSettings };

      assessment.settings.proctoringSettings.enabled = true;
      assessment.settings.proctoringSettings.recordWebcam = true;
      assessment.settings.proctoringSettings.recordScreen = true;
      assessment.settings.proctoringSettings.detectTabSwitch = true;
      assessment.settings.proctoringSettings.detectCopyPaste = true;
      assessment.settings.proctoringSettings.detectMultipleMonitors = true;

      await assessment.save();

      console.log(`   ✅ Updated proctoring settings:`);
      console.log(`      - enabled: ${oldSettings.enabled} → true`);
      console.log(`      - recordWebcam: ${oldSettings.recordWebcam} → true`);
      console.log(`      - recordScreen: ${oldSettings.recordScreen} → true`);
      console.log(`      - detectTabSwitch: ${oldSettings.detectTabSwitch} → true`);
      console.log(`      - detectCopyPaste: ${oldSettings.detectCopyPaste} → true`);
      console.log(`      - detectMultipleMonitors: ${oldSettings.detectMultipleMonitors} → true\n`);
    }

    console.log('✅ All assessments updated with proctoring enabled!\n');
    console.log('📋 Next steps:');
    console.log('1. Create a new invitation (or use existing one)');
    console.log('2. Open the invitation link in incognito window');
    console.log('3. Grant camera, microphone, and screen permissions');
    console.log('4. Complete the assessment (wait at least 30 seconds)');
    console.log('5. Run: npx tsx src/scripts/monitor-recordings.ts\n');

    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

enableProctoring();
