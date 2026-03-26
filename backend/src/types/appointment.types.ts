import { Document, Types } from 'mongoose';
import { AppointmentStatus, AppointmentType, PaymentStatus } from './index';

// Main appointment interface
export interface IAppointment extends Document {
  // Core relationships
  patientId: Types.ObjectId;
  doctorId: Types.ObjectId;
  clinicId?: Types.ObjectId;
  
  // Scheduling
  appointmentDate: Date;
  startTime: string;
  endTime: string;
  duration: number;
  timezone: string;
  
  // Status
  status: AppointmentStatus;
  
  // Type and details
  type: AppointmentType;
  reason: string;
  symptoms?: string[];
  notes?: string;
  
  // Video consultation (if type is video)
  videoRoomId?: string;
  videoUrl?: string;
  videoRecordingUrl?: string;
  
  // Reminders
  remindersSent: Array<{
    type: 'email' | 'sms';
    sentAt: Date;
    status: 'sent' | 'failed';
  }>;
  
  // Payment
  paymentStatus: PaymentStatus;
  paymentAmount?: number;
  paymentIntentId?: string;
  paymentMethod?: string;
  
  // Cancellation
  cancellationReason?: string;
  cancelledBy?: string;
  cancelledAt?: Date;
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
  
  // Methods
  canBeCancelled(): boolean;
  canBeRescheduled(): boolean;
  isUpcoming(): boolean;
  isPast(): boolean;
  getFormattedDateTime(): string;
}

// DTO for creating appointment
export interface CreateAppointmentDto {
  doctorId: string;
  appointmentDate: Date;
  startTime: string;
  type: AppointmentType;
  reason: string;
  symptoms?: string[];
  notes?: string;
}

// DTO for updating appointment
export interface UpdateAppointmentDto {
  appointmentDate?: Date;
  startTime?: string;
  reason?: string;
  symptoms?: string[];
  notes?: string;
  status?: AppointmentStatus;
}

// DTO for appointment response
export interface AppointmentResponseDto {
  id: string;
  patient: {
    id: string;
    name: string;
    email: string;
    phone?: string;
  };
  doctor: {
    id: string;
    name: string;
    specialization: string;
    consultationFee?: number;
  };
  appointmentDate: Date;
  startTime: string;
  endTime: string;
  duration: number;
  status: AppointmentStatus;
  type: AppointmentType;
  reason: string;
  createdAt: Date;
}

// Query filters
export interface AppointmentFilters {
  patientId?: string;
  doctorId?: string;
  status?: AppointmentStatus;
  type?: AppointmentType;
  dateFrom?: Date;
  dateTo?: Date;
  page?: number;
  limit?: number;
}