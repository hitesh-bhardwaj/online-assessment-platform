import mongoose from 'mongoose';
import { Organization, User } from './models';
import connectDB from './config/db';

async function seedTestData() {
  try {
    // Connect to database
    await connectDB();
    console.log('✅ Connected to database');

    // Clear existing test data
    console.log('🧹 Cleaning existing test data...');
    await Organization.deleteMany({ domain: 'testorg.com' });
    await User.deleteMany({ email: /test.*@testorg\.com/ });

    // Create test organization
    console.log('🏢 Creating test organization...');
    const testOrg = await Organization.create({
      name: 'Test Organization',
      domain: 'testorg.com',
      contactEmail: 'admin@testorg.com',
      branding: {
        logoUrl: '',
        primaryColor: '#007bff',
        secondaryColor: '#6c757d',
        emailTemplates: {
          invitation: 'Welcome to the assessment!',
          reminder: 'Don\'t forget to complete your assessment!',
          results: 'Your assessment results are ready!'
        }
      },
      subscription: {
        plan: 'premium',
        startDate: new Date(),
        endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year from now
        features: ['unlimited_assessments', 'advanced_analytics', 'custom_branding', 'api_access'],
        maxAssessments: 100,
        maxCandidatesPerMonth: 1000
      },
      settings: {
        dataRetentionDays: 365,
        gdprCompliant: true,
        allowCandidateDataDownload: true,
        requireProctoringConsent: false,
        defaultAssessmentSettings: {
          timeLimit: 120,
          proctoringEnabled: false,
          shuffleQuestions: true,
          showResultsToCandidate: true
        }
      },
      isActive: true
    });

    console.log(`✅ Test organization created: ${testOrg._id}`);

    // Create admin user
    console.log('👤 Creating admin user...');
    const adminUser = await User.create({
      email: 'admin@testorg.com',
      password: 'AdminTest123!', // Will be hashed by the pre-save middleware
      firstName: 'Admin',
      lastName: 'User',
      role: 'admin',
      organizationId: testOrg._id,
      permissions: {
        users: { create: true, read: true, update: true, delete: true },
        assessments: { create: true, read: true, update: true, delete: true },
        questions: { create: true, read: true, update: true, delete: true },
        invitations: { create: true, read: true, update: true, delete: true },
        results: { create: true, read: true, update: true, delete: true },
        reports: { create: true, read: true, update: true, delete: true },
        settings: { create: true, read: true, update: true, delete: true }
      },
      isActive: true,
      profile: {
        avatar: '',
        timezone: 'UTC',
        language: 'en',
        bio: 'Test admin user for API testing'
      },
      preferences: {
        emailNotifications: true,
        dashboardLayout: 'default',
        defaultQuestionType: 'mcq'
      }
    });

    console.log(`✅ Admin user created: ${adminUser._id}`);

    // Create recruiter user
    console.log('👤 Creating recruiter user...');
    const recruiterUser = await User.create({
      email: 'recruiter@testorg.com',
      password: 'RecruiterTest123!',
      firstName: 'John',
      lastName: 'Recruiter',
      role: 'recruiter',
      organizationId: testOrg._id,
      permissions: {
        users: { create: false, read: true, update: false, delete: false },
        assessments: { create: true, read: true, update: true, delete: false },
        questions: { create: true, read: true, update: true, delete: false },
        invitations: { create: true, read: true, update: true, delete: false },
        results: { create: false, read: true, update: false, delete: false },
        reports: { create: false, read: true, update: false, delete: false },
        settings: { create: false, read: true, update: false, delete: false }
      },
      isActive: true,
      profile: {
        avatar: '',
        timezone: 'America/New_York',
        language: 'en',
        bio: 'Test recruiter user for API testing'
      },
      preferences: {
        emailNotifications: true,
        dashboardLayout: 'compact',
        defaultQuestionType: 'mcq'
      }
    });

    console.log(`✅ Recruiter user created: ${recruiterUser._id}`);

    // Print summary
    console.log('\n🎉 Test data created successfully!');
    console.log('=================================');
    console.log(`Organization: ${testOrg.name} (${testOrg.domain})`);
    console.log(`Admin: ${adminUser.email} / AdminTest123!`);
    console.log(`Recruiter: ${recruiterUser.email} / RecruiterTest123!`);
    console.log(`Organization ID: ${testOrg._id}`);
    console.log('=================================\n');

    return {
      organization: testOrg,
      adminUser,
      recruiterUser
    };

  } catch (error) {
    console.error('❌ Error creating test data:', error);
    throw error;
  } finally {
    // Don't close connection as we might need it for testing
    // await mongoose.connection.close();
  }
}

// Run if called directly
if (require.main === module) {
  seedTestData()
    .then(() => {
      console.log('✅ Data seeding completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Data seeding failed:', error);
      process.exit(1);
    });
}

export default seedTestData;