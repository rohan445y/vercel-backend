import mongoose, { Schema, Document, Types } from 'mongoose';

export interface ISupportTicket extends Document {
  user: Types.ObjectId;
  subject: string;
  category: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high';
  messages: {
    sender: Types.ObjectId;
    senderRole: 'user' | 'admin';
    message: string;
    createdAt: Date;
  }[];
}

const supportTicketSchema = new Schema<ISupportTicket>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    subject: { type: String, required: true },
    category: { type: String, default: 'general' },
    status: { type: String, enum: ['open', 'in_progress', 'resolved', 'closed'], default: 'open' },
    priority: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
    messages: [
      {
        sender: { type: Schema.Types.ObjectId, ref: 'User' },
        senderRole: { type: String, enum: ['user', 'admin'] },
        message: { type: String, required: true },
        createdAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

export const SupportTicket = mongoose.model<ISupportTicket>('SupportTicket', supportTicketSchema);
