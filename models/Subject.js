const mongoose = require('mongoose');

const SubjectSchema = new mongoose.Schema({
  name: { type: String, required: true }, // e.g., "Mathematics"
  code: String, // e.g., "MATH101"
  teacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
});

module.exports = mongoose.model('Subject', SubjectSchema);