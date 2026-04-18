import express from 'express';
import {
  createRegularSchedule,
  createException,
  getWeeklySchedule,
  getAvailabilityForDate,
  getAvailableSlots,
  getSchedules,
  updateSchedule,
  deleteSchedule,
  createStandardWeek,
  getUpcomingExceptions,
  checkAvailability,
  getScheduleStats,
} from '../controllers/availabilityController';
import { protect } from '../middleware/auth';
import { authorize } from '../middleware/authorize';
import { validate } from '../middleware/validation';
import {
  createRegularScheduleValidation,
  createExceptionValidation,
  updateScheduleValidation,
  getAvailableSlotsValidation,
  createStandardWeekValidation,
} from '../utils/availabilityValidators';
import { UserRole } from '../types';

const router = express.Router();

// ==================== PUBLIC ROUTES ====================
router.get('/weekly', getWeeklySchedule);
router.get('/weekly/:doctorId', getWeeklySchedule);
router.get('/date/:doctorId', getAvailabilityForDate);
router.get('/slots/:doctorId', getAvailableSlotsValidation, validate, getAvailableSlots);
router.post('/check', checkAvailability);

// ==================== PROTECTED ROUTES ====================
router.use(protect); // All routes below require authentication

// Doctor-only routes
router.post(
  '/regular',
  authorize(UserRole.DOCTOR),
  createRegularScheduleValidation,
  validate,
  createRegularSchedule
);

router.post(
  '/exception',
  authorize(UserRole.DOCTOR),
  createExceptionValidation,
  validate,
  createException
);

router.post(
  '/standard-week',
  authorize(UserRole.DOCTOR),
  createStandardWeekValidation,
  validate,
  createStandardWeek
);

router.get('/exceptions/upcoming', authorize(UserRole.DOCTOR), getUpcomingExceptions);
router.get('/stats', authorize(UserRole.DOCTOR), getScheduleStats);
router.get('/', authorize(UserRole.DOCTOR), getSchedules);

// Update and delete
router.put('/:id', authorize(UserRole.DOCTOR), updateScheduleValidation, validate, updateSchedule);
router.delete('/:id', authorize(UserRole.DOCTOR), deleteSchedule);

export default router;
