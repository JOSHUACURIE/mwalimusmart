
const Student = require('../models/Student');
const Stream = require('../models/Stream');
const Class = require('../models/Class');
const Score = require('../models/Score');
const mongoose = require('mongoose');


exports.createStudent = async (req, res) => {
  try {
    const { streamId, ...studentData } = req.body;
    
    // Verify stream exists and belongs to teacher
    const stream = await Stream.findOne({
      _id: streamId,
      teacherId: req.user._id
    });
    
    if (!stream) {
      return res.status(404).json({
        success: false,
        message: 'Stream not found or you do not have permission'
      });
    }
    
    // Generate registration number if not provided
    if (!studentData.regNumber) {
      studentData.regNumber = await Student.generateRegNumber(streamId);
    }
    
    // Create student
    const student = await Student.create({
      ...studentData,
      streamId,
      classId: stream.classId,
      teacherId: req.user._id,
      createdBy: req.user._id,
      academicYear: stream.academicYear
    });
    
    res.status(201).json({
      success: true,
      data: student,
      message: 'Student created successfully'
    });
    
  } catch (error) {
    console.error('Create student error:', error);
    
    // Handle duplicate key error
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      return res.status(400).json({
        success: false,
        message: `${field} already exists. Please use a unique value.`
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Server error while creating student',
      error: error.message
    });
  }
};

// @desc    Get all students for a teacher
// @route   GET /api/students
// @access  Private
exports.getAllStudents = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      sortBy = 'name',
      order = 1,
      status = 'active',
      streamId,
      classId,
      search
    } = req.query;

    // Build query
    const query = { teacherId: req.user._id };
    
    if (status) query.status = status;
    if (streamId) query.streamId = streamId;
    if (classId) query.classId = classId;
    
    // Search functionality
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { regNumber: { $regex: search, $options: 'i' } },
        { admissionNumber: { $regex: search, $options: 'i' } },
        { 'parentInfo.fatherName': { $regex: search, $options: 'i' } },
        { 'parentInfo.motherName': { $regex: search, $options: 'i' } }
      ];
    }

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Execute query with pagination
    const students = await Student.find(query)
      .populate('streamId', 'name roomNumber')
      .populate('classId', 'name')
      .sort({ [sortBy]: parseInt(order) })
      .limit(parseInt(limit))
      .skip(skip);

    // Get total count for pagination
    const total = await Student.countDocuments(query);

    res.status(200).json({
      success: true,
      count: students.length,
      total,
      totalPages: Math.ceil(total / parseInt(limit)),
      currentPage: parseInt(page),
      data: students
    });
    
  } catch (error) {
    console.error('Get all students error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching students',
      error: error.message
    });
  }
};

// @desc    Get single student by ID
// @route   GET /api/students/:id
// @access  Private
exports.getStudentById = async (req, res) => {
  try {
    const student = await Student.findOne({
      _id: req.params.id,
      teacherId: req.user._id
    })
    .populate('streamId', 'name roomNumber capacity')
    .populate('classId', 'name academicYear')
    .populate('createdBy', 'name email')
    .populate('updatedBy', 'name email');

    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    res.status(200).json({
      success: true,
      data: student
    });
    
  } catch (error) {
    console.error('Get student by ID error:', error);
    
    // Handle invalid ObjectId
    if (error.kind === 'ObjectId') {
      return res.status(400).json({
        success: false,
        message: 'Invalid student ID'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Server error while fetching student',
      error: error.message
    });
  }
};

// @desc    Update student
// @route   PUT /api/students/:id
// @access  Private
exports.updateStudent = async (req, res) => {
  try {
    const { streamId, ...updateData } = req.body;
    
    // Find student
    const student = await Student.findOne({
      _id: req.params.id,
      teacherId: req.user._id
    });

    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    // If stream is being updated, verify new stream
    if (streamId && streamId !== student.streamId.toString()) {
      const stream = await Stream.findOne({
        _id: streamId,
        teacherId: req.user._id
      });
      
      if (!stream) {
        return res.status(404).json({
          success: false,
          message: 'New stream not found or you do not have permission'
        });
      }
      
      updateData.streamId = streamId;
      updateData.classId = stream.classId;
      updateData.academicYear = stream.academicYear;
    }

    // Update student
    const updatedStudent = await Student.findByIdAndUpdate(
      req.params.id,
      {
        ...updateData,
        updatedBy: req.user._id,
        updatedAt: Date.now()
      },
      { new: true, runValidators: true }
    )
    .populate('streamId', 'name')
    .populate('classId', 'name');

    res.status(200).json({
      success: true,
      data: updatedStudent,
      message: 'Student updated successfully'
    });
    
  } catch (error) {
    console.error('Update student error:', error);
    
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      return res.status(400).json({
        success: false,
        message: `${field} already exists. Please use a unique value.`
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Server error while updating student',
      error: error.message
    });
  }
};

// @desc    Delete student (soft delete by changing status)
// @route   DELETE /api/students/:id
// @access  Private
exports.deleteStudent = async (req, res) => {
  try {
    const student = await Student.findOne({
      _id: req.params.id,
      teacherId: req.user._id
    });

    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    // Soft delete - change status to inactive
    await student.updateStatus(
      'inactive',
      'Student deleted by teacher',
      `Deleted by ${req.user.name}`,
      req.user._id
    );

    res.status(200).json({
      success: true,
      message: 'Student deleted successfully'
    });
    
  } catch (error) {
    console.error('Delete student error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while deleting student',
      error: error.message
    });
  }
};

