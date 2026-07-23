import mongoose from 'mongoose';

export const connectDB = async (): Promise<void> => {
  if (mongoose.connection.readyState >= 1) {
    return;
  }

  const uri =
    process.env.MONGODB_URI ||
    process.env.MONGO_URI ||
    process.env.DATABASE_URL ||
    'mongodb://127.0.0.1:27017/karma-membership';

  await mongoose.connect(uri);
  console.log('MongoDB connected');
};

export const disconnectDB = async (): Promise<void> => {
  await mongoose.disconnect();
};

