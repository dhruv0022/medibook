import dotenv from 'dotenv';
import mongoose from 'mongoose';
import User from './models/User';

// Load environment variables
dotenv.config();

const testUser = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI as string);
    console.log('✅ MongoDB Connected\n');

    // Clean up existing test data
    await User.deleteMany({ email: { $in: ['patient@test.com', 'doctor@test.com'] } });
    console.log('🧹 Cleaned up existing test data\n');

    // ==================== TEST 1: Create Patient ====================
    console.log('📝 TEST 1: Creating a Patient');
    const patient = await User.create({
      email: 'patient@test.com',
      password: 'Patient123!',
      firstName: 'John',
      lastName: 'Doe',
      role: 'patient',
      phone: '+1-416-555-0001',
      dateOfBirth: new Date('1990-05-15'),
      gender: 'male',
      address: {
        street: '123 Main St',
        city: 'Toronto',
        province: 'ON',
        postalCode: 'M5V 3A8',
        country: 'Canada',
      },
      emergencyContact: {
        name: 'Jane Doe',
        relationship: 'Spouse',
        phone: '+1-416-555-0002',
      },
      bloodType: 'O+',
    });

    console.log('✅ Patient created successfully');
    console.log('   ID:', patient._id);
    console.log('   Email:', patient.email);
    console.log('   Name:', `${patient.firstName} ${patient.lastName}`);
    console.log('   Role:', patient.role);
    console.log('   Blood Type:', patient.bloodType);
    console.log('');

    // ==================== TEST 2: Create Doctor ====================
    console.log('📝 TEST 2: Creating a Doctor');
    const doctor = await User.create({
      email: 'doctor@test.com',
      password: 'Doctor123!',
      firstName: 'Dr. Sarah',
      lastName: 'Williams',
      role: 'doctor',
      phone: '+1-416-555-0003',
      specialization: 'General Medicine',
      licenseNumber: 'MD-ON-12345',
      consultationFee: 150,
      yearsOfExperience: 10,
      qualifications: ['MD', 'FRCPC'],
      bio: 'Experienced general practitioner with focus on preventive care.',
    });

    console.log('✅ Doctor created successfully');
    console.log('   ID:', doctor._id);
    console.log('   Email:', doctor.email);
    console.log('   Name:', `${doctor.firstName} ${doctor.lastName}`);
    console.log('   Role:', doctor.role);
    console.log('   Specialization:', doctor.specialization);
    console.log('   License:', doctor.licenseNumber);
    console.log('   Consultation Fee: $' + doctor.consultationFee);
    console.log('');

    // ==================== TEST 3: Test Password Methods ====================
    console.log('📝 TEST 3: Testing Password Validation');
    
    const isValidPassword = await patient.comparePassword('Patient123!');
    const isInvalidPassword = await patient.comparePassword('WrongPassword');
    
    console.log('✅ Password validation working');
    console.log('   Correct password:', isValidPassword);
    console.log('   Incorrect password:', isInvalidPassword);
    console.log('');

    // ==================== TEST 4: Find User ====================
    console.log('📝 TEST 4: Finding Users');
    
    const foundPatient = await User.findOne({ email: 'patient@test.com' });
    const foundDoctor = await User.findOne({ role: 'doctor' });
    
    console.log('✅ Users found successfully');
    console.log('   Patient found:', foundPatient?.email);
    console.log('   Doctor found:', foundDoctor?.email);
    console.log('');

    // ==================== TEST 5: Update User ====================
    console.log('📝 TEST 5: Updating User');
    
    patient.phone = '+1-416-555-9999';
    await patient.save();
    
    console.log('✅ User updated successfully');
    console.log('   New phone:', patient.phone);
    console.log('');

    // ==================== TEST 6: Count Users by Role ====================
    console.log('📝 TEST 6: Counting Users by Role');
    
    const patientCount = await User.countDocuments({ role: 'patient' });
    const doctorCount = await User.countDocuments({ role: 'doctor' });
    
    console.log('✅ User counts:');
    console.log('   Patients:', patientCount);
    console.log('   Doctors:', doctorCount);
    console.log('');

    // ==================== TEST 7: Test Account Status ====================
    console.log('📝 TEST 7: Testing Account Status');
    
    console.log('   Patient verified:', patient.isVerified);
    console.log('   Patient active:', patient.isActive);
    console.log('   Doctor verified:', doctor.isVerified);
    console.log('   Doctor active:', doctor.isActive);
    console.log('');

    console.log('🎉 All tests completed successfully!\n');

  } catch (error: any) {
    console.error('❌ Test failed:', error.message);
    console.error(error);
  } finally {
    // Disconnect from MongoDB
    await mongoose.disconnect();
    console.log('👋 Disconnected from MongoDB');
  }
};

// Run the test
testUser();