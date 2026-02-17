const mongoose = require('mongoose');
const ScoreSchema = new mongoose.Schema({

  studentId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Student', 
    required: [true, 'Student reference is required'],
    index: true
  },
  
  subjectId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Subject', 
    required: [true, 'Subject reference is required'],
    index: true
  },
  
  teacherId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: [true, 'Teacher reference is required'],
    index: true
  },
  
  streamId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Stream',
    required: [true, 'Stream reference is required'],
    index: true
  }, // Adding streamId makes analytics by stream much easier
  

  assessment: {
    name: { 
      type: String, 
      required: [true, 'Assessment name is required'],
      trim: true
    },
    date: { 
      type: Date, 
      default: Date.now,
      index: true 
    },
    type: { 
      type: String, 
      enum: ['Quiz', 'Exam', 'Assignment', 'Project', 'Test', 'Homework', 'Practical'],
      default: 'Quiz'
    },
    term: {
      type: String,
      enum: ['Term 1', 'Term 2', 'Term 3', 'Term 4', 'Mid-Term', 'Final'],
      default: 'Term 1'
    },
    academicYear: {
      type: String,
      default: function() {
        const year = new Date().getFullYear();
        return `${year}-${year + 1}`;
      }
    }
  },
  
  // Score data
  score: { 
    type: Number, 
    required: [true, 'Score is required'],
    min: [0, 'Score cannot be negative']
  },
  
  totalPossible: { 
    type: Number, 
    required: [true, 'Total possible score is required'],
    min: [1, 'Total possible must be at least 1']
  },
  
  percentage: {
    type: Number,
    min: 0,
    max: 100
  },
  
  grade: {
    type: String,
rade: {
    type: String,
    enum: [
      'A', 'A-',
      'B+', 'B', 'B-',
      'C+', 'C', 'C-',
      'D+', 'D', 'D-',
      'E',
      'F',
      'Not Graded'
    ],
    default: 'Not Graded'
  },
    default: 'Not Graded'
  },
  
  remarks: {
    type: String,
    maxlength: [200, 'Remarks cannot exceed 200 characters']
  },
  
  // Status
  isAbsent: {
    type: Boolean,
    default: false
  },
  
  isLateSubmission: {
    type: Boolean,
    default: false
  },
  
  // For tracking resits/improvements
  isResit: {
    type: Boolean,
    default: false
  },
  
  previousScoreId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Score'
  } // Link to original if this is a resit
  
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Compound indexes for common queries
ScoreSchema.index({ studentId: 1, subjectId: 1, 'assessment.term': 1 });
ScoreSchema.index({ streamId: 1, 'assessment.date': -1 });
ScoreSchema.index({ teacherId: 1, 'assessment.type': 1 });

// Pre-save middleware to calculate percentage and grade
ScoreSchema.pre('save', function(next) {
  // Calculate percentage
  if (this.score && this.totalPossible) {
    this.percentage = Number(((this.score / this.totalPossible) * 100).toFixed(2));
    
    // Auto-calculate grade based on percentage
    if (this.percentage >= 90) this.grade = 'A';
    else if (this.percentage >= 80) this.grade = 'B';
    else if (this.percentage >= 70) this.grade = 'C';
    else if (this.percentage >= 60) this.grade = 'D';
    else if (this.percentage >= 50) this.grade = 'E';
    else this.grade = 'F';
  }
  next();
});

// Static methods for analytics (all derived from scores)
ScoreSchema.statics = {
  // Get average for a specific assessment
  async getAssessmentAverage(assessmentName, subjectId, streamId, term) {
    const match = { 
      'assessment.name': assessmentName,
      subjectId,
      streamId,
      'assessment.term': term
    };
    
    const result = await this.aggregate([
      { $match: match },
      { 
        $group: {
          _id: null,
          average: { $avg: '$percentage' },
          highest: { $max: '$percentage' },
          lowest: { $min: '$percentage' },
          count: { $sum: 1 }
        }
      }
    ]);
    
    return result[0] || { average: 0, highest: 0, lowest: 0, count: 0 };
  },
  
  // Get student's performance trend
  async getStudentTrend(studentId, subjectId, limit = 5) {
    return this.find({ studentId, subjectId })
      .sort({ 'assessment.date': -1 })
      .limit(limit)
      .select('assessment.name assessment.date percentage score totalPossible');
  },
  
  // Get class/stream performance summary
  async getStreamSummary(streamId, subjectId, term) {
    return this.aggregate([
      { 
        $match: { 
          streamId, 
          subjectId,
          'assessment.term': term 
        } 
      },
      {
        $group: {
          _id: '$studentId',
          averagePercentage: { $avg: '$percentage' },
          totalAssessments: { $sum: 1 }
        }
      },
      {
        $group: {
          _id: null,
          classAverage: { $avg: '$averagePercentage' },
          studentCount: { $sum: 1 },
          above75: {
            $sum: { $cond: [{ $gte: ['$averagePercentage', 75] }, 1, 0] }
          },
          below50: {
            $sum: { $cond: [{ $lt: ['$averagePercentage', 50] }, 1, 0] }
          }
        }
      }
    ]);
  },
  
  // Get grade distribution
  async getGradeDistribution(streamId, subjectId, term) {
    return this.aggregate([
      { 
        $match: { 
          streamId, 
          subjectId,
          'assessment.term': term 
        } 
      },
      {
        $group: {
          _id: '$grade',
          count: { $sum: 1 },
          students: { $addToSet: '$studentId' }
        }
      },
      {
        $project: {
          grade: '$_id',
          count: 1,
          uniqueStudents: { $size: '$students' }
        }
      },
      { $sort: { grade: 1 } }
    ]);
  }
};

// Instance methods
ScoreSchema.methods = {
  // Check if score is passing (adjust threshold as needed)
  isPassing(threshold = 50) {
    return this.percentage >= threshold;
  },
  
  // Get improvement from previous score (if this is a resit)
  async getImprovement() {
    if (!this.previousScoreId) return null;
    
    const previous = await this.constructor.findById(this.previousScoreId);
    if (!previous) return null;
    
    return {
      previous: previous.percentage,
      current: this.percentage,
      improvement: Number((this.percentage - previous.percentage).toFixed(2))
    };
  }
};