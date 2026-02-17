// server.js
const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const colors = require('colors');
const cors = require('cors');


dotenv.config();

// Import routes
const userRoutes = require('./routes/userRoutes');
const classRoutes = require('./routes/classRoutes');
const streamRoutes = require('./routes/streamRoutes');
const studentRoutes = require('./routes/studentRoutes');
const subjectRoutes = require('./routes/subjectRoutes');
const lessonRoutes = require('./routes/lessonRoutes');
const scoreRoutes = require('./routes/scoreRoutes');

const app = express();

// Body parser
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Enable CORS
app.use(cors());

// Mount routes
app.use('/api/users', userRoutes);
app.use('/api/classes', classRoutes);
app.use('/api/streams', streamRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/subjects', subjectRoutes);
app.use('/api/lessons', lessonRoutes);
app.use('/api/scores', scoreRoutes);

// Home route
app.get('/', (req, res) => {
  res.json({ 
    message: 'Welcome to EduLog Pro API',
    version: '1.0.0',
    endpoints: {
      users: '/api/users',
      classes: '/api/classes',
      streams: '/api/streams',
      students: '/api/students',
      subjects: '/api/subjects',
      lessons: '/api/lessons',
      scores: '/api/scores'
    }
  });
});

// Error handler middleware
app.use((err, req, res, next) => {
  console.error(err.stack.red);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Something went wrong!',
    error: process.env.NODE_ENV === 'development' ? err.stack : {}
  });
});

// Handle 404
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

const PORT = process.env.PORT || 5000;

// Connect to MongoDB and start server
mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log(`MongoDB Connected`.cyan.underline.bold);
    
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`.yellow.bold);
      console.log(`Environment: ${process.env.NODE_ENV}`.magenta);
    });
  })
  .catch((err) => {
    console.error(`MongoDB Connection Error: ${err.message}`.red.underline.bold);
    process.exit(1);
  });

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.log(`Unhandled Rejection: ${err.message}`.red);
  // Close server & exit process
  server.close(() => process.exit(1));
});

module.exports = app;