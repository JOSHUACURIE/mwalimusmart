const mongoose = require('mongoose');
const bcrypt = require('bcryptjs'); // Make sure to install: npm install bcryptjs

const UserSchema = new mongoose.Schema({
  // Personal Information
  name: { 
    type: String, 
    required: [true, 'Name is required'],
    trim: true,
    minlength: [2, 'Name must be at least 2 characters'],
    maxlength: [50, 'Name cannot exceed 50 characters']
  },
  
  email: { 
    type: String, 
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [
      /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
      'Please provide a valid email address'
    ]
  },
  
  password: { 
    type: String, 
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters'],
    select: false // Don't return password by default in queries
  },
  
  // Professional Information
  schoolName: {
    type: String,
    trim: true,
    maxlength: [100, 'School name cannot exceed 100 characters']
  },
  
  schoolAddress: {
    type: String,
    trim: true,
    maxlength: [200, 'School address cannot exceed 200 characters']
  },
  
  phoneNumber: {
    type: String,
    trim: true,
    match: [
      /^[+]?[(]?[0-9]{1,4}[)]?[-\s\.]?[(]?[0-9]{1,4}[)]?[-\s\.]?[0-9]{1,5}$/,
      'Please provide a valid phone number'
    ]
  },
  
  qualification: {
    type: String,
    enum: ['Certificate', 'Diploma', 'Bachelor', 'Masters', 'PhD', 'Other'],
    default: 'Other'
  },
  
  subjects: [{
    type: String,
    trim: true
  }], // Subjects the teacher specializes in
  
  employeeId: {
    type: String,
    trim: true,
    unique: true,
    sparse: true // Allows null/undefined values
  },
  
  // Account Information
  role: {
    type: String,
    enum: ['teacher', 'admin', 'superadmin'],
    default: 'teacher'
  },
  
  isEmailVerified: {
    type: Boolean,
    default: false
  },
  
  emailVerificationToken: String,
  emailVerificationExpires: Date,
  
  passwordResetToken: String,
  passwordResetExpires: Date,
  
  // Account Status
  isActive: {
    type: Boolean,
    default: true
  },
  
  lastLogin: {
    type: Date
  },
  
  loginHistory: [{
    ip: String,
    userAgent: String,
    timestamp: { type: Date, default: Date.now }
  }],
  
  // Profile Image
  profilePicture: {
    type: String,
    default: 'default-avatar.png'
  },
  
  // Preferences
  preferences: {
    theme: {
      type: String,
      enum: ['light', 'dark', 'system'],
      default: 'system'
    },
    language: {
      type: String,
      default: 'en'
    },
    notifications: {
      email: { type: Boolean, default: true },
      push: { type: Boolean, default: true }
    },
    dashboardLayout: {
      type: String,
      default: 'default'
    }
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
  timestamps: true, // Adds createdAt and updatedAt automatically
  toJSON: { 
    virtuals: true,
    transform: function(doc, ret) {
      delete ret.password;
      delete ret.__v;
      delete ret.emailVerificationToken;
      delete ret.passwordResetToken;
      return ret;
    }
  },
  toObject: { 
    virtuals: true,
    transform: function(doc, ret) {
      delete ret.password;
      return ret;
    }
  }
});

// Indexes for performance
UserSchema.index({ email: 1 });
UserSchema.index({ role: 1, isActive: 1 });
UserSchema.index({ schoolName: 1 });

// Virtual populate to get all classes for this teacher
UserSchema.virtual('classes', {
  ref: 'Class',
  localField: '_id',
  foreignField: 'teacherId'
});

// Virtual to get all streams for this teacher
UserSchema.virtual('streams', {
  ref: 'Stream',
  localField: '_id',
  foreignField: 'teacherId'
});

// Virtual to get all students for this teacher
UserSchema.virtual('students', {
  ref: 'Student',
  localField: '_id',
  foreignField: 'teacherId'
});

// Virtual to get all lesson plans for this teacher
UserSchema.virtual('lessonPlans', {
  ref: 'LessonPlan',
  localField: '_id',
  foreignField: 'teacherId'
});

// Pre-save middleware to hash password
UserSchema.pre('save', async function(next) {
  // Only hash the password if it has been modified (or is new)
  if (!this.isModified('password')) return next();
  
  try {
    // Generate salt
    const salt = await bcrypt.genSalt(10);
    // Hash password
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Pre-update middleware to hash password if being updated
UserSchema.pre('findOneAndUpdate', async function(next) {
  const update = this.getUpdate();
  
  if (update.password) {
    try {
      const salt = await bcrypt.genSalt(10);
      update.password = await bcrypt.hash(update.password, salt);
    } catch (error) {
      return next(error);
    }
  }
  next();
});

// Instance methods
UserSchema.methods = {
  // Compare password for login
  async comparePassword(candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
  },
  
  // Generate email verification token
  generateEmailVerificationToken() {
    const crypto = require('crypto');
    const token = crypto.randomBytes(32).toString('hex');
    
    this.emailVerificationToken = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');
      
    this.emailVerificationExpires = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
    
    return token;
  },
  
  // Generate password reset token
  generatePasswordResetToken() {
    const crypto = require('crypto');
    const token = crypto.randomBytes(32).toString('hex');
    
    this.passwordResetToken = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');
      
    this.passwordResetExpires = Date.now() + 1 * 60 * 60 * 1000; // 1 hour
    
    return token;
  },
  
  // Log login activity
  logLogin(ip, userAgent) {
    if (!this.loginHistory) {
      this.loginHistory = [];
    }
    
    this.loginHistory.push({
      ip,
      userAgent,
      timestamp: new Date()
    });
    
    // Keep only last 50 logins
    if (this.loginHistory.length > 50) {
      this.loginHistory = this.loginHistory.slice(-50);
    }
    
    this.lastLogin = new Date();
    
    return this.save();
  },
  
  // Get teacher dashboard summary
  async getDashboardSummary() {
    const Class = mongoose.model('Class');
    const Stream = mongoose.model('Stream');
    const Student = mongoose.model('Student');
    const LessonPlan = mongoose.model('LessonPlan');
    
    const [
      classCount,
      streamCount,
      studentCount,
      lessonPlanCount,
      recentLessonPlans
    ] = await Promise.all([
      Class.countDocuments({ teacherId: this._id, isActive: true }),
      Stream.countDocuments({ teacherId: this._id, isActive: true }),
      Student.countDocuments({ teacherId: this._id, status: 'active' }),
      LessonPlan.countDocuments({ teacherId: this._id }),
      LessonPlan.find({ teacherId: this._id })
        .sort({ createdAt: -1 })
        .limit(5)
        .select('title subjectId status')
        .populate('subjectId', 'name')
    ]);
    
    return {
      teacherName: this.name,
      schoolName: this.schoolName,
      stats: {
        classes: classCount,
        streams: streamCount,
        students: studentCount,
        lessonPlans: lessonPlanCount
      },
      recentLessonPlans
    };
  }
};

// Static methods
UserSchema.statics = {
  // Find teacher by email with password included
  async findByEmailWithPassword(email) {
    return this.findOne({ email }).select('+password');
  },
  
  // Get active teachers count
  async getActiveCount() {
    return this.countDocuments({ isActive: true, role: 'teacher' });
  },
  
  // Search teachers
  searchTeachers(query) {
    return this.find({
      $or: [
        { name: { $regex: query, $options: 'i' } },
        { email: { $regex: query, $options: 'i' } },
        { schoolName: { $regex: query, $options: 'i' } }
      ],
      role: 'teacher'
    }).limit(20);
  }
};

// Export the model
module.exports = mongoose.model('User', UserSchema);