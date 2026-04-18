import mongoose, { Schema } from 'mongoose';
import {
  IAvailability,
  IAvailabilityModel,
  ITimeSlot,
  IBreakTime,
} from '../types/availability.types';
import { format, addMinutes, parseISO, isSameDay } from 'date-fns';

// Sub-schema for time slots
const TimeSlotSchema = new Schema<ITimeSlot>(
  {
    startTime: {
      type: String,
      required: [true, 'Start time is required'],
      match: [/^([01]\d|2[0-3]):([0-5]\d)$/, 'Start time must be in HH:MM format'],
    },
    endTime: {
      type: String,
      required: [true, 'End time is required'],
      match: [/^([01]\d|2[0-3]):([0-5]\d)$/, 'End time must be in HH:MM format'],
    },
    slotDuration: {
      type: Number,
      default: 30,
      min: [15, 'Slot duration must be at least 15 minutes'],
      max: [480, 'Slot duration cannot exceed 8 hours'],
    },
  },
  { _id: false }
);

// Sub-schema for break times
const BreakTimeSchema = new Schema<IBreakTime>(
  {
    startTime: {
      type: String,
      required: [true, 'Break start time is required'],
      match: [/^([01]\d|2[0-3]):([0-5]\d)$/, 'Time must be in HH:MM format'],
    },
    endTime: {
      type: String,
      required: [true, 'Break end time is required'],
      match: [/^([01]\d|2[0-3]):([0-5]\d)$/, 'Time must be in HH:MM format'],
    },
    reason: {
      type: String,
      trim: true,
      maxlength: [100, 'Reason cannot exceed 100 characters'],
    },
  },
  { _id: false }
);

