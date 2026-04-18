import mongoose, { Schema } from 'mongoose';
import { IMedicalRecord, IPrescription, ILabResult, IVitals, IAttachment } from '../types/medicalRecord.types';
import { MedicalRecordType, UserRole } from '../types';
import encryption from '../utils/encryption';

// Sub-schema for prescriptions
const PrescriptionSchema = new Schema<IPrescription>(
  {
    medication: {
      type: String,
      required: [true, 'Medication name is required'],
      trim: true,
    },
    dosage: {
      type: String,
      required: [true, 'Dosage is required'],
      trim: true,
    },
    frequency: {
      type: String,
      required: [true, 'Frequency is required'],
      trim: true,
    },
    duration: {
      type: String,
      required: [true, 'Duration is required'],
      trim: true,
    },
    instructions: {
      type: String,
      trim: true,
    },
    refills: {
      type: Number,
      min: [0, 'Refills cannot be negative'],
      default: 0,
    },
  },
  { _id: false }
);

// Sub-schema for lab results
const LabResultSchema = new Schema<ILabResult>(
  {
    testName: {
      type: String,
      required: [true, 'Test name is required'],
      trim: true,
    },
    result: {
      type: String,
      required: [true, 'Test result is required'],
    },
    normalRange: {
      type: String,
      required: true,
    },
    unit: {
      type: String,
      required: true,
    },
    date: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: ['normal', 'abnormal', 'critical'],
    },
  },
  { _id: false }
);

// Sub-schema for vital signs
const VitalsSchema = new Schema<IVitals>(
  {
    bloodPressure: {
      type: String,
      match: [/^\d{2,3}\/\d{2,3}$/, 'Blood pressure must be in format XXX/XX'],
    },
    heartRate: {
      type: Number,
      min: [0, 'Heart rate cannot be negative'],
      max: [300, 'Heart rate seems unrealistic'],
    },
    temperature: {
      type: Number,
      min: [30, 'Temperature seems too low'],
      max: [45, 'Temperature seems too high'],
    },
    weight: {
      type: Number,
      min: [0, 'Weight cannot be negative'],
    },
    height: {
      type: Number,
      min: [0, 'Height cannot be negative'],
    },
    bmi: {
      type: Number,
      min: [0, 'BMI cannot be negative'],
    },
    oxygenSaturation: {
      type: Number,
      min: [0, 'Oxygen saturation cannot be negative'],
      max: [100, 'Oxygen saturation cannot exceed 100%'],
    },
    respiratoryRate: {
      type: Number,
      min: [0, 'Respiratory rate cannot be negative'],
    },
  },
  { _id: false }
);

// Sub-schema for attachments
const AttachmentSchema = new Schema<IAttachment>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      required: true,
      enum: ['image', 'pdf', 'document'],
    },
    url: {
      type: String,
      required: true,
    },
    size: {
      type: Number,
    },
    uploadedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: true }
);

