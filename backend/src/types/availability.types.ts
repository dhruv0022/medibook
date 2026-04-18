import { Document, Model, Types } from 'mongoose';

// Time slot interface
export interface ITimeSlot {
  startTime: string; // "09:00"
  endTime: string; // "17:00"
  slotDuration?: number; // minutes, default 30
}

// Break time interface
export interface IBreakTime {
  startTime: string;
  endTime: string;
  reason?: string; // "Lunch", "Meeting", etc.
}

// Main availability interface
export interface IAvailability extends Document {
  // Relationships
  doctorId: Types.ObjectId;
  clinicId?: Types.ObjectId;
  
  // Schedule type
  type: 'regular' | 'exception';
  
  // Regular schedule (recurring weekly)
  dayOfWeek?: number; // 0-6 (0 = Sunday)
  schedule?: ITimeSlot[];
  
  // Exception (specific dates)
  date?: Date;
  isAvailable: boolean;
  exceptionSchedule?: ITimeSlot[];
  exceptionReason?: string;
  
  // Break times
  breaks?: IBreakTime[];
  
  // Timezone
  timezone: string;
  
  // Active period
  effectiveFrom: Date;
  effectiveTo?: Date;
  isActive: boolean;
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
  dayName?: string | null;
  
  // Methods
  hasConflict(startTime: string, endTime: string): boolean;
  generateTimeSlots(date: Date): string[];
}

export interface IAvailabilityModel extends Model<IAvailability> {
  getForDate(
    doctorId: Types.ObjectId | string,
    date: Date,
    clinicId?: Types.ObjectId | string
  ): Promise<IAvailability | null>;
  getWeeklySchedule(
    doctorId: Types.ObjectId | string,
    clinicId?: Types.ObjectId | string
  ): Promise<IAvailability[]>;
  getUpcomingExceptions(
    doctorId: Types.ObjectId | string,
    fromDate: Date,
    toDate?: Date
  ): Promise<IAvailability[]>;
  isAvailable(
    doctorId: Types.ObjectId | string,
    date: Date,
    startTime: string,
    endTime: string
  ): Promise<boolean>;
  getAvailableSlots(
    doctorId: Types.ObjectId | string,
    date: Date,
    existingAppointments?: Array<{ startTime: string; endTime: string }>
  ): Promise<string[]>;
  createStandardWeekSchedule(
    doctorId: Types.ObjectId | string,
    options?: {
      startTime?: string;
      endTime?: string;
      lunchBreak?: boolean;
      clinicId?: Types.ObjectId | string;
    }
  ): Promise<IAvailability[]>;
}

// DTO for creating regular availability
export interface CreateRegularAvailabilityDto {
  dayOfWeek: number;
  schedule: ITimeSlot[];
  breaks?: IBreakTime[];
  timezone?: string;
  effectiveFrom?: Date;
  effectiveTo?: Date;
}

// DTO for creating exception
export interface CreateExceptionDto {
  date: Date;
  isAvailable: boolean;
  exceptionSchedule?: ITimeSlot[];
  exceptionReason?: string;
}

// DTO for updating availability
export interface UpdateAvailabilityDto {
  schedule?: ITimeSlot[];
  breaks?: IBreakTime[];
  isActive?: boolean;
  effectiveTo?: Date;
}

// Available slots response
export interface AvailableSlot {
  time: string;
  available: boolean;
  reason?: string; // If not available: "Booked", "Break", "Outside hours"
}
