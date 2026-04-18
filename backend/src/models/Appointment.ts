import mongoose, { Schema } from 'mongoose';
import { IAppointment } from '../types/appointment.types';
import { AppointmentStatus, AppointmentType, PaymentStatus } from '../types';
import { format, addMinutes, isBefore, isAfter, parseISO } from 'date-fns';

const AppointmentSchema = new Schema<IAppointment>(
  {
    // ==================== RELATIONSHIPS ====================
    patientId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Patient is required'],
      index: true,
    },
    
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
    
    // ==================== SCHEDULING ====================
    appointmentDate: {
      type: Date,
      required: [true, 'Appointment date is required'],
      index: true,
    },
    
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
    
    duration: {
      type: Number,
      min: [15, 'Duration must be at least 15 minutes'],
      max: [480, 'Duration cannot exceed 8 hours'],
    },
    
    timezone: {
      type: String,
      default: 'America/Toronto',
    },
    
    // ==================== STATUS ====================
    status: {
      type: String,
      enum: Object.values(AppointmentStatus),
      default: AppointmentStatus.SCHEDULED,
      index: true,
    },
    
    // ==================== TYPE & DETAILS ====================
    type: {
      type: String,
      enum: Object.values(AppointmentType),
      required: [true, 'Appointment type is required'],
    },
    
    reason: {
      type: String,
      required: [true, 'Reason for appointment is required'],
      maxlength: [500, 'Reason cannot exceed 500 characters'],
    },
    
    symptoms: [
      {
        type: String,
        maxlength: [200, 'Symptom description cannot exceed 200 characters'],
      },
    ],
    
    notes: {
      type: String,
      maxlength: [1000, 'Notes cannot exceed 1000 characters'],
    },
    
    // ==================== VIDEO CONSULTATION ====================
    videoRoomId: {
      type: String,
      sparse: true,
    },
    
    videoUrl: {
      type: String,
    },
    
    videoRecordingUrl: {
      type: String,
    },
    
    // ==================== REMINDERS ====================
    remindersSent: [
      {
        type: {
          type: String,
          enum: ['email', 'sms'],
        },
        sentAt: {
          type: Date,
          default: Date.now,
        },
        status: {
          type: String,
          enum: ['sent', 'failed'],
          default: 'sent',
        },
      },
    ],
    
    // ==================== PAYMENT ====================
    paymentStatus: {
      type: String,
      enum: Object.values(PaymentStatus),
      default: PaymentStatus.PENDING,
    },
    
    paymentAmount: {
      type: Number,
      min: [0, 'Payment amount cannot be negative'],
    },
    
    paymentIntentId: {
      type: String,
    },
    
    paymentMethod: {
      type: String,
      enum: ['card', 'cash', 'insurance', null],
    },
    
    // ==================== CANCELLATION ====================
    cancellationReason: {
      type: String,
      maxlength: [500, 'Cancellation reason cannot exceed 500 characters'],
    },
    
    cancelledBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    
    cancelledAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ==================== INDEXES ====================
// Compound index for checking availability
AppointmentSchema.index({ doctorId: 1, appointmentDate: 1, startTime: 1 });

// Index for querying appointments by date range
AppointmentSchema.index({ appointmentDate: 1, status: 1 });

// Index for patient's appointments
AppointmentSchema.index({ patientId: 1, appointmentDate: -1 });

// Index for doctor's appointments
AppointmentSchema.index({ doctorId: 1, appointmentDate: -1 });

// ==================== VIRTUAL FIELDS ====================

// Virtual for populated patient
AppointmentSchema.virtual('patient', {
  ref: 'User',
  localField: 'patientId',
  foreignField: '_id',
  justOne: true,
});

// Virtual for populated doctor
AppointmentSchema.virtual('doctor', {
  ref: 'User',
  localField: 'doctorId',
  foreignField: '_id',
  justOne: true,
});

// ==================== MIDDLEWARE ====================
// Temporarily disabled due to TypeScript issues
// TODO: Fix middleware type definitions

// ==================== INSTANCE METHODS ====================

// Check if appointment can be cancelled
AppointmentSchema.methods.canBeCancelled = function (this: IAppointment): boolean {
  // Can't cancel if already cancelled or completed
  if (
    this.status === AppointmentStatus.CANCELLED ||
    this.status === AppointmentStatus.COMPLETED ||
    this.status === AppointmentStatus.NO_SHOW
  ) {
    return false;
  }
  
  // Can cancel if appointment is in the future
  const appointmentDateTime = new Date(this.appointmentDate);
  const [hours, minutes] = this.startTime.split(':').map(Number);
  appointmentDateTime.setHours(hours, minutes, 0, 0);
  
  return isAfter(appointmentDateTime, new Date());
};

// Check if appointment can be rescheduled
AppointmentSchema.methods.canBeRescheduled = function (this: IAppointment): boolean {
  // Can only reschedule scheduled or confirmed appointments
  if (
    this.status !== AppointmentStatus.SCHEDULED &&
    this.status !== AppointmentStatus.CONFIRMED
  ) {
    return false;
  }
  
  // Must be in the future
  const appointmentDateTime = new Date(this.appointmentDate);
  const [hours, minutes] = this.startTime.split(':').map(Number);
  appointmentDateTime.setHours(hours, minutes, 0, 0);
  
  return isAfter(appointmentDateTime, new Date());
};

// Check if appointment is upcoming (within next 7 days)
AppointmentSchema.methods.isUpcoming = function (this: IAppointment): boolean {
  const appointmentDateTime = new Date(this.appointmentDate);
  const [hours, minutes] = this.startTime.split(':').map(Number);
  appointmentDateTime.setHours(hours, minutes, 0, 0);
  
  const now = new Date();
  const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  
  return isAfter(appointmentDateTime, now) && isBefore(appointmentDateTime, sevenDaysFromNow);
};

// Check if appointment is in the past
AppointmentSchema.methods.isPast = function (this: IAppointment): boolean {
  const appointmentDateTime = new Date(this.appointmentDate);
  const [hours, minutes] = this.startTime.split(':').map(Number);
  appointmentDateTime.setHours(hours, minutes, 0, 0);
  
  return isBefore(appointmentDateTime, new Date());
};

// Get formatted date and time
AppointmentSchema.methods.getFormattedDateTime = function (this: IAppointment): string {
  const appointmentDateTime = new Date(this.appointmentDate);
  const [hours, minutes] = this.startTime.split(':').map(Number);
  appointmentDateTime.setHours(hours, minutes, 0, 0);
  
  return format(appointmentDateTime, 'EEEE, MMMM dd, yyyy \'at\' h:mm a');
};

// ==================== STATIC METHODS ====================

// Check for conflicting appointments
AppointmentSchema.statics.hasConflict = async function (
  doctorId: string,
  appointmentDate: Date,
  startTime: string,
  endTime: string,
  excludeId?: string
): Promise<boolean> {
  const query: any = {
    doctorId,
    appointmentDate,
    status: {
      $nin: [AppointmentStatus.CANCELLED, AppointmentStatus.NO_SHOW],
    },
    $or: [
      // New appointment starts during existing appointment
      {
        startTime: { $lte: startTime },
        endTime: { $gt: startTime },
      },
      // New appointment ends during existing appointment
      {
        startTime: { $lt: endTime },
        endTime: { $gte: endTime },
      },
      // New appointment contains existing appointment
      {
        startTime: { $gte: startTime },
        endTime: { $lte: endTime },
      },
    ],
  };
  
  // Exclude specific appointment (for rescheduling)
  if (excludeId) {
    query._id = { $ne: excludeId };
  }
  
  const conflict = await this.findOne(query);
  return !!conflict;
};

// Get upcoming appointments for a user
AppointmentSchema.statics.getUpcoming = function (
  userId: string,
  role: 'patient' | 'doctor',
  limit: number = 10
) {
  const field = role === 'patient' ? 'patientId' : 'doctorId';
  const now = new Date();
  
  return this.find({
    [field]: userId,
    appointmentDate: { $gte: now },
    status: {
      $nin: [AppointmentStatus.CANCELLED, AppointmentStatus.NO_SHOW],
    },
  })
    .sort({ appointmentDate: 1, startTime: 1 })
    .limit(limit)
    .populate('patientId', 'firstName lastName email phone')
    .populate('doctorId', 'firstName lastName specialization consultationFee');
};

// Get appointments for a specific date
AppointmentSchema.statics.getByDate = function (
  doctorId: string,
  date: Date
) {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);
  
  return this.find({
    doctorId,
    appointmentDate: {
      $gte: startOfDay,
      $lte: endOfDay,
    },
    status: {
      $nin: [AppointmentStatus.CANCELLED, AppointmentStatus.NO_SHOW],
    },
  })
    .sort({ startTime: 1 })
    .populate('patientId', 'firstName lastName email phone');
};

// Get appointment statistics
AppointmentSchema.statics.getStats = async function (
  userId: string,
  role: 'patient' | 'doctor'
) {
  const field = role === 'patient' ? 'patientId' : 'doctorId';
  
  const stats = await this.aggregate([
    { $match: { [field]: new mongoose.Types.ObjectId(userId) } },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
      },
    },
  ]);
  
  const result: any = {
    total: 0,
    scheduled: 0,
    confirmed: 0,
    completed: 0,
    cancelled: 0,
    noShow: 0,
  };
  
  stats.forEach((stat) => {
    result.total += stat.count;
    if (stat._id === AppointmentStatus.SCHEDULED) result.scheduled = stat.count;
    if (stat._id === AppointmentStatus.CONFIRMED) result.confirmed = stat.count;
    if (stat._id === AppointmentStatus.COMPLETED) result.completed = stat.count;
    if (stat._id === AppointmentStatus.CANCELLED) result.cancelled = stat.count;
    if (stat._id === AppointmentStatus.NO_SHOW) result.noShow = stat.count;
  });
  
  return result;
};

// ==================== EXPORT ====================
const Appointment = mongoose.model<IAppointment>('Appointment', AppointmentSchema);

export default Appointment;