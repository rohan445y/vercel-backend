import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IDeposit extends Document {
  user: Types.ObjectId;
  transactionId: string;
  amount: number;
  paymentMethod: 'esewa' | 'khalti' | 'bank_transfer' | 'manual' | 'crypto';
  paymentReference?: string;
  screenshot?: string;
  status: 'pending' | 'approved' | 'rejected';
  adminNote?: string;
  reviewedBy?: Types.ObjectId;
  reviewedAt?: Date;
}

const depositSchema = new Schema<IDeposit>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    transactionId: { type: String, required: true, unique: true },
    amount: { type: Number, required: true, min: 1 },
    paymentMethod: {
      type: String,
      enum: ['esewa', 'khalti', 'bank_transfer', 'manual', 'crypto'],
      required: true,
    },
    paymentReference: { type: String },
    screenshot: { type: String },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    adminNote: { type: String },
    reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: { type: Date },
  },
  { timestamps: true }
);

depositSchema.index({ user: 1, status: 1 });

export const Deposit = mongoose.model<IDeposit>('Deposit', depositSchema);
