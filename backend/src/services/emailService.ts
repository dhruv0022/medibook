import logger from '../utils/logger';

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

class EmailService {
  /**
   * Send email
   * @param options - Email options
   */
  async sendEmail(options: EmailOptions): Promise<boolean> {
    try {
      // TODO: Integrate SendGrid later
      // For now, just log the email
      if (process.env.NODE_ENV === 'development') {
        logger.info('📧 Email would be sent:', {
          to: options.to,
          subject: options.subject,
        });
        logger.debug('Email content:', options.html);
      }

      // In production, use SendGrid:
      // const sgMail = require('@sendgrid/mail');
      // sgMail.setApiKey(process.env.SENDGRID_API_KEY);
      // await sgMail.send({
      //   to: options.to,
      //   from: process.env.SENDGRID_FROM_EMAIL,
      //   subject: options.subject,
      //   html: options.html,
      //   text: options.text,
      // });

      return true;
    } catch (error) {
      logger.error('Error sending email:', error);
      return false;
    }
  }

  /**
   * Send verification email
   */
  async sendVerificationEmail(email: string, name: string, token: string): Promise<boolean> {
    const verificationUrl = `${process.env.CLIENT_URL}/verify-email/${token}`;

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #2563eb; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; background: #f9fafb; }
            .button { 
              display: inline-block; 
              padding: 12px 24px; 
              background: #2563eb; 
              color: white; 
              text-decoration: none; 
              border-radius: 5px; 
              margin: 20px 0;
            }
            .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🏥 MediBook</h1>
            </div>
            <div class="content">
              <h2>Welcome, ${name}! 👋</h2>
              <p>Thank you for registering with MediBook. Please verify your email address to get started.</p>
              <p>Click the button below to verify your email:</p>
              <a href="${verificationUrl}" class="button">Verify Email</a>
              <p>Or copy and paste this link into your browser:</p>
              <p style="word-break: break-all; color: #2563eb;">${verificationUrl}</p>
              <p><strong>This link expires in 24 hours.</strong></p>
              <p>If you didn't create an account, you can safely ignore this email.</p>
            </div>
            <div class="footer">
              <p>© 2024 MediBook. All rights reserved.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    return this.sendEmail({
      to: email,
      subject: 'Verify Your Email - MediBook',
      html,
      text: `Welcome to MediBook! Please verify your email by visiting: ${verificationUrl}`,
    });
  }

  /**
   * Send password reset email
   */
  async sendPasswordResetEmail(email: string, name: string, token: string): Promise<boolean> {
    const resetUrl = `${process.env.CLIENT_URL}/reset-password/${token}`;

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #2563eb; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; background: #f9fafb; }
            .button { 
              display: inline-block; 
              padding: 12px 24px; 
              background: #2563eb; 
              color: white; 
              text-decoration: none; 
              border-radius: 5px; 
              margin: 20px 0;
            }
            .warning { background: #fef3c7; padding: 10px; border-left: 4px solid #f59e0b; }
            .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🏥 MediBook</h1>
            </div>
            <div class="content">
              <h2>Password Reset Request</h2>
              <p>Hi ${name},</p>
              <p>You requested to reset your password. Click the button below to create a new password:</p>
              <a href="${resetUrl}" class="button">Reset Password</a>
              <p>Or copy and paste this link into your browser:</p>
              <p style="word-break: break-all; color: #2563eb;">${resetUrl}</p>
              <p><strong>This link expires in 1 hour.</strong></p>
              <div class="warning">
                <p><strong>⚠️ Security Notice:</strong></p>
                <p>If you didn't request a password reset, please ignore this email or contact support if you have concerns.</p>
              </div>
            </div>
            <div class="footer">
              <p>© 2024 MediBook. All rights reserved.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    return this.sendEmail({
      to: email,
      subject: 'Password Reset Request - MediBook',
      html,
      text: `You requested a password reset. Visit: ${resetUrl}`,
    });
  }

  /**
   * Send welcome email (after verification)
   */
  async sendWelcomeEmail(email: string, name: string, role: string): Promise<boolean> {
    const dashboardUrl = `${process.env.CLIENT_URL}/dashboard`;

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #2563eb; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; background: #f9fafb; }
            .button { 
              display: inline-block; 
              padding: 12px 24px; 
              background: #2563eb; 
              color: white; 
              text-decoration: none; 
              border-radius: 5px; 
              margin: 20px 0;
            }
            .features { background: white; padding: 15px; border-radius: 5px; margin: 20px 0; }
            .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🎉 Welcome to MediBook!</h1>
            </div>
            <div class="content">
              <h2>You're all set, ${name}!</h2>
              <p>Your ${role} account has been successfully verified and activated.</p>
              <div class="features">
                <h3>What you can do now:</h3>
                <ul>
                  ${role === 'patient' ? `
                    <li>Browse and book appointments with doctors</li>
                    <li>View your medical history</li>
                    <li>Manage your health records</li>
                    <li>Receive appointment reminders</li>
                  ` : role === 'doctor' ? `
                    <li>Manage your schedule and availability</li>
                    <li>View patient appointments</li>
                    <li>Update patient medical records</li>
                    <li>Track your consultation history</li>
                  ` : ''}
                </ul>
              </div>
              <a href="${dashboardUrl}" class="button">Go to Dashboard</a>
              <p>If you have any questions, feel free to contact our support team.</p>
            </div>
            <div class="footer">
              <p>© 2024 MediBook. All rights reserved.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    return this.sendEmail({
      to: email,
      subject: 'Welcome to MediBook! 🎉',
      html,
    });
  }
}

export default new EmailService();