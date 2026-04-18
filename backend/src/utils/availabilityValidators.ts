import { body, param, query, ValidationChain } from 'express-validator';

export const createRegularScheduleValidation: ValidationChain[] = [
  body('dayOfWeek')
    .notEmpty()
    .withMessage('Day of week is required')
    .isInt({ min: 0, max: 6 })
    .withMessage('Day of week must be between 0 (Sunday) and 6 (Saturday)'),
  
  body('schedule')
    .notEmpty()
    .withMessage('Schedule is required')
    .isArray({ min: 1 })
    .withMessage('Schedule must have at least one time slot'),
  
  body('schedule.*.startTime')
    .notEmpty()
    .withMessage('Start time is required')
    .matches(/^([01]\d|2[0-3]):([0-5]\d)$/)
    .withMessage('Start time must be in HH:MM format'),
  
  body('schedule.*.endTime')
    .notEmpty()
    .withMessage('End time is required')
    .matches(/^([01]\d|2[0-3]):([0-5]\d)$/)
    .withMessage('End time must be in HH:MM format'),
  
  body('schedule.*.slotDuration')
    .optional()
    .isInt({ min: 15, max: 480 })
    .withMessage('Slot duration must be between 15 and 480 minutes'),
  
  body('breaks')
    .optional()
    .isArray()
    .withMessage('Breaks must be an array'),
  
  body('breaks.*.startTime')
    .if(body('breaks').exists())
    .matches(/^([01]\d|2[0-3]):([0-5]\d)$/)
    .withMessage('Break start time must be in HH:MM format'),
  
  body('breaks.*.endTime')
    .if(body('breaks').exists())
    .matches(/^([01]\d|2[0-3]):([0-5]\d)$/)
    .withMessage('Break end time must be in HH:MM format'),
];

export const createExceptionValidation: ValidationChain[] = [
  body('date')
    .notEmpty()
    .withMessage('Date is required')
    .isISO8601()
    .withMessage('Invalid date format'),
  
  body('isAvailable')
    .notEmpty()
    .withMessage('Availability status is required')
    .isBoolean()
    .withMessage('isAvailable must be a boolean'),
  
  body('exceptionSchedule')
    .optional()
    .isArray()
    .withMessage('Exception schedule must be an array'),
  
  body('exceptionReason')
    .optional()
    .isLength({ max: 200 })
    .withMessage('Exception reason cannot exceed 200 characters'),
];

export const updateScheduleValidation: ValidationChain[] = [
  param('id')
    .isMongoId()
    .withMessage('Invalid availability ID'),
  
  body('schedule')
    .optional()
    .isArray({ min: 1 })
    .withMessage('Schedule must have at least one time slot'),
  
  body('breaks')
    .optional()
    .isArray()
    .withMessage('Breaks must be an array'),
  
  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive must be a boolean'),
];

export const getAvailableSlotsValidation: ValidationChain[] = [
  param('doctorId')
    .isMongoId()
    .withMessage('Invalid doctor ID'),
  
  query('date')
    .notEmpty()
    .withMessage('Date is required')
    .isISO8601()
    .withMessage('Invalid date format'),
];

export const createStandardWeekValidation: ValidationChain[] = [
  body('startTime')
    .optional()
    .matches(/^([01]\d|2[0-3]):([0-5]\d)$/)
    .withMessage('Start time must be in HH:MM format'),
  
  body('endTime')
    .optional()
    .matches(/^([01]\d|2[0-3]):([0-5]\d)$/)
    .withMessage('End time must be in HH:MM format'),
  
  body('lunchBreak')
    .optional()
    .isBoolean()
    .withMessage('lunchBreak must be a boolean'),
];