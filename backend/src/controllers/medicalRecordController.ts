import { Response, NextFunction } from 'express';
import { AuthRequest, UserRole } from '../types';
import MedicalRecord from '../models/MedicalRecord';
import User from '../models/User';
import Appointment from '../models/Appointment';
import ErrorResponse from '../utils/ErrorResponse';
import logger from '../utils/logger';
import { startOfDay, endOfDay, parseISO } from 'date-fns';

/**
 * @desc    Create medical record
 * @route   POST /api/medical-records
 * @access  Private (Doctor only)
 */
export const createMedicalRecord = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.id;
    const userRole = req.user?.role;

    // Only doctors can create medical records
    if (userRole !== UserRole.DOCTOR) {
      return next(new ErrorResponse('Only doctors can create medical records', 403));
    }

    const {
      patientId,
      appointmentId,
      type,
      diagnosis,
      symptoms,
      treatment,
      prescriptions,
      vitals,
      labResults,
      doctorNotes,
      patientNotes,
      isConfidential,
      followUpRequired,
      followUpDate,
      followUpNotes,
    } = req.body;

    // Verify patient exists
    const patient = await User.findOne({
      _id: patientId,
      role: UserRole.PATIENT,
      isActive: true,
    });

    if (!patient) {
      return next(new ErrorResponse('Patient not found', 404));
    }

    // Verify appointment if provided
    if (appointmentId) {
      const appointment = await Appointment.findOne({
        _id: appointmentId,
        patientId,
        doctorId: userId,
      });

      if (!appointment) {
        return next(
          new ErrorResponse('Appointment not found or you are not the assigned doctor', 404)
        );
      }
    }

    // Create medical record
    const medicalRecord = await MedicalRecord.create({
      patientId,
      doctorId: userId,
      appointmentId,
      type,
      diagnosis,
      symptoms,
      treatment,
      prescriptions,
      vitals,
      labResults,
      doctorNotes,
      patientNotes,
      isConfidential: isConfidential || false,
      followUpRequired: followUpRequired || false,
      followUpDate,
      followUpNotes,
    });

    // Populate patient and doctor details
    const populatedRecord = await MedicalRecord.findById(medicalRecord._id)
      .populate('patientId', 'firstName lastName email dateOfBirth gender bloodType')
      .populate('doctorId', 'firstName lastName specialization')
      .populate('appointmentId', 'appointmentDate startTime');

    logger.info(`Medical record created: ${medicalRecord._id} by doctor ${userId}`);

    res.status(201).json({
      success: true,
      message: 'Medical record created successfully',
      data: populatedRecord,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get all medical records (with filters and permissions)
 * @route   GET /api/medical-records
 * @access  Private
 */
export const getMedicalRecords = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { patientId, type, dateFrom, dateTo, page = 1, limit = 20 } = req.query;
    const userId = req.user?.id;
    const userRole = req.user?.role;

    // Build query based on user role
    const query: any = {};

    if (userRole === UserRole.PATIENT) {
      // Patients can only see their own records
      query.patientId = userId;
    } else if (userRole === UserRole.DOCTOR) {
      // Doctors can see records they created or non-confidential records
      if (patientId) {
        query.$or = [
          { patientId, doctorId: userId }, // Records they created
          { patientId, isConfidential: false }, // Non-confidential records
        ];
      } else {
        // If no patientId filter, show only records they created
        query.doctorId = userId;
      }
    } else if (userRole === UserRole.ADMIN) {
      // Admin can see all records
      if (patientId) {
        query.patientId = patientId;
      }
    }

    // Apply filters
    if (type) {
      query.type = type;
    }

    if (dateFrom || dateTo) {
      query.recordDate = {};
      if (dateFrom) {
        query.recordDate.$gte = startOfDay(parseISO(dateFrom as string));
      }
      if (dateTo) {
        query.recordDate.$lte = endOfDay(parseISO(dateTo as string));
      }
    }

    // Pagination
    const skip = (Number(page) - 1) * Number(limit);

    // Execute query
    const records = await MedicalRecord.find(query)
      .populate('patientId', 'firstName lastName email dateOfBirth gender')
      .populate('doctorId', 'firstName lastName specialization')
      .populate('appointmentId', 'appointmentDate startTime')
      .select('-doctorNotes') // Exclude encrypted notes from list
      .sort({ recordDate: -1 })
      .skip(skip)
      .limit(Number(limit));

    // Get total count
    const total = await MedicalRecord.countDocuments(query);

    res.status(200).json({
      success: true,
      data: records,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get single medical record
 * @route   GET /api/medical-records/:id
 * @access  Private
 */
export const getMedicalRecord = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    const userRole = req.user?.role;

    const record = await MedicalRecord.findById(id)
      .populate('patientId', 'firstName lastName email dateOfBirth gender bloodType allergies')
      .populate('doctorId', 'firstName lastName specialization qualifications')
      .populate('appointmentId', 'appointmentDate startTime type');

    if (!record) {
      return next(new ErrorResponse('Medical record not found', 404));
    }

    // Check permissions
    if (!userId || !userRole) {
      return next(new ErrorResponse('User not authenticated', 401));
    }

    if (!record.canBeViewedBy(userId, userRole)) {
      return next(new ErrorResponse('Not authorized to view this medical record', 403));
    }

    // Decrypt doctor notes if user is authorized
    let decryptedNotes = undefined;
    if (userRole === UserRole.DOCTOR || userRole === UserRole.ADMIN) {
      decryptedNotes = (record as any).getDecryptedNotes();
    }

    // Create response object
    const responseData = record.toObject();
    if (decryptedNotes) {
      responseData.doctorNotes = decryptedNotes;
    } else {
      delete responseData.doctorNotes; // Don't send encrypted notes to patients
    }

    res.status(200).json({
      success: true,
      data: responseData,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update medical record
 * @route   PUT /api/medical-records/:id
 * @access  Private (Doctor who created it or Admin)
 */
export const updateMedicalRecord = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    const userRole = req.user?.role;

    const record = await MedicalRecord.findById(id);

    if (!record) {
      return next(new ErrorResponse('Medical record not found', 404));
    }

    // Check permissions
    if (!userId || !userRole) {
      return next(new ErrorResponse('User not authenticated', 401));
    }

    if (!record.canBeEditedBy(userId, userRole)) {
      return next(
        new ErrorResponse('Not authorized to edit this medical record', 403)
      );
    }

    // Update allowed fields
    const allowedFields = [
      'diagnosis',
      'symptoms',
      'treatment',
      'prescriptions',
      'vitals',
      'labResults',
      'doctorNotes',
      'patientNotes',
      'followUpRequired',
      'followUpDate',
      'followUpNotes',
    ];

    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        (record as any)[field] = req.body[field];
      }
    });

    await record.save();

    const updatedRecord = await MedicalRecord.findById(id)
      .populate('patientId', 'firstName lastName email')
      .populate('doctorId', 'firstName lastName specialization');

    logger.info(`Medical record updated: ${id} by user ${userId}`);

    res.status(200).json({
      success: true,
      message: 'Medical record updated successfully',
      data: updatedRecord,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete medical record
 * @route   DELETE /api/medical-records/:id
 * @access  Private (Admin only - soft delete recommended in production)
 */
export const deleteMedicalRecord = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const userRole = req.user?.role;

    // Only admin can delete medical records
    if (userRole !== UserRole.ADMIN) {
      return next(new ErrorResponse('Only administrators can delete medical records', 403));
    }

    const record = await MedicalRecord.findById(id);

    if (!record) {
      return next(new ErrorResponse('Medical record not found', 404));
    }

    await record.deleteOne();

    logger.info(`Medical record deleted: ${id} by admin ${req.user?.id}`);

    res.status(200).json({
      success: true,
      message: 'Medical record deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get patient medical history
 * @route   GET /api/medical-records/patient/:patientId/history
 * @access  Private
 */
export const getPatientHistory = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { patientId } = req.params;
    const { type, limit = 50 } = req.query;
    const userId = req.user?.id;
    const userRole = req.user?.role;

    // Verify patient exists
    const patient = await User.findOne({
      _id: patientId,
      role: UserRole.PATIENT,
    });

    if (!patient) {
      return next(new ErrorResponse('Patient not found', 404));
    }

    // Check permissions
    if (userRole === UserRole.PATIENT && patientId !== userId) {
      return next(new ErrorResponse('Not authorized to view this patient history', 403));
    }

    const options: any = { limit: Number(limit) };
    if (type) {
      options.type = type;
    }

    const history = await (MedicalRecord as any).getPatientHistory(patientId, options);

    res.status(200).json({
      success: true,
      count: history.length,
      data: history,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get patient prescriptions
 * @route   GET /api/medical-records/patient/:patientId/prescriptions
 * @access  Private
 */
export const getPatientPrescriptions = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { patientId } = req.params;
    const { limit = 10 } = req.query;
    const userId = req.user?.id;
    const userRole = req.user?.role;

    // Check permissions
    if (userRole === UserRole.PATIENT && patientId !== userId) {
      return next(new ErrorResponse('Not authorized to view these prescriptions', 403));
    }

    const prescriptions = await (MedicalRecord as any).getRecentPrescriptions(
      patientId,
      Number(limit)
    );

    res.status(200).json({
      success: true,
      count: prescriptions.length,
      data: prescriptions,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Add attachment to medical record
 * @route   POST /api/medical-records/:id/attachments
 * @access  Private (Doctor who created it)
 */
export const addAttachment = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, type, url, size } = req.body;
    const userId = req.user?.id;
    const userRole = req.user?.role;

    const record = await MedicalRecord.findById(id);

    if (!record) {
      return next(new ErrorResponse('Medical record not found', 404));
    }

    // Check permissions
    if (!userId || !userRole) {
      return next(new ErrorResponse('User not authenticated', 401));
    }

    if (!record.canBeEditedBy(userId, userRole)) {
      return next(new ErrorResponse('Not authorized to modify this medical record', 403));
    }

    // Add attachment
    await record.addAttachment({
      name,
      type,
      url,
      size,
      uploadedAt: new Date(),
    } as any);

    logger.info(`Attachment added to medical record ${id}`);

    res.status(200).json({
      success: true,
      message: 'Attachment added successfully',
      data: record,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Remove attachment from medical record
 * @route   DELETE /api/medical-records/:id/attachments/:attachmentId
 * @access  Private (Doctor who created it)
 */
export const removeAttachment = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id, attachmentId } = req.params;
    const userId = req.user?.id;
    const userRole = req.user?.role;

    const record = await MedicalRecord.findById(id);

    if (!record) {
      return next(new ErrorResponse('Medical record not found', 404));
    }

    // Check permissions
    if (!userId || !userRole) {
      return next(new ErrorResponse('User not authenticated', 401));
    }

    if (!record.canBeEditedBy(userId, userRole)) {
      return next(new ErrorResponse('Not authorized to modify this medical record', 403));
    }

    // Remove attachment
    await record.removeAttachment(attachmentId as string);

    logger.info(`Attachment removed from medical record ${id}`);

    res.status(200).json({
      success: true,
      message: 'Attachment removed successfully',
      data: record,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get records requiring follow-up
 * @route   GET /api/medical-records/follow-up
 * @access  Private (Doctor)
 */
export const getFollowUpRecords = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.id;
    const userRole = req.user?.role;

    if (userRole !== UserRole.DOCTOR && userRole !== UserRole.ADMIN) {
      return next(new ErrorResponse('Only doctors can access follow-up records', 403));
    }

    const doctorId = userRole === UserRole.DOCTOR ? userId : undefined;
    const records = await (MedicalRecord as any).getFollowUpRequired(doctorId);

    res.status(200).json({
      success: true,
      count: records.length,
      data: records,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get medical record statistics
 * @route   GET /api/medical-records/stats
 * @access  Private
 */
export const getMedicalRecordStats = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.id;
    const userRole = req.user?.role;

    let query: any = {};

    if (userRole === UserRole.PATIENT) {
      query.patientId = userId;
    } else if (userRole === UserRole.DOCTOR) {
      query.doctorId = userId;
    }

    const stats = await MedicalRecord.aggregate([
      { $match: query },
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 },
        },
      },
    ]);

    const total = await MedicalRecord.countDocuments(query);

    const result: any = {
      total,
      byType: {},
    };

    stats.forEach((stat) => {
      result.byType[stat._id] = stat.count;
    });

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};