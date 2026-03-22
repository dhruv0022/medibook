import { Request } from 'express';
import { Document } from 'mongoose';

// Extend Express Request to include user
export interface AuthRequest extends Request {
  user?: {
    id: string;
    role: UserRole;
  };
}

// User roles
export enum UserRole {
  PATIENT = 'patient',
  DOCTOR = 'doctor',
  ADMIN = 'admin',
}

// Appointment status
export enum AppointmentStatus {
  SCHEDULED = 'scheduled',
  CONFIRMED = 'confirmed',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  NO_SHOW = 'no_show',
}

// Appointment type
export enum AppointmentType {
  IN_PERSON = 'in_person',
  VIDEO = 'video',
  PHONE = 'phone',
}

// Payment status
export enum PaymentStatus {
  PENDING = 'pending',
  PAID = 'paid',
  REFUNDED = 'refunded',
  FAILED = 'failed',
}

// Medical record type
export enum MedicalRecordType {
  CONSULTATION = 'consultation',
  PRESCRIPTION = 'prescription',
  LAB_REPORT = 'lab_report',
  IMAGING = 'imaging',
  VACCINATION = 'vaccination',
  SURGERY = 'surgery',
  OTHER = 'other',
}

// Notification type
export enum NotificationType {
  APPOINTMENT_REMINDER = 'appointment_reminder',
  APPOINTMENT_CONFIRMED = 'appointment_confirmed',
  APPOINTMENT_CANCELLED = 'appointment_cancelled',
  APPOINTMENT_RESCHEDULED = 'appointment_rescheduled',
  NEW_MESSAGE = 'new_message',
  PRESCRIPTION_READY = 'prescription_ready',
  LAB_RESULTS_READY = 'lab_results_ready',
  PAYMENT_SUCCESS = 'payment_success',
}

// Generic API Response
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

// Pagination
export interface PaginationParams {
  page: number;
  limit: number;
  sort?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}