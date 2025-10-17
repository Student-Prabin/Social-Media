import mongoose from "mongoose";

const connectDB = async () => {
  try {
    mongoose.connection.on('connected', () => console.log('db connected'))
    await mongoose.connect(`${process.env.MONGODB_URI}/SocialMedia`)
  } catch (error) {
    console.log(error.message);
  }
}

export default connectDB