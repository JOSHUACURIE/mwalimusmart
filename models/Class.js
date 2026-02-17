
const ClassSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: [true, 'Class name is required'],
    trim: true,
    maxlength: [50, 'Class name cannot exceed 50 characters']
  }, 
  
  teacherId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: [true, 'Teacher reference is required'],
    index: true
  },
  
  academicYear: {
    type: String,
    required: [true, 'Academic year is required'],
    default: function() {
      const year = new Date().getFullYear();
      return `${year}-${year + 1}`; // e.g., "2024-2025"
    }
  },
  
  description: {
    type: String,
    maxlength: [200, 'Description cannot exceed 200 characters']
  },
  
  isActive: {
    type: Boolean,
    default: true
  }
  
}, {
  timestamps: true, 
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

ClassSchema.index({ teacherId: 1, name: 1, academicYear: 1 }, { unique: true });


ClassSchema.virtual('streams', {
  ref: 'Stream',
  localField: '_id',
  foreignField: 'classId',
  options: { sort: { name: 1 } }
});

ClassSchema.virtual('totalStudents', {
  ref: 'Student',
  localField: '_id',
  foreignField: 'classId',
  count: true
});


ClassSchema.virtual('subjects', {
  ref: 'Subject',
  localField: '_id',
  foreignField: 'classId'
});

// Method to get class summary
ClassSchema.methods.getSummary = async function() {
  const streams = await this.populate('streams');
  return {
    id: this._id,
    name: this.name,
    academicYear: this.academicYear,
    streamCount: this.streams?.length || 0,
    isActive: this.isActive,
    createdAt: this.createdAt
  };
};

ClassSchema.statics.findActiveByTeacher = function(teacherId) {
  return this.find({ 
    teacherId, 
    isActive: true 
  }).sort({ name: 1 });
};

module.exports = mongoose.model('Class', ClassSchema);