// @desc    Permanently delete student (admin only)
// @route   DELETE /api/students/:id/permanent
// @access  Private (Admin only)
exports.permanentDeleteStudent = async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin' && req.user.role !== 'superadmin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to permanently delete students'
      });
    }

    const student = await Student.findOne({
      _id: req.params.id,
      teacherId: req.user._id
    });

    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    // Check if student has scores (optional - prevent deletion if has records)
    const hasScores = await Score.exists({ studentId: req.params.id });
    
    if (hasScores) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete student with existing scores. Consider soft delete instead.'
      });
    }

    await student.remove();

    res.status(200).json({
      success: true,
      message: 'Student permanently deleted'
    });
    
  } catch (error) {
    console.error('Permanent delete error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while permanently deleting student',
      error: error.message
    });
  }
};

// @desc    Get student profile with all details
// @route   GET /api/students/:id/profile
// @access  Private
exports.getStudentProfile = async (req, res) => {
  try {
    const student = await Student.findOne({
      _id: req.params.id,
      teacherId: req.user._id
    });

    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    // Get full profile with populated data
    const profile = await student.getFullProfile();
    
    // Get performance summary
    const performance = await student.getPerformanceSummary();

    res.status(200).json({
      success: true,
      data: {
        ...profile.toObject(),
        performance
      }
    });
    
  } catch (error) {
    console.error('Get student profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching student profile',
      error: error.message
    });
  }
};

// @desc    Get student performance
// @route   GET /api/students/:id/performance
// @access  Private
exports.getStudentPerformance = async (req, res) => {
  try {
    const { term } = req.query;
    
    const student = await Student.findOne({
      _id: req.params.id,
      teacherId: req.user._id
    });

    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    const performance = await student.getPerformanceSummary(term);

    res.status(200).json({
      success: true,
      data: performance
    });
    
  } catch (error) {
    console.error('Get student performance error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching performance',
      error: error.message
    });
  }
};

// @desc    Bulk create students
// @route   POST /api/students/bulk
// @access  Private
exports.bulkCreateStudents = async (req, res) => {
  try {
    const { students, streamId } = req.body;

    if (!students || !Array.isArray(students) || students.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please provide an array of students'
      });
    }

    if (!streamId) {
      return res.status(400).json({
        success: false,
        message: 'Stream ID is required'
      });
    }

    // Verify stream exists and belongs to teacher
    const stream = await Stream.findOne({
      _id: streamId,
      teacherId: req.user._id
    });

    if (!stream) {
      return res.status(404).json({
        success: false,
        message: 'Stream not found or you do not have permission'
      });
    }

    // Prepare students data
    const studentsData = await Promise.all(students.map(async (student, index) => {
      // Generate registration number if not provided
      const regNumber = student.regNumber || 
        await Student.generateRegNumber(streamId);
      
      return {
        ...student,
        regNumber,
        streamId,
        classId: stream.classId,
        teacherId: req.user._id,
        academicYear: stream.academicYear,
        rollNumber: student.rollNumber || index + 1,
        createdBy: req.user._id
      };
    }));

    // Bulk insert
    const createdStudents = await Student.insertMany(studentsData, { 
      ordered: false // Continue even if some fail
    });

    res.status(201).json({
      success: true,
      count: createdStudents.length,
      data: createdStudents,
      message: `${createdStudents.length} students created successfully`
    });
    
  } catch (error) {
    console.error('Bulk create students error:', error);
    
    // Handle duplicate key errors
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Some students have duplicate registration numbers',
        error: error.writeErrors || error.message
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Server error while bulk creating students',
      error: error.message
    });
  }
};

