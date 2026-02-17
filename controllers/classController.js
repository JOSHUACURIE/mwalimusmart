
const Class = require('../models/Class');
const Stream = require('../models/Stream');
const Student = require('../models/Student');
const Subject = require('../models/Subject');
const mongoose = require('mongoose');

exports.createClass = async (req, res) => {
  try {
    const { name, academicYear, description } = req.body;

  
    const existingClass = await Class.findOne({
      name,
      teacherId: req.user._id,
      academicYear: academicYear || `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`
    });

    if (existingClass) {
      return res.status(400).json({
        success: false,
        message: 'A class with this name already exists for the current academic year'
      });
    }

    // Create class
    const newClass = await Class.create({
      name,
      teacherId: req.user._id,
      academicYear: academicYear || `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`,
      description
    });

    res.status(201).json({
      success: true,
      data: newClass,
      message: 'Class created successfully'
    });

  } catch (error) {
    console.error('Create class error:', error);
    
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Class with this name already exists for this academic year'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Server error while creating class',
      error: error.message
    });
  }
};


exports.getAllClasses = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      sortBy = 'name', 
      order = 1,
      academicYear,
      includeInactive = false
    } = req.query;

    // Build query
    const query = { teacherId: req.user._id };
    
    if (academicYear) {
      query.academicYear = academicYear;
    }
    
    if (!includeInactive || includeInactive === 'false') {
      query.isActive = true;
    }

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Get classes
    const classes = await Class.find(query)
      .sort({ [sortBy]: parseInt(order) })
      .limit(parseInt(limit))
      .skip(skip);

    // Get stream counts for each class
    const classesWithStats = await Promise.all(
      classes.map(async (cls) => {
        const streamCount = await Stream.countDocuments({ classId: cls._id });
        const studentCount = await Student.countDocuments({ classId: cls._id, status: 'active' });
        const subjectCount = await Subject.countDocuments({ classId: cls._id, isActive: true });
        
        return {
          ...cls.toObject(),
          streamCount,
          studentCount,
          subjectCount
        };
      })
    );

    // Get total count for pagination
    const total = await Class.countDocuments(query);

    res.status(200).json({
      success: true,
      count: classes.length,
      total,
      totalPages: Math.ceil(total / parseInt(limit)),
      currentPage: parseInt(page),
      data: classesWithStats
    });

  } catch (error) {
    console.error('Get all classes error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching classes',
      error: error.message
    });
  }
};


exports.getClassById = async (req, res) => {
  try {
    const classDoc = await Class.findOne({
      _id: req.params.id,
      teacherId: req.user._id
    });

    if (!classDoc) {
      return res.status(404).json({
        success: false,
        message: 'Class not found'
      });
    }

    // Get streams in this class
    const streams = await Stream.find({ classId: classDoc._id, isActive: true })
      .sort('name');

    // Get student count
    const studentCount = await Student.countDocuments({ 
      classId: classDoc._id, 
      status: 'active' 
    });

    // Get subject count
    const subjectCount = await Subject.countDocuments({ 
      classId: classDoc._id, 
      isActive: true 
    });

    // Get streams with their student counts
    const streamsWithCounts = await Promise.all(
      streams.map(async (stream) => {
        const count = await Student.countDocuments({ 
          streamId: stream._id, 
          status: 'active' 
        });
        return {
          ...stream.toObject(),
          studentCount: count
        };
      })
    );

    res.status(200).json({
      success: true,
      data: {
        ...classDoc.toObject(),
        streams: streamsWithCounts,
        studentCount,
        subjectCount,
        streamCount: streams.length
      }
    });

  } catch (error) {
    console.error('Get class by ID error:', error);
    
    if (error.kind === 'ObjectId') {
      return res.status(400).json({
        success: false,
        message: 'Invalid class ID'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Server error while fetching class',
      error: error.message
    });
  }
};


exports.updateClass = async (req, res) => {
  try {
    const { name, academicYear, description, isActive } = req.body;

    // Find class
    const classDoc = await Class.findOne({
      _id: req.params.id,
      teacherId: req.user._id
    });

    if (!classDoc) {
      return res.status(404).json({
        success: false,
        message: 'Class not found'
      });
    }

    // Check if updating name and if it conflicts with existing
    if (name && name !== classDoc.name) {
      const existingClass = await Class.findOne({
        name,
        teacherId: req.user._id,
        academicYear: academicYear || classDoc.academicYear,
        _id: { $ne: req.params.id }
      });

      if (existingClass) {
        return res.status(400).json({
          success: false,
          message: 'Another class with this name already exists for this academic year'
        });
      }
    }

    // Update class
    const updatedClass = await Class.findByIdAndUpdate(
      req.params.id,
      {
        name: name || classDoc.name,
        academicYear: academicYear || classDoc.academicYear,
        description: description !== undefined ? description : classDoc.description,
        isActive: isActive !== undefined ? isActive : classDoc.isActive,
        updatedAt: Date.now()
      },
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      data: updatedClass,
      message: 'Class updated successfully'
    });

  } catch (error) {
    console.error('Update class error:', error);
    
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Class with this name already exists for this academic year'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Server error while updating class',
      error: error.message
    });
  }
};


