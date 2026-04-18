import { Response, NextFunction } from 'express';
import crypto from 'crypto';
import { AuthRequest, UserRole } from '../types';
import User from '../models/User';
import ErrorResponse from '../utils/ErrorResponse';
import logger from '../utils/logger';
import emailService from '../services/emailService';

/**
 * @desc    Register user
 * @route   POST /api/auth/register
 * @access  Public
 */
export const register = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { email, password, role, firstName, lastName, phone, dateOfBirth, ...otherFields } =
      req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return next(new ErrorResponse('User with this email already exists', 400));
    }

    // Create user
    const user = await User.create({
      email,
      password,
      role: role || UserRole.PATIENT,
      firstName,
      lastName,
      phone,
      dateOfBirth,
      ...otherFields,
    });

    // Generate email verification token
    const verificationToken = user.generateEmailVerificationToken();
    await user.save({ validateBeforeSave: false });

    // Send verification email
    await emailService.sendVerificationEmail(
      user.email,
      user.fullName,
      verificationToken
    );

    // Generate JWT token
    const token = user.getSignedJwtToken();

    logger.info(`User registered: ${user.email} (${user.role})`);

    res.status(201).json({
      success: true,
      message: 'Registration successful! Please check your email to verify your account.',
      data: {
        token,
        user: user.getPublicProfile(),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Login user
 * @route   POST /api/auth/login
 * @access  Public
 */
export const login = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { email, password } = req.body;

    // Check if user exists (include password for comparison)
    const user = await User.findOne({ email }).select('+password');

    if (!user) {
      return next(new ErrorResponse('Invalid credentials', 401));
    }

    // Check if password matches
    const isPasswordMatch = await user.matchPassword(password);

    if (!isPasswordMatch) {
      return next(new ErrorResponse('Invalid credentials', 401));
    }

    // Check if account is active
    if (!user.isActive) {
      return next(
        new ErrorResponse('Your account has been deactivated. Please contact support.', 403)
      );
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save({ validateBeforeSave: false });

    // Generate JWT token
    const token = user.getSignedJwtToken();

    logger.info(`User logged in: ${user.email}`);

    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        token,
        user: user.getPublicProfile(),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get current logged in user
 * @route   GET /api/auth/me
 * @access  Private
 */
export const getMe = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = await User.findById(req.user?.id);

    if (!user) {
      return next(new ErrorResponse('User not found', 404));
    }

    res.status(200).json({
      success: true,
      data: user.getPublicProfile(),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update user profile
 * @route   PUT /api/auth/profile
 * @access  Private
 */
export const updateProfile = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const fieldsToUpdate = {
      firstName: req.body.firstName,
      lastName: req.body.lastName,
      phone: req.body.phone,
      dateOfBirth: req.body.dateOfBirth,
      gender: req.body.gender,
      address: req.body.address,
      avatar: req.body.avatar,
      // Role-specific fields
      ...(req.user?.role === UserRole.PATIENT && {
        bloodType: req.body.bloodType,
        allergies: req.body.allergies,
        emergencyContact: req.body.emergencyContact,
      }),
      ...(req.user?.role === UserRole.DOCTOR && {
        biography: req.body.biography,
        qualifications: req.body.qualifications,
        yearsOfExperience: req.body.yearsOfExperience,
      }),
    };

    // Remove undefined fields
 Object.keys(fieldsToUpdate).forEach((key) => {
  if (fieldsToUpdate[key as keyof typeof fieldsToUpdate] === undefined) {
    delete fieldsToUpdate[key as keyof typeof fieldsToUpdate];
  }
});

    const user = await User.findByIdAndUpdate(req.user?.id, fieldsToUpdate, {
      new: true,
      runValidators: true,
    });

    if (!user) {
      return next(new ErrorResponse('User not found', 404));
    }

    logger.info(`User updated profile: ${user.email}`);

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: user.getPublicProfile(),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update password
 * @route   PUT /api/auth/password
 * @access  Private
 */
export const updatePassword = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { currentPassword, newPassword } = req.body;

    // Get user with password
    const user = await User.findById(req.user?.id).select('+password');

    if (!user) {
      return next(new ErrorResponse('User not found', 404));
    }

    // Check current password
    const isPasswordMatch = await user.matchPassword(currentPassword);

    if (!isPasswordMatch) {
      return next(new ErrorResponse('Current password is incorrect', 401));
    }

    // Update password
    user.password = newPassword;
    await user.save();

    // Generate new token
    const token = user.getSignedJwtToken();

    logger.info(`User changed password: ${user.email}`);

    res.status(200).json({
      success: true,
      message: 'Password updated successfully',
      data: {
        token,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Forgot password
 * @route   POST /api/auth/forgot-password
 * @access  Public
 */
export const forgotPassword = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });

    if (!user) {
      // Don't reveal if email exists or not (security best practice)
      res.status(200).json({
        success: true,
        message: 'If that email exists, a password reset link has been sent.',
      });
      return;
    }

    // Generate reset token
    const resetToken = user.generatePasswordResetToken();
    await user.save({ validateBeforeSave: false });

    // Send reset email
    await emailService.sendPasswordResetEmail(user.email, user.fullName, resetToken);

    logger.info(`Password reset requested: ${user.email}`);

    res.status(200).json({
      success: true,
      message: 'If that email exists, a password reset link has been sent.',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Reset password
 * @route   PUT /api/auth/reset-password/:token
 * @access  Public
 */
export const resetPassword = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    // Hash token to compare with DB
    const hashedToken = crypto.createHash('sha256').update(token as string).digest('hex');
    // Find user by token and check if not expired
    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpire: { $gt: Date.now() },
    });

    if (!user) {
      return next(new ErrorResponse('Invalid or expired reset token', 400));
    }

    // Set new password
    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save();

    // Generate new JWT token
    const jwtToken = user.getSignedJwtToken();

    logger.info(`Password reset successful: ${user.email}`);

    res.status(200).json({
      success: true,
      message: 'Password reset successful',
      data: {
        token: jwtToken,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Verify email
 * @route   GET /api/auth/verify-email/:token
 * @access  Public
 */
export const verifyEmail = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { token } = req.params;

    // Hash token to compare with DB
   const hashedToken = crypto.createHash('sha256').update(token as string).digest('hex');
    // Find user by token and check if not expired
    const user = await User.findOne({
      verificationToken: hashedToken,
      verificationTokenExpiry: { $gt: Date.now() },
    });

    if (!user) {
      return next(new ErrorResponse('Invalid or expired verification token', 400));
    }

    // Mark email as verified
    user.isVerified = true;
    user.verificationToken = undefined;
    user.verificationTokenExpiry = undefined;
    await user.save({ validateBeforeSave: false });

    // Send welcome email
    await emailService.sendWelcomeEmail(user.email, user.fullName, user.role);

    logger.info(`Email verified: ${user.email}`);

    res.status(200).json({
      success: true,
      message: 'Email verified successfully! Welcome to MediBook.',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Resend verification email
 * @route   POST /api/auth/resend-verification
 * @access  Private
 */
export const resendVerificationEmail = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = await User.findById(req.user?.id);

    if (!user) {
      return next(new ErrorResponse('User not found', 404));
    }

    if (user.isVerified) {
      return next(new ErrorResponse('Email is already verified', 400));
    }

    // Generate new verification token
    const verificationToken = user.generateEmailVerificationToken();
    await user.save({ validateBeforeSave: false });

    // Send verification email
    await emailService.sendVerificationEmail(
      user.email,
      user.fullName,
      verificationToken
    );

    logger.info(`Verification email resent: ${user.email}`);

    res.status(200).json({
      success: true,
      message: 'Verification email sent. Please check your inbox.',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Logout user
 * @route   POST /api/auth/logout
 * @access  Private
 */
export const logout = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // In a real app with refresh tokens, you'd invalidate them here
    // For JWT-only auth, logout is handled client-side by removing the token

    logger.info(`User logged out: ${req.user?.id}`);

    res.status(200).json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (error) {
    next(error);
  }
};