// @desc    Bulk update students (e.g., promote to next class)
// @route   PUT /api/students/bulk/update
// @access  Private
exports.bulkUpdateStudents = async (req, res) => {
  try {
    const { studentIds, updates } = req.body;

    if (!studentIds || !Array.isArray(studentIds) || studentIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please provide an array of student IDs'
      });
    }

    // If updating stream, verify new stream
    if (updates.streamId) {
      const stream = await Stream.findOne({
        _id: updates.streamId,
        teacherId: req.user._id
      });
      
      if (!stream) {
        return res.status(404).json({
          success: false,
          message: 'Stream not found or you do not have permission'
        });
      }
      
      updates.classId = stream.classId;
      updates.academicYear = stream.academicYear;
    }

    // Bulk update
    const result = await Student.updateMany(
      { 
        _id: { $in: studentIds },
        teacherId: req.user._id 
      },
      {
        ...updates,
        updatedBy: req.user._id,
        updatedAt: Date.now()
      }
    );

    res.status(200).json({
      success: true,
      message: `${result.modifiedCount} students updated successfully`,
      data: result
    });
    
  } catch (error) {
    console.error('Bulk update students error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while bulk updating students',
      error: error.message
    });
  }
};

// @desc    Promote students to next class/stream
// @route   POST /api/students/promote
// @access  Private
exports.promoteStudents = async (req, res) => {
  try {
    const { studentIds, newStreamId, newAcademicYear } = req.body;

    if (!studentIds || !Array.isArray(studentIds) || studentIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please provide an array of student IDs'
      });
    }

    // Verify new stream exists and belongs to teacher
    const newStream = await Stream.findOne({
      _id: newStreamId,
      teacherId: req.user._id
    });

    if (!newStream) {
      return res.status(404).json({
        success: false,
        message: 'New stream not found or you do not have permission'
      });
    }

    // Check if stream has capacity
    const currentStudents = await Student.countDocuments({ 
      streamId: newStreamId,
      status: 'active'
    });
    
    if (currentStudents + studentIds.length > newStream.capacity) {
      return res.status(400).json({
        success: false,
        message: `New stream does not have enough capacity. Available: ${newStream.capacity - currentStudents}`
      });
    }

    // Promote students
    const result = await Student.updateMany(
      { 
        _id: { $in: studentIds },
        teacherId: req.user._id,
        status: 'active'
      },
      {
        streamId: newStreamId,
        classId: newStream.classId,
        academicYear: newAcademicYear || newStream.academicYear,
        updatedBy: req.user._id,
        updatedAt: Date.now(),
        $push: {
          statusHistory: {
            status: 'active',
            reason: 'Promoted to next class',
            remarks: `Promoted to ${newStream.name}`,
            changedBy: req.user._id,
            date: new Date()
          }
        }
      }
    );

    res.status(200).json({
      success: true,
      message: `${result.modifiedCount} students promoted successfully`,
      data: result
    });
    
  } catch (error) {
    console.error('Promote students error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while promoting students',
      error: error.message
    });
  }
};

// @desc    Transfer students to another school
// @route   POST /api/students/transfer
// @access  Private
exports.transferStudents = async (req, res) => {
  try {
    const { studentIds, transferReason, newSchool } = req.body;

    if (!studentIds || !Array.isArray(studentIds) || studentIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please provide an array of student IDs'
      });
    }

    // Transfer students (mark as transferred)
    const result = await Student.updateMany(
      { 
        _id: { $in: studentIds },
        teacherId: req.user._id,
        status: 'active'
      },
      {
        status: 'transferred',
        updatedBy: req.user._id,
        updatedAt: Date.now(),
        $push: {
          statusHistory: {
            status: 'transferred',
            reason: transferReason || 'Transferred to another school',
            remarks: `Transferred to: ${newSchool || 'Unknown school'}`,
            changedBy: req.user._id,
            date: new Date()
          }
        },
        $set: {
          'previousSchool.name': newSchool
        }
      }
    );

    res.status(200).json({
      success: true,
      message: `${result.modifiedCount} students transferred successfully`,
      data: result
    });
    
  } catch (error) {
    console.error('Transfer students error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while transferring students',
      error: error.message
    });
  }
};

