// models/Student.js
const mongoose = require('mongoose');

const StudentSchema = new mongoose.Schema({
  // Basic Information
  name: { 
    type: String, 
    required: [true, 'Student name is required'],
    trim: true,
    minlength: [2, 'Name must be at least 2 characters'],
    maxlength: [100, 'Name cannot exceed 100 characters']
  },
  
  regNumber: { 
    type: String, 
    required: [true, 'Registration number is required'],
    unique: true,
    trim: true,
    uppercase: true,
    maxlength: [20, 'Registration number cannot exceed 20 characters']
  },
  
  admissionNumber: {
    type: String,
    unique: true,
    sparse: true,
    trim: true,
    uppercase: true
  },
  
  // Academic Information
  streamId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Stream', 
    required: [true, 'Stream reference is required'],
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
  
  rollNumber: {
    type: Number,
    min: [1, 'Roll number must be at least 1'],
    max: [100, 'Roll number cannot exceed 100']
  },
  
  academicYear: {
    type: String,
    required: [true, 'Academic year is required'],
    default: function() {
      const year = new Date().getFullYear();
      return `${year}-${year + 1}`;
    }
  },
  
  // Personal Details
  dateOfBirth: {
    type: Date,
    validate: {
      validator: function(value) {
        return value < new Date();
      },
      message: 'Date of birth must be in the past'
    }
  },
  
  gender: {
    type: String,
    enum: ['Male', 'Female', 'Other', 'Prefer not to say']
  },
  
  bloodGroup: {
    type: String,
    enum: ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-', 'Unknown'],
    default: 'Unknown'
  },
  
  nationality: {
    type: String,
    default: 'Ugandan'
  },
  
  religion: {
    type: String,
    trim: true
  },
  
  // Contact Information
  email: {
    type: String,
    lowercase: true,
    trim: true,
    match: [
      /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
      'Please enter a valid email'
    ]
  },
  
  phoneNumber: {
    type: String,
    trim: true,
    match: [
      /^[+]?[(]?[0-9]{1,4}[)]?[-\s\.]?[(]?[0-9]{1,4}[)]?[-\s\.]?[0-9]{1,5}$/,
      'Please enter a valid phone number'
    ]
  },
  
  address: {
    street: String,
    city: String,
    state: String,
    postalCode: String,
    country: { type: String, default: 'Uganda' }
  },
  
  // Parent/Guardian Information
  parentInfo: {
    fatherName: {
      type: String,
      trim: true,
      maxlength: [100, 'Father name cannot exceed 100 characters']
    },
    fatherPhone: {
      type: String,
      match: [
        /^[+]?[(]?[0-9]{1,4}[)]?[-\s\.]?[(]?[0-9]{1,4}[)]?[-\s\.]?[0-9]{1,5}$/,
        'Please enter a valid phone number'
      ]
    },
    fatherEmail: {
      type: String,
      lowercase: true,
      match: [
        /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
        'Please enter a valid email'
      ]
    },
    fatherOccupation: String,
    
    motherName: {
      type: String,
      trim: true,
      maxlength: [100, 'Mother name cannot exceed 100 characters']
    },
    motherPhone: {
      type: String,
      match: [
        /^[+]?[(]?[0-9]{1,4}[)]?[-\s\.]?[(]?[0-9]{1,4}[)]?[-\s\.]?[0-9]{1,5}$/,
        'Please enter a valid phone number'
      ]
    },
    motherEmail: {
      type: String,
      lowercase: true,
      match: [
        /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
        'Please enter a valid email'
      ]
    },
    motherOccupation: String,
    
    guardianName: {
      type: String,
      trim: true,
      maxlength: [100, 'Guardian name cannot exceed 100 characters']
    },
    guardianPhone: {
      type: String,
      match: [
        /^[+]?[(]?[0-9]{1,4}[)]?[-\s\.]?[(]?[0-9]{1,4}[)]?[-\s\.]?[0-9]{1,5}$/,
        'Please enter a valid phone number'
      ]
    },
    guardianEmail: {
      type: String,
      lowercase: true,
      match: [
        /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
        'Please enter a valid email'
      ]
    },
    relationship: {
      type: String,
      enum: ['Father', 'Mother', 'Guardian', 'Other'],
      default: 'Guardian'
    },
    
    address: {
      street: String,
      city: String,
      state: String,
      postalCode: String,
      country: String
    }
  },
  
  // Emergency Contact
  emergencyContact: {
    name: {
      type: String,
      required: [true, 'Emergency contact name is required'],
      trim: true
    },
    relationship: {
      type: String,
      required: [true, 'Emergency contact relationship is required'],
      trim: true
    },
    phone: {
      type: String,
      required: [true, 'Emergency contact phone is required'],
      match: [
        /^[+]?[(]?[0-9]{1,4}[)]?[-\s\.]?[(]?[0-9]{1,4}[)]?[-\s\.]?[0-9]{1,5}$/,
        'Please enter a valid phone number'
      ]
    },
    alternativePhone: {
      type: String,
      match: [
        /^[+]?[(]?[0-9]{1,4}[)]?[-\s\.]?[(]?[0-9]{1,4}[)]?[-\s\.]?[0-9]{1,5}$/,
        'Please enter a valid phone number'
      ]
    },
    email: {
      type: String,
      lowercase: true,
      match: [
        /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
        'Please enter a valid email'
      ]
    }
  },
  
  // Medical Information
  medicalInfo: {
    bloodGroup: {
      type: String,
      enum: ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-', 'Unknown'],
      default: 'Unknown'
    },
    allergies: [{
      type: String,
      trim: true
    }],
    chronicConditions: [{
      type: String,
      trim: true
    }],
    medications: [{
      name: String,
      dosage: String,
      frequency: String,
      notes: String
    }],
    disabilities: [{
      type: String,
      trim: true
    }],
    specialNeeds: [{
      type: String,
      trim: true
    }],
    doctorName: String,
    doctorPhone: String,
    hospitalPreference: String,
    insuranceProvider: String,
    insuranceNumber: String,
    notes: String
  },
  
  // Previous School Information
  previousSchool: {
    name: String,
    address: String,
    lastClass: String,
    lastYear: Number,
    performance: String,
    transferReason: String,
    conduct: {
      type: String,
      enum: ['Excellent', 'Good', 'Satisfactory', 'Fair', 'Poor']
    },
    documents: [{
      type: String,
      description: String
    }]
  },
  
  // Enrollment Details
  enrollmentDate: {
    type: Date,
    default: Date.now
  },
  
  enrollmentType: {
    type: String,
    enum: ['New', 'Transfer', 'Re-admission'],
    default: 'New'
  },
  
  status: {
    type: String,
    enum: ['active', 'inactive', 'transferred', 'graduated', 'suspended', 'expelled', 'withdrawn'],
    default: 'active',
    index: true
  },
  
  statusHistory: [{
    status: {
      type: String,
      enum: ['active', 'inactive', 'transferred', 'graduated', 'suspended', 'expelled', 'withdrawn']
    },
    date: { type: Date, default: Date.now },
    reason: String,
    remarks: String,
    changedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  }],
  
  // Languages
  languages: [{
    name: {
      type: String,
      required: true
    },
    proficiency: {
      type: String,
      enum: ['Native', 'Fluent', 'Intermediate', 'Basic']
    },
    read: Boolean,
    write: Boolean,
    speak: Boolean
  }],
  
  // Documents
  documents: {
    birthCertificate: {
      url: String,
      uploadedAt: Date,
      verified: { type: Boolean, default: false }
    },
    passportPhoto: {
      url: String,
      uploadedAt: Date
    },
    previousReports: [{
      name: String,
      url: String,
      uploadedAt: Date
    }],
    medicalReports: [{
      name: String,
      url: String,
      uploadedAt: Date
    }],
    transferLetter: {
      url: String,
      uploadedAt: Date
    },
    other: [{
      name: String,
      type: String,
      url: String,
      description: String,
      uploadedAt: { type: Date, default: Date.now }
    }]
  },
  
  // Extracurricular Activities
  extracurricular: [{
    activity: {
      type: String,
      required: true
    },
    role: String,
    achievements: String,
    year: String,
    notes: String
  }],
  
  // Sports
  sports: [{
    name: String,
    position: String,
    achievements: String,
    year: String
  }],
  
  // Clubs and Societies
  clubs: [{
    name: String,
    role: String,
    joinedDate: Date,
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active'
    }
  }],
  
  // Achievements
  achievements: [{
    title: String,
    description: String,
    date: Date,
    type: {
      type: String,
      enum: ['academic', 'sports', 'cultural', 'leadership', 'other']
    },
    certificate: String
  }],
  
  // Disciplinary Records
  disciplinaryRecords: [{
    date: Date,
    incident: String,
    action: String,
    severity: {
      type: String,
      enum: ['minor', 'moderate', 'major']
    },
    reportedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    resolved: { type: Boolean, default: false },
    resolutionDate: Date,
    notes: String
  }],
  
  // Transport Information (if applicable)
  transport: {
    usesSchoolTransport: { type: Boolean, default: false },
    route: String,
    pickupPoint: String,
    pickupTime: String,
    dropoffTime: String,
    driverName: String,
    driverPhone: String,
    busNumber: String
  },
  
  // Fee Information (basic)
  feeInfo: {
    feeCategory: {
      type: String,
      enum: ['Regular', 'Scholarship', 'Bursary', 'Special'],
      default: 'Regular'
    },
    scholarshipDetails: String,
    feeBalance: {
      type: Number,
      default: 0,
      min: 0
    }
  },
  
  // Additional Notes
  notes: {
    type: String,
    maxlength: [2000, 'Notes cannot exceed 2000 characters']
  },
  
  // System Fields
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
  toJSON: { 
    virtuals: true,
    transform: function(doc, ret) {
      delete ret.__v;
      return ret;
    }
  },
  toObject: { virtuals: true }
});

