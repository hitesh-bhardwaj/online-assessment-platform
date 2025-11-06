import mongoose from 'mongoose';

const connectDB = async () => {
  const MONGODB_URI = process.env.NODE_ENV === 'production' 
    ? process.env.MONGODB_ATLAS_URI 
    : process.env.MONGODB_URI;
  try {
    await mongoose.connect(MONGODB_URI || 'mongodb://localhost:27017/oap');
    console.log('MongoDB connected');
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
};

export default connectDB;
