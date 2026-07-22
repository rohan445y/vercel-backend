import mongoose, { Schema, Document, Types } from 'mongoose';

export interface ISubscription extends Document {
  user: Types.ObjectId;
  plan: Types.ObjectId;
  status: 'active' | 'expired' | 'cancelled';
  startDate: Date;
  endDate: Date;
  amount: number;
  transactionId?: string;
}

const subscriptionSchema = new Schema<ISubscription>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    plan: { type: Schema.Types.ObjectId, ref: 'Plan', required: true },
    status: { type: String, enum: ['active', 'expired', 'cancelled'], default: 'active' },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    amount: { type: Number, required: true },
    transactionId: { type: String },
  },
  { timestamps: true }
);

subscriptionSchema.index({ user: 1, status: 1 });

export const Subscription = mongoose.model<ISubscription>('Subscription', subscriptionSchema);