exports.deleteClass = async (req, res) => {
  try {
    const classDoc = await Class.findOne({
      _id: req.params.id,
      teacherId: req.user._id
    });

    if (!classDoc) {
      return res.status(404).json({
        success: false,
        message: 'Class not found'
      });
    }

    // Check if class has active streams
    const hasActiveStreams = await Stream.exists({ 
      classId: req.params.id, 
      isActive: true 
    });

    if (hasActiveStreams) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete class with active streams. Deactivate or delete streams first.'
      });
    }

    // Soft delete
    classDoc.isActive = false;
    await classDoc.save();

    res.status(200).json({
      success: true,
      message: 'Class deleted successfully'
    });

  } catch (error) {
    console.error('Delete class error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while deleting class',
      error: error.message
    });
  }
};

exports.permanentDeleteClass = async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin' && req.user.role !== 'superadmin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to permanently delete classes'
      });
    }

    const classDoc = await Class.findOne({
      _id: req.params.id,
      teacherId: req.user._id
    });

    if (!classDoc) {
      return res.status(404).json({
        success: false,
        message: 'Class not found'
      });
    }

    // Check if class has any streams
    const hasStreams = await Stream.exists({ classId: req.params.id });
    
    if (hasStreams) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete class with existing streams. Delete streams first.'
      });
    }

    await classDoc.remove();

    res.status(200).json({
      success: true,
      message: 'Class permanently deleted'
    });

  } catch (error) {
    console.error('Permanent delete class error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while permanently deleting class',
      error: error.message
    });
  }
};


exports.getClassSummary = async (req, res) => {
  try {
    const classDoc = await Class.findOne({
      _id: req.params.id,
      teacherId: req.user._id
    });

    if (!classDoc) {
      return res.status(404).json({
        success: false,
        message: 'Class not found'
      });
    }

    // Get all streams in this class
    const streams = await Stream.find({ classId: classDoc._id, isActive: true });

    // Get student statistics
    const studentStats = await Student.aggregate([
      {
        $match: {
          classId: classDoc._id,
          status: 'active'
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          male: { $sum: { $cond: [{ $eq: ['$gender', 'Male'] }, 1, 0] } },
          female: { $sum: { $cond: [{ $eq: ['$gender', 'Female'] }, 1, 0] } }
        }
      }
    ]);

    // Get subject count
    const subjectCount = await Subject.countDocuments({ 
      classId: classDoc._id, 
      isActive: true 
    });

    // Get recent streams with their student counts
    const streamsWithStats = await Promise.all(
      streams.slice(0, 5).map(async (stream) => {
        const studentCount = await Student.countDocuments({ 
          streamId: stream._id, 
          status: 'active' 
        });
        return {
          _id: stream._id,
          name: stream.name,
          studentCount,
          capacity: stream.capacity,
          roomNumber: stream.roomNumber
        };
      })
    );

    res.status(200).json({
      success: true,
      data: {
        classInfo: {
          _id: classDoc._id,
          name: classDoc.name,
          academicYear: classDoc.academicYear,
          description: classDoc.description
        },
        statistics: {
          totalStudents: studentStats[0]?.total || 0,
          maleStudents: studentStats[0]?.male || 0,
          femaleStudents: studentStats[0]?.female || 0,
          totalStreams: streams.length,
          totalSubjects: subjectCount
        },
          recentStreams: streamsWithStats
      }
    });

  } catch (error) {
    console.error('Get class summary error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching class summary',
      error: error.message
    });
  }
};


