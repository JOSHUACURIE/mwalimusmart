
const Stream = require('../models/Stream');
const Class = require('../models/Class');
const Student = require('../models/Student');
const LessonPlan = require('../models/Lesson');
const Score = require('../models/Score');
const mongoose = require('mongoose');

exports.createStream = async (req, res) => {
  try {
    const { name, classId, roomNumber, capacity, classTeacher } = req.body;

    // Verify class exists and belongs to teacher
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

    // Check if stream already exists in this class
    const existingStream = await Stream.findOne({
      name,
      classId,
      academicYear: classDoc.academicYear
    });

    if (existingStream) {
      return res.status(400).json({
        success: false,
        message: 'A stream with this name already exists in this class'
      });
    }

    // Create stream
    const stream = await Stream.create({
      name,
      classId,
      teacherId: req.user._id,
      roomNumber,
      capacity: capacity || 40,
      classTeacher: classTeacher || req.user.name,
      academicYear: classDoc.academicYear
    });

    res.status(201).json({
      success: true,
      data: stream,
      message: 'Stream created successfully'
    });

  } catch (error) {
    console.error('Create stream error:', error);
    
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Stream with this name already exists in this class'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Server error while creating stream',
      error: error.message
    });
  }
};


exports.getAllStreams = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      sortBy = 'name',
      order = 1,
      classId,
      academicYear,
      includeInactive = false,
      populate = false
    } = req.query;

    // Build query
    const query = { teacherId: req.user._id };
    
    if (classId) query.classId = classId;
    if (academicYear) query.academicYear = academicYear;
    if (!includeInactive || includeInactive === 'false') {
      query.isActive = true;
    }

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Base query
    let streamsQuery = Stream.find(query)
      .sort({ [sortBy]: parseInt(order) })
      .limit(parseInt(limit))
      .skip(skip);

    // Populate if requested
    if (populate === 'true') {
      streamsQuery = streamsQuery.populate('classId', 'name academicYear');
    }

    const streams = await streamsQuery;

    // Get student counts for each stream
    const streamsWithStats = await Promise.all(
      streams.map(async (stream) => {
        const studentCount = await Student.countDocuments({ 
          streamId: stream._id, 
          status: 'active' 
        });
        
        const lessonCount = await LessonPlan.countDocuments({
          'deliveryRecords.streamId': stream._id
        });

        return {
          ...stream.toObject(),
          studentCount,
          lessonCount,
          occupancyRate: stream.capacity ? (studentCount / stream.capacity) * 100 : 0
        };
      })
    );

    // Get total count for pagination
    const total = await Stream.countDocuments(query);

    res.status(200).json({
      success: true,
      count: streams.length,
      total,
      totalPages: Math.ceil(total / parseInt(limit)),
      currentPage: parseInt(page),
      data: streamsWithStats
    });

  } catch (error) {
    console.error('Get all streams error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching streams',
      error: error.message
    });
  }
};


