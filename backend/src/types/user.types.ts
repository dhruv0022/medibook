import { Document } from 'mongoose';
import { UserRole } from './index';

// Base user interface
export interface IUser extends Document {
  // Common fields
  email: string;
  password: string;
  role: UserRole;
  firstName: string;
  lastName: string;
  phone?: string;
  avatar?: string;
  dateOfBirth?: Date;
  gender?: 'male' | 'female' | 'other' | 'prefer_not_to_say';
  
  // Address
  address?: {
    street?: string;
    city?: string;
    province?: string;
    postalCode?: string;
    country?: string;
  };
  
  // Patient-specific fields
  healthCard?: string;
  bloodType?: string;
  allergies?: string[];
  emergencyContact?: {
    name: string;
    phone: string;
    relationship: string;
  };
  
  // Doctor-specific fields
  specialization?: string;
  licenseNumber?: string;
  qualifications?: string[];
  biography?: string;
  consultationFee?: number;
  yearsOfExperience?: number;
  
  // Account status
  isVerified: boolean;
  isActive: boolean;
  emailVerified: boolean;
  phoneVerified: boolean;
  
  // Security
  emailVerificationToken?: string;
  emailVerificationExpire?: Date;
  resetPasswordToken?: string;
  resetPasswordExpire?: Date;
  
  // Timestamps
  lastLogin?: Date;
  createdAt: Date;
  updatedAt: Date;
  
  // Methods
  matchPassword(enteredPassword: string): Promise<boolean>;
  getSignedJwtToken(): string;
  generateEmailVerificationToken(): string;
  generatePasswordResetToken(): string;
}

// DTO for user registration
export interface RegisterUserDto {
  email: string;
  password: string;
  role: UserRole;
  firstName: string;
  lastName: string;
  phone?: string;
  dateOfBirth?: Date;
  
  // Doctor-specific (if role is doctor)
  specialization?: string;
  licenseNumber?: string;
  consultationFee?: number;
}

// DTO for user login
export interface LoginUserDto {
  email: string;
  password: string;
}

// DTO for user update
export interface UpdateUserDto {
  firstName?: string;
  lastName?: string;
  phone?: string;
  avatar?: string;
  dateOfBirth?: Date;
  gender?: 'male' | 'female' | 'other' | 'prefer_not_to_say';
  address?: {
    street?: string;
    city?: string;
    province?: string;
    postalCode?: string;
    country?: string;
  };
  
  // Patient-specific
  bloodType?: string;
  allergies?: string[];
  emergencyContact?: {
    name: string;
    phone: string;
    relationship: string;
  };
  
  // Doctor-specific
  biography?: string;
  qualifications?: string[];
  yearsOfExperience?: number;
}

// Response DTO (excludes sensitive fields)
export interface UserResponseDto {
  id: string;
  email: string;
  role: UserRole;
  firstName: string;
  lastName: string;
  phone?: string;
  avatar?: string;
  isVerified: boolean;
  emailVerified: boolean;
  createdAt: Date;
}