exports.getClassesByAcademicYear = async (req, res) => {
  try {
    const { academicYear } = req.params;

    const classes = await Class.find({
      teacherId: req.user._id,
      academicYear,
      isActive: true
    }).sort('name');

    // Get stream and student counts for each class
    const classesWithCounts = await Promise.all(
      classes.map(async (cls) => {
        const streamCount = await Stream.countDocuments({ classId: cls._id });
        const studentCount = await Student.countDocuments({ 
          classId: cls._id, 
          status: 'active' 
        });
        
        return {
          ...cls.toObject(),
          streamCount,
          studentCount
        };
      })
    );

    res.status(200).json({
      success: true,
      count: classes.length,
      data: classesWithCounts
    });

  } catch (error) {
    console.error('Get classes by academic year error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching classes',
      error: error.message
    });
  }
};


exports.bulkCreateClasses = async (req, res) => {
  try {
    const { classes } = req.body;

    if (!classes || !Array.isArray(classes) || classes.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please provide an array of classes'
      });
    }

    // Prepare classes data
    const classesData = classes.map(cls => ({
      name: cls.name,
      teacherId: req.user._id,
      academicYear: cls.academicYear || `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`,
      description: cls.description || ''
    }));

    // Check for duplicates
    const existingClasses = await Class.find({
      teacherId: req.user._id,
      name: { $in: classesData.map(c => c.name) },
      academicYear: { $in: [...new Set(classesData.map(c => c.academicYear))] }
    });

    if (existingClasses.length > 0) {
      const duplicateNames = existingClasses.map(c => `${c.name} (${c.academicYear})`);
      return res.status(400).json({
        success: false,
        message: `Classes already exist: ${duplicateNames.join(', ')}`
      });
    }

    // Bulk insert
    const createdClasses = await Class.insertMany(classesData, { 
      ordered: false 
    });

    res.status(201).json({
      success: true,
      count: createdClasses.length,
      data: createdClasses,
      message: `${createdClasses.length} classes created successfully`
    });

  } catch (error) {
    console.error('Bulk create classes error:', error);
    
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Some classes have duplicate names for the same academic year'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Server error while bulk creating classes',
      error: error.message
    });
  }
};


exports.archiveClass = async (req, res) => {
  try {
    const classDoc = await Class.findOne({
      _id: req.params.id,
      teacherId: req.user._id
    });

    if (!classDoc) {
      return res.status(404).json({
        success: false,
        message: 'Class not found'
      });
    }

    // Check if class has active streams
    const hasActiveStreams = await Stream.exists({ 
      classId: req.params.id, 
      isActive: true 
    });

    if (hasActiveStreams) {
      return res.status(400).json({
        success: false,
        message: 'Please deactivate or promote all streams before archiving class'
      });
    }

    // Archive class
    classDoc.isActive = false;
    await classDoc.save();

    res.status(200).json({
      success: true,
      message: 'Class archived successfully',
      data: classDoc
    });

  } catch (error) {
    console.error('Archive class error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while archiving class',
      error: error.message
    });
  }
};