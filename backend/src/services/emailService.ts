import sgMail from '@sendgrid/mail';
import logger from '../utils/logger';

// Initialize SendGrid
if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

class EmailService {
  /**
   * Send email via SendGrid
   */
  async sendEmail(options: EmailOptions): Promise<boolean> {
    try {
      // In development, just log the email
      if (process.env.NODE_ENV === 'development') {
        logger.info('📧 Email would be sent (DEV MODE):', {
          to: options.to,
          subject: options.subject,
        });
        logger.debug('Email HTML:', options.html);
        return true;
      }

      // In production, send via SendGrid
      if (!process.env.SENDGRID_API_KEY) {
        logger.error('SendGrid API key not configured');
        return false;
      }

      const msg = {
        to: options.to,
        from: {
          email: process.env.SENDGRID_FROM_EMAIL || 'noreply@medibook.com',
          name: process.env.SENDGRID_FROM_NAME || 'MediBook',
        },
        subject: options.subject,
        html: options.html,
        text: options.text || options.html.replace(/<[^>]*>/g, ''), // Strip HTML for text version
      };

      await sgMail.send(msg);
      logger.info(`Email sent successfully to ${options.to}`);
      return true;
    } catch (error: any) {
      logger.error('Error sending email:', error.response?.body || error.message);
      return false;
    }
  }

  async sendVerificationEmail(
    email: string,
    name: string,
    verificationToken: string
  ): Promise<boolean> {
    const verificationUrl = `${process.env.CLIENT_URL}/verify-email/${verificationToken}`;
    const html = `
      <html>
        <body style="font-family: Arial, sans-serif; color: #1f2937; line-height: 1.6;">
          <h2>Verify your MediBook account</h2>
          <p>Hi ${name},</p>
          <p>Thanks for signing up. Please verify your email address to activate your account.</p>
          <p>
            <a href="${verificationUrl}" style="display:inline-block;padding:12px 20px;background:#2563eb;color:#fff;text-decoration:none;border-radius:6px;">
              Verify Email
            </a>
          </p>
          <p>If the button does not work, use this link:</p>
          <p>${verificationUrl}</p>
        </body>
      </html>
    `;

    return this.sendEmail({
      to: email,
      subject: 'Verify your MediBook account',
      html,
    });
  }

  async sendPasswordResetEmail(
    email: string,
    name: string,
    resetToken: string
  ): Promise<boolean> {
    const resetUrl = `${process.env.CLIENT_URL}/reset-password/${resetToken}`;
    const html = `
      <html>
        <body style="font-family: Arial, sans-serif; color: #1f2937; line-height: 1.6;">
          <h2>Reset your password</h2>
          <p>Hi ${name},</p>
          <p>We received a request to reset your MediBook password.</p>
          <p>
            <a href="${resetUrl}" style="display:inline-block;padding:12px 20px;background:#dc2626;color:#fff;text-decoration:none;border-radius:6px;">
              Reset Password
            </a>
          </p>
          <p>This link will expire soon. If you did not request this, you can ignore this email.</p>
          <p>${resetUrl}</p>
        </body>
      </html>
    `;

    return this.sendEmail({
      to: email,
      subject: 'Reset your MediBook password',
      html,
    });
  }

  async sendWelcomeEmail(
    email: string,
    name: string,
    role: string
  ): Promise<boolean> {
    const html = `
      <html>
        <body style="font-family: Arial, sans-serif; color: #1f2937; line-height: 1.6;">
          <h2>Welcome to MediBook</h2>
          <p>Hi ${name},</p>
          <p>Your email has been verified and your ${role} account is ready to use.</p>
          <p>
            <a href="${process.env.CLIENT_URL}" style="display:inline-block;padding:12px 20px;background:#059669;color:#fff;text-decoration:none;border-radius:6px;">
              Open MediBook
            </a>
          </p>
        </body>
      </html>
    `;

    return this.sendEmail({
      to: email,
      subject: 'Welcome to MediBook',
      html,
    });
  }