// Indexes for performance
StudentSchema.index({ streamId: 1, rollNumber: 1 }, { unique: true, sparse: true });
StudentSchema.index({ teacherId: 1, status: 1 });
StudentSchema.index({ name: 1 });
StudentSchema.index({ regNumber: 1 }, { unique: true });
StudentSchema.index({ admissionNumber: 1 }, { unique: true, sparse: true });
StudentSchema.index({ 'parentInfo.fatherPhone': 1 });
StudentSchema.index({ 'parentInfo.motherPhone': 1 });
StudentSchema.index({ 'emergencyContact.phone': 1 });

// Virtual populate for scores
StudentSchema.virtual('scores', {
  ref: 'Score',
  localField: '_id',
  foreignField: 'studentId',
  options: { 
    sort: { 'assessment.date': -1 },
    populate: { path: 'subjectId', select: 'name code' }
  }
});

// Virtual for average performance
StudentSchema.virtual('averagePerformance').get(function() {
  return this._averageScore || 0;
});

// Virtual for full name with registration
StudentSchema.virtual('displayName').get(function() {
  return `${this.name} (${this.regNumber})`;
});

// Virtual for age
StudentSchema.virtual('age').get(function() {
  if (!this.dateOfBirth) return null;
  const today = new Date();
  const birthDate = new Date(this.dateOfBirth);
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
});

