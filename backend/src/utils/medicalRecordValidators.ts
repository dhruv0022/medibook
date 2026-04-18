import { body, param, query, ValidationChain } from 'express-validator';

export const createMedicalRecordValidation: ValidationChain[] = [
  body('patientId')
    .notEmpty()
    .withMessage('Patient ID is required')
    .isMongoId()
    .withMessage('Invalid patient ID'),
  
  body('type')
    .notEmpty()
    .withMessage('Record type is required')
    .isIn(['consultation', 'prescription', 'lab_report', 'imaging', 'vaccination', 'surgery', 'other'])
    .withMessage('Invalid record type'),
  
  body('diagnosis')
    .optional()
    .isLength({ max: 1000 })
    .withMessage('Diagnosis cannot exceed 1000 characters'),
  
  body('symptoms')
    .optional()
    .isArray()
    .withMessage('Symptoms must be an array'),
  
  body('treatment')
    .optional()
    .isLength({ max: 2000 })
    .withMessage('Treatment cannot exceed 2000 characters'),
  
  body('prescriptions')
    .optional()
    .isArray()
    .withMessage('Prescriptions must be an array'),
  
  body('prescriptions.*.medication')
    .if(body('prescriptions').exists())
    .notEmpty()
    .withMessage('Medication name is required'),
  
  body('prescriptions.*.dosage')
    .if(body('prescriptions').exists())
    .notEmpty()
    .withMessage('Dosage is required'),
  
  body('prescriptions.*.frequency')
    .if(body('prescriptions').exists())
    .notEmpty()
    .withMessage('Frequency is required'),
  
  body('vitals.bloodPressure')
    .optional()
    .matches(/^\d{2,3}\/\d{2,3}$/)
    .withMessage('Blood pressure must be in format XXX/XX'),
  
  body('vitals.heartRate')
    .optional()
    .isInt({ min: 0, max: 300 })
    .withMessage('Heart rate must be between 0 and 300'),
  
  body('vitals.temperature')
    .optional()
    .isFloat({ min: 30, max: 45 })
    .withMessage('Temperature must be between 30 and 45 celsius'),
  
  body('doctorNotes')
    .optional()
    .isLength({ max: 5000 })
    .withMessage('Doctor notes cannot exceed 5000 characters'),
];

export const updateMedicalRecordValidation: ValidationChain[] = [
  param('id')
    .isMongoId()
    .withMessage('Invalid medical record ID'),
  
  body('diagnosis')
    .optional()
    .isLength({ max: 1000 })
    .withMessage('Diagnosis cannot exceed 1000 characters'),
  
  body('treatment')
    .optional()
    .isLength({ max: 2000 })
    .withMessage('Treatment cannot exceed 2000 characters'),
];

export const getMedicalRecordsValidation: ValidationChain[] = [
  query('patientId')
    .optional()
    .isMongoId()
    .withMessage('Invalid patient ID'),
  
  query('type')
    .optional()
    .isIn(['consultation', 'prescription', 'lab_report', 'imaging', 'vaccination', 'surgery', 'other'])
    .withMessage('Invalid record type'),
  
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

export const addAttachmentValidation: ValidationChain[] = [
  param('id')
    .isMongoId()
    .withMessage('Invalid medical record ID'),
  
  body('name')
    .notEmpty()
    .withMessage('Attachment name is required'),
  
  body('type')
    .notEmpty()
    .withMessage('Attachment type is required')
    .isIn(['image', 'pdf', 'document'])
    .withMessage('Invalid attachment type'),
  
  body('url')
    .notEmpty()
    .withMessage('Attachment URL is required')
    .isURL()
    .withMessage('Invalid URL format'),
];