exports.getStreamById = async (req, res) => {
  try {
    const stream = await Stream.findOne({
      _id: req.params.id,
      teacherId: req.user._id
    }).populate('classId', 'name academicYear');

    if (!stream) {
      return res.status(404).json({
        success: false,
        message: 'Stream not found'
      });
    }

    // Get students in this stream
    const students = await Student.find({ 
      streamId: stream._id, 
      status: 'active' 
    })
    .select('name regNumber rollNumber gender dateOfBirth')
    .sort('rollNumber');

    // Get student count
    const studentCount = students.length;

    // Get lesson plans for this stream
    const lessonPlans = await LessonPlan.find({
      'deliveryRecords.streamId': stream._id
    })
    .select('title subjectId deliveryRecords.$')
    .populate('subjectId', 'name code')
    .limit(10)
    .sort({ 'deliveryRecords.datePlanned': -1 });

    // Get recent performance (last 10 scores)
    const recentScores = await Score.find({ 
      streamId: stream._id 
    })
    .populate('studentId', 'name regNumber')
    .populate('subjectId', 'name')
    .sort({ 'assessment.date': -1 })
    .limit(10);

    res.status(200).json({
      success: true,
      data: {
        ...stream.toObject(),
        students,
        studentCount,
        recentLessonPlans: lessonPlans,
        recentScores,
        occupancyRate: stream.capacity ? (studentCount / stream.capacity) * 100 : 0,
        availableSpaces: stream.capacity ? stream.capacity - studentCount : null
      }
    });

  } catch (error) {
    console.error('Get stream by ID error:', error);
    
    if (error.kind === 'ObjectId') {
      return res.status(400).json({
        success: false,
        message: 'Invalid stream ID'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Server error while fetching stream',
      error: error.message
    });
  }
};


exports.updateStream = async (req, res) => {
  try {
    const { name, roomNumber, capacity, classTeacher, isActive } = req.body;

    // Find stream
    const stream = await Stream.findOne({
      _id: req.params.id,
      teacherId: req.user._id
    });

    if (!stream) {
      return res.status(404).json({
        success: false,
        message: 'Stream not found'
      });
    }

    // If name is being updated, check for duplicates in the same class
    if (name && name !== stream.name) {
      const existingStream = await Stream.findOne({
        name,
        classId: stream.classId,
        academicYear: stream.academicYear,
        _id: { $ne: req.params.id }
      });

      if (existingStream) {
        return res.status(400).json({
          success: false,
          message: 'Another stream with this name already exists in this class'
        });
      }
    }

    // If reducing capacity, check if current students fit
    if (capacity && capacity < stream.capacity) {
      const studentCount = await Student.countDocuments({ 
        streamId: stream._id, 
        status: 'active' 
      });

      if (studentCount > capacity) {
        return res.status(400).json({
          success: false,
          message: `Cannot reduce capacity to ${capacity}. Current enrollment is ${studentCount} students.`
        });
      }
    }

    // Update stream
    const updatedStream = await Stream.findByIdAndUpdate(
      req.params.id,
      {
        name: name || stream.name,
        roomNumber: roomNumber !== undefined ? roomNumber : stream.roomNumber,
        capacity: capacity !== undefined ? capacity : stream.capacity,
        classTeacher: classTeacher !== undefined ? classTeacher : stream.classTeacher,
        isActive: isActive !== undefined ? isActive : stream.isActive,
        updatedAt: Date.now()
      },
      { new: true, runValidators: true }
    ).populate('classId', 'name academicYear');

    res.status(200).json({
      success: true,
      data: updatedStream,
      message: 'Stream updated successfully'
    });

  } catch (error) {
    console.error('Update stream error:', error);
    
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Stream with this name already exists in this class'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Server error while updating stream',
      error: error.message
    });
  }
};


exports.deleteStream = async (req, res) => {
  try {
    const stream = await Stream.findOne({
      _id: req.params.id,
      teacherId: req.user._id
    });

    if (!stream) {
      return res.status(404).json({
        success: false,
        message: 'Stream not found'
      });
    }

    // Check if stream has active students
    const hasActiveStudents = await Student.exists({ 
      streamId: req.params.id, 
      status: 'active' 
    });

    if (hasActiveStudents) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete stream with active students. Transfer or deactivate students first.'
      });
    }

    // Soft delete
    stream.isActive = false;
    await stream.save();

    res.status(200).json({
      success: true,
      message: 'Stream deleted successfully'
    });

  } catch (error) {
    console.error('Delete stream error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while deleting stream',
      error: error.message
    });
  }
};


exports.permanentDeleteStream = async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin' && req.user.role !== 'superadmin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to permanently delete streams'
      });
    }

    const stream = await Stream.findOne({
      _id: req.params.id,
      teacherId: req.user._id
    });

    if (!stream) {
      return res.status(404).json({
        success: false,
        message: 'Stream not found'
      });
    }

    // Check if stream has any students
    const hasStudents = await Student.exists({ streamId: req.params.id });
    
    if (hasStudents) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete stream with existing students. Delete students first.'
      });
    }

    await stream.remove();

    res.status(200).json({
      success: true,
      message: 'Stream permanently deleted'
    });

  } catch (error) {
    console.error('Permanent delete stream error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while permanently deleting stream',
      error: error.message
    });
  }
};