// Pre-save middleware
StudentSchema.pre('save', async function(next) {
  try {
    // If stream is changed, update classId and academicYear
    if (this.isModified('streamId')) {
      const Stream = mongoose.model('Stream');
      const stream = await Stream.findById(this.streamId);
      if (stream) {
        this.classId = stream.classId;
        this.academicYear = stream.academicYear;
      }
    }
    
    // Track status changes
    if (this.isModified('status')) {
      const User = mongoose.model('User');
      if (!this.statusHistory) this.statusHistory = [];
      
      // Find who changed it (you'll need to pass this from controller)
      let changedBy = this._changedBy || null;
      
      this.statusHistory.push({
        status: this.status,
        date: new Date(),
        reason: this._statusReason || 'Status updated',
        remarks: this._statusRemarks || '',
        changedBy: changedBy
      });
    }
    
    next();
  } catch (error) {
    next(error);
  }
});

// Instance methods
StudentSchema.methods = {
  // Get complete student profile
  async getFullProfile() {
    await this.populate('streamId', 'name roomNumber capacity')
               .populate('classId', 'name academicYear')
               .populate('teacherId', 'name email')
               .populate({
                 path: 'scores',
                 options: { 
                   limit: 20,
                   sort: { 'assessment.date': -1 }
                 },
                 populate: { 
                   path: 'subjectId', 
                   select: 'name code category' 
                 }
               })
               .execPopulate();
    
    return this;
  },
  
  // Get performance summary
  async getPerformanceSummary(term = null) {
    const Score = mongoose.model('Score');
    
    const match = { studentId: this._id };
    if (term) {
      match['assessment.term'] = term;
    }
    
    const summary = await Score.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$subjectId',
          average: { $avg: '$percentage' },
          highest: { $max: '$percentage' },
          lowest: { $min: '$percentage' },
          assessments: { $sum: 1 },
          totalScore: { $sum: '$score' },
          totalPossible: { $sum: '$totalPossible' }
        }
      },
      {
        $lookup: {
          from: 'subjects',
          localField: '_id',
          foreignField: '_id',
          as: 'subject'
        }
      },
      {
        $project: {
          subjectName: { $arrayElemAt: ['$subject.name', 0] },
          subjectCode: { $arrayElemAt: ['$subject.code', 0] },
          average: 1,
          highest: 1,
          lowest: 1,
          assessments: 1,
          overallPercentage: {
            $multiply: [
              { $divide: ['$totalScore', '$totalPossible'] },
              100
            ]
          }
        }
      },
      { $sort: { subjectName: 1 } }
    ]);
    
    // Calculate overall average
    const overall = await Score.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          overallAverage: { $avg: '$percentage' },
          totalAssessments: { $sum: 1 },
          totalScore: { $sum: '$score' },
          totalPossible: { $sum: '$totalPossible' }
        }
      }
    ]);
    
    this._averageScore = overall[0]?.overallAverage || 0;
    
    return {
      subjects: summary,
      overall: overall[0] || { overallAverage: 0, totalAssessments: 0 }
    };
  },
  
  // Get attendance summary (if you add attendance model)
  async getAttendanceSummary(term) {
    // Implement when attendance model is added
    return { message: 'Attendance tracking not implemented' };
  },
  
  // Update status with tracking
  updateStatus(newStatus, reason = '', remarks = '', changedBy = null) {
    this._statusReason = reason;
    this._statusRemarks = remarks;
    this._changedBy = changedBy;
    this.status = newStatus;
    return this.save();
  },
  
  // Add disciplinary record
  addDisciplinaryRecord(record, reportedBy) {
    if (!this.disciplinaryRecords) {
      this.disciplinaryRecords = [];
    }
    
    this.disciplinaryRecords.push({
      ...record,
      date: new Date(),
      reportedBy
    });
    
    return this.save();
  },
  
  // Add achievement
  addAchievement(achievement) {
    if (!this.achievements) {
      this.achievements = [];
    }
    
    this.achievements.push({
      ...achievement,
      date: achievement.date || new Date()
    });
    
    return this.save();
  },
  
  // Check if student is eligible for promotion
  isEligibleForPromotion(threshold = 50) {
    return this._averageScore >= threshold;
  }
};

