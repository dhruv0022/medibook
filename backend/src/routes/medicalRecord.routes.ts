import express from 'express';
import {
  createMedicalRecord,
  getMedicalRecords,
  getMedicalRecord,
  updateMedicalRecord,
  deleteMedicalRecord,
  getPatientHistory,
  getPatientPrescriptions,
  addAttachment,
  removeAttachment,
  getFollowUpRecords,
  getMedicalRecordStats,
} from '../controllers/medicalRecordController';
import { protect } from '../middleware/auth';
import { authorize } from '../middleware/authorize';
import { validate } from '../middleware/validation';
import {
  createMedicalRecordValidation,
  updateMedicalRecordValidation,
  getMedicalRecordsValidation,
  addAttachmentValidation,
} from '../utils/medicalRecordValidators';
import { UserRole } from '../types';

const router = express.Router();

// ==================== PROTECTED ROUTES ====================
router.use(protect); // All routes require authentication

// Statistics
router.get('/stats', getMedicalRecordStats);

// Follow-up records
router.get('/follow-up', authorize(UserRole.DOCTOR, UserRole.ADMIN), getFollowUpRecords);

// Patient-specific routes
router.get('/patient/:patientId/history', getPatientHistory);
router.get('/patient/:patientId/prescriptions', getPatientPrescriptions);

// CRUD operations
router.post(
  '/',
  authorize(UserRole.DOCTOR),
  createMedicalRecordValidation,
  validate,
  createMedicalRecord
);
router.get('/', getMedicalRecordsValidation, validate, getMedicalRecords);
router.get('/:id', getMedicalRecord);
router.put('/:id', updateMedicalRecordValidation, validate, updateMedicalRecord);
router.delete('/:id', authorize(UserRole.ADMIN), deleteMedicalRecord);

// Attachment operations
router.post('/:id/attachments', addAttachmentValidation, validate, addAttachment);
router.delete('/:id/attachments/:attachmentId', removeAttachment);

export default router;