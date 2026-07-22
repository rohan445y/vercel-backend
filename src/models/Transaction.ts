import mongoose, { Schema, Document, Types } from 'mongoose';

export interface ITransaction extends Document {
  transactionId: string;
  user: Types.ObjectId;
  type: 'deposit' | 'withdraw' | 'referral' | 'subscription' | 'bonus' | 'adjustment' | 'transfer';
  amount: number;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled' | 'completed';
  remarks?: string;
  metadata?: Record<string, unknown>;
}

const transactionSchema = new Schema<ITransaction>(
  {
    transactionId: { type: String, required: true, unique: true },
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    type: {
      type: String,
      enum: ['deposit', 'withdraw', 'referral', 'subscription', 'bonus', 'adjustment', 'transfer'],
      required: true,
    },
    amount: { type: Number, required: true },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'cancelled', 'completed'],
      default: 'pending',
    },
    remarks: { type: String },
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: true }
);

transactionSchema.index({ user: 1, createdAt: -1 });
transactionSchema.index({ type: 1, status: 1 });

export const Transaction = mongoose.model<ITransaction>('Transaction', transactionSchema);
