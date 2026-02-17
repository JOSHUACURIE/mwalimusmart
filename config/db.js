// config/db.js
const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log(`MongoDB Connected: ${conn.connection.host}`.cyan.underline.bold);
    
    // Handle connection events
    mongoose.connection.on('error', (err) => {
      console.error(`MongoDB connection error: ${err}`.red);
    });

    mongoose.connection.on('disconnected', () => {
      console.log('MongoDB disconnected'.yellow);
    });

    // Graceful shutdown
    process.on('SIGINT', async () => {
      await mongoose.connection.close();
      console.log('MongoDB connection closed through app termination'.yellow);
      process.exit(0);
    });

  } catch (error) {
    console.error(`Error connecting to MongoDB: ${error.message}`.red.underline.bold);
    process.exit(1);
  }
};

module.exports = connectDB;