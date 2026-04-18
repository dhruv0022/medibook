import express from 'express';
import {
  createAppointment,
  getAppointments,
  getAppointment,
  updateAppointment,
  cancelAppointment,
  confirmAppointment,
  completeAppointment,
  markNoShow,
  getAvailableSlots,
  getUpcomingAppointments,
  getAppointmentStats,
} from '../controllers/appointmentController';
import { protect } from '../middleware/auth';
import { authorize } from '../middleware/authorize';
import { validate } from '../middleware/validation';
import {
  createAppointmentValidation,
  updateAppointmentValidation,
  cancelAppointmentValidation,
  getAppointmentsValidation,
} from '../utils/appointmentValidators';
import { UserRole } from '../types';

const router = express.Router();

// ==================== PUBLIC ROUTES ====================
router.get('/test', (req, res) => {
  res.json({ success: true, message: 'Test route works!' });
});

router.get('/available-slots/:doctorId', getAvailableSlots);

// ==================== PROTECTED ROUTES ====================
router.use(protect); // All routes below require authentication

// Get statistics
router.get('/stats', getAppointmentStats);

// Get upcoming appointments
router.get('/upcoming', getUpcomingAppointments);

// CRUD operations
router.post('/', createAppointmentValidation, validate, createAppointment);
router.get('/', getAppointmentsValidation, validate, getAppointments);
router.get('/:id', getAppointment);
router.put('/:id', updateAppointmentValidation, validate, updateAppointment);
router.delete('/:id', cancelAppointmentValidation, validate, cancelAppointment);

// Status updates (Doctor only)
router.put('/:id/confirm', authorize(UserRole.DOCTOR), confirmAppointment);
router.put('/:id/complete', authorize(UserRole.DOCTOR), completeAppointment);
router.put('/:id/no-show', authorize(UserRole.DOCTOR), markNoShow);

export default router;