exports.getStreamsByClass = async (req, res) => {
  try {
    const { classId } = req.params;
    const { includeInactive = false } = req.query;

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

    // Build query
    const query = { 
      classId, 
      teacherId: req.user._id 
    };
    
    if (!includeInactive || includeInactive === 'false') {
      query.isActive = true;
    }

    // Get streams
    const streams = await Stream.find(query).sort('name');

    // Get student counts for each stream
    const streamsWithStats = await Promise.all(
      streams.map(async (stream) => {
        const studentCount = await Student.countDocuments({ 
          streamId: stream._id, 
          status: 'active' 
        });
        
        return {
          ...stream.toObject(),
          studentCount,
          availableSpaces: stream.capacity ? stream.capacity - studentCount : null,
          occupancyPercentage: stream.capacity ? (studentCount / stream.capacity) * 100 : 0
        };
      })
    );

    res.status(200).json({
      success: true,
      count: streams.length,
      class: {
        id: classDoc._id,
        name: classDoc.name,
        academicYear: classDoc.academicYear
      },
      data: streamsWithStats
    });

  } catch (error) {
    console.error('Get streams by class error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching streams',
      error: error.message
    });
  }
};


exports.bulkCreateStreams = async (req, res) => {
  try {
    const { classId, streams } = req.body;

    if (!classId) {
      return res.status(400).json({
        success: false,
        message: 'Class ID is required'
      });
    }

    if (!streams || !Array.isArray(streams) || streams.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please provide an array of streams'
      });
    }

    // Verify class exists and belongs to teacher
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

    // Prepare streams data
    const streamsData = streams.map(stream => ({
      name: stream.name,
      classId,
      teacherId: req.user._id,
      roomNumber: stream.roomNumber || '',
      capacity: stream.capacity || 40,
      classTeacher: stream.classTeacher || req.user.name,
      academicYear: classDoc.academicYear
    }));

    // Check for duplicates within the batch
    const streamNames = streamsData.map(s => s.name);
    const uniqueNames = [...new Set(streamNames)];
    
    if (uniqueNames.length !== streamNames.length) {
      return res.status(400).json({
        success: false,
        message: 'Duplicate stream names found in the batch'
      });
    }

    // Check for existing streams
    const existingStreams = await Stream.find({
      classId,
      name: { $in: streamNames }
    });

    if (existingStreams.length > 0) {
      const duplicateNames = existingStreams.map(s => s.name);
      return res.status(400).json({
        success: false,
        message: `Streams already exist: ${duplicateNames.join(', ')}`
      });
    }

    // Bulk insert
    const createdStreams = await Stream.insertMany(streamsData, { 
      ordered: false 
    });

    res.status(201).json({
      success: true,
      count: createdStreams.length,
      data: createdStreams,
      message: `${createdStreams.length} streams created successfully`
    });

  } catch (error) {
    console.error('Bulk create streams error:', error);
    
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Some streams have duplicate names'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Server error while bulk creating streams',
      error: error.message
    });
  }
};


