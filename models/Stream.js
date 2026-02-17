// models/Stream.js
const StreamSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: [true, 'Stream name is required'],
    trim: true,
    maxlength: [50, 'Stream name cannot exceed 50 characters']
  }, // e.g., "North", "Section A", "Science", "Morning Batch"
  
  classId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Class', 
    required: [true, 'Class reference is required'],
    index: true
  },
  
  teacherId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: [true, 'Teacher reference is required'],
    index: true
  },
  
  roomNumber: {
    type: String,
    trim: true,
    maxlength: [20, 'Room number cannot exceed 20 characters']
  },
  
  capacity: {
    type: Number,
    min: [1, 'Capacity must be at least 1'],
    max: [100, 'Capacity cannot exceed 100'],
    default: 40
  },
  
  classTeacher: {
    type: String,
    trim: true,
    maxlength: [100, 'Class teacher name cannot exceed 100 characters']
  }, // Name of the class teacher (if different from main teacher)
  
  academicYear: {
    type: String,
    required: true
  }, // Should match parent class academic year
  
  isActive: {
    type: Boolean,
    default: true
  }
  
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Ensure unique stream names within a class per academic year
StreamSchema.index({ classId: 1, name: 1, academicYear: 1 }, { unique: true });

// Virtual populate to get all students in this stream
StreamSchema.virtual('students', {
  ref: 'Student',
  localField: '_id',
  foreignField: 'streamId',
  options: { sort: { rollNumber: 1, name: 1 } }
});

// Virtual to get student count
StreamSchema.virtual('studentCount', {
  ref: 'Student',
  localField: '_id',
  foreignField: 'streamId',
  count: true
});

// Virtual to get all lesson plans for this stream
StreamSchema.virtual('lessonPlans', {
  ref: 'LessonPlan',
  localField: '_id',
  foreignField: 'deliveryRecords.streamId'
});

// Virtual to get recent scores for this stream
StreamSchema.virtual('recentScores', {
  ref: 'Score',
  localField: '_id',
  foreignField: 'streamId',
  options: { 
    sort: { 'assessment.date': -1 },
    limit: 50
  }
});

// Pre-save middleware to ensure academic year matches parent class
StreamSchema.pre('save', async function(next) {
  try {
    const Class = mongoose.model('Class');
    const parentClass = await Class.findById(this.classId);
    
    if (!parentClass) {
      throw new Error('Parent class not found');
    }
    
    // Set academic year to match parent class
    this.academicYear = parentClass.academicYear;
    
    // Verify teacher owns the class
    if (parentClass.teacherId.toString() !== this.teacherId.toString()) {
      throw new Error('Stream teacher must match class teacher');
    }
    
    next();
  } catch (error) {
    next(error);
  }
});

// Pre-remove middleware to handle cascading deletes (if needed)
StreamSchema.pre('remove', async function(next) {
  try {
    // Optionally handle cleanup of related records
    // You might want to archive or reassign students instead of deleting
    next();
  } catch (error) {
    next(error);
  }
});

// Instance methods
StreamSchema.methods = {
  // Get stream details with populated data
  async getDetails() {
    await this.populate('classId', 'name academicYear')
               .populate('studentCount')
               .execPopulate();
    
    return {
      id: this._id,
      name: this.name,
      class: this.classId,
      roomNumber: this.roomNumber,
      capacity: this.capacity,
      currentEnrollment: this.studentCount,
      classTeacher: this.classTeacher,
      isActive: this.isActive,
      academicYear: this.academicYear
    };
  },
  
  // Check if stream has capacity
  hasCapacity(currentStudents) {
    return currentStudents < this.capacity;
  },
  
  // Get performance summary for this stream
  async getPerformanceSummary(subjectId, term) {
    const Score = mongoose.model('Score');
    
    const stats = await Score.aggregate([
      {
        $match: {
          streamId: this._id,
          subjectId: subjectId,
          'assessment.term': term,
          isAbsent: false
        }
      },
      {
        $group: {
          _id: null,
          average: { $avg: '$percentage' },
          highest: { $max: '$percentage' },
          lowest: { $min: '$percentage' },
          totalAssessments: { $sum: 1 }
        }
      }
    ]);
    
    return stats[0] || { average: 0, highest: 0, lowest: 0, totalAssessments: 0 };
  }
};

// Static methods
StreamSchema.statics = {
  // Find streams by class with student counts
  async findByClassWithStats(classId) {
    const streams = await this.find({ classId, isActive: true })
      .sort({ name: 1 })
      .populate('studentCount');
    
    return streams.map(stream => ({
      id: stream._id,
      name: stream.name,
      roomNumber: stream.roomNumber,
      capacity: stream.capacity,
      studentCount: stream.studentCount,
      isActive: stream.isActive
    }));
  },
  
  // Get all active streams for a teacher
  findActiveByTeacher(teacherId) {
    return this.find({ 
      teacherId, 
      isActive: true 
    }).populate('classId', 'name academicYear');
  },
  
  // Bulk create streams for a class
  async bulkCreateForClass(classId, teacherId, streamNames) {
    const Class = mongoose.model('Class');
    const parentClass = await Class.findById(classId);
    
    if (!parentClass) {
      throw new Error('Class not found');
    }
    
    const streams = streamNames.map(name => ({
      name,
      classId,
      teacherId,
      academicYear: parentClass.academicYear
    }));
    
    return this.insertMany(streams);
  }
};

module.exports = mongoose.model('Stream', StreamSchema);