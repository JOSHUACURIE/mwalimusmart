const mongoose = require('mongoose');
const LessonPlanSchema = new mongoose.Schema({
  // Core Information
  title: { 
    type: String, 
    required: [true, 'Lesson title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters']
  },
  
  topic: {
    type: String,
    required: [true, 'Topic is required'],
    trim: true,
    maxlength: [100, 'Topic cannot exceed 100 characters']
  },
  
  subjectId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Subject', 
    required: [true, 'Subject reference is required'],
    index: true
  },
  
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

  // Lesson Details
  learningObjectives: [{
    type: String,
    required: [true, 'At least one learning objective is required'],
    trim: true
  }],
  
  prerequisites: [{
    type: String,
    description: 'Knowledge or skills students should have before this lesson'
  }],
  
  duration: {
    plannedMinutes: {
      type: Number,
      required: true,
      min: [5, 'Lesson must be at least 5 minutes'],
      max: [480, 'Lesson cannot exceed 8 hours']
    },
    periodsRequired: {
      type: Number,
      default: 1,
      min: 1,
      max: 10
    }
  },

  // Teaching Materials & Resources
  materialsNeeded: [{
    item: { type: String, required: true },
    quantity: Number,
    notes: String
  }],
  
  resources: [{
    type: { 
      type: String, 
      enum: ['worksheet', 'presentation', 'video', 'link', 'textbook', 'other'],
      default: 'other'
    },
    title: String,
    url: String,
    description: String
  }],

  // Lesson Structure
  procedure: {
    introduction: {
      type: String,
      required: [true, 'Introduction/hook is required'],
      maxlength: [1000, 'Introduction cannot exceed 1000 characters']
    },
    mainActivities: [{
      step: Number,
      description: { type: String, required: true },
      duration: Number, // minutes
      teacherRole: String,
      studentRole: String
    }],
    conclusion: {
      type: String,
      required: [true, 'Conclusion/summary is required'],
      maxlength: [500, 'Conclusion cannot exceed 500 characters']
    }
  },

  // Assessment
  assessment: {
    formative: [{
      type: { 
        type: String, 
        enum: ['observation', 'questioning', 'quiz', 'exitTicket', 'homework', 'discussion'],
        default: 'observation'
      },
      description: String,
      weightage: Number // 0-100%
    }],
    summative: {
      type: String,
      description: 'Final assessment method'
    },
    successCriteria: [String] // "Students will be able to..."
  },

  // Differentiation & Accommodations
  differentiation: {
    forStrugglingStudents: [String],
    forAdvancedStudents: [String],
    accommodations: [String], // IEP, 504 plans etc.
    ellSupport: [String] // English Language Learner support
  },

  // Standards & Tags
  curriculumStandards: [{
    code: String, // e.g., "CCSS.MATH.CONTENT.8.EE.A.1"
    description: String
  }],
  
  tags: [{
    type: String,
    lowercase: true,
    trim: true
  }],

  // Status & Metadata
  status: {
    type: String,
    enum: ['draft', 'published', 'archived'],
    default: 'draft'
  },
  
  version: {
    type: Number,
    default: 1
  },

  // Execution Tracking (Enhanced from your deliveryLogs)
  deliveryRecords: [{
    streamId: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: 'Stream',
      required: true,
      index: true
    },
    datePlanned: {
      type: Date,
      required: true
    },
    dateDelivered: Date,
    startTime: String,
    endTime: String,
    durationActual: Number, // minutes
    
    // Execution details
    status: {
      type: String,
      enum: ['planned', 'completed', 'cancelled', 'rescheduled', 'partial'],
      default: 'planned'
    },
    
    completionPercentage: {
      type: Number,
      min: 0,
      max: 100,
      default: 0
    },
    
    teacherRemarks: {
      type: String,
      maxlength: [500, 'Remarks cannot exceed 500 characters']
    },
    
    studentEngagement: {
      type: String,
      enum: ['low', 'medium', 'high', 'not recorded'],
      default: 'not recorded'
    },
    
    challengesFaced: [String],
    
    followUpNeeded: {
      required: Boolean,
      description: String,
      dueDate: Date
    },
    
    // Link to homework/assignments
    homeworkGiven: {
      description: String,
      dueDate: Date
    },
    
    // Teacher's reflection (for continuous improvement)
    reflection: {
      whatWorkedWell: String,
      whatToImprove: String,
      notesForNextTime: String
    }
  }],

  // Analytics & Statistics
  statistics: {
    timesDelivered: {
      type: Number,
      default: 0
    },
    averageCompletionTime: Number,
    lastDelivered: Date,
    streamsWhereDelivered: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Stream'
    }]
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for efficient querying
LessonPlanSchema.index({ teacherId: 1, subjectId: 1, status: 1 });
LessonPlanSchema.index({ 'deliveryRecords.streamId': 1, 'deliveryRecords.datePlanned': 1 });
LessonPlanSchema.index({ tags: 1 });