exports.getStreamPerformance = async (req, res) => {
  try {
    const { term, subjectId } = req.query;

    const stream = await Stream.findOne({
      _id: req.params.id,
      teacherId: req.user._id
    });

    if (!stream) {
      return res.status(404).json({
        success: false,
        message: 'Stream not found'
      });
    }

    // Get students in this stream
    const students = await Student.find({ 
      streamId: stream._id, 
      status: 'active' 
    }).select('_id name regNumber');

    const studentIds = students.map(s => s._id);

    // Build match criteria
    const match = {
      streamId: stream._id,
      studentId: { $in: studentIds }
    };

    if (term) {
      match['assessment.term'] = term;
    }

    if (subjectId) {
      match.subjectId = mongoose.Types.ObjectId(subjectId);
    }

    // Get overall stream performance
    const overallStats = await Score.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          averageScore: { $avg: '$percentage' },
          highestScore: { $max: '$percentage' },
          lowestScore: { $min: '$percentage' },
          totalAssessments: { $sum: 1 },
          totalStudents: { $addToSet: '$studentId' }
        }
      },
      {
        $project: {
          averageScore: 1,
          highestScore: 1,
          lowestScore: 1,
          totalAssessments: 1,
          studentCount: { $size: '$totalStudents' }
        }
      }
    ]);

    // Get performance by subject
    const subjectPerformance = await Score.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$subjectId',
          averageScore: { $avg: '$percentage' },
          highestScore: { $max: '$percentage' },
          lowestScore: { $min: '$percentage' },
          assessments: { $sum: 1 }
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
          averageScore: 1,
          highestScore: 1,
          lowestScore: 1,
          assessments: 1
        }
      },
      { $sort: { subjectName: 1 } }
    ]);

    // Get grade distribution
    const gradeDistribution = await Score.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$grade',
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Get top performing students
    const topStudents = await Score.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$studentId',
          averageScore: { $avg: '$percentage' },
          assessments: { $sum: 1 }
        }
      },
      {
        $lookup: {
          from: 'students',
          localField: '_id',
          foreignField: '_id',
          as: 'student'
        }
      },
      {
        $project: {
          studentName: { $arrayElemAt: ['$student.name', 0] },
          regNumber: { $arrayElemAt: ['$student.regNumber', 0] },
          averageScore: 1,
          assessments: 1
        }
      },
      { $sort: { averageScore: -1 } },
      { $limit: 5 }
    ]);

    res.status(200).json({
      success: true,
      data: {
        streamInfo: {
          id: stream._id,
          name: stream.name,
          class: stream.classId
        },
        overall: overallStats[0] || {
          averageScore: 0,
          highestScore: 0,
          lowestScore: 0,
          totalAssessments: 0,
          studentCount: students.length
        },
        subjectPerformance,
        gradeDistribution,
        topStudents
      }
    });

  } catch (error) {
    console.error('Get stream performance error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching stream performance',
      error: error.message
    });
  }
};


exports.getStreamAttendance = async (req, res) => {
  try {
    const { term } = req.query;

    const stream = await Stream.findOne({
      _id: req.params.id,
      teacherId: req.user._id
    });

    if (!stream) {
      return res.status(404).json({
        success: false,
        message: 'Stream not found'
      });
    }

    // Placeholder response - implement when attendance model is added
    res.status(200).json({
      success: true,
      message: 'Attendance tracking will be implemented in the next phase',
      data: {
        streamId: stream._id,
        streamName: stream.name,
        note: 'Attendance module coming soon'
      }
    });

  } catch (error) {
    console.error('Get stream attendance error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching attendance',
      error: error.message
    });
  }
};

