import dotenv from 'dotenv';
import path from 'path';
import connectDB from './config/database';
import User from './models/User';
import Appointment from './models/Appointment';
import MedicalRecord from './models/MedicalRecord';
import { UserRole, AppointmentType, MedicalRecordType } from './types';
import encryption from './utils/encryption';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const testMedicalRecordModel = async () => {
  try {
    await connectDB();

    console.log('\n🧪 Testing MedicalRecord Model...\n');

    // ==================== SETUP: Create Test Users ====================
    console.log('Setting up test users...');

    const timestamp = Date.now();
    const patient = await User.create({
      email: `patient.medical.${timestamp}@test.com`,
      password: 'password123',
      role: UserRole.PATIENT,
      firstName: 'John',
      lastName: 'Doe',
      dateOfBirth: new Date('1985-06-15'),
      bloodType: 'A+',
    });
    console.log('✅ Patient created:', patient.email);

    const doctor = await User.create({
      email: `doctor.medical.${timestamp}@test.com`,
      password: 'password123',
      role: UserRole.DOCTOR,
      firstName: 'Dr. Sarah',
      lastName: 'Johnson',
      specialization: 'Internal Medicine',
      licenseNumber: 'MD-TEST-002',
    });
    console.log('✅ Doctor created:', doctor.email);

    // Create an appointment
    const appointment = await Appointment.create({
      patientId: patient._id,
      doctorId: doctor._id,
      appointmentDate: new Date('2024-03-15'),
      startTime: '10:00',
      endTime: '10:30',
      type: AppointmentType.IN_PERSON,
      reason: 'Annual checkup',
    });
    console.log('✅ Appointment created');

    // ==================== TEST 1: Create Consultation Record ====================
    console.log('\nTest 1: Creating consultation record...');
    const consultation = await MedicalRecord.create({
      patientId: patient._id,
      doctorId: doctor._id,
      appointmentId: appointment._id,
      type: MedicalRecordType.CONSULTATION,
      diagnosis: 'Seasonal allergies with mild upper respiratory symptoms',
      symptoms: ['Sneezing', 'Runny nose', 'Itchy eyes', 'Mild cough'],
      treatment: 'Prescribed antihistamine, advised to avoid outdoor activities during high pollen count',
      prescriptions: [
        {
          medication: 'Cetirizine',
          dosage: '10mg',
          frequency: 'Once daily',
          duration: '30 days',
          instructions: 'Take in the evening',
          refills: 2,
        },
      ],
      vitals: {
        bloodPressure: '120/80',
        heartRate: 72,
        temperature: 36.8,
        weight: 75,
        height: 175,
        oxygenSaturation: 98,
      },
      doctorNotes: 'Patient presents with classic seasonal allergy symptoms. No fever. Lungs clear. Recommend follow-up if symptoms persist beyond 2 weeks.',
      followUpRequired: true,
      followUpDate: new Date('2024-04-15'),
    });
    console.log('✅ Consultation created:', consultation._id);
    console.log('   Diagnosis:', consultation.diagnosis);
    console.log('   BMI calculated:', consultation.vitals?.bmi);
    console.log('   Prescriptions:', consultation.prescriptions?.length);

    // ==================== TEST 2: Encryption ====================
    console.log('\nTest 2: Testing encryption...');
    const originalNotes = 'Patient presents with classic seasonal allergy symptoms. No fever. Lungs clear. Recommend follow-up if symptoms persist beyond 2 weeks.';
    console.log('   Original notes length:', originalNotes.length);
    console.log('   Encrypted notes contain ":"?', consultation.doctorNotes?.includes(':'));
    console.log('   Decrypted notes match?', (consultation as any).getDecryptedNotes() === originalNotes);

    // ==================== TEST 3: Create Prescription Record ====================
    console.log('\nTest 3: Creating prescription record...');
    const prescription = await MedicalRecord.create({
      patientId: patient._id,
      doctorId: doctor._id,
      type: MedicalRecordType.PRESCRIPTION,
      prescriptions: [
        {
          medication: 'Amoxicillin',
          dosage: '500mg',
          frequency: 'Three times daily',
          duration: '7 days',
          instructions: 'Take with food',
          refills: 0,
        },
        {
          medication: 'Ibuprofen',
          dosage: '400mg',
          frequency: 'As needed',
          duration: '7 days',
          instructions: 'For pain or fever',
          refills: 0,
        },
      ],
      doctorNotes: 'Prescribed for bacterial throat infection',
    });
    console.log('✅ Prescription record created');
    console.log('   Medications:', prescription.prescriptions?.map(p => p.medication).join(', '));

    // ==================== TEST 4: Create Lab Report ====================
    console.log('\nTest 4: Creating lab report...');
    const labReport = await MedicalRecord.create({
      patientId: patient._id,
      doctorId: doctor._id,
      type: MedicalRecordType.LAB_REPORT,
      labResults: [
        {
          testName: 'Complete Blood Count (CBC)',
          result: '4.5',
          normalRange: '4.0-5.5',
          unit: 'million cells/mcL',
          date: new Date('2024-03-14'),
          status: 'normal',
        },
        {
          testName: 'Hemoglobin',
          result: '14.5',
          normalRange: '13.5-17.5',
          unit: 'g/dL',
          date: new Date('2024-03-14'),
          status: 'normal',
        },
        {
          testName: 'Blood Glucose',
          result: '105',
          normalRange: '70-100',
          unit: 'mg/dL',
          date: new Date('2024-03-14'),
          status: 'abnormal',
        },
      ],
      doctorNotes: 'Slightly elevated glucose levels. Recommend dietary modifications and retest in 3 months.',
      followUpRequired: true,
      followUpDate: new Date('2024-06-14'),
    });
    console.log('✅ Lab report created');
    console.log('   Tests performed:', labReport.labResults?.length);
    console.log('   Abnormal results:', labReport.labResults?.filter(r => r.status === 'abnormal').length);

    // ==================== TEST 5: Add Attachment ====================
    console.log('\nTest 5: Adding attachment...');
    await consultation.addAttachment({
      name: 'Chest X-Ray.jpg',
      type: 'image',
      url: 'https://s3.amazonaws.com/medibook/xray-123.jpg',
      size: 2048576,
      uploadedAt: new Date(),
    } as any);
    console.log('✅ Attachment added');
    console.log('   Total attachments:', consultation.attachments?.length);

    // ==================== TEST 6: Permission Checks ====================
    console.log('\nTest 6: Testing permissions...');
    console.log('   Patient can view?', consultation.canBeViewedBy(patient._id.toString(), UserRole.PATIENT));
    console.log('   Doctor can view?', consultation.canBeViewedBy(doctor._id.toString(), UserRole.DOCTOR));
    console.log('   Patient can edit?', consultation.canBeEditedBy(patient._id.toString(), UserRole.PATIENT));
    console.log('   Doctor can edit?', consultation.canBeEditedBy(doctor._id.toString(), UserRole.DOCTOR));

    // ==================== TEST 7: Get Patient History ====================
    console.log('\nTest 7: Getting patient history...');
    const history = await (MedicalRecord as any).getPatientHistory(patient._id);
    console.log('✅ Patient has', history.length, 'medical records');

    // ==================== TEST 8: Get Recent Prescriptions ====================
    console.log('\nTest 8: Getting recent prescriptions...');
    const recentPrescriptions = await (MedicalRecord as any).getRecentPrescriptions(patient._id);
    console.log('✅ Found', recentPrescriptions.length, 'prescription records');

    // ==================== TEST 9: Get Follow-up Required ====================
    console.log('\nTest 9: Getting records requiring follow-up...');
    const followUps = await (MedicalRecord as any).getFollowUpRequired(doctor._id);
    console.log('✅ Found', followUps.length, 'records requiring follow-up');

    // ==================== TEST 10: Confidential Records ====================
    console.log('\nTest 10: Testing confidential records...');
    const confidential = await MedicalRecord.create({
      patientId: patient._id,
      doctorId: doctor._id,
      type: MedicalRecordType.CONSULTATION,
      diagnosis: 'Mental health consultation',
      isConfidential: true,
      doctorNotes: 'Sensitive mental health information',
    });
    console.log('✅ Confidential record created');
    
    // Create another doctor
    const otherDoctor = await User.create({
      email: `other.doctor.${timestamp}@test.com`,
      password: 'password123',
      role: UserRole.DOCTOR,
      firstName: 'Dr. Mike',
      lastName: 'Wilson',
      specialization: 'Cardiology',
      licenseNumber: 'MD-TEST-003',
    });
    
    console.log('   Other doctor can view confidential?', 
      confidential.canBeViewedBy(otherDoctor._id.toString(), UserRole.DOCTOR)
    ); // Should be false

    // ==================== CLEANUP ====================
    console.log('\n🧹 Cleaning up test data...');
    await MedicalRecord.deleteMany({ patientId: patient._id });
    await Appointment.deleteMany({ patientId: patient._id });
    await User.deleteMany({
      email: { $regex: /\.test\.com$/ }
    });
    console.log('✅ Test data cleaned up');

    console.log('\n✅ ALL MEDICAL RECORD TESTS PASSED!\n');
    process.exit(0);
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
};

testMedicalRecordModel();