import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IWithdraw extends Document {
  user: Types.ObjectId;
  transactionId: string;
  amount: number;
  paymentMethod: string;
  paymentDetails: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  adminNote?: string;
  reviewedBy?: Types.ObjectId;
  reviewedAt?: Date;
}

const withdrawSchema = new Schema<IWithdraw>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    transactionId: { type: String, required: true, unique: true },
    amount: { type: Number, required: true, min: 100 },
    paymentMethod: { type: String, required: true },
    paymentDetails: { type: String, required: true },
    status: { type: String, enum: ['pending', 'approved', 'rejected', 'cancelled'], default: 'pending' },
    adminNote: { type: String },
    reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: { type: Date },
  },
  { timestamps: true }
);

withdrawSchema.index({ user: 1, status: 1 });

export const Withdraw = mongoose.model<IWithdraw>('Withdraw', withdrawSchema);