// Main Medical Record Schema
const MedicalRecordSchema = new Schema<IMedicalRecord>(
  {
    // ==================== RELATIONSHIPS ====================
    patientId: {
      type: Schema.Types.ObjectId as any,
      ref: 'User',
      required: [true, 'Patient is required'],
      index: true,
    },

    doctorId: {
      type: Schema.Types.ObjectId as any,
      ref: 'User',
      required: [true, 'Doctor is required'],
      index: true,
    },

    appointmentId: {
      type: Schema.Types.ObjectId as any,
      ref: 'Appointment',
      index: true,
    },
    
    // ==================== RECORD TYPE ====================
    type: {
      type: String,
      enum: Object.values(MedicalRecordType),
      required: [true, 'Record type is required'],
    },
    
    // ==================== MEDICAL DATA ====================
    diagnosis: {
      type: String,
      trim: true,
      maxlength: [1000, 'Diagnosis cannot exceed 1000 characters'],
    },
    
    symptoms: [
      {
        type: String,
        trim: true,
        maxlength: [200, 'Symptom description cannot exceed 200 characters'],
      },
    ],
    
    treatment: {
      type: String,
      trim: true,
      maxlength: [2000, 'Treatment description cannot exceed 2000 characters'],
    },
    
    prescriptions: [PrescriptionSchema],
    
    // ==================== VITAL SIGNS ====================
    vitals: VitalsSchema,
    
    // ==================== LAB RESULTS ====================
    labResults: [LabResultSchema],
    
    // ==================== ATTACHMENTS ====================
    attachments: [AttachmentSchema],
    
    // ==================== PRIVACY & SECURITY ====================
    isConfidential: {
      type: Boolean,
      default: false,
    },
    
    // ==================== NOTES ====================
    doctorNotes: {
      type: String,
      // Will be encrypted before saving
    },
    
    patientNotes: {
      type: String,
      maxlength: [1000, 'Patient notes cannot exceed 1000 characters'],
    },
    
    // ==================== FOLLOW-UP ====================
    followUpRequired: {
      type: Boolean,
      default: false,
    },
    
    followUpDate: {
      type: Date,
    },
    
    followUpNotes: {
      type: String,
      maxlength: [500, 'Follow-up notes cannot exceed 500 characters'],
    },
    
    // ==================== METADATA ====================
    recordDate: {
      type: Date,
      default: Date.now,
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
MedicalRecordSchema.index({ patientId: 1, recordDate: -1 });
MedicalRecordSchema.index({ doctorId: 1, recordDate: -1 });
MedicalRecordSchema.index({ type: 1, recordDate: -1 });
MedicalRecordSchema.index({ patientId: 1, type: 1 });

// ==================== VIRTUAL FIELDS ====================

// Virtual for populated patient
MedicalRecordSchema.virtual('patient', {
  ref: 'User',
  localField: 'patientId',
  foreignField: '_id',
  justOne: true,
});

// Virtual for populated doctor
MedicalRecordSchema.virtual('doctor', {
  ref: 'User',
  localField: 'doctorId',
  foreignField: '_id',
  justOne: true,
});

// Virtual for populated appointment
MedicalRecordSchema.virtual('appointment', {
  ref: 'Appointment',
  localField: 'appointmentId',
  foreignField: '_id',
  justOne: true,
});

// ==================== MIDDLEWARE ====================

// Encrypt doctor notes before saving
MedicalRecordSchema.pre('save', async function () {
  const doc = this as IMedicalRecord & { isModified(field: string): boolean };
  if (doc.isModified('doctorNotes') && doc.doctorNotes) {
    // Only encrypt if not already encrypted (doesn't contain ':')
    if (!doc.doctorNotes.includes(':')) {
      doc.doctorNotes = encryption.encrypt(doc.doctorNotes);
    }
  }
});

// Calculate BMI if height and weight are provided
MedicalRecordSchema.pre('save', async function () {
  const doc = this as IMedicalRecord;
  if (doc.vitals?.height && doc.vitals?.weight) {
    const heightInMeters = doc.vitals.height / 100;
    doc.vitals.bmi = parseFloat((doc.vitals.weight / (heightInMeters * heightInMeters)).toFixed(1));
  }
});

// ==================== INSTANCE METHODS ====================

// Check if user can view this record
MedicalRecordSchema.methods.canBeViewedBy = function (
  this: IMedicalRecord,
  userId: string,
  userRole: string
): boolean {
  // Doctor who created the record can always view it (even if confidential)
  if (this.doctorId.toString() === userId && userRole === UserRole.DOCTOR) {
    return true;
  }

  // Patient can view their own records
  if (this.patientId.toString() === userId && userRole === UserRole.PATIENT) {
    return true;
  }

  // Admin can view all
  if (userRole === UserRole.ADMIN) {
    return true;
  }

  // Confidential records cannot be viewed by other doctors
  if (this.isConfidential) {
    return false;
  }

  // Other doctors can view non-confidential records
  if (userRole === UserRole.DOCTOR) {
    return true;
  }

  return false;
};

// Check if user can edit this record
MedicalRecordSchema.methods.canBeEditedBy = function (
  this: IMedicalRecord,
  userId: string,
  userRole: string
): boolean {
  // Only the doctor who created the record can edit it
  if (this.doctorId.toString() === userId && userRole === UserRole.DOCTOR) {
    return true;
  }
  
  // Admin can edit all records
  if (userRole === UserRole.ADMIN) {
    return true;
  }
  
  return false;
};

// Add attachment
MedicalRecordSchema.methods.addAttachment = async function (
  this: IMedicalRecord,
  attachment: IAttachment
): Promise<IMedicalRecord> {
  if (!this.attachments) {
    this.attachments = [];
  }
  
  this.attachments.push(attachment);
  await this.save();
  
  return this;
};

// Remove attachment
MedicalRecordSchema.methods.removeAttachment = async function (
  this: IMedicalRecord,
  attachmentId: string
): Promise<IMedicalRecord> {
  if (!this.attachments) {
    return this;
  }
  
  this.attachments = this.attachments.filter(
    (att) => att._id && att._id.toString() !== attachmentId
  );
  
  await this.save();
  
  return this;
};

// Get decrypted doctor notes
MedicalRecordSchema.methods.getDecryptedNotes = function (this: IMedicalRecord): string {
  if (!this.doctorNotes) {
    return '';
  }
  
  try {
    return encryption.decrypt(this.doctorNotes);
  } catch (error) {
    console.error('Error decrypting notes:', error);
    return '';
  }
};

// ==================== STATIC METHODS ====================

// Get patient's medical history
MedicalRecordSchema.statics.getPatientHistory = function (
  patientId: string,
  options: { type?: MedicalRecordType; limit?: number } = {}
) {
  const query: any = { patientId };
  
  if (options.type) {
    query.type = options.type;
  }
  
  return this.find(query)
    .populate('doctorId', 'firstName lastName specialization')
    .populate('appointmentId', 'appointmentDate startTime')
    .sort({ recordDate: -1 })
    .limit(options.limit || 50);
};

// Get records by doctor
MedicalRecordSchema.statics.getDoctorRecords = function (
  doctorId: string,
  options: { type?: MedicalRecordType; limit?: number } = {}
) {
  const query: any = { doctorId };
  
  if (options.type) {
    query.type = options.type;
  }
  
  return this.find(query)
    .populate('patientId', 'firstName lastName email dateOfBirth')
    .populate('appointmentId', 'appointmentDate startTime')
    .sort({ recordDate: -1 })
    .limit(options.limit || 50);
};

// Get records by appointment
MedicalRecordSchema.statics.getByAppointment = function (appointmentId: string) {
  return this.find({ appointmentId })
    .populate('patientId', 'firstName lastName email')
    .populate('doctorId', 'firstName lastName specialization');
};

// Get records requiring follow-up
MedicalRecordSchema.statics.getFollowUpRequired = function (doctorId?: string) {
  const query: any = {
    followUpRequired: true,
    followUpDate: { $gte: new Date() },
  };
  
  if (doctorId) {
    query.doctorId = doctorId;
  }
  
  return this.find(query)
    .populate('patientId', 'firstName lastName email phone')
    .populate('doctorId', 'firstName lastName')
    .sort({ followUpDate: 1 });
};

// Get recent prescriptions for a patient
MedicalRecordSchema.statics.getRecentPrescriptions = function (
  patientId: string,
  limit: number = 10
) {
  return this.find({
    patientId,
    'prescriptions.0': { $exists: true }, // Has at least one prescription
  })
    .select('prescriptions recordDate doctorId')
    .populate('doctorId', 'firstName lastName specialization')
    .sort({ recordDate: -1 })
    .limit(limit);
};

// ==================== EXPORT ====================
const MedicalRecord = mongoose.model<IMedicalRecord>('MedicalRecord', MedicalRecordSchema);

export default MedicalRecord;