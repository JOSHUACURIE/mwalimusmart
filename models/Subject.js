// models/Subject.js
const mongoose = require('mongoose');

const SubjectSchema = new mongoose.Schema({
  // Core Information
  name: { 
    type: String, 
    required: [true, 'Subject name is required'],
    trim: true,
    maxlength: [100, 'Subject name cannot exceed 100 characters']
  }, // e.g., "Mathematics", "English Language", "Physics"
  
  code: {
    type: String,
    required: [true, 'Subject code is required'],
    unique: true,
    trim: true,
    uppercase: true,
    maxlength: [10, 'Subject code cannot exceed 10 characters']
  }, // e.g., "MATH101", "ENG102", "PHY201"
  
  teacherId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: [true, 'Teacher reference is required'],
    index: true
  },
  
  classId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Class',
    required: [true, 'Class reference is required'],
    index: true
  }, // Which class this subject is offered to
  
  // Subject Details
  description: {
    type: String,
    maxlength: [500, 'Description cannot exceed 500 characters'],
    default: ''
  },
  
  category: {
    type: String,
    enum: [
      'Core', 
      'Elective', 
      'Language', 
      'Science', 
      'Humanities', 
      'Mathematics', 
      'Arts',
      'Technical',
      'Vocational',
      'Physical Education',
      'Religious Education'
    ],
    default: 'Core'
  },
  
  department: {
    type: String,
    trim: true,
    maxlength: [50, 'Department name cannot exceed 50 characters']
  }, // e.g., "Science Department", "Languages Department"
  
  // Academic Information
  academicYear: {
    type: String,
    required: [true, 'Academic year is required'],
    default: function() {
      const year = new Date().getFullYear();
      return `${year}-${year + 1}`;
    }
  },
  
  term: {
    type: String,
    enum: ['Term 1', 'Term 2', 'Term 3', 'Term 4', 'Full Year', 'Not Applicable'],
    default: 'Full Year'
  },
  
  credits: {
    type: Number,
    min: [0, 'Credits cannot be negative'],
    max: [10, 'Credits cannot exceed 10'],
    default: 0
  }, // For GPA calculations
  
  hoursPerWeek: {
    type: Number,
    min: [0, 'Hours per week cannot be negative'],
    max: [10, 'Hours per week cannot exceed 10'],
    default: 0
  },
  
  // Pass marks and grading
  passMark: {
    type: Number,
    min: [0, 'Pass mark cannot be negative'],
    max: [100, 'Pass mark cannot exceed 100'],
    default: 50
  }, // Percentage required to pass
  
  gradingScale: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'GradingScale'
  }, // Reference to a custom grading scale (if needed)
  
  // Assessment Structure
  assessmentStructure: {
    continuousAssessment: {
      weight: {
        type: Number,
        min: 0,
        max: 100,
        default: 40
      },
      components: [{
        name: String,
        weight: Number, // Percentage of CA
        maxScore: Number,
        count: { type: Number, default: 1 } // Number of times this component occurs
      }]
    },
    endOfTerm: {
      weight: {
        type: Number,
        min: 0,
        max: 100,
        default: 60
      },
      name: { type: String, default: 'End of Term Examination' },
      maxScore: { type: Number, default: 100 }
    }
  },
  
  // Textbooks and Resources
  textbooks: [{
    title: { type: String, required: true },
    author: String,
    publisher: String,
    year: Number,
    isbn: String,
    isRequired: { type: Boolean, default: true }
  }],
  
  recommendedResources: [{
    type: {
      type: String,
      enum: ['website', 'video', 'article', 'software', 'other'],
      default: 'website'
    },
    title: String,
    url: String,
    description: String
  }],
  
  // Syllabus and Curriculum
  syllabus: {
    documentUrl: String, // Link to uploaded syllabus PDF
    summary: String,
    topics: [{
      topicNumber: String,
      title: String,
      weeksRequired: Number,
      learningOutcomes: [String],
      subtopics: [String]
    }]
  },
  
  // Prerequisites
  prerequisites: [{
    subjectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Subject'
    },
    minimumGrade: {
      type: String,
      enum: ['A', 'B', 'C', 'D', 'E', 'F', 'None'],
      default: 'None'
    }
  }],
  
  // Teachers assigned to this subject
  assignedTeachers: [{
    teacherId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    role: {
      type: String,
      enum: ['primary', 'assistant', 'substitute'],
      default: 'primary'
    },
    streams: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Stream'
    }] // Which streams this teacher handles for this subject
  }],
  
  // Status
  isActive: {
    type: Boolean,
    default: true
  },
  
  isCompulsory: {
    type: Boolean,
    default: true
  },
  
  // Metadata
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
  
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
SubjectSchema.index({ teacherId: 1, classId: 1 });
SubjectSchema.index({ code: 1 }, { unique: true });
SubjectSchema.index({ name: 1, academicYear: 1 });
SubjectSchema.index({ 'assignedTeachers.teacherId': 1 });

