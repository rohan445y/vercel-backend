import mongoose, { Schema, Document } from 'mongoose';

export interface ISettings extends Document {
  key: string;
  value: unknown;
  group: string;
}

const settingsSchema = new Schema<ISettings>(
  {
    key: { type: String, required: true, unique: true },
    value: { type: Schema.Types.Mixed, required: true },
    group: { type: String, default: 'general' },
  },
  { timestamps: true }
);

export const Settings = mongoose.model<ISettings>('Settings', settingsSchema);

export interface IAnnouncement extends Document {
  title: string;
  content: string;
  type: 'banner' | 'popup' | 'news';
  isActive: boolean;
  startDate?: Date;
  endDate?: Date;
}

const announcementSchema = new Schema<IAnnouncement>(
  {
    title: { type: String, required: true },
    content: { type: String, required: true },
    type: { type: String, enum: ['banner', 'popup', 'news'], default: 'banner' },
    isActive: { type: Boolean, default: true },
    startDate: { type: Date },
    endDate: { type: Date },
  },
  { timestamps: true }
);

export const Announcement = mongoose.model<IAnnouncement>('Announcement', announcementSchema);

export interface IAdminLog extends Document {
  admin: mongoose.Types.ObjectId;
  action: string;
  target?: string;
  details?: Record<string, unknown>;
  ip?: string;
}

const adminLogSchema = new Schema<IAdminLog>(
  {
    admin: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    action: { type: String, required: true },
    target: { type: String },
    details: { type: Schema.Types.Mixed },
    ip: { type: String },
  },
  { timestamps: true }
);

export const AdminLog = mongoose.model<IAdminLog>('AdminLog', adminLogSchema);

export interface IActivityLog extends Document {
  user: mongoose.Types.ObjectId;
  action: string;
  details?: Record<string, unknown>;
}

const activityLogSchema = new Schema<IActivityLog>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    action: { type: String, required: true },
    details: { type: Schema.Types.Mixed },
  },
  { timestamps: true }
);

export const ActivityLog = mongoose.model<IActivityLog>('ActivityLog', activityLogSchema);

export interface ICmsContent extends Document {
  page: string;
  section: string;
  content: Record<string, unknown>;
}

const cmsContentSchema = new Schema<ICmsContent>(
  {
    page: { type: String, required: true },
    section: { type: String, required: true },
    content: { type: Schema.Types.Mixed, required: true },
  },
  { timestamps: true }
);

cmsContentSchema.index({ page: 1, section: 1 }, { unique: true });

export const CmsContent = mongoose.model<ICmsContent>('CmsContent', cmsContentSchema);
