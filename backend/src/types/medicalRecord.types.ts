import { Document, Types } from 'mongoose';
import { MedicalRecordType } from './index';

// Prescription interface
export interface IPrescription {
  medication: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions?: string;
  refills?: number;
}

// Lab result interface
export interface ILabResult {
  testName: string;
  result: string;
  normalRange: string;
  unit: string;
  date: Date;
  status?: 'normal' | 'abnormal' | 'critical';
}

// Vital signs interface
export interface IVitals {
  bloodPressure?: string; // "120/80"
  heartRate?: number; // beats per minute
  temperature?: number; // Celsius
  weight?: number; // kg
  height?: number; // cm
  bmi?: number;
  oxygenSaturation?: number; // percentage
  respiratoryRate?: number; // breaths per minute
}

// Attachment interface
export interface IAttachment {
  _id?: string;
  name: string;
  type: string; // "image", "pdf", "document"
  url: string; // S3 URL
  size?: number; // bytes
  uploadedAt: Date;
}

// Main medical record interface
export interface IMedicalRecord extends Document {
  // Relationships
  patientId: Types.ObjectId;
  doctorId: Types.ObjectId;
  appointmentId?: Types.ObjectId;
  
  // Record type
  type: MedicalRecordType;
  
  // Medical data
  diagnosis?: string;
  symptoms?: string[];
  treatment?: string;
  prescriptions?: IPrescription[];
  
  // Vital signs
  vitals?: IVitals;
  
  // Lab results
  labResults?: ILabResult[];
  
  // Attachments
  attachments?: IAttachment[];
  
  // Privacy & security
  isConfidential: boolean;
  
  // Notes
  doctorNotes?: string; // Encrypted
  patientNotes?: string;
  
  // Follow-up
  followUpRequired: boolean;
  followUpDate?: Date;
  followUpNotes?: string;
  
  // Metadata
  recordDate: Date;
  createdAt: Date;
  updatedAt: Date;
  
  // Methods
  canBeViewedBy(userId: string, userRole: string): boolean;
  canBeEditedBy(userId: string, userRole: string): boolean;
  addAttachment(attachment: IAttachment): Promise<IMedicalRecord>;
  removeAttachment(attachmentId: string): Promise<IMedicalRecord>;
}

// DTO for creating medical record
export interface CreateMedicalRecordDto {
  patientId: string;
  appointmentId?: string;
  type: MedicalRecordType;
  diagnosis?: string;
  symptoms?: string[];
  treatment?: string;
  prescriptions?: IPrescription[];
  vitals?: IVitals;
  labResults?: ILabResult[];
  doctorNotes?: string;
  followUpRequired?: boolean;
  followUpDate?: Date;
}

// DTO for updating medical record
export interface UpdateMedicalRecordDto {
  diagnosis?: string;
  symptoms?: string[];
  treatment?: string;
  prescriptions?: IPrescription[];
  vitals?: IVitals;
  labResults?: ILabResult[];
  doctorNotes?: string;
  patientNotes?: string;
  followUpRequired?: boolean;
  followUpDate?: Date;
}

// Response DTO (excludes encrypted fields)
export interface MedicalRecordResponseDto {
  id: string;
  patient: {
    id: string;
    name: string;
  };
  doctor: {
    id: string;
    name: string;
    specialization: string;
  };
  type: MedicalRecordType;
  diagnosis?: string;
  symptoms?: string[];
  recordDate: Date;
  createdAt: Date;
}