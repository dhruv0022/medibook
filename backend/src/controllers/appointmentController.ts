import { Response, NextFunction } from 'express';
import { AuthRequest, AppointmentStatus, AppointmentType, UserRole } from '../types';
import Appointment from '../models/Appointment';
import User from '../models/User';
import ErrorResponse from '../utils/ErrorResponse';
import logger from '../utils/logger';
import { addMinutes, format, parseISO, startOfDay, endOfDay } from 'date-fns';

/**
 * @desc    Create new appointment
 * @route   POST /api/appointments
 * @access  Private (Patient only)
 */
export const createAppointment = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { doctorId, appointmentDate, startTime, type, reason, symptoms, notes } = req.body;
    const patientId = req.user?.id;

    // Verify patient role
    if (req.user?.role !== UserRole.PATIENT) {
      return next(new ErrorResponse('Only patients can book appointments', 403));
    }

    // Verify doctor exists and is active
    const doctor = await User.findOne({
      _id: doctorId,
      role: UserRole.DOCTOR,
      isActive: true,
      isVerified: true,
    });

    if (!doctor) {
      return next(new ErrorResponse('Doctor not found or not available', 404));
    }

    // Calculate end time (default 30 minutes)
    const [startHour, startMin] = startTime.split(':').map(Number);
    const startDate = new Date(appointmentDate);
    startDate.setHours(startHour, startMin, 0, 0);
    
    const endDate = addMinutes(startDate, 30); // Default 30-minute slots
    const endTime = format(endDate, 'HH:mm');

    // Check for conflicts
    const hasConflict = await (Appointment as any).hasConflict(
      doctorId,
      appointmentDate,
      startTime,
      endTime
    );

    if (hasConflict) {
      return next(
        new ErrorResponse(
          'This time slot is not available. Please choose a different time.',
          400
        )
      );
    }

    // Create appointment
    const appointment = await Appointment.create({
      patientId,
      doctorId,
      appointmentDate,
      startTime,
      endTime,
      type,
      reason,
      symptoms,
      notes,
      paymentAmount: doctor.consultationFee,
    });

    // Populate patient and doctor details
    const populatedAppointment = await Appointment.findById(appointment._id)
      .populate('patientId', 'firstName lastName email phone')
      .populate('doctorId', 'firstName lastName specialization consultationFee');

    logger.info(`Appointment created: ${appointment._id} by patient ${patientId}`);

    res.status(201).json({
      success: true,
      message: 'Appointment booked successfully',
      data: populatedAppointment,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get all appointments (with filters)
 * @route   GET /api/appointments
 * @access  Private
 */
export const getAppointments = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { status, type, dateFrom, dateTo, page = 1, limit = 10 } = req.query;
    const userId = req.user?.id;
    const userRole = req.user?.role;

    // Build query
    const query: any = {};

    // Filter by user role
    if (userRole === UserRole.PATIENT) {
      query.patientId = userId;
    } else if (userRole === UserRole.DOCTOR) {
      query.doctorId = userId;
    }
    // Admin can see all appointments (no filter)

    // Apply filters
    if (status) {
      query.status = status;
    }

    if (type) {
      query.type = type;
    }

    if (dateFrom || dateTo) {
      query.appointmentDate = {};
      if (dateFrom) {
        query.appointmentDate.$gte = startOfDay(parseISO(dateFrom as string));
      }
      if (dateTo) {
        query.appointmentDate.$lte = endOfDay(parseISO(dateTo as string));
      }
    }

    // Pagination
    const skip = (Number(page) - 1) * Number(limit);

    // Execute query
    const appointments = await Appointment.find(query)
      .populate('patientId', 'firstName lastName email phone avatar')
      .populate('doctorId', 'firstName lastName specialization consultationFee avatar')
      .sort({ appointmentDate: -1, startTime: -1 })
      .skip(skip)
      .limit(Number(limit));

    // Get total count
    const total = await Appointment.countDocuments(query);

    res.status(200).json({
      success: true,
      data: appointments,
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
 * @desc    Get single appointment
 * @route   GET /api/appointments/:id
 * @access  Private
 */
export const getAppointment = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    const userRole = req.user?.role;

    const appointment = await Appointment.findById(id)
      .populate('patientId', 'firstName lastName email phone avatar dateOfBirth gender')
      .populate('doctorId', 'firstName lastName specialization consultationFee avatar biography qualifications');

    if (!appointment) {
      return next(new ErrorResponse('Appointment not found', 404));
    }

    // Authorization: Only patient, doctor, or admin can view
    if (
      userRole !== UserRole.ADMIN &&
      appointment.patientId._id.toString() !== userId &&
      appointment.doctorId._id.toString() !== userId
    ) {
      return next(new ErrorResponse('Not authorized to access this appointment', 403));
    }

    res.status(200).json({
      success: true,
      data: appointment,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update appointment (reschedule)
 * @route   PUT /api/appointments/:id
 * @access  Private
 */
export const updateAppointment = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const { appointmentDate, startTime, reason, symptoms, notes } = req.body;
    const userId = req.user?.id;
    const userRole = req.user?.role;

    const appointment = await Appointment.findById(id);

    if (!appointment) {
      return next(new ErrorResponse('Appointment not found', 404));
    }

    // Authorization: Only patient or admin can reschedule
    if (
      userRole !== UserRole.ADMIN &&
      appointment.patientId.toString() !== userId
    ) {
      return next(new ErrorResponse('Not authorized to update this appointment', 403));
    }

    // Check if appointment can be rescheduled
    if (!appointment.canBeRescheduled()) {
      return next(
        new ErrorResponse(
          'This appointment cannot be rescheduled. It may be completed, cancelled, or in the past.',
          400
        )
      );
    }

    // If rescheduling time/date, check for conflicts
    if (appointmentDate || startTime) {
      const newDate = appointmentDate ? new Date(appointmentDate) : appointment.appointmentDate;
      const newStartTime = startTime || appointment.startTime;
      
      // Calculate new end time
      const [startHour, startMin] = newStartTime.split(':').map(Number);
      const startDate = new Date(newDate);
      startDate.setHours(startHour, startMin, 0, 0);
      const endDate = addMinutes(startDate, 30);
      const newEndTime = format(endDate, 'HH:mm');

      // Check conflicts (exclude current appointment)
      const hasConflict = await (Appointment as any).hasConflict(
        appointment.doctorId,
        newDate,
        newStartTime,
        newEndTime,
        id
      );

      if (hasConflict) {
        return next(
          new ErrorResponse('This time slot is not available. Please choose a different time.', 400)
        );
      }

      appointment.appointmentDate = newDate;
      appointment.startTime = newStartTime;
      appointment.endTime = newEndTime;
    }

    // Update other fields
    if (reason) appointment.reason = reason;
    if (symptoms) appointment.symptoms = symptoms;
    if (notes) appointment.notes = notes;

    await appointment.save();

    const updatedAppointment = await Appointment.findById(id)
      .populate('patientId', 'firstName lastName email phone')
      .populate('doctorId', 'firstName lastName specialization consultationFee');

    logger.info(`Appointment updated: ${id} by user ${userId}`);

    res.status(200).json({
      success: true,
      message: 'Appointment updated successfully',
      data: updatedAppointment,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Cancel appointment
 * @route   DELETE /api/appointments/:id
 * @access  Private
 */
export const cancelAppointment = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const { cancellationReason } = req.body;
    const userId = req.user?.id;
    const userRole = req.user?.role;

    const appointment = await Appointment.findById(id);

    if (!appointment) {
      return next(new ErrorResponse('Appointment not found', 404));
    }

    // Authorization: Patient, doctor, or admin can cancel
    if (
      userRole !== UserRole.ADMIN &&
      appointment.patientId.toString() !== userId &&
      appointment.doctorId.toString() !== userId
    ) {
      return next(new ErrorResponse('Not authorized to cancel this appointment', 403));
    }

    // Check if appointment can be cancelled
    if (!appointment.canBeCancelled()) {
      return next(
        new ErrorResponse(
          'This appointment cannot be cancelled. It may be already cancelled, completed, or in the past.',
          400
        )
      );
    }

    // Cancel appointment
    appointment.status = AppointmentStatus.CANCELLED;
    appointment.cancellationReason = cancellationReason;
    appointment.cancelledBy = userId;
    appointment.cancelledAt = new Date();

    await appointment.save();

    logger.info(`Appointment cancelled: ${id} by user ${userId}`);

    res.status(200).json({
      success: true,
      message: 'Appointment cancelled successfully',
      data: appointment,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Confirm appointment (doctor accepts)
 * @route   PUT /api/appointments/:id/confirm
 * @access  Private (Doctor only)
 */
export const confirmAppointment = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    const userRole = req.user?.role;

    const appointment = await Appointment.findById(id);

    if (!appointment) {
      return next(new ErrorResponse('Appointment not found', 404));
    }

    // Only doctor can confirm
    if (userRole !== UserRole.DOCTOR || appointment.doctorId.toString() !== userId) {
      return next(new ErrorResponse('Only the assigned doctor can confirm this appointment', 403));
    }

    // Can only confirm scheduled appointments
    if (appointment.status !== AppointmentStatus.SCHEDULED) {
      return next(new ErrorResponse('Only scheduled appointments can be confirmed', 400));
    }

    appointment.status = AppointmentStatus.CONFIRMED;
    await appointment.save();

    logger.info(`Appointment confirmed: ${id} by doctor ${userId}`);

    res.status(200).json({
      success: true,
      message: 'Appointment confirmed successfully',
      data: appointment,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Mark appointment as completed
 * @route   PUT /api/appointments/:id/complete
 * @access  Private (Doctor only)
 */
export const completeAppointment = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    const userRole = req.user?.role;

    const appointment = await Appointment.findById(id);

    if (!appointment) {
      return next(new ErrorResponse('Appointment not found', 404));
    }

    // Only doctor can mark as completed
    if (userRole !== UserRole.DOCTOR || appointment.doctorId.toString() !== userId) {
      return next(new ErrorResponse('Only the assigned doctor can complete this appointment', 403));
    }

    // Can only complete confirmed or in-progress appointments
    if (
      appointment.status !== AppointmentStatus.CONFIRMED &&
      appointment.status !== AppointmentStatus.IN_PROGRESS
    ) {
      return next(
        new ErrorResponse('Only confirmed or in-progress appointments can be marked as completed', 400)
      );
    }

    appointment.status = AppointmentStatus.COMPLETED;
    await appointment.save();

    logger.info(`Appointment completed: ${id} by doctor ${userId}`);

    res.status(200).json({
      success: true,
      message: 'Appointment marked as completed',
      data: appointment,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Mark appointment as no-show
 * @route   PUT /api/appointments/:id/no-show
 * @access  Private (Doctor only)
 */
export const markNoShow = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    const userRole = req.user?.role;

    const appointment = await Appointment.findById(id);

    if (!appointment) {
      return next(new ErrorResponse('Appointment not found', 404));
    }

    // Only doctor can mark as no-show
    if (userRole !== UserRole.DOCTOR || appointment.doctorId.toString() !== userId) {
      return next(new ErrorResponse('Only the assigned doctor can mark this as no-show', 403));
    }

    appointment.status = AppointmentStatus.NO_SHOW;
    await appointment.save();

    logger.info(`Appointment marked as no-show: ${id} by doctor ${userId}`);

    res.status(200).json({
      success: true,
      message: 'Appointment marked as no-show',
      data: appointment,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get available time slots for a doctor on a specific date
 * @route   GET /api/appointments/available-slots/:doctorId
 * @access  Public
 */
export const getAvailableSlots = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { doctorId } = req.params;
    const { date } = req.query;

    if (!date) {
      return next(new ErrorResponse('Date is required', 400));
    }

    // Verify doctor exists
    const doctor = await User.findOne({
      _id: doctorId,
      role: UserRole.DOCTOR,
      isActive: true,
    });

    if (!doctor) {
      return next(new ErrorResponse('Doctor not found', 404));
    }

    // Get existing appointments for the date
    const appointmentDate = parseISO(date as string);
    const existingAppointments = await (Appointment as any).getByDate(doctorId, appointmentDate);

    // Generate time slots (9:00 AM - 5:00 PM, 30-minute slots)
    const slots: Array<{ time: string; available: boolean }> = [];
    const startHour = 9;
    const endHour = 17;
    const slotDuration = 30;

    for (let hour = startHour; hour < endHour; hour++) {
      for (let minute = 0; minute < 60; minute += slotDuration) {
        const time = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        
        // Check if this time slot is taken
        const isTaken = existingAppointments.some((apt: any) => apt.startTime === time);
        
        slots.push({
          time,
          available: !isTaken,
        });
      }
    }

    res.status(200).json({
      success: true,
      data: {
        doctorId,
        date: appointmentDate,
        slots,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get upcoming appointments
 * @route   GET /api/appointments/upcoming
 * @access  Private
 */
export const getUpcomingAppointments = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.id;
    const userRole = req.user?.role;
    const { limit = 10 } = req.query;

    if (!userId || !userRole) {
      return next(new ErrorResponse('User not authenticated', 401));
    }

    const role = userRole === UserRole.PATIENT ? 'patient' : 'doctor';
    const appointments = await (Appointment as any).getUpcoming(userId, role, Number(limit));

    res.status(200).json({
      success: true,
      count: appointments.length,
      data: appointments,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get appointment statistics
 * @route   GET /api/appointments/stats
 * @access  Private
 */
export const getAppointmentStats = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.id;
    const userRole = req.user?.role;

    if (!userId || !userRole) {
      return next(new ErrorResponse('User not authenticated', 401));
    }

    const role = userRole === UserRole.PATIENT ? 'patient' : 'doctor';
    const stats = await (Appointment as any).getStats(userId, role);

    res.status(200).json({
      success: true,
      data: stats,
    });
  } catch (error) {
    next(error);
  }
};