import mongoose, { Document, Schema } from 'mongoose';
import bcrypt from 'bcryptjs';

// User Interface
export interface IUser extends Document {
  _id: mongoose.Types.ObjectId;
  email: string;
  password: string;
  role: 'patient' | 'doctor' | 'admin';
  firstName: string;
  lastName: string;
  phone?: string;
  avatar?: string;
  dateOfBirth?: Date;
  gender?: 'male' | 'female' | 'other';
  address?: {
    street?: string;
    city?: string;
    province?: string;
    postalCode?: string;
    country?: string;
  };
  emergencyContact?: {
    name?: string;
    relationship?: string;
    phone?: string;
  };
  
  // Patient-specific fields
  bloodType?: string;
  allergies?: string[];
  chronicConditions?: string[];
  currentMedications?: string[];
  insuranceProvider?: string;
  insurancePolicyNumber?: string;
  
  // Doctor-specific fields
  specialization?: string;
  licenseNumber?: string;
  consultationFee?: number;
  yearsOfExperience?: number;
  qualifications?: string[];
  bio?: string;
  languages?: string[];
  hospitalAffiliations?: string[];
  
  // Account status
  isVerified: boolean;
  isActive: boolean;
  verificationToken?: string;
  verificationTokenExpiry?: Date;
  resetPasswordToken?: string;
  resetPasswordExpire?: Date;
  lastLogin?: Date;
  
  createdAt: Date;
  updatedAt: Date;
  
  // Virtual properties
  fullName: string;
  
  // Instance methods
  comparePassword(candidatePassword: string): Promise<boolean>;
  matchPassword(candidatePassword: string): Promise<boolean>;
  getSignedJwtToken(): string;
  generateEmailVerificationToken(): string;
  generatePasswordResetToken(): string;
  getPublicProfile(): any;
}

// User Schema
const userSchema = new Schema<IUser>(
  {
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address'],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [8, 'Password must be at least 8 characters long'],
      select: false, // Don't return password by default in queries
    },
    role: {
      type: String,
      enum: ['patient', 'doctor', 'admin'],
      default: 'patient',
    },
    firstName: {
      type: String,
      required: [true, 'First name is required'],
      trim: true,
    },
    lastName: {
      type: String,
      required: [true, 'Last name is required'],
      trim: true,
    },
    phone: {
      type: String,
      trim: true,
    },
    avatar: {
      type: String,
    },
    dateOfBirth: {
      type: Date,
    },
    gender: {
      type: String,
      enum: ['male', 'female', 'other'],
    },
    address: {
      street: String,
      city: String,
      province: String,
      postalCode: String,
      country: String,
    },
    emergencyContact: {
      name: String,
      relationship: String,
      phone: String,
    },

    // Patient-specific fields
    bloodType: {
      type: String,
      enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'],
    },
    allergies: [String],
    chronicConditions: [String],
    currentMedications: [String],
    insuranceProvider: String,
    insurancePolicyNumber: String,

    // Doctor-specific fields
    specialization: {
      type: String,
      required: function (this: IUser) {
        return this.role === 'doctor';
      },
    },
    licenseNumber: {
      type: String,
      required: function (this: IUser) {
        return this.role === 'doctor';
      },
    },
    consultationFee: {
      type: Number,
      min: 0,
    },
    yearsOfExperience: {
      type: Number,
      min: 0,
    },
    qualifications: [String],
    bio: String,
    languages: [String],
    hospitalAffiliations: [String],

    // Account status
    isVerified: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    verificationToken: String,
    verificationTokenExpiry: Date,
    resetPasswordToken: String,
    resetPasswordExpire: Date,
    lastLogin: Date,
  },
  {
    timestamps: true,
  }
);

// Indexes
userSchema.index({ email: 1 });
userSchema.index({ role: 1 });
userSchema.index({ specialization: 1 });

// Pre-save middleware to hash password
userSchema.pre<IUser>('save', async function () {
  if (!this.isModified('password')) {
    return;
  }

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Method to compare passwords
userSchema.methods.comparePassword = async function (
  candidatePassword: string
): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.password);
};

// ==================== VIRTUAL PROPERTIES ====================

userSchema.virtual('fullName').get(function (this: IUser) {
  return `${this.firstName} ${this.lastName}`;
});

// Make virtuals visible in JSON
userSchema.set('toJSON', { virtuals: true });
userSchema.set('toObject', { virtuals: true });

// ==================== INSTANCE METHODS ====================

// Method to compare passwords
userSchema.methods.comparePassword = async function (
  candidatePassword: string
): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.password);
};

// Alias for comparePassword
userSchema.methods.matchPassword = async function (
  candidatePassword: string
): Promise<boolean> {
  return this.comparePassword(candidatePassword);
};

// Method to generate JWT token
userSchema.methods.getSignedJwtToken = function (): string {
  const jwt = require('jsonwebtoken');
  return jwt.sign(
    { id: this._id, role: this.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRE || '7d' }
  );
};

// Method to generate email verification token
userSchema.methods.generateEmailVerificationToken = function (): string {
  const crypto = require('crypto');
  const verificationToken = crypto.randomBytes(20).toString('hex');

  this.verificationToken = crypto
    .createHash('sha256')
    .update(verificationToken)
    .digest('hex');

  this.verificationTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);

  return verificationToken;
};

// Method to generate password reset token
userSchema.methods.generatePasswordResetToken = function (): string {
  const crypto = require('crypto');
  const resetToken = crypto.randomBytes(20).toString('hex');

  this.resetPasswordToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');

  this.resetPasswordExpire = new Date(Date.now() + 10 * 60 * 1000);

  return resetToken;
};

// Method to get public profile
userSchema.methods.getPublicProfile = function () {
  const userObject = this.toObject();
  
  delete userObject.password;
  delete userObject.verificationToken;
  delete userObject.verificationTokenExpiry;
  delete userObject.resetPasswordToken;
  delete userObject.resetPasswordExpire;
  delete userObject.__v;

  return userObject;
};

// ==================== MODEL ====================

const User = mongoose.model<IUser>('User', userSchema);

export default User;