  /**
   * Send appointment reminder (24 hours before)
   */
  async sendAppointmentReminder24h(
    email: string,
    name: string,
    appointment: {
      doctorName: string;
      date: string;
      time: string;
      type: string;
    }
  ): Promise<boolean> {
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #2563eb 0%, #1e40af 100%); color: white; padding: 30px 20px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { padding: 30px; background: #f9fafb; border-radius: 0 0 10px 10px; }
            .appointment-card { background: white; padding: 20px; border-radius: 8px; border-left: 4px solid #2563eb; margin: 20px 0; }
            .detail-row { margin: 10px 0; }
            .label { font-weight: bold; color: #4b5563; }
            .value { color: #1f2937; }
            .button { display: inline-block; padding: 12px 24px; background: #2563eb; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
            .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🏥 Appointment Reminder</h1>
            </div>
            <div class="content">
              <p>Hi ${name},</p>
              <p>This is a friendly reminder that you have an appointment coming up <strong>tomorrow</strong>.</p>
              
              <div class="appointment-card">
                <h3 style="margin-top: 0; color: #2563eb;">Appointment Details</h3>
                <div class="detail-row">
                  <span class="label">Doctor:</span>
                  <span class="value">${appointment.doctorName}</span>
                </div>
                <div class="detail-row">
                  <span class="label">Date:</span>
                  <span class="value">${appointment.date}</span>
                </div>
                <div class="detail-row">
                  <span class="label">Time:</span>
                  <span class="value">${appointment.time}</span>
                </div>
                <div class="detail-row">
                  <span class="label">Type:</span>
                  <span class="value">${appointment.type}</span>
                </div>
              </div>

              <p><strong>Please arrive 10 minutes early</strong> to complete any necessary paperwork.</p>
              
              <p>If you need to cancel or reschedule, please do so at least 24 hours in advance.</p>
              
              <a href="${process.env.CLIENT_URL}/appointments" class="button">
                View Appointment Details
              </a>
            </div>
            <div class="footer">
              <p>© 2024 MediBook. All rights reserved.</p>
              <p style="font-size: 12px; color: #9ca3af;">
                This is an automated reminder. Please do not reply to this email.
              </p>
            </div>
          </div>
        </body>
      </html>
    `;

    return this.sendEmail({
      to: email,
      subject: '⏰ Appointment Reminder - Tomorrow',
      html,
    });
  }

  /**
   * Send appointment reminder (1 hour before)
   */
  async sendAppointmentReminder1h(
    email: string,
    name: string,
    appointment: {
      doctorName: string;
      time: string;
      location?: string;
    }
  ): Promise<boolean> {
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; padding: 30px 20px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { padding: 30px; background: #fffbeb; border-radius: 0 0 10px 10px; }
            .urgent-banner { background: #fef3c7; border: 2px solid #f59e0b; padding: 15px; border-radius: 8px; margin: 20px 0; text-align: center; }
            .button { display: inline-block; padding: 12px 24px; background: #f59e0b; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>⚠️ Appointment in 1 Hour!</h1>
            </div>
            <div class="content">
              <div class="urgent-banner">
                <h2 style="margin: 0; color: #92400e;">Your appointment starts soon!</h2>
              </div>
              
              <p>Hi ${name},</p>
              <p>Just a quick reminder that your appointment with <strong>${appointment.doctorName}</strong> is in <strong>1 hour</strong> at <strong>${appointment.time}</strong>.</p>
              
              ${
                appointment.location
                  ? `<p><strong>Location:</strong> ${appointment.location}</p>`
                  : ''
              }
              
              <p>Please make sure to arrive on time. We look forward to seeing you!</p>
              
              <a href="${process.env.CLIENT_URL}/appointments" class="button">
                View Details
              </a>
            </div>
          </div>
        </body>
      </html>
    `;

    return this.sendEmail({
      to: email,
      subject: '⏰ Appointment Starting Soon - In 1 Hour!',
      html,
    });
  }

  /**
   * Send appointment confirmation
   */
  async sendAppointmentConfirmation(
    email: string,
    name: string,
    appointment: {
      doctorName: string;
      date: string;
      time: string;
      type: string;
      appointmentId: string;
    }
  ): Promise<boolean> {
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 30px 20px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { padding: 30px; background: #f0fdf4; border-radius: 0 0 10px 10px; }
            .appointment-card { background: white; padding: 20px; border-radius: 8px; border-left: 4px solid #10b981; margin: 20px 0; }
            .button { display: inline-block; padding: 12px 24px; background: #10b981; color: white; text-decoration: none; border-radius: 5px; margin: 10px 5px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>✅ Appointment Confirmed!</h1>
            </div>
            <div class="content">
              <p>Hi ${name},</p>
              <p>Your appointment has been successfully booked!</p>
              
              <div class="appointment-card">
                <h3 style="margin-top: 0; color: #10b981;">Appointment Details</h3>
                <p><strong>Doctor:</strong> ${appointment.doctorName}</p>
                <p><strong>Date:</strong> ${appointment.date}</p>
                <p><strong>Time:</strong> ${appointment.time}</p>
                <p><strong>Type:</strong> ${appointment.type}</p>
                <p><strong>Confirmation #:</strong> ${appointment.appointmentId}</p>
              </div>

              <p>You will receive reminder notifications before your appointment.</p>
              
              <div style="text-align: center;">
                <a href="${process.env.CLIENT_URL}/appointments/${appointment.appointmentId}" class="button">
                  View Appointment
                </a>
                <a href="${process.env.CLIENT_URL}/appointments/${appointment.appointmentId}/cancel" class="button" style="background: #ef4444;">
                  Cancel/Reschedule
                </a>
              </div>
            </div>
          </div>
        </body>
      </html>
    `;

    return this.sendEmail({
      to: email,
      subject: '✅ Appointment Confirmed - MediBook',
      html,
    });
  }

  /**
   * Send appointment cancellation notice
   */
  async sendAppointmentCancellation(
    email: string,
    name: string,
    appointment: {
      doctorName: string;
      date: string;
      time: string;
      reason?: string;
    }
  ): Promise<boolean> {
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); color: white; padding: 30px 20px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { padding: 30px; background: #fef2f2; border-radius: 0 0 10px 10px; }
            .button { display: inline-block; padding: 12px 24px; background: #2563eb; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>❌ Appointment Cancelled</h1>
            </div>
            <div class="content">
              <p>Hi ${name},</p>
              <p>Your appointment has been cancelled.</p>
              
              <p><strong>Cancelled Appointment:</strong></p>
              <p>Doctor: ${appointment.doctorName}</p>
              <p>Date: ${appointment.date}</p>
              <p>Time: ${appointment.time}</p>
              
              ${appointment.reason ? `<p><strong>Reason:</strong> ${appointment.reason}</p>` : ''}
              
              <p>If you'd like to schedule a new appointment, please visit our booking page.</p>
              
              <a href="${process.env.CLIENT_URL}/doctors" class="button">
                Book New Appointment
              </a>
            </div>
          </div>
        </body>
      </html>
    `;

    return this.sendEmail({
      to: email,
      subject: '❌ Appointment Cancelled - MediBook',
      html,
    });
  }
}

export default new EmailService();