// Ensure unique subject name per class per academic year
SubjectSchema.index({ 
  classId: 1, 
  name: 1, 
  academicYear: 1 
}, { unique: true });

// Virtual populate to get all lesson plans for this subject
SubjectSchema.virtual('lessonPlans', {
  ref: 'LessonPlan',
  localField: '_id',
  foreignField: 'subjectId',
  options: { sort: { createdAt: -1 } }
});

// Virtual to get all scores for this subject
SubjectSchema.virtual('scores', {
  ref: 'Score',
  localField: '_id',
  foreignField: 'subjectId',
  options: { sort: { 'assessment.date': -1 } }
});

// Virtual to get average performance across all streams
SubjectSchema.virtual('overallAverage').get(function() {
  return this._averageScore || 0;
});

// Virtual to check if subject has prerequisites
SubjectSchema.virtual('hasPrerequisites').get(function() {
  return this.prerequisites && this.prerequisites.length > 0;
});

// Pre-save validation
SubjectSchema.pre('save', function(next) {
  // Validate assessment structure weights sum to 100
  if (this.assessmentStructure) {
    const caWeight = this.assessmentStructure.continuousAssessment.weight;
    const eotWeight = this.assessmentStructure.endOfTerm.weight;
    
    if (caWeight + eotWeight !== 100) {
      next(new Error('Assessment weights must sum to 100'));
    }
    
    // Validate CA components sum to 100% of CA weight
    if (this.assessmentStructure.continuousAssessment.components) {
      const totalComponentWeight = this.assessmentStructure.continuousAssessment.components
        .reduce((sum, comp) => sum + (comp.weight || 0), 0);
      
      if (totalComponentWeight !== 100) {
        next(new Error('Continuous assessment components must sum to 100%'));
      }
    }
  }
  
  next();
});

// Instance methods
SubjectSchema.methods = {
  // Get subject details with related data
  async getDetails() {
    await this.populate('classId', 'name academicYear')
               .populate('teacherId', 'name email')
               .populate('prerequisites.subjectId', 'name code')
               .populate('assignedTeachers.teacherId', 'name email')
               .populate('assignedTeachers.streams', 'name')
               .execPopulate();
    
    return this;
  },
  
  // Get performance statistics for this subject
  async getPerformanceStats(term, streamId = null) {
    const Score = mongoose.model('Score');
    
    const match = {
      subjectId: this._id,
      'assessment.term': term
    };
    
    if (streamId) {
      match.streamId = streamId;
    }
    
    const stats = await Score.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          averageScore: { $avg: '$percentage' },
          highestScore: { $max: '$percentage' },
          lowestScore: { $min: '$percentage' },
          totalAssessments: { $sum: 1 },
          passCount: {
            $sum: { 
              $cond: [{ $gte: ['$percentage', this.passMark] }, 1, 0] 
            }
          },
          failCount: {
            $sum: { 
              $cond: [{ $lt: ['$percentage', this.passMark] }, 1, 0] 
            }
          }
        }
      }
    ]);
    
    const result = stats[0] || { 
      averageScore: 0, 
      highestScore: 0, 
      lowestScore: 0, 
      totalAssessments: 0,
      passCount: 0,
      failCount: 0
    };
    
    // Calculate pass rate
    result.passRate = result.totalAssessments > 0 
      ? (result.passCount / result.totalAssessments) * 100 
      : 0;
    
    this._averageScore = result.averageScore;
    
    return result;
  },
  
  // Get topics coverage across lesson plans
  async getTopicsCoverage(term) {
    const LessonPlan = mongoose.model('LessonPlan');
    
    const coverage = await LessonPlan.aggregate([
      {
        $match: {
          subjectId: this._id,
          'deliveryRecords.status': 'completed',
          'deliveryRecords.dateDelivered': {
            $gte: new Date(new Date().getFullYear(), 0, 1) // Start of year
          }
        }
      },
      {
        $unwind: '$deliveryRecords'
      },
      {
        $match: {
          'deliveryRecords.status': 'completed'
        }
      },
      {
        $group: {
          _id: '$topic',
          timesTaught: { $sum: 1 },
          streams: { $addToSet: '$deliveryRecords.streamId' },
          lastTaught: { $max: '$deliveryRecords.dateDelivered' }
        }
      },
      {
        $project: {
          topic: '$_id',
          timesTaught: 1,
          streamCount: { $size: '$streams' },
          lastTaught: 1
        }
      },
      { $sort: { lastTaught: -1 } }
    ]);
    
    return coverage;
  },
  
  // Assign teacher to specific streams
  assignTeacherToStreams(teacherId, streamIds, role = 'primary') {
    if (!this.assignedTeachers) {
      this.assignedTeachers = [];
    }
    
    let teacherAssignment = this.assignedTeachers.find(
      t => t.teacherId.toString() === teacherId.toString()
    );
    
    if (teacherAssignment) {
      // Update existing assignment
      teacherAssignment.streams = [
        ...new Set([...teacherAssignment.streams, ...streamIds])
      ];
    } else {
      // Create new assignment
      this.assignedTeachers.push({
        teacherId,
        role,
        streams: streamIds
      });
    }
    
    return this.save();
  }
};

