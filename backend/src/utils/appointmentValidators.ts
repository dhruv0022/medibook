import { body, param, query, ValidationChain } from 'express-validator';

export const createAppointmentValidation: ValidationChain[] = [
  body('doctorId')
    .notEmpty()
    .withMessage('Doctor ID is required')
    .isMongoId()
    .withMessage('Invalid doctor ID'),
  
  body('appointmentDate')
    .notEmpty()
    .withMessage('Appointment date is required')
    .isISO8601()
    .withMessage('Invalid date format'),
  
  body('startTime')
    .notEmpty()
    .withMessage('Start time is required')
    .matches(/^([01]\d|2[0-3]):([0-5]\d)$/)
    .withMessage('Start time must be in HH:MM format (e.g., 09:00)'),
  
  body('type')
    .notEmpty()
    .withMessage('Appointment type is required')
    .isIn(['in_person', 'video', 'phone'])
    .withMessage('Invalid appointment type'),
  
  body('reason')
    .notEmpty()
    .withMessage('Reason for appointment is required')
    .isLength({ max: 500 })
    .withMessage('Reason cannot exceed 500 characters'),
  
  body('symptoms')
    .optional()
    .isArray()
    .withMessage('Symptoms must be an array'),
  
  body('notes')
    .optional()
    .isLength({ max: 1000 })
    .withMessage('Notes cannot exceed 1000 characters'),
];

export const updateAppointmentValidation: ValidationChain[] = [
  param('id')
    .isMongoId()
    .withMessage('Invalid appointment ID'),
  
  body('appointmentDate')
    .optional()
    .isISO8601()
    .withMessage('Invalid date format'),
  
  body('startTime')
    .optional()
    .matches(/^([01]\d|2[0-3]):([0-5]\d)$/)
    .withMessage('Start time must be in HH:MM format'),
  
  body('status')
    .optional()
    .isIn(['scheduled', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show'])
    .withMessage('Invalid status'),
  
  body('reason')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Reason cannot exceed 500 characters'),
];

export const cancelAppointmentValidation: ValidationChain[] = [
  param('id')
    .isMongoId()
    .withMessage('Invalid appointment ID'),
  
  body('cancellationReason')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Cancellation reason cannot exceed 500 characters'),
];

export const getAppointmentsValidation: ValidationChain[] = [
  query('status')
    .optional()
    .isIn(['scheduled', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show'])
    .withMessage('Invalid status'),
  
  query('type')
    .optional()
    .isIn(['in_person', 'video', 'phone'])
    .withMessage('Invalid appointment type'),
  
  query('dateFrom')
    .optional()
    .isISO8601()
    .withMessage('Invalid date format'),
  
  query('dateTo')
    .optional()
    .isISO8601()
    .withMessage('Invalid date format'),
  
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
];