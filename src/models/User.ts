import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IUser extends Document {
  name: string;
  username: string;
  email: string;
  phone?: string;
  country?: string;
  password: string;
  role: 'user' | 'admin' | 'superadmin';
  avatar?: string;
  referralCode: string;
  referredBy?: Types.ObjectId;
  isEmailVerified: boolean;
  isPhoneVerified: boolean;
  isActive: boolean;
  isBanned: boolean;
  twoFactorEnabled: boolean;
  twoFactorSecret?: string;
  otp?: string;
  otpExpiry?: Date;
  resetPasswordToken?: string;
  resetPasswordExpiry?: Date;
  lastLogin?: Date;
  loginHistory: { ip: string; device: string; date: Date }[];
  badges: string[];
  dailyLoginStreak: number;
  lastDailyLogin?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true },
    username: { type: String, required: true, unique: true, lowercase: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone: { type: String, trim: true },
    country: { type: String, default: 'Nepal' },
    password: { type: String, required: true, select: false },
    role: { type: String, enum: ['user', 'admin', 'superadmin'], default: 'user' },
    avatar: { type: String },
    referralCode: { type: String, unique: true, required: true },
    referredBy: { type: Schema.Types.ObjectId, ref: 'User' },
    isEmailVerified: { type: Boolean, default: false },
    isPhoneVerified: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    isBanned: { type: Boolean, default: false },
    twoFactorEnabled: { type: Boolean, default: false },
    twoFactorSecret: { type: String },
    otp: { type: String, select: false },
    otpExpiry: { type: Date, select: false },
    resetPasswordToken: { type: String, select: false },
    resetPasswordExpiry: { type: Date, select: false },
    lastLogin: { type: Date },
    loginHistory: [{ ip: String, device: String, date: { type: Date, default: Date.now } }],
    badges: [{ type: String }],
    dailyLoginStreak: { type: Number, default: 0 },
    lastDailyLogin: { type: Date },
  },
  { timestamps: true }
);

userSchema.index({ referredBy: 1 });

export const User = mongoose.model<IUser>('User', userSchema);