exports.transferStudents = async (req, res) => {
  try {
    const { fromStreamId, toStreamId, studentIds, transferReason } = req.body;

    if (!fromStreamId || !toStreamId || !studentIds || !Array.isArray(studentIds) || studentIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please provide fromStreamId, toStreamId, and an array of studentIds'
      });
    }

    // Verify source stream belongs to teacher
    const fromStream = await Stream.findOne({
      _id: fromStreamId,
      teacherId: req.user._id
    });

    if (!fromStream) {
      return res.status(404).json({
        success: false,
        message: 'Source stream not found or you do not have permission'
      });
    }

    // Verify destination stream belongs to teacher
    const toStream = await Stream.findOne({
      _id: toStreamId,
      teacherId: req.user._id
    });

    if (!toStream) {
      return res.status(404).json({
        success: false,
        message: 'Destination stream not found or you do not have permission'
      });
    }

    // Check if destination stream has capacity
    const currentStudents = await Student.countDocuments({ 
      streamId: toStreamId, 
      status: 'active' 
    });

    if (currentStudents + studentIds.length > toStream.capacity) {
      return res.status(400).json({
        success: false,
        message: `Destination stream does not have enough capacity. Available: ${toStream.capacity - currentStudents}`
      });
    }

    // Verify all students exist and belong to source stream
    const students = await Student.find({
      _id: { $in: studentIds },
      streamId: fromStreamId,
      teacherId: req.user._id,
      status: 'active'
    });

    if (students.length !== studentIds.length) {
      return res.status(400).json({
        success: false,
        message: 'Some students were not found in the source stream or are not active'
      });
    }

    // Transfer students
    const result = await Student.updateMany(
      { _id: { $in: studentIds } },
      {
        streamId: toStreamId,
        classId: toStream.classId,
        academicYear: toStream.academicYear,
        updatedBy: req.user._id,
        updatedAt: Date.now(),
        $push: {
          statusHistory: {
            status: 'active',
            reason: transferReason || 'Stream transfer',
            remarks: `Transferred from ${fromStream.name} to ${toStream.name}`,
            changedBy: req.user._id,
            date: new Date()
          }
        }
      }
    );

    res.status(200).json({
      success: true,
      message: `${result.modifiedCount} students transferred successfully from ${fromStream.name} to ${toStream.name}`,
      data: {
        fromStream: fromStream.name,
        toStream: toStream.name,
        studentsTransferred: result.modifiedCount
      }
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

exports.getStreamStats = async (req, res) => {
  try {
    const { academicYear } = req.query;

    const match = { teacherId: req.user._id };
    if (academicYear) match.academicYear = academicYear;

    const stats = await Stream.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          totalStreams: { $sum: 1 },
          activeStreams: {
            $sum: { $cond: [{ $eq: ['$isActive', true] }, 1, 0] }
          },
          totalCapacity: { $sum: '$capacity' },
          averageCapacity: { $avg: '$capacity' }
        }
      }
    ]);

    // Get total students across all streams
    const studentMatch = { teacherId: req.user._id, status: 'active' };
    if (academicYear) studentMatch.academicYear = academicYear;

    const totalStudents = await Student.countDocuments(studentMatch);

    // Get streams with highest occupancy
    const topStreams = await Stream.aggregate([
      { $match: { ...match, isActive: true } },
      {
        $lookup: {
          from: 'students',
          localField: '_id',
          foreignField: 'streamId',
          as: 'students'
        }
      },
      {
        $project: {
          name: 1,
          className: 1,
          capacity: 1,
          studentCount: { $size: '$students' },
          occupancyRate: {
            $multiply: [
              { $divide: [{ $size: '$students' }, '$capacity'] },
              100
            ]
          }
        }
      },
      { $sort: { occupancyRate: -1 } },
      { $limit: 5 }
    ]);

    res.status(200).json({
      success: true,
      data: {
        overview: stats[0] || {
          totalStreams: 0,
          activeStreams: 0,
          totalCapacity: 0,
          averageCapacity: 0
        },
        totalStudents,
        topStreams,
        averageOccupancy: stats[0]?.totalCapacity 
          ? (totalStudents / stats[0].totalCapacity) * 100 
          : 0
      }
    });

  } catch (error) {
    console.error('Get stream stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching stream statistics',
      error: error.message
    });
  }
};


exports.archiveStream = async (req, res) => {
  try {
    const stream = await Stream.findOne({
      _id: req.params.id,
      teacherId: req.user._id
    });

    if (!stream) {
      return res.status(404).json({
        success: false,
        message: 'Stream not found'
      });
    }

    // Check if stream has active students
    const hasActiveStudents = await Student.exists({ 
      streamId: req.params.id, 
      status: 'active' 
    });

    if (hasActiveStudents) {
      return res.status(400).json({
        success: false,
        message: 'Please transfer or graduate all students before archiving'
      });
    }

    // Archive stream
    stream.isActive = false;
    await stream.save();

    res.status(200).json({
      success: true,
      message: 'Stream archived successfully',
      data: stream
    });

  } catch (error) {
    console.error('Archive stream error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while archiving stream',
      error: error.message
    });
  }
};