// Main Availability Schema
const AvailabilitySchema = new Schema<IAvailability, IAvailabilityModel>(
  {
    // ==================== RELATIONSHIPS ====================
    doctorId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Doctor is required'],
      index: true,
    },
    
    clinicId: {
      type: Schema.Types.ObjectId,
      ref: 'Clinic',
      index: true,
    },
    
    // ==================== SCHEDULE TYPE ====================
    type: {
      type: String,
      enum: ['regular', 'exception'],
      required: [true, 'Type is required'],
      default: 'regular',
    },
    
    // ==================== REGULAR SCHEDULE ====================
    dayOfWeek: {
      type: Number,
      min: [0, 'Day of week must be between 0 (Sunday) and 6 (Saturday)'],
      max: [6, 'Day of week must be between 0 (Sunday) and 6 (Saturday)'],
      // Required if type is regular
    },
    
    schedule: [TimeSlotSchema],
    
    // ==================== EXCEPTION SCHEDULE ====================
    date: {
      type: Date,
      // Required if type is exception
    },
    
    isAvailable: {
      type: Boolean,
      default: true,
    },
    
    exceptionSchedule: [TimeSlotSchema],
    
    exceptionReason: {
      type: String,
      trim: true,
      maxlength: [200, 'Exception reason cannot exceed 200 characters'],
    },
    
    // ==================== BREAK TIMES ====================
    breaks: [BreakTimeSchema],
    
    // ==================== TIMEZONE ====================
    timezone: {
      type: String,
      default: 'America/Toronto',
    },
    
    // ==================== ACTIVE PERIOD ====================
    effectiveFrom: {
      type: Date,
      default: Date.now,
    },
    
    effectiveTo: {
      type: Date,
    },
    
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ==================== INDEXES ====================
AvailabilitySchema.index({ doctorId: 1, dayOfWeek: 1, isActive: 1 });
AvailabilitySchema.index({ doctorId: 1, date: 1, type: 1 });
AvailabilitySchema.index({ doctorId: 1, type: 1, isActive: 1 });

// ==================== VIRTUAL FIELDS ====================

// Virtual for populated doctor
AvailabilitySchema.virtual('doctor', {
  ref: 'User',
  localField: 'doctorId',
  foreignField: '_id',
  justOne: true,
});

// Virtual for populated clinic
AvailabilitySchema.virtual('clinic', {
  ref: 'Clinic',
  localField: 'clinicId',
  foreignField: '_id',
  justOne: true,
});

// Virtual for day name
AvailabilitySchema.virtual('dayName').get(function (this: IAvailability) {
  if (this.type === 'regular' && this.dayOfWeek !== undefined) {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[this.dayOfWeek];
  }
  return null;
});

// ==================== MIDDLEWARE ====================

// Validate that regular schedules have dayOfWeek
AvailabilitySchema.pre('save', function () {
  if (this.type === 'regular' && this.dayOfWeek === undefined) {
    throw new Error('Day of week is required for regular schedules');
  }
  
  if (this.type === 'exception' && !this.date) {
    throw new Error('Date is required for exception schedules');
  }
});

// Validate time slots don't overlap
AvailabilitySchema.pre('save', function () {
  const slots = this.type === 'regular' ? this.schedule : this.exceptionSchedule;
  
  if (slots && slots.length > 1) {
    for (let i = 0; i < slots.length - 1; i++) {
      for (let j = i + 1; j < slots.length; j++) {
        const slot1 = slots[i];
        const slot2 = slots[j];
        
        // Check if slots overlap
        if (
          (slot1.startTime <= slot2.startTime && slot1.endTime > slot2.startTime) ||
          (slot2.startTime <= slot1.startTime && slot2.endTime > slot1.startTime)
        ) {
          throw new Error('Time slots cannot overlap');
        }
      }
    }
  }
});

// Validate breaks are within schedule
AvailabilitySchema.pre('save', function () {
  if (!this.breaks || this.breaks.length === 0) {
    return;
  }
  
  const slots = this.type === 'regular' ? this.schedule : this.exceptionSchedule;
  
  if (!slots || slots.length === 0) {
    throw new Error('Cannot have breaks without a schedule');
  }
  
  const earliestStart = slots.reduce(
    (earliest, slot) => (slot.startTime < earliest ? slot.startTime : earliest),
    slots[0].startTime
  );
  const latestEnd = slots.reduce(
    (latest, slot) => (slot.endTime > latest ? slot.endTime : latest),
    slots[0].endTime
  );

  // Check each break is within the overall working window
  for (const breakTime of this.breaks) {
    if (breakTime.startTime < earliestStart || breakTime.endTime > latestEnd) {
      throw new Error('Break times must be within scheduled hours');
    }
  }
});

// ==================== INSTANCE METHODS ====================

// Check if a time slot conflicts with schedule
AvailabilitySchema.methods.hasConflict = function (
  this: IAvailability,
  startTime: string,
  endTime: string
): boolean {
  const slots = this.type === 'regular' ? this.schedule : this.exceptionSchedule;
  
  if (!slots || slots.length === 0) {
    return true; // No schedule = conflict
  }
  
  // Check if time is within any slot
  let withinSlot = false;
  for (const slot of slots) {
    if (startTime >= slot.startTime && endTime <= slot.endTime) {
      withinSlot = true;
      break;
    }
  }
  
  if (!withinSlot) {
    return true; // Outside scheduled hours
  }
  
  // Check if time overlaps with any break
  if (this.breaks) {
    for (const breakTime of this.breaks) {
      if (
        (startTime >= breakTime.startTime && startTime < breakTime.endTime) ||
        (endTime > breakTime.startTime && endTime <= breakTime.endTime) ||
        (startTime <= breakTime.startTime && endTime >= breakTime.endTime)
      ) {
        return true; // Conflicts with break
      }
    }
  }
  
  return false;
};

// Generate available time slots for a specific date
AvailabilitySchema.methods.generateTimeSlots = function (
  this: IAvailability,
  date: Date
): string[] {
  const slots = this.type === 'regular' ? this.schedule : this.exceptionSchedule;
  
  if (!slots || slots.length === 0) {
    return [];
  }
  
  const timeSlots: string[] = [];
  
  for (const slot of slots) {
    const [startHour, startMin] = slot.startTime.split(':').map(Number);
    const [endHour, endMin] = slot.endTime.split(':').map(Number);
    
    const slotDuration = slot.slotDuration || 30;
    
    let currentTime = new Date(date);
    currentTime.setHours(startHour, startMin, 0, 0);
    
    const endTime = new Date(date);
    endTime.setHours(endHour, endMin, 0, 0);
    
    while (currentTime < endTime) {
      const timeString = format(currentTime, 'HH:mm');
      const nextTime = addMinutes(currentTime, slotDuration);
      const nextTimeString = format(nextTime, 'HH:mm');
      
      // Check if this slot is during a break
      let isDuringBreak = false;
      if (this.breaks) {
        for (const breakTime of this.breaks) {
          if (timeString >= breakTime.startTime && timeString < breakTime.endTime) {
            isDuringBreak = true;
            break;
          }
        }
      }
      
      if (!isDuringBreak && nextTime <= endTime) {
        timeSlots.push(timeString);
      }
      
      currentTime = nextTime;
    }
  }
  
  return timeSlots;
};

// ==================== STATIC METHODS ====================

// Get availability for a specific date
AvailabilitySchema.statics.getForDate = async function (
  doctorId: mongoose.Types.ObjectId | string,
  date: Date,
  clinicId?: mongoose.Types.ObjectId | string
) {
  const dayOfWeek = date.getDay();
  const dateStr = format(date, 'yyyy-MM-dd');
  
  // Check for exceptions first
  const exceptionQuery: any = {
    doctorId,
    type: 'exception',
    date: {
      $gte: new Date(dateStr + 'T00:00:00.000Z'),
      $lt: new Date(dateStr + 'T23:59:59.999Z'),
    },
    isActive: true,
  };
  
  if (clinicId) {
    exceptionQuery.clinicId = clinicId;
  }
  
  const exception = await this.findOne(exceptionQuery);
  
  if (exception) {
    return exception;
  }
  
  // Get regular schedule
  const regularQuery: any = {
    doctorId,
    type: 'regular',
    dayOfWeek,
    isActive: true,
    effectiveFrom: { $lte: date },
    $or: [{ effectiveTo: { $exists: false } }, { effectiveTo: { $gte: date } }],
  };
  
  if (clinicId) {
    regularQuery.clinicId = clinicId;
  }
  
  return this.findOne(regularQuery);
};

// Get doctor's weekly schedule
AvailabilitySchema.statics.getWeeklySchedule = function (
  doctorId: mongoose.Types.ObjectId | string,
  clinicId?: mongoose.Types.ObjectId | string
) {
  const query: any = {
    doctorId,
    type: 'regular',
    isActive: true,
  };
  
  if (clinicId) {
    query.clinicId = clinicId;
  }
  
  return this.find(query).sort({ dayOfWeek: 1 });
};

// Get upcoming exceptions
AvailabilitySchema.statics.getUpcomingExceptions = function (
  doctorId: mongoose.Types.ObjectId | string,
  fromDate: Date,
  toDate?: Date
) {
  const query: any = {
    doctorId,
    type: 'exception',
    date: { $gte: fromDate },
    isActive: true,
  };
  
  if (toDate) {
    query.date.$lte = toDate;
  }
  
  return this.find(query).sort({ date: 1 });
};

// Check if doctor is available on a specific date and time
AvailabilitySchema.statics.isAvailable = async function (
  doctorId: mongoose.Types.ObjectId | string,
  date: Date,
  startTime: string,
  endTime: string
) {
  const availability = await this.getForDate(doctorId, date);
  
  if (!availability) {
    return false; // No schedule = not available
  }
  
  if (availability.type === 'exception' && !availability.isAvailable) {
    return false; // Exception marked as unavailable
  }
  
  return !availability.hasConflict(startTime, endTime);
};

// Get all available slots for a date
AvailabilitySchema.statics.getAvailableSlots = async function (
  doctorId: mongoose.Types.ObjectId | string,
  date: Date,
  existingAppointments: Array<{ startTime: string; endTime: string }> = []
) {
  const availability = await this.getForDate(doctorId, date);
  
  if (!availability) {
    return [];
  }
  
  if (availability.type === 'exception' && !availability.isAvailable) {
    return [];
  }
  
  const allSlots = availability.generateTimeSlots(date);
  
  // Filter out booked slots
  const availableSlots = allSlots.filter((slot) => {
    return !existingAppointments.some((apt) => apt.startTime === slot);
  });
  
  return availableSlots;
};

// Bulk create regular schedule (Monday-Friday, 9-5)
AvailabilitySchema.statics.createStandardWeekSchedule = async function (
  doctorId: mongoose.Types.ObjectId | string,
  options: {
    startTime?: string;
    endTime?: string;
    lunchBreak?: boolean;
    clinicId?: mongoose.Types.ObjectId | string;
  } = {}
) {
  const { startTime = '09:00', endTime = '17:00', lunchBreak = true, clinicId } = options;
  
  const schedules = [];
  
  // Monday to Friday (1-5)
  for (let day = 1; day <= 5; day++) {
    const schedule: any = {
      doctorId,
      type: 'regular',
      dayOfWeek: day,
      schedule: [{ startTime, endTime }],
      isActive: true,
    };
    
    if (lunchBreak) {
      schedule.breaks = [{ startTime: '12:00', endTime: '13:00', reason: 'Lunch' }];
    }
    
    if (clinicId) {
      schedule.clinicId = clinicId;
    }
    
    schedules.push(schedule);
  }
  
  return this.insertMany(schedules);
};

// ==================== EXPORT ====================
const Availability = mongoose.model<IAvailability, IAvailabilityModel>(
  'Availability',
  AvailabilitySchema
);

export default Availability;
