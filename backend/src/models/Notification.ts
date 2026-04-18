import mongoose, { Schema } from 'mongoose';
import { NotificationType } from '../types';

export interface INotification extends mongoose.Document {
  userId: mongoose.Types.ObjectId;
  type: NotificationType;
  title: string;
  message: string;
  
  // Related entities
  relatedId?: mongoose.Types.ObjectId;
  relatedType?: string;
  
  // Delivery channels
  channels: Array<{
    type: 'email' | 'sms' | 'in_app';
    status: 'pending' | 'sent' | 'failed' | 'delivered';
    sentAt?: Date;
    deliveredAt?: Date;
    error?: string;
  }>;
  
  // Status
  isRead: boolean;
  readAt?: Date;
  
  // Actions
  actionUrl?: string;
  actionLabel?: string;
  
  // Metadata
  metadata?: Record<string, any>;
  
  createdAt: Date;
  expiresAt?: Date;
}

const NotificationSchema = new Schema<INotification>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    
    type: {
      type: String,
      enum: Object.values(NotificationType),
      required: true,
    },
    
    title: {
      type: String,
      required: true,
      maxlength: 200,
    },
    
    message: {
      type: String,
      required: true,
      maxlength: 1000,
    },
    
    relatedId: {
      type: Schema.Types.ObjectId,
    },
    
    relatedType: {
      type: String,
      enum: ['appointment', 'medical_record', 'user', null],
    },
    
    channels: [
      {
        type: {
          type: String,
          enum: ['email', 'sms', 'in_app'],
          required: true,
        },
        status: {
          type: String,
          enum: ['pending', 'sent', 'failed', 'delivered'],
          default: 'pending',
        },
        sentAt: Date,
        deliveredAt: Date,
        error: String,
      },
    ],
    
    isRead: {
      type: Boolean,
      default: false,
    },
    
    readAt: Date,
    
    actionUrl: String,
    actionLabel: String,
    
    metadata: {
      type: Schema.Types.Mixed,
    },
    
    expiresAt: Date,
  },
  {
    timestamps: true,
  }
);

// Indexes
NotificationSchema.index({ userId: 1, isRead: 1 });
NotificationSchema.index({ userId: 1, createdAt: -1 });
NotificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL index

const Notification = mongoose.model<INotification>('Notification', NotificationSchema);

export default Notification;