// Static methods
StudentSchema.statics = {
  // Find students by stream with sorting
  async findByStream(streamId, options = {}) {
    const { 
      sortBy = 'rollNumber', 
      order = 1, 
      status = 'active',
      populate = false 
    } = options;
    
    let query = this.find({ streamId, status })
      .sort({ [sortBy]: order });
    
    if (populate) {
      query = query.populate('streamId', 'name roomNumber')
                   .populate('classId', 'name');
    }
    
    return query;
  },
  
  // Search students
  searchStudents(teacherId, searchTerm, limit = 20) {
    return this.find({
      teacherId,
      $or: [
        { name: { $regex: searchTerm, $options: 'i' } },
        { regNumber: { $regex: searchTerm, $options: 'i' } },
        { admissionNumber: { $regex: searchTerm, $options: 'i' } },
        { 'parentInfo.fatherName': { $regex: searchTerm, $options: 'i' } },
        { 'parentInfo.motherName': { $regex: searchTerm, $options: 'i' } }
      ]
    })
    .limit(limit)
    .populate('streamId', 'name')
    .populate('classId', 'name');
  },
  
  // Bulk create/update students
  async bulkUpsert(studentsData, teacherId, createdBy = null) {
    const operations = studentsData.map(student => ({
      updateOne: {
        filter: { regNumber: student.regNumber },
        update: { 
          $set: {
            ...student,
            teacherId,
            updatedBy: createdBy,
            updatedAt: new Date()
          },
          $setOnInsert: {
            createdBy,
            createdAt: new Date()
          }
        },
        upsert: true
      }
    }));
    
    return this.bulkWrite(operations);
  },
  
  // Get stream statistics
  async getStreamStats(streamId) {
    const stats = await this.aggregate([
      { $match: { streamId, status: 'active' } },
      {
        $group: {
          _id: null,
          totalStudents: { $sum: 1 },
          maleCount: {
            $sum: { $cond: [{ $eq: ['$gender', 'Male'] }, 1, 0] }
          },
          femaleCount: {
            $sum: { $cond: [{ $eq: ['$gender', 'Female'] }, 1, 0] }
          },
          bloodGroups: { $addToSet: '$bloodGroup' },
          averageAge: {
            $avg: {
              $subtract: [
                new Date(),
                '$dateOfBirth'
              ]
            }
          }
        }
      },
      {
        $project: {
          totalStudents: 1,
          maleCount: 1,
          femaleCount: 1,
          bloodGroups: 1,
          averageAge: {
            $divide: ['$averageAge', 365 * 24 * 60 * 60 * 1000]
          } // Convert milliseconds to years
        }
      }
    ]);
    
    return stats[0] || { totalStudents: 0 };
  },
  
  // Get students with pending fee balances (if fee tracking is implemented)
  getStudentsWithFeeBalance(teacherId, minBalance = 0) {
    return this.find({
      teacherId,
      'feeInfo.feeBalance': { $gt: minBalance },
      status: 'active'
    })
    .select('name regNumber streamId feeInfo')
    .populate('streamId', 'name')
    .sort({ 'feeInfo.feeBalance': -1 });
  },
  
  // Generate registration number
  async generateRegNumber(streamId) {
    const Stream = mongoose.model('Stream');
    const stream = await Stream.findById(streamId).populate('classId');
    
    if (!stream) throw new Error('Stream not found');
    
    const year = new Date().getFullYear().toString().slice(-2);
    const classPrefix = stream.classId.name.replace(/[^0-9]/g, '') || '00';
    const streamCode = stream.name.slice(0, 2).toUpperCase();
    
    // Get count of students in this stream
    const count = await this.countDocuments({ streamId }) + 1;
    
    return `${year}${classPrefix}${streamCode}${count.toString().padStart(3, '0')}`;
  }
};

module.exports = mongoose.model('Student', StudentSchema);