import path from 'path';
import dotenv from 'dotenv';
import mongoose from 'mongoose';

import connectDB from '../src/config/db';
import Organization from '../src/models/Organization';
import User from '../src/models/User';

async function createAdmin() {
  const envPath = path.resolve(__dirname, '../.env');
  dotenv.config({ path: envPath });

  await connectDB();

  const organizationName = 'Enigma Digital';
  const organizationDomain = 'enigmadigital.com';
  const organizationEmail = 'contact@enigmadigital.com';

  const adminEmail = 'admin@enigmadigital.com';
  const adminPassword = 'Admin@12345';
  const adminFirstName = 'Enigma';
  const adminLastName = 'Admin';

  try {
    let organization = await Organization.findOne({ name: organizationName });

    if (!organization) {
      organization = await Organization.create({
        name: organizationName,
        domain: organizationDomain,
        contactEmail: organizationEmail,
        branding: {
          primaryColor: '#1C64F2',
          secondaryColor: '#111827'
        },
        subscription: {
          plan: 'premium',
          startDate: new Date(),
          features: [
            'advanced_analytics',
            'proctoring',
            'custom_branding',
            'priority_support'
          ]
        },
        settings: {
          dataRetentionDays: 730,
          gdprCompliant: true,
          allowCandidateDataDownload: true,
          requireProctoringConsent: true,
          defaultAssessmentSettings: {
            timeLimit: 90,
            proctoringEnabled: true,
            shuffleQuestions: true,
            showResultsToCandidate: false
          }
        },
        isActive: true
      });
      console.log(`Created organization: ${organization.name} (${organization._id.toHexString()})`);
    } else {
      console.log(`Organization already exists: ${organization.name} (${organization._id.toHexString()})`);
    }

    let adminUser = await User.findOne({ email: adminEmail });

    if (!adminUser) {
      adminUser = await User.create({
        organizationId: organization._id,
        email: adminEmail,
        password: adminPassword,
        firstName: adminFirstName,
        lastName: adminLastName,
        role: 'admin',
        permissions: {} as any,
        isActive: true
      });
      console.log(`Created admin user: ${adminUser.email} (${adminUser._id.toHexString()})`);
    } else {
      adminUser.organizationId = organization._id;
      adminUser.role = 'admin';
      adminUser.isActive = true;
      await adminUser.save();
      console.log(`Updated existing admin user: ${adminUser.email}`);
    }

    console.log('\nLogin credentials ready:');
    console.log(`Organization: ${organizationName}`);
    console.log(`Admin email: ${adminEmail}`);
    console.log(`Admin password: ${adminPassword}`);

  } catch (error) {
    console.error('Failed to create admin user:', error);
  } finally {
    await mongoose.disconnect();
  }
}

createAdmin().catch((error) => {
  console.error('Unexpected error:', error);
  mongoose.disconnect().catch(() => undefined);
});
