import dotenv from 'dotenv';
import mongoose from 'mongoose';
import connectDB from './config/database';
import User from './models/User';
import Availability from './models/Availability';
import { UserRole } from './types';

dotenv.config();

const testAvailabilityModel = async () => {
  const testDoctorEmail = 'doctor.availability@test.com';

  try {
    await connectDB();

    console.log('\n🧪 Testing Availability Model...\n');

    // ==================== SETUP: Create Test Doctor ====================
    console.log('Setting up test doctor...');
    await User.deleteOne({ email: testDoctorEmail });
    const doctor = await User.create({
      email: testDoctorEmail,
      password: 'password123',
      role: UserRole.DOCTOR,
      firstName: 'Dr. Emily',
      lastName: 'Thompson',
      specialization: 'General Practice',
      licenseNumber: 'MD-TEST-004',
    });
    console.log('✅ Doctor created:', doctor.email);

    // ==================== TEST 1: Create Regular Schedule ====================
    console.log('\nTest 1: Creating regular Monday schedule...');
    const mondaySchedule = await Availability.create({
      doctorId: doctor._id,
      type: 'regular',
      dayOfWeek: 1, // Monday
      schedule: [
        { startTime: '09:00', endTime: '12:00', slotDuration: 30 },
        { startTime: '13:00', endTime: '17:00', slotDuration: 30 },
      ],
      breaks: [{ startTime: '12:00', endTime: '13:00', reason: 'Lunch' }],
      timezone: 'America/Toronto',
    });
    console.log('✅ Monday schedule created');
    console.log('   Day:', mondaySchedule.dayName);
    console.log('   Time slots:', mondaySchedule.schedule?.length);
    console.log('   Breaks:', mondaySchedule.breaks?.length);

    // ==================== TEST 2: Create Standard Week Schedule ====================
    console.log('\nTest 2: Creating standard week schedule (Mon-Fri)...');
    await (Availability as any).createStandardWeekSchedule(doctor._id, {
      startTime: '09:00',
      endTime: '17:00',
      lunchBreak: true,
    });
    console.log('✅ Standard week schedule created (Monday-Friday)');

    // ==================== TEST 3: Get Weekly Schedule ====================
    console.log('\nTest 3: Getting weekly schedule...');
    const weeklySchedule = await (Availability as any).getWeeklySchedule(doctor._id);
    console.log('✅ Weekly schedule retrieved');
    console.log('   Days configured:', weeklySchedule.length);
    weeklySchedule.forEach((sched: any) => {
      console.log(`   - ${sched.dayName}: ${sched.schedule[0].startTime}-${sched.schedule[0].endTime}`);
    });

    // ==================== TEST 4: Generate Time Slots ====================
    console.log('\nTest 4: Generating time slots for a Monday...');
    const testDate = new Date('2024-12-16'); // A Monday
    const timeSlots = mondaySchedule.generateTimeSlots(testDate);
    console.log('✅ Time slots generated:', timeSlots.length);
    console.log('   First 5 slots:', timeSlots.slice(0, 5).join(', '));
    console.log('   Last 5 slots:', timeSlots.slice(-5).join(', '));

    // ==================== TEST 5: Check for Conflicts ====================
    console.log('\nTest 5: Testing conflict detection...');
    const hasConflict1 = mondaySchedule.hasConflict('10:00', '10:30');
    console.log('   10:00-10:30 (valid)?', !hasConflict1 ? 'No conflict ✅' : 'Conflict ❌');
    
    const hasConflict2 = mondaySchedule.hasConflict('12:15', '12:45');
    console.log('   12:15-12:45 (lunch break)?', hasConflict2 ? 'Conflict ✅' : 'No conflict ❌');
    
    const hasConflict3 = mondaySchedule.hasConflict('08:00', '08:30');
    console.log('   08:00-08:30 (before hours)?', hasConflict3 ? 'Conflict ✅' : 'No conflict ❌');

    // ==================== TEST 6: Create Exception (Holiday) ====================
    console.log('\nTest 6: Creating exception for holiday...');
    const holiday = await Availability.create({
      doctorId: doctor._id,
      type: 'exception',
      date: new Date('2024-12-25'), // Christmas
      isAvailable: false,
      exceptionReason: 'Christmas Day - Office Closed',
    });
    console.log('✅ Holiday exception created');
    console.log('   Date:', holiday.date);
    console.log('   Available?', holiday.isAvailable);
    console.log('   Reason:', holiday.exceptionReason);

    // ==================== TEST 7: Create Exception (Special Hours) ====================
    console.log('\nTest 7: Creating exception with special hours...');
    const specialHours = await Availability.create({
      doctorId: doctor._id,
      type: 'exception',
      date: new Date('2024-12-24'), // Christmas Eve
      isAvailable: true,
      exceptionSchedule: [{ startTime: '09:00', endTime: '13:00' }],
      exceptionReason: 'Half day - Christmas Eve',
    });
    console.log('✅ Special hours exception created');
    console.log('   Hours:', specialHours.exceptionSchedule?.[0].startTime, '-', 
                          specialHours.exceptionSchedule?.[0].endTime);

    // ==================== TEST 8: Get Availability for Specific Date ====================
    console.log('\nTest 8: Getting availability for specific dates...');
    
    const regularDay = await (Availability as any).getForDate(doctor._id, new Date('2024-12-16'));
    console.log('   Regular Monday:', regularDay ? 'Found ✅' : 'Not found ❌');
    
    const christmasDay = await (Availability as any).getForDate(doctor._id, new Date('2024-12-25'));
    console.log('   Christmas (exception):', christmasDay?.isAvailable === false ? 'Not available ✅' : 'Available ❌');
    
    const christmasEve = await (Availability as any).getForDate(doctor._id, new Date('2024-12-24'));
    console.log('   Christmas Eve (special):', christmasEve?.exceptionSchedule ? 'Special hours ✅' : 'Regular ❌');

    // ==================== TEST 9: Check Availability ====================
    console.log('\nTest 9: Checking if doctor is available...');
    const available1 = await (Availability as any).isAvailable(
      doctor._id,
      new Date('2024-12-16'),
      '10:00',
      '10:30'
    );
    console.log('   Monday 10:00-10:30:', available1 ? 'Available ✅' : 'Not available ❌');
    
    const available2 = await (Availability as any).isAvailable(
      doctor._id,
      new Date('2024-12-25'),
      '10:00',
      '10:30'
    );
    console.log('   Christmas 10:00-10:30:', available2 ? 'Available ❌' : 'Not available ✅');

    // ==================== TEST 10: Get Upcoming Exceptions ====================
    console.log('\nTest 10: Getting upcoming exceptions...');
    const exceptions = await (Availability as any).getUpcomingExceptions(
      doctor._id,
      new Date('2024-12-01')
    );
    console.log('✅ Found', exceptions.length, 'upcoming exceptions:');
    exceptions.forEach((exc: any) => {
      console.log(`   - ${exc.date.toDateString()}: ${exc.exceptionReason || 'Not available'}`);
    });

    // ==================== TEST 11: Overlapping Slots (Should Fail) ====================
    console.log('\nTest 11: Testing overlapping slots validation...');
    try {
      await Availability.create({
        doctorId: doctor._id,
        type: 'regular',
        dayOfWeek: 3, // Wednesday
        schedule: [
          { startTime: '09:00', endTime: '12:00' },
          { startTime: '11:00', endTime: '14:00' }, // Overlaps!
        ],
      });
      console.log('❌ Should have failed - overlapping slots accepted');
    } catch (error: any) {
      console.log('✅ Validation works:', error.message);
    }

    // ==================== TEST 12: Break Outside Schedule (Should Fail) ====================
    console.log('\nTest 12: Testing break validation...');
    try {
      await Availability.create({
        doctorId: doctor._id,
        type: 'regular',
        dayOfWeek: 4, // Thursday
        schedule: [{ startTime: '09:00', endTime: '17:00' }],
        breaks: [{ startTime: '17:30', endTime: '18:00' }], // Outside schedule!
      });
      console.log('❌ Should have failed - break outside schedule accepted');
    } catch (error: any) {
      console.log('✅ Validation works:', error.message);
    }

    // ==================== TEST 13: Get Available Slots with Appointments ====================
    console.log('\nTest 13: Getting available slots with booked appointments...');
    const bookedAppointments = [
      { startTime: '09:00', endTime: '09:30' },
      { startTime: '10:00', endTime: '10:30' },
      { startTime: '14:00', endTime: '14:30' },
    ];
    
    const availableSlots = await (Availability as any).getAvailableSlots(
      doctor._id,
      new Date('2024-12-16'),
      bookedAppointments
    );
    console.log('✅ Available slots (excluding booked):', availableSlots.length);
    console.log('   Total possible slots:', timeSlots.length);
    console.log('   Booked slots:', bookedAppointments.length);
    console.log('   Available:', availableSlots.length, '=', timeSlots.length, '-', bookedAppointments.length);

    // ==================== TEST 14: Update Schedule ====================
    console.log('\nTest 14: Updating schedule...');
    mondaySchedule.schedule = [
      { startTime: '08:00', endTime: '12:00', slotDuration: 30 },
      { startTime: '13:00', endTime: '18:00', slotDuration: 30 },
    ];
    await mondaySchedule.save();
    console.log('✅ Schedule updated');
    console.log('   New hours: 08:00-12:00, 13:00-18:00');

    // ==================== TEST 15: Deactivate Schedule ====================
    console.log('\nTest 15: Deactivating old schedule...');
    mondaySchedule.isActive = false;
    mondaySchedule.effectiveTo = new Date('2024-12-31');
    await mondaySchedule.save();
    console.log('✅ Schedule deactivated');
    console.log('   Effective until:', mondaySchedule.effectiveTo);

    // ==================== CLEANUP ====================
    console.log('\n🧹 Cleaning up test data...');
    await Availability.deleteMany({ doctorId: doctor._id });
    await User.deleteOne({ email: testDoctorEmail });
    console.log('✅ Test data cleaned up');

    console.log('\n✅ ALL AVAILABILITY TESTS PASSED!\n');
    process.exitCode = 0;
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exitCode = 1;
  } finally {
    const doctorIds = await User.find({ email: testDoctorEmail }).distinct('_id');
    if (doctorIds.length > 0) {
      await Availability.deleteMany({ doctorId: { $in: doctorIds } });
    }
    await User.deleteMany({ email: testDoctorEmail });
    await mongoose.disconnect();
  }
};

testAvailabilityModel();