// Static methods
SubjectSchema.statics = {
  // Get subjects for a class
  async findByClass(classId, options = {}) {
    const { includeInactive = false, populate = false } = options;
    
    const query = { classId };
    if (!includeInactive) {
      query.isActive = true;
    }
    
    let subjects = this.find(query).sort({ name: 1 });
    
    if (populate) {
      subjects = subjects.populate('teacherId', 'name email');
    }
    
    return subjects;
  },
  
  // Get subjects taught by a teacher
  findByTeacher(teacherId, academicYear = null) {
    const query = {
      $or: [
        { teacherId },
        { 'assignedTeachers.teacherId': teacherId }
      ]
    };
    
    if (academicYear) {
      query.academicYear = academicYear;
    }
    
    return this.find(query)
      .populate('classId', 'name')
      .sort({ name: 1 });
  },
  
  // Get subject statistics
  async getSubjectStats(teacherId, academicYear) {
    const stats = await this.aggregate([
      {
        $match: {
          $or: [
            { teacherId },
            { 'assignedTeachers.teacherId': teacherId }
          ],
          academicYear
        }
      },
      {
        $lookup: {
          from: 'classes',
          localField: 'classId',
          foreignField: '_id',
          as: 'class'
        }
      },
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 },
          subjects: { $push: { name: '$name', class: { $arrayElemAt: ['$class.name', 0] } } }
        }
      },
      { $sort: { _id: 1 } }
    ]);
    
    return stats;
  },
  
  // Bulk create subjects for a class
  async bulkCreateForClass(classId, teacherId, subjectsData) {
    const Class = mongoose.model('Class');
    const classDoc = await Class.findById(classId);
    
    if (!classDoc) {
      throw new Error('Class not found');
    }
    
    const subjects = subjectsData.map(data => ({
      ...data,
      classId,
      teacherId,
      academicYear: classDoc.academicYear
    }));
    
    return this.insertMany(subjects);
  },
  
  // Generate subject code
  async generateSubjectCode(subjectName, classId) {
    const Class = mongoose.model('Class');
    const classDoc = await Class.findById(classId);
    
    if (!classDoc) {
      throw new Error('Class not found');
    }
    
    // Get first 3 letters of subject name
    const prefix = subjectName
      .replace(/[^a-zA-Z]/g, '')
      .substring(0, 3)
      .toUpperCase();
    
    // Get class level number
    const classLevel = classDoc.name.replace(/[^0-9]/g, '') || '00';
    
    // Count existing subjects with similar code
    const count = await this.countDocuments({
      code: new RegExp(`^${prefix}${classLevel}`)
    }) + 1;
    
    return `${prefix}${classLevel}${count.toString().padStart(2, '0')}`;
  }
};

// Export the model
module.exports = mongoose.model('Subject', SubjectSchema);