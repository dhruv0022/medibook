import express from 'express';
import {
  register,
  login,
  logout,
  getMe,
  updateProfile,
  updatePassword,
  forgotPassword,
  resetPassword,
  verifyEmail,
  resendVerificationEmail,
} from '../controllers/authController';
import { protect } from '../middleware/auth';
import { validate } from '../middleware/validation';
import {
  registerValidation,
  loginValidation,
  updateProfileValidation,
  updatePasswordValidation,
  forgotPasswordValidation,
  resetPasswordValidation,
} from '../utils/validators';

const router = express.Router();

// ==================== PUBLIC ROUTES ====================
router.post('/register', registerValidation, validate, register);
router.post('/login', loginValidation, validate, login);
router.post('/forgot-password', forgotPasswordValidation, validate, forgotPassword);
router.put('/reset-password/:token', resetPasswordValidation, validate, resetPassword);
router.get('/verify-email/:token', verifyEmail);

// ==================== PROTECTED ROUTES ====================
router.use(protect); // All routes below require authentication

router.get('/me', getMe);
router.put('/profile', updateProfileValidation, validate, updateProfile);
router.put('/password', updatePasswordValidation, validate, updatePassword);
router.post('/resend-verification', resendVerificationEmail);
router.post('/logout', logout);

export default router;