// @desc    Get students by stream
// @route   GET /api/students/stream/:streamId
// @access  Private
exports.getStudentsByStream = async (req, res) => {
  try {
    const { streamId } = req.params;
    const { sortBy = 'rollNumber', order = 1, status = 'active' } = req.query;

    // Verify stream belongs to teacher
    const stream = await Stream.findOne({
      _id: streamId,
      teacherId: req.user._id
    });

    if (!stream) {
      return res.status(404).json({
        success: false,
        message: 'Stream not found or you do not have permission'
      });
    }

    const students = await Student.find({ 
      streamId, 
      status,
      teacherId: req.user._id 
    })
    .sort({ [sortBy]: parseInt(order) })
    .select('name regNumber rollNumber gender dateOfBirth status');

    // Get stream statistics
    const stats = await Student.getStreamStats(streamId);

    res.status(200).json({
      success: true,
      count: students.length,
      stats,
      data: students
    });
    
  } catch (error) {
    console.error('Get students by stream error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching students',
      error: error.message
    });
  }
};

// @desc    Get students by class
// @route   GET /api/students/class/:classId
// @access  Private
exports.getStudentsByClass = async (req, res) => {
  try {
    const { classId } = req.params;
    const { status = 'active' } = req.query;

    // Verify class belongs to teacher
    const classDoc = await Class.findOne({
      _id: classId,
      teacherId: req.user._id
    });

    if (!classDoc) {
      return res.status(404).json({
        success: false,
        message: 'Class not found or you do not have permission'
      });
    }

    const students = await Student.find({ 
      classId, 
      status,
      teacherId: req.user._id 
    })
    .populate('streamId', 'name')
    .sort({ 'streamId.name': 1, rollNumber: 1 });

    // Group by stream
    const groupedByStream = students.reduce((acc, student) => {
      const streamName = student.streamId?.name || 'Unassigned';
      if (!acc[streamName]) {
        acc[streamName] = [];
      }
      acc[streamName].push(student);
      return acc;
    }, {});

    res.status(200).json({
      success: true,
      total: students.length,
      groupedByStream,
      data: students
    });
    
  } catch (error) {
    console.error('Get students by class error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching students',
      error: error.message
    });
  }
};

// @desc    Search students
// @route   GET /api/students/search
// @access  Private
exports.searchStudents = async (req, res) => {
  try {
    const { q, limit = 20 } = req.query;

    if (!q) {
      return res.status(400).json({
        success: false,
        message: 'Search query is required'
      });
    }

    const students = await Student.searchStudents(req.user._id, q, parseInt(limit));

    res.status(200).json({
      success: true,
      count: students.length,
      data: students
    });
    
  } catch (error) {
    console.error('Search students error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while searching students',
      error: error.message
    });
  }
};

// @desc    Add disciplinary record
// @route   POST /api/students/:id/disciplinary
// @access  Private
exports.addDisciplinaryRecord = async (req, res) => {
  try {
    const { incident, action, severity, notes } = req.body;

    const student = await Student.findOne({
      _id: req.params.id,
      teacherId: req.user._id
    });

    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    await student.addDisciplinaryRecord({
      incident,
      action,
      severity,
      notes
    }, req.user._id);

    res.status(200).json({
      success: true,
      message: 'Disciplinary record added successfully',
      data: student.disciplinaryRecords
    });
    
  } catch (error) {
    console.error('Add disciplinary record error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while adding disciplinary record',
      error: error.message
    });
  }
};

// @desc    Add achievement
// @route   POST /api/students/:id/achievements
// @access  Private
exports.addAchievement = async (req, res) => {
  try {
    const { title, description, type, certificate } = req.body;

    const student = await Student.findOne({
      _id: req.params.id,
      teacherId: req.user._id
    });

    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    await student.addAchievement({
      title,
      description,
      type,
      certificate
    });

    res.status(200).json({
      success: true,
      message: 'Achievement added successfully',
      data: student.achievements
    });
    
  } catch (error) {
    console.error('Add achievement error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while adding achievement',
      error: error.message
    });
  }
};

// @desc    Update student status
// @route   PATCH /api/students/:id/status
// @access  Private
exports.updateStudentStatus = async (req, res) => {
  try {
    const { status, reason, remarks } = req.body;

    const student = await Student.findOne({
      _id: req.params.id,
      teacherId: req.user._id
    });

    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    await student.updateStatus(status, reason, remarks, req.user._id);

    res.status(200).json({
      success: true,
      message: `Student status updated to ${status}`,
      data: {
        status: student.status,
        statusHistory: student.statusHistory
      }
    });
    
  } catch (error) {
    console.error('Update student status error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating status',
      error: error.message
    });
  }
};

