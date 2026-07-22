import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IWallet extends Document {
  user: Types.ObjectId;
  balance: number;
  pendingBalance: number;
  withdrawableBalance: number;
  lockedBalance: number;
  isFrozen: boolean;
  totalDeposited: number;
  totalWithdrawn: number;
  totalEarned: number;
}

const walletSchema = new Schema<IWallet>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    balance: { type: Number, default: 0, min: 0 },
    pendingBalance: { type: Number, default: 0, min: 0 },
    withdrawableBalance: { type: Number, default: 0, min: 0 },
    lockedBalance: { type: Number, default: 0, min: 0 },
    isFrozen: { type: Boolean, default: false },
    totalDeposited: { type: Number, default: 0 },
    totalWithdrawn: { type: Number, default: 0 },
    totalEarned: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export const Wallet = mongoose.model<IWallet>('Wallet', walletSchema);