// Ensure title is unique per teacher
LessonPlanSchema.index({ teacherId: 1, title: 1 }, { unique: true });

// Virtual to check if lesson has been delivered to a specific stream
LessonPlanSchema.virtual('deliveryStatus').get(function() {
  return {
    totalDeliveries: this.deliveryRecords.length,
    completedDeliveries: this.deliveryRecords.filter(r => r.status === 'completed').length,
    pendingDeliveries: this.deliveryRecords.filter(r => r.status === 'planned').length
  };
});

// Middleware to update statistics when delivery record is added
LessonPlanSchema.pre('save', async function(next) {
  if (this.isModified('deliveryRecords')) {
    const completedRecords = this.deliveryRecords.filter(r => r.status === 'completed');
    
    this.statistics.timesDelivered = completedRecords.length;
    this.statistics.streamsWhereDelivered = [...new Set(
      completedRecords.map(r => r.streamId.toString())
    )].map(id => mongoose.Types.ObjectId(id));
    
    if (completedRecords.length > 0) {
      this.statistics.lastDelivered = Math.max(
        ...completedRecords.map(r => r.dateDelivered || r.datePlanned)
      );
      
      // Calculate average completion time (if actual delivery times are recorded)
      const withActualDuration = completedRecords.filter(r => r.durationActual);
      if (withActualDuration.length > 0) {
        const avg = withActualDuration.reduce((sum, r) => sum + r.durationActual, 0) / withActualDuration.length;
        this.statistics.averageCompletionTime = Math.round(avg);
      }
    }
  }
  next();
});

// Instance method to schedule delivery for a stream
LessonPlanSchema.methods.scheduleForStream = function(streamId, datePlanned) {
  if (!this.deliveryRecords) {
    this.deliveryRecords = [];
  }
  
  // Check if already scheduled for this stream on this date
  const existing = this.deliveryRecords.find(
    r => r.streamId.toString() === streamId.toString() && 
         r.datePlanned.toDateString() === new Date(datePlanned).toDateString()
  );
  
  if (existing) {
    throw new Error('Lesson already scheduled for this stream on the specified date');
  }
  
  this.deliveryRecords.push({
    streamId,
    datePlanned,
    status: 'planned',
    completionPercentage: 0
  });
  
  return this;
};

// Instance method to mark as delivered
LessonPlanSchema.methods.markAsDelivered = function(streamId, deliveryData) {
  const record = this.deliveryRecords.find(
    r => r.streamId.toString() === streamId.toString() && r.status === 'planned'
  );
  
  if (record) {
    record.status = 'completed';
    record.dateDelivered = new Date();
    record.durationActual = deliveryData.durationActual;
    record.teacherRemarks = deliveryData.teacherRemarks;
    record.studentEngagement = deliveryData.studentEngagement || 'medium';
    record.completionPercentage = 100;
    record.homeworkGiven = deliveryData.homeworkGiven;
    record.reflection = deliveryData.reflection;
  }
  
  return this;
};