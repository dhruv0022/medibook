import { Response, NextFunction } from 'express';
import { AuthRequest, UserRole } from '../types';
import Availability from '../models/Availability';
import Appointment from '../models/Appointment';
import User from '../models/User';
import ErrorResponse from '../utils/ErrorResponse';
import logger from '../utils/logger';
import { parseISO, startOfDay, endOfDay } from 'date-fns';

/**
 * @desc    Create regular schedule (weekly recurring)
 * @route   POST /api/availability/regular
 * @access  Private (Doctor only)
 */
export const createRegularSchedule = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.id;
    const userRole = req.user?.role;

    // Only doctors can create schedules
    if (userRole !== UserRole.DOCTOR) {
      return next(new ErrorResponse('Only doctors can create availability schedules', 403));
    }

    const { dayOfWeek, schedule, breaks, timezone, clinicId, effectiveFrom, effectiveTo } =
      req.body;

    // Check if schedule already exists for this day
    const existingSchedule = await Availability.findOne({
      doctorId: userId,
      type: 'regular',
      dayOfWeek,
      isActive: true,
    });

    if (existingSchedule) {
      return next(
        new ErrorResponse(
          `A schedule already exists for this day. Please update or deactivate the existing schedule first.`,
          400
        )
      );
    }

    // Create schedule
    const availability = await Availability.create({
      doctorId: userId,
      clinicId,
      type: 'regular',
      dayOfWeek,
      schedule,
      breaks,
      timezone: timezone || 'America/Toronto',
      effectiveFrom: effectiveFrom || new Date(),
      effectiveTo,
      isActive: true,
    });

    const populatedAvailability = await Availability.findById(availability._id).populate(
      'doctorId',
      'firstName lastName specialization'
    );

    logger.info(`Regular schedule created for doctor ${userId}, day ${dayOfWeek}`);

    res.status(201).json({
      success: true,
      message: 'Regular schedule created successfully',
      data: populatedAvailability,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Create exception (holiday, special hours)
 * @route   POST /api/availability/exception
 * @access  Private (Doctor only)
 */
export const createException = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.id;
    const userRole = req.user?.role;

    if (userRole !== UserRole.DOCTOR) {
      return next(new ErrorResponse('Only doctors can create exceptions', 403));
    }

    const { date, isAvailable, exceptionSchedule, exceptionReason, clinicId } = req.body;

    const exceptionDate = parseISO(date);

    // Check if exception already exists for this date
    const existingException = await Availability.findOne({
      doctorId: userId,
      type: 'exception',
      date: {
        $gte: startOfDay(exceptionDate),
        $lte: endOfDay(exceptionDate),
      },
      isActive: true,
    });

    if (existingException) {
      return next(
        new ErrorResponse(
          'An exception already exists for this date. Please update or delete the existing exception.',
          400
        )
      );
    }

    // Create exception
    const availability = await Availability.create({
      doctorId: userId,
      clinicId,
      type: 'exception',
      date: exceptionDate,
      isAvailable,
      exceptionSchedule,
      exceptionReason,
      isActive: true,
    });

    logger.info(`Exception created for doctor ${userId}, date ${date}`);

    res.status(201).json({
      success: true,
      message: 'Exception created successfully',
      data: availability,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get doctor's weekly schedule
 * @route   GET /api/availability/weekly/:doctorId?
 * @access  Public (or Private if doctorId not provided)
 */
export const getWeeklySchedule = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const rawDoctorId = req.params.doctorId;
    const doctorId = Array.isArray(rawDoctorId) ? rawDoctorId[0] : rawDoctorId;
    const userId = req.user?.id;
    const userRole = req.user?.role;

    // If no doctorId provided, use logged-in doctor's ID
    const targetDoctorId: string | null = doctorId || (userRole === UserRole.DOCTOR ? userId || null : null);

    if (!targetDoctorId) {
      return next(new ErrorResponse('Doctor ID is required', 400));
    }

    // Verify doctor exists
    const doctor = await User.findOne({
      _id: targetDoctorId,
      role: UserRole.DOCTOR,
    });

    if (!doctor) {
      return next(new ErrorResponse('Doctor not found', 404));
    }

    const schedule = await Availability.getWeeklySchedule(targetDoctorId);

    res.status(200).json({
      success: true,
      data: {
        doctor: {
          id: doctor._id,
          name: `${doctor.firstName} ${doctor.lastName}`,
          specialization: doctor.specialization,
        },
        schedule,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get availability for specific date
 * @route   GET /api/availability/date/:doctorId?date=YYYY-MM-DD
 * @access  Public
 */
export const getAvailabilityForDate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const rawDoctorId = req.params.doctorId;
    const doctorId: string = Array.isArray(rawDoctorId) ? rawDoctorId[0] : rawDoctorId;
    const { date } = req.query;

    if (!doctorId) {
      return next(new ErrorResponse('Doctor ID is required', 400));
    }

    if (!date) {
      return next(new ErrorResponse('Date is required', 400));
    }

    const targetDate = parseISO(date as string);

    const availability = await (Availability as any).getForDate(doctorId, targetDate);

    if (!availability) {
      res.status(200).json({
        success: true,
        data: null,
        message: 'No availability configured for this date',
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: availability,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get available time slots for a doctor on a specific date
 * @route   GET /api/availability/slots/:doctorId?date=YYYY-MM-DD
 * @access  Public
 */
export const getAvailableSlots = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const rawDoctorId = req.params.doctorId;
    const doctorId: string = Array.isArray(rawDoctorId) ? rawDoctorId[0] : rawDoctorId;
    const { date } = req.query;

    if (!doctorId) {
      return next(new ErrorResponse('Doctor ID is required', 400));
    }

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

    const targetDate = parseISO(date as string);

    // Get existing appointments for this date
    const existingAppointments = await Appointment.find({
      doctorId,
      appointmentDate: {
        $gte: startOfDay(targetDate),
        $lte: endOfDay(targetDate),
      },
      status: {
        $nin: ['cancelled', 'no_show'],
      },
    }).select('startTime endTime');

    // Get available slots
    const availableSlots: string[] = await Availability.getAvailableSlots(
      doctorId,
      targetDate,
      existingAppointments
    );

    res.status(200).json({
      success: true,
      data: {
        doctor: {
          id: doctor._id,
          name: `${doctor.firstName} ${doctor.lastName}`,
          specialization: doctor.specialization,
        },
        date: targetDate,
        totalSlots: availableSlots.length,
        slots: availableSlots.map((slot: string) => ({
          time: slot,
          available: true,
        })),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get all schedules (regular and exceptions)
 * @route   GET /api/availability
 * @access  Private (Doctor)
 */
export const getSchedules = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.id;
    const userRole = req.user?.role;
    const { type, isActive } = req.query;

    if (userRole !== UserRole.DOCTOR) {
      return next(new ErrorResponse('Only doctors can access their schedules', 403));
    }

    const query: any = { doctorId: userId };

    if (type) {
      query.type = type;
    }

    if (isActive !== undefined) {
      query.isActive = isActive === 'true';
    }

    const schedules = await Availability.find(query).sort({ dayOfWeek: 1, date: 1 });

    res.status(200).json({
      success: true,
      count: schedules.length,
      data: schedules,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update schedule
 * @route   PUT /api/availability/:id
 * @access  Private (Doctor who created it)
 */
export const updateSchedule = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    const userRole = req.user?.role;

    const availability = await Availability.findById(id);

    if (!availability) {
      return next(new ErrorResponse('Schedule not found', 404));
    }

    // Check ownership
    if (availability.doctorId.toString() !== userId && userRole !== UserRole.ADMIN) {
      return next(new ErrorResponse('Not authorized to update this schedule', 403));
    }

    // Update allowed fields
    const allowedFields = ['schedule', 'breaks', 'exceptionSchedule', 'isActive', 'effectiveTo'];

    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        (availability as any)[field] = req.body[field];
      }
    });

    await availability.save();

    logger.info(`Schedule updated: ${id} by user ${userId}`);

    res.status(200).json({
      success: true,
      message: 'Schedule updated successfully',
      data: availability,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete schedule
 * @route   DELETE /api/availability/:id
 * @access  Private (Doctor who created it)
 */
export const deleteSchedule = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    const userRole = req.user?.role;

    const availability = await Availability.findById(id);

    if (!availability) {
      return next(new ErrorResponse('Schedule not found', 404));
    }

    // Check ownership
    if (availability.doctorId.toString() !== userId && userRole !== UserRole.ADMIN) {
      return next(new ErrorResponse('Not authorized to delete this schedule', 403));
    }

    await availability.deleteOne();

    logger.info(`Schedule deleted: ${id} by user ${userId}`);

    res.status(200).json({
      success: true,
      message: 'Schedule deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Create standard week schedule (Mon-Fri, 9-5)
 * @route   POST /api/availability/standard-week
 * @access  Private (Doctor only)
 */
export const createStandardWeek = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.id;
    const userRole = req.user?.role;

    if (userRole !== UserRole.DOCTOR) {
      return next(new ErrorResponse('Only doctors can create schedules', 403));
    }

    const { startTime, endTime, lunchBreak, clinicId } = req.body;

    // Check if any schedules already exist
    const existingSchedules = await Availability.find({
      doctorId: userId,
      type: 'regular',
      isActive: true,
    });

    if (existingSchedules.length > 0) {
      return next(
        new ErrorResponse(
          'You already have active schedules. Please delete or deactivate them first.',
          400
        )
      );
    }

    // Create standard week
    const schedules = await (Availability as any).createStandardWeekSchedule(userId, {
      startTime: startTime || '09:00',
      endTime: endTime || '17:00',
      lunchBreak: lunchBreak !== undefined ? lunchBreak : true,
      clinicId,
    });

    logger.info(`Standard week schedule created for doctor ${userId}`);

    res.status(201).json({
      success: true,
      message: 'Standard week schedule created successfully (Monday-Friday)',
      data: schedules,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get upcoming exceptions
 * @route   GET /api/availability/exceptions/upcoming
 * @access  Private (Doctor)
 */
export const getUpcomingExceptions = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.id;
    const userRole = req.user?.role;

    if (userRole !== UserRole.DOCTOR) {
      return next(new ErrorResponse('Only doctors can access their exceptions', 403));
    }

    const exceptions = await (Availability as any).getUpcomingExceptions(userId, new Date());

    res.status(200).json({
      success: true,
      count: exceptions.length,
      data: exceptions,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Check if specific time slot is available
 * @route   POST /api/availability/check
 * @access  Public
 */
export const checkAvailability = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { doctorId, date, startTime, endTime } = req.body;

    if (!doctorId || !date || !startTime || !endTime) {
      return next(new ErrorResponse('All fields are required', 400));
    }

    const targetDate = parseISO(date);

    // Check availability
    const isAvailable = await (Availability as any).isAvailable(
      doctorId,
      targetDate,
      startTime,
      endTime
    );

    if (!isAvailable) {
      res.status(200).json({
        success: true,
        available: false,
        message: 'This time slot is not available',
      });
      return;
    }

    // Check for existing appointments
    const existingAppointment = await (Appointment as any).hasConflict(
      doctorId,
      targetDate,
      startTime,
      endTime
    );

    res.status(200).json({
      success: true,
      available: !existingAppointment,
      message: existingAppointment
        ? 'This time slot is already booked'
        : 'This time slot is available',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get schedule statistics
 * @route   GET /api/availability/stats
 * @access  Private (Doctor)
 */
export const getScheduleStats = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.id;
    const userRole = req.user?.role;

    if (userRole !== UserRole.DOCTOR) {
      return next(new ErrorResponse('Only doctors can access their statistics', 403));
    }

    // Count regular schedules
    const regularCount = await Availability.countDocuments({
      doctorId: userId,
      type: 'regular',
      isActive: true,
    });

    // Count upcoming exceptions
    const upcomingExceptions = await Availability.countDocuments({
      doctorId: userId,
      type: 'exception',
      date: { $gte: new Date() },
      isActive: true,
    });

    // Count inactive schedules
    const inactiveCount = await Availability.countDocuments({
      doctorId: userId,
      isActive: false,
    });

    res.status(200).json({
      success: true,
      data: {
        regularSchedules: regularCount,
        upcomingExceptions,
        inactiveSchedules: inactiveCount,
      },
    });
  } catch (error) {
    next(error);
  }
};
