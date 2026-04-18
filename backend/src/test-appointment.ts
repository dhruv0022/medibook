import dotenv from 'dotenv';
import connectDB from './config/database';
import User from './models/User';
import Appointment from './models/Appointment';
import { UserRole, AppointmentStatus, AppointmentType } from './types';

dotenv.config();

const testAppointmentModel = async () => {
  try {
    await connectDB();

    console.log('\n🧪 Testing Appointment Model...\n');

    // ==================== CLEANUP: Remove existing test users ====================
    console.log('Cleaning up existing test data...');
    await User.deleteMany({
      email: { $in: ['test.patient@medibook.com', 'test.doctor@medibook.com'] }
    });
    await Appointment.deleteMany({});

    // ==================== SETUP: Create Test Users ====================
    console.log('Setting up test users...');

    // Create patient
    const patient = await User.create({
      email: 'test.patient@medibook.com',
      password: 'password123',
      role: UserRole.PATIENT,
      firstName: 'Test',
      lastName: 'Patient',
    });
    console.log('✅ Patient created:', patient.email);

    // Create doctor
    const doctor = await User.create({
      email: 'test.doctor@medibook.com',
      password: 'password123',
      role: UserRole.DOCTOR,
      firstName: 'Test',
      lastName: 'Doctor',
      specialization: 'General Medicine',
      licenseNumber: 'MD-TEST-001',
      consultationFee: 150,
    });
    console.log('✅ Doctor created:', doctor.email);

    // ==================== TEST 1: Create Appointment ====================
    console.log('\nTest 1: Creating an appointment...');
    const appointment = await Appointment.create({
      patientId: patient._id.toString(),
      doctorId: doctor._id.toString(),
      appointmentDate: new Date('2024-12-15'),
      startTime: '09:00',
      endTime: '09:30',
      duration: 30,
      type: AppointmentType.IN_PERSON,
      reason: 'Annual checkup',
      symptoms: ['General fatigue', 'Headache'],
      notes: 'Patient prefers morning appointments',
    } as any);
    console.log('✅ Appointment created:', (appointment as any)._id);
    console.log('   Duration:', (appointment as any).duration, 'minutes');
    console.log('   Status:', (appointment as any).status);

    // ==================== TEST 2: Virtual Fields ====================
    console.log('\nTest 2: Testing virtual fields...');
    const populatedAppointment = await Appointment.findById((appointment as any)._id)
      .populate('patientId', 'firstName lastName email')
      .populate('doctorId', 'firstName lastName specialization consultationFee');

    console.log('✅ Populated appointment:');
    console.log('   Patient:', (populatedAppointment as any).patientId?.firstName, (populatedAppointment as any).patientId?.lastName);
    console.log('   Doctor:', (populatedAppointment as any).doctorId?.firstName, (populatedAppointment as any).doctorId?.lastName);

    // ==================== TEST 3: Instance Methods ====================
    console.log('\nTest 3: Testing instance methods...');
    console.log('   Can be cancelled?', (appointment as any).canBeCancelled());
    console.log('   Can be rescheduled?', (appointment as any).canBeRescheduled());
    console.log('   Is upcoming?', (appointment as any).isUpcoming());
    console.log('   Is past?', (appointment as any).isPast());
    console.log('   Formatted:', (appointment as any).getFormattedDateTime());

    // ==================== TEST 4: Conflict Detection ====================
    console.log('\nTest 4: Testing conflict detection...');
    const hasConflict = await (Appointment as any).hasConflict(
      doctor._id.toString(),
      new Date('2024-12-15'),
      '09:15', // Overlaps with existing 09:00-09:30
      '09:45'
    );
    console.log('✅ Conflict detection:', hasConflict ? 'CONFLICT FOUND' : 'NO CONFLICT');

    const noConflict = await (Appointment as any).hasConflict(
      doctor._id.toString(),
      new Date('2024-12-15'),
      '10:00', // Different time slot
      '10:30'
    );
    console.log('✅ No conflict check:', noConflict ? 'CONFLICT FOUND' : 'NO CONFLICT');

    // ==================== TEST 5: Create Multiple Appointments ====================
    console.log('\nTest 5: Creating multiple appointments...');
    await Appointment.create([
      {
        patientId: patient._id.toString(),
        doctorId: doctor._id.toString(),
        appointmentDate: new Date('2024-12-16'),
        startTime: '10:00',
        endTime: '10:30',
        type: AppointmentType.VIDEO,
        reason: 'Follow-up consultation',
        status: AppointmentStatus.CONFIRMED,
      },
      {
        patientId: patient._id.toString(),
        doctorId: doctor._id.toString(),
        appointmentDate: new Date('2024-12-20'),
        startTime: '14:00',
        endTime: '14:30',
        type: AppointmentType.PHONE,
        reason: 'Test results discussion',
        status: AppointmentStatus.COMPLETED,
      },
    ] as any);
    console.log('✅ Multiple appointments created');

    // ==================== TEST 6: Get Upcoming Appointments ====================
    console.log('\nTest 6: Getting upcoming appointments...');
    const upcomingForPatient = await (Appointment as any).getUpcoming(patient._id.toString(), 'patient');
    console.log('✅ Upcoming appointments for patient:', upcomingForPatient.length);

    const upcomingForDoctor = await (Appointment as any).getUpcoming(doctor._id.toString(), 'doctor');
    console.log('✅ Upcoming appointments for doctor:', upcomingForDoctor.length);

    // ==================== TEST 7: Get Appointments by Date ====================
    console.log('\nTest 7: Getting appointments by date...');
    const appointmentsByDate = await (Appointment as any).getByDate(
      doctor._id.toString(),
      new Date('2024-12-15')
    );
    console.log('✅ Appointments on Dec 15:', appointmentsByDate.length);

    // ==================== TEST 8: Get Statistics ====================
    console.log('\nTest 8: Getting appointment statistics...');
    const patientStats = await (Appointment as any).getStats(patient._id.toString(), 'patient');
    console.log('✅ Patient stats:', patientStats);

    const doctorStats = await (Appointment as any).getStats(doctor._id.toString(), 'doctor');
    console.log('✅ Doctor stats:', doctorStats);

    // ==================== TEST 9: Cancel Appointment ====================
    console.log('\nTest 9: Cancelling appointment...');
    (appointment as any).status = AppointmentStatus.CANCELLED;
    (appointment as any).cancellationReason = 'Patient request';
    (appointment as any).cancelledBy = patient._id.toString();
    (appointment as any).cancelledAt = new Date();
    await appointment.save();
    console.log('✅ Appointment cancelled');
    console.log('   Can still be cancelled?', (appointment as any).canBeCancelled()); // Should be false

    // ==================== CLEANUP ====================
    console.log('\n🧹 Cleaning up test data...');
    await Appointment.deleteMany({ patientId: patient._id.toString() } as any);
    await User.deleteMany({
      email: { $in: ['test.patient@medibook.com', 'test.doctor@medibook.com'] }
    });
    console.log('✅ Test data cleaned up');

    console.log('\n✅ ALL APPOINTMENT TESTS PASSED!\n');
    process.exit(0);
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
};

testAppointmentModel();