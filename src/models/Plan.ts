import mongoose, { Schema, Document } from 'mongoose';

export interface IPlan extends Document {
  name: string;
  slug: string;
  price: number;
  commission: number;
  duration: number;
  benefits: string[];
  badge?: string;
  color: string;
  isActive: boolean;
  sortOrder: number;
}

const planSchema = new Schema<IPlan>(
  {
    name: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    price: { type: Number, required: true, min: 0 },
    commission: { type: Number, required: true, min: 0, max: 100 },
    duration: { type: Number, required: true, default: 30 },
    benefits: [{ type: String }],
    badge: { type: String },
    color: { type: String, default: '#8B5CF6' },
    isActive: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export const Plan = mongoose.model<IPlan>('Plan', planSchema);
