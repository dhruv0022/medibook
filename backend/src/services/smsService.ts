import twilio from 'twilio';
import logger from '../utils/logger';

// Initialize Twilio
let twilioClient: any = null;

if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
  twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
}

class SmsService {
  /**
   * Send SMS via Twilio
   */
  async sendSms(to: string, message: string): Promise<boolean> {
    try {
      // In development, just log the SMS
      if (process.env.NODE_ENV === 'development') {
        logger.info('📱 SMS would be sent (DEV MODE):', {
          to,
          message,
        });
        return true;
      }

      // Check if Twilio is configured
      if (!twilioClient) {
        logger.error('Twilio not configured');
        return false;
      }

      // Send SMS
      await twilioClient.messages.create({
        body: message,
        from: process.env.TWILIO_PHONE_NUMBER,
        to,
      });

      logger.info(`SMS sent successfully to ${to}`);
      return true;
    } catch (error: any) {
      logger.error('Error sending SMS:', error.message);
      return false;
    }
  }

  /**
   * Send appointment reminder SMS (24 hours)
   */
  async sendAppointmentReminder24h(
    phone: string,
    name: string,
    appointment: {
      doctorName: string;
      date: string;
      time: string;
    }
  ): Promise<boolean> {
    const message = `Hi ${name}, reminder: You have an appointment tomorrow with ${appointment.doctorName} at ${appointment.time}. Please arrive 10 min early. Reply CANCEL to cancel. - MediBook`;

    return this.sendSms(phone, message);
  }

  /**
   * Send appointment reminder SMS (1 hour)
   */
  async sendAppointmentReminder1h(
    phone: string,
    name: string,
    appointment: {
      doctorName: string;
      time: string;
    }
  ): Promise<boolean> {
    const message = `Hi ${name}, your appointment with ${appointment.doctorName} starts in 1 hour at ${appointment.time}. See you soon! - MediBook`;

    return this.sendSms(phone, message);
  }

  /**
   * Send appointment confirmation SMS
   */
  async sendAppointmentConfirmation(
    phone: string,
    name: string,
    appointment: {
      doctorName: string;
      date: string;
      time: string;
    }
  ): Promise<boolean> {
    const message = `Hi ${name}, your appointment with ${appointment.doctorName} is confirmed for ${appointment.date} at ${appointment.time}. You'll receive reminders before your appointment. - MediBook`;

    return this.sendSms(phone, message);
  }

  /**
   * Send appointment cancellation SMS
   */
  async sendAppointmentCancellation(
    phone: string,
    name: string,
    appointment: {
      doctorName: string;
      date: string;
      time: string;
    }
  ): Promise<boolean> {
    const message = `Hi ${name}, your appointment with ${appointment.doctorName} on ${appointment.date} at ${appointment.time} has been cancelled. Book a new appointment at ${process.env.CLIENT_URL} - MediBook`;

    return this.sendSms(phone, message);
  }
}

export default new SmsService();