// @desc    Export students to CSV
// @route   GET /api/students/export/csv
// @access  Private
exports.exportStudentsToCSV = async (req, res) => {
  try {
    const { streamId, classId, status = 'active' } = req.query;

    const query = { teacherId: req.user._id, status };
    if (streamId) query.streamId = streamId;
    if (classId) query.classId = classId;

    const students = await Student.find(query)
      .populate('streamId', 'name')
      .populate('classId', 'name')
      .sort({ name: 1 });

    // Create CSV header
    const fields = [
      'Name', 'Registration Number', 'Admission Number', 'Class', 'Stream',
      'Roll Number', 'Gender', 'Date of Birth', 'Age', 'Blood Group',
      'Email', 'Phone', 'Father\'s Name', 'Father\'s Phone', 'Mother\'s Name',
      'Mother\'s Phone', 'Emergency Contact', 'Emergency Phone', 'Status'
    ];

    const csvRows = [];
    csvRows.push(fields.join(','));

    // Add data rows
    for (const student of students) {
      const row = [
        `"${student.name}"`,
        student.regNumber,
        student.admissionNumber || '',
        `"${student.classId?.name || ''}"`,
        `"${student.streamId?.name || ''}"`,
        student.rollNumber || '',
        student.gender || '',
        student.dateOfBirth ? new Date(student.dateOfBirth).toLocaleDateString() : '',
        student.age || '',
        student.bloodGroup || '',
        student.email || '',
        student.phoneNumber || '',
        `"${student.parentInfo?.fatherName || ''}"`,
        student.parentInfo?.fatherPhone || '',
        `"${student.parentInfo?.motherName || ''}"`,
        student.parentInfo?.motherPhone || '',
        `"${student.emergencyContact?.name || ''}"`,
        student.emergencyContact?.phone || '',
        student.status
      ];
      csvRows.push(row.join(','));
    }

    const csvContent = csvRows.join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=students.csv');
    res.status(200).send(csvContent);
    
  } catch (error) {
    console.error('Export students error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while exporting students',
      error: error.message
    });
  }
};

// @desc    Get student statistics
// @route   GET /api/students/stats/overview
// @access  Private
exports.getStudentStats = async (req, res) => {
  try {
    const { academicYear } = req.query;

    const match = { teacherId: req.user._id };
    if (academicYear) match.academicYear = academicYear;

    const stats = await Student.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          totalStudents: { $sum: 1 },
          activeStudents: {
            $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] }
          },
          inactiveStudents: {
            $sum: { $cond: [{ $eq: ['$status', 'inactive'] }, 1, 0] }
          },
          transferredStudents: {
            $sum: { $cond: [{ $eq: ['$status', 'transferred'] }, 1, 0] }
          },
          maleStudents: {
            $sum: { $cond: [{ $eq: ['$gender', 'Male'] }, 1, 0] }
          },
          femaleStudents: {
            $sum: { $cond: [{ $eq: ['$gender', 'Female'] }, 1, 0] }
          },
          newThisYear: {
            $sum: { 
              $cond: [{ $eq: ['$enrollmentType', 'New'] }, 1, 0] 
            }
          }
        }
      },
      {
        $project: {
          _id: 0,
          totalStudents: 1,
          activeStudents: 1,
          inactiveStudents: 1,
          transferredStudents: 1,
          maleStudents: 1,
          femaleStudents: 1,
          newThisYear: 1,
          malePercentage: {
            $multiply: [
              { $divide: ['$maleStudents', '$totalStudents'] },
              100
            ]
          },
          femalePercentage: {
            $multiply: [
              { $divide: ['$femaleStudents', '$totalStudents'] },
              100
            ]
          }
        }
      }
    ]);

    // Get distribution by stream
    const streamDistribution = await Student.aggregate([
      { $match: { ...match, status: 'active' } },
      {
        $group: {
          _id: '$streamId',
          count: { $sum: 1 }
        }
      },
      {
        $lookup: {
          from: 'streams',
          localField: '_id',
          foreignField: '_id',
          as: 'stream'
        }
      },
      {
        $project: {
          streamName: { $arrayElemAt: ['$stream.name', 0] },
          count: 1
        }
      },
      { $sort: { count: -1 } }
    ]);

    res.status(200).json({
      success: true,
      data: {
        overview: stats[0] || {
          totalStudents: 0,
          activeStudents: 0,
          maleStudents: 0,
          femaleStudents: 0
        },
        streamDistribution
      }
    });
    
  } catch (error) {
    console.error('Get student stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching statistics',
      error: error.message
    });
  }
};