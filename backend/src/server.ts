import dotenv from 'dotenv';
dotenv.config({ path: './.env' });

import express, { Application } from 'express';
import cors from 'cors';
import connectDB from './config/database';
import errorHandler from './middleware/errorHandler';
import logger from './utils/logger';
import appointmentRoutes from './routes/appointment.routes';
import authRoutes from './routes/auth.routes';
import medicalRecordRoutes from './routes/medicalRecord.routes';
import availabilityRoutes from './routes/availability.routes';

// Connect to database
connectDB();

// Initialize Express app
const app: Application = express();

// Body parser middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS middleware
app.use(
  cors({
    origin: process.env.CLIENT_URL || 'http://localhost:3000',
    credentials: true,
  })
);

// Request logging middleware (development)
if (process.env.NODE_ENV === 'development') {
  app.use((req, res, next) => {
    logger.debug(`${req.method} ${req.path}`);
    next();
  });
}

// Health check route
app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'MediBook API is running',
    environment: process.env.NODE_ENV,
    timestamp: new Date().toISOString(),
  });
});

// Root route
app.get('/', (req, res) => {
  res.json({
    message: 'MediBook API',
    version: '1.0.0',
    endpoints: {
      health: '/api/health',
      auth: '/api/auth',
      appointments: '/api/appointments',
      medicalRecords: '/api/medical-records',
      availability: '/api/availability',
      doctors: '/api/doctors',
      patients: '/api/patients',
    },
    appointmentEndpoints: {
      create: 'POST /api/appointments',
      getAll: 'GET /api/appointments',
      getOne: 'GET /api/appointments/:id',
      update: 'PUT /api/appointments/:id',
      cancel: 'DELETE /api/appointments/:id',
      confirm: 'PUT /api/appointments/:id/confirm',
      complete: 'PUT /api/appointments/:id/complete',
      markNoShow: 'PUT /api/appointments/:id/no-show',
      availableSlots: 'GET /api/appointments/available-slots/:doctorId?date=YYYY-MM-DD',
      upcoming: 'GET /api/appointments/upcoming',
      stats: 'GET /api/appointments/stats',
    },
    medicalRecordEndpoints: {
      create: 'POST /api/medical-records',
      getAll: 'GET /api/medical-records',
      getOne: 'GET /api/medical-records/:id',
      update: 'PUT /api/medical-records/:id',
      delete: 'DELETE /api/medical-records/:id (Admin only)',
      patientHistory: 'GET /api/medical-records/patient/:patientId/history',
      prescriptions: 'GET /api/medical-records/patient/:patientId/prescriptions',
      addAttachment: 'POST /api/medical-records/:id/attachments',
      removeAttachment: 'DELETE /api/medical-records/:id/attachments/:attachmentId',
      followUp: 'GET /api/medical-records/follow-up',
      stats: 'GET /api/medical-records/stats',
    },
    availabilityEndpoints: {
      createRegular: 'POST /api/availability/regular',
      createException: 'POST /api/availability/exception',
      createStandardWeek: 'POST /api/availability/standard-week',
      getWeekly: 'GET /api/availability/weekly/:doctorId',
      getForDate: 'GET /api/availability/date/:doctorId?date=YYYY-MM-DD',
      getSlots: 'GET /api/availability/slots/:doctorId?date=YYYY-MM-DD',
      checkAvailability: 'POST /api/availability/check',
      getAll: 'GET /api/availability',
      update: 'PUT /api/availability/:id',
      delete: 'DELETE /api/availability/:id',
      upcomingExceptions: 'GET /api/availability/exceptions/upcoming',
      stats: 'GET /api/availability/stats',
    },
  });
});

// ==================== MOUNT ROUTES ====================
app.get('/api/test-direct', (req, res) => {
  res.json({ success: true, message: 'Direct test works!' });
});

app.use('/api/auth', authRoutes);
console.log('Mounting appointment routes...');
app.use('/api/appointments', appointmentRoutes);
console.log('Appointment routes mounted');
app.use('/api/medical-records', medicalRecordRoutes);
app.use('/api/availability', availabilityRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found',
  });
});

// Error handler (must be last)
app.use(errorHandler);

// Start server
const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  logger.info(`
    ╔════════════════════════════════════════╗
    ║   🏥 MediBook API Server              ║
    ║   ✅ Server running on port ${PORT}       ║
    ║   📍 Mode: ${process.env.NODE_ENV}                ║
    ║   🌐 URL: http://localhost:${PORT}        ║
    ╚════════════════════════════════════════╝
  `);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err: Error) => {
  logger.error('Unhandled Rejection:', err);
  server.close(() => process.exit(1));
});

// Handle uncaught exceptions
process.on('uncaughtException', (err: Error) => {
  logger.error('Uncaught Exception:', err);
  process.exit(1);
});

export default app;