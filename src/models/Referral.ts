import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IReferral extends Document {
  referrer: Types.ObjectId;
  referred: Types.ObjectId;
  level: number;
  isActive: boolean;
  totalCommission: number;
  totalPurchases: number;
}

const referralSchema = new Schema<IReferral>(
  {
    referrer: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    referred: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    level: { type: Number, default: 1 },
    isActive: { type: Boolean, default: false },
    totalCommission: { type: Number, default: 0 },
    totalPurchases: { type: Number, default: 0 },
  },
  { timestamps: true }
);

referralSchema.index({ referrer: 1 });
referralSchema.index({ referred: 1 }, { unique: true });

export const Referral = mongoose.model<IReferral>('Referral', referralSchema);

export interface IReferralCommission extends Document {
  referrer: Types.ObjectId;
  referred: Types.ObjectId;
  subscription: Types.ObjectId;
  plan: Types.ObjectId;
  amount: number;
  commissionRate: number;
  commissionAmount: number;
  level: number;
  status: 'pending' | 'paid';
}

const referralCommissionSchema = new Schema<IReferralCommission>(
  {
    referrer: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    referred: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    subscription: { type: Schema.Types.ObjectId, ref: 'Subscription', required: true },
    plan: { type: Schema.Types.ObjectId, ref: 'Plan', required: true },
    amount: { type: Number, required: true },
    commissionRate: { type: Number, required: true },
    commissionAmount: { type: Number, required: true },
    level: { type: Number, default: 1 },
    status: { type: String, enum: ['pending', 'paid'], default: 'paid' },
  },
  { timestamps: true }
);

export const ReferralCommission = mongoose.model<IReferralCommission>('ReferralCommission', referralCommissionSchema);
