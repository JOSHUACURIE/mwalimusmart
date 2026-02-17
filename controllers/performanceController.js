// controllers/scoreController.js
const Score = require('../models/Score');
const Student = require('../models/Student');
const Subject = require('../models/Subject');
const Stream = require('../models/Stream');
const mongoose = require('mongoose');

// @desc    Submit a single score
// @route   POST /api/scores
// @access  Private
exports.submitScore = async (req, res) => {
  try {
    const { 
      studentId, subjectId, streamId, 
      assessment, score, totalPossible,
      isAbsent, remarks 
    } = req.body;

    // Verify student exists and belongs to teacher
    const student = await Student.findOne({
      _id: studentId,
      teacherId: req.user._id
    });

    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found or you do not have permission'
      });
    }

    // Verify subject exists
    const subject = await Subject.findOne({
      _id: subjectId,
      teacherId: req.user._id
    });

    if (!subject) {
      return res.status(404).json({
        success: false,
        message: 'Subject not found or you do not have permission'
      });
    }

    // Check if score already exists for this student/subject/assessment
    const existingScore = await Score.findOne({
      studentId,
      subjectId,
      'assessment.name': assessment.name,
      'assessment.term': assessment.term,
      'assessment.academicYear': assessment.academicYear || student.academicYear
    });

    if (existingScore) {
      return res.status(400).json({
        success: false,
        message: 'Score already exists for this assessment. Use update instead.'
      });
    }

    // Create score
    const scoreData = {
      studentId,
      subjectId,
      streamId: streamId || student.streamId,
      teacherId: req.user._id,
      assessment: {
        name: assessment.name,
        date: assessment.date || Date.now(),
        type: assessment.type || 'Quiz',
        term: assessment.term || 'Term 1',
        academicYear: assessment.academicYear || student.academicYear
      },
      score: isAbsent ? 0 : score,
      totalPossible,
      remarks,
      isAbsent: isAbsent || false
    };

    const newScore = await Score.create(scoreData);

    // Populate for response
    await newScore.populate('studentId', 'name regNumber')
                  .populate('subjectId', 'name code')
                  .populate('streamId', 'name')
                  .execPopulate();

    res.status(201).json({
      success: true,
      data: newScore,
      message: 'Score submitted successfully'
    });

  } catch (error) {
    console.error('Submit score error:', error);
    
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(val => val.message);
      return res.status(400).json({
        success: false,
        message: messages.join(', ')
      });
    }

    res.status(500).json({
      success: false,
      message: 'Server error while submitting score',
      error: error.message
    });
  }
};

// @desc    Bulk submit scores
// @route   POST /api/scores/bulk
// @access  Private
exports.bulkSubmitScores = async (req, res) => {
  try {
    const { 
      subjectId, streamId, assessment,
      scores, defaultTotalPossible 
    } = req.body;

    if (!scores || !Array.isArray(scores) || scores.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please provide an array of scores'
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

    // Verify subject exists
    const subject = await Subject.findOne({
      _id: subjectId,
      teacherId: req.user._id
    });

    if (!subject) {
      return res.status(404).json({
        success: false,
        message: 'Subject not found or you do not have permission'
      });
    }

    // Get all students in the stream
    const students = await Student.find({ 
      streamId, 
      teacherId: req.user._id,
      status: 'active' 
    });

    const studentMap = new Map(students.map(s => [s.regNumber, s]));

    // Prepare scores for bulk operation
    const scoresData = [];
    const errors = [];

    for (const item of scores) {
      try {
        // Find student by regNumber or id
        let student;
        if (item.regNumber) {
          student = studentMap.get(item.regNumber);
        } else if (item.studentId) {
          student = await Student.findOne({
            _id: item.studentId,
            teacherId: req.user._id
          });
        }

        if (!student) {
          errors.push({
            regNumber: item.regNumber || 'unknown',
            error: 'Student not found'
          });
          continue;
        }

        // Check for existing score
        const existingScore = await Score.findOne({
          studentId: student._id,
          subjectId,
          'assessment.name': assessment.name,
          'assessment.term': assessment.term,
          'assessment.academicYear': assessment.academicYear || student.academicYear
        });

        if (existingScore) {
          errors.push({
            regNumber: student.regNumber,
            name: student.name,
            error: 'Score already exists for this assessment'
          });
          continue;
        }

        // Create score data
        scoresData.push({
          studentId: student._id,
          subjectId,
          streamId,
          teacherId: req.user._id,
          assessment: {
            name: assessment.name,
            date: assessment.date || Date.now(),
            type: assessment.type || 'Quiz',
            term: assessment.term || 'Term 1',
            academicYear: assessment.academicYear || student.academicYear
          },
          score: item.isAbsent ? 0 : (item.score || 0),
          totalPossible: item.totalPossible || defaultTotalPossible || 100,
          isAbsent: item.isAbsent || false,
          remarks: item.remarks || '',
          grade: item.grade // Will be auto-calculated by pre-save hook
        });

      } catch (err) {
        errors.push({
          regNumber: item.regNumber || 'unknown',
          error: err.message
        });
      }
    }

    // Bulk insert
    let createdScores = [];
    if (scoresData.length > 0) {
      createdScores = await Score.insertMany(scoresData, { ordered: false });
    }

    // Populate for response
    const populatedScores = await Score.populate(createdScores, [
      { path: 'studentId', select: 'name regNumber' },
      { path: 'subjectId', select: 'name code' },
      { path: 'streamId', select: 'name' }
    ]);

    res.status(201).json({
      success: true,
      message: `${createdScores.length} scores submitted successfully`,
      data: {
        successful: populatedScores,
        errors: errors,
        totalProcessed: scores.length,
        successfulCount: createdScores.length,
        failedCount: errors.length
      }
    });

  } catch (error) {
    console.error('Bulk submit scores error:', error);
    
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Duplicate score entries detected',
        error: error.message
      });
    }

    res.status(500).json({
      success: false,
      message: 'Server error while bulk submitting scores',
      error: error.message
    });
  }
};

// @desc    Get all scores with filtering
// @route   GET /api/scores
// @access  Private
exports.getAllScores = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      sortBy = 'assessment.date',
      order = -1,
      studentId,
      subjectId,
      streamId,
      classId,
      term,
      assessmentName,
      assessmentType,
      academicYear,
      fromDate,
      toDate,
      minScore,
      maxScore,
      grade,
      isAbsent
    } = req.query;

    // Build query
    const query = { teacherId: req.user._id };

    if (studentId) query.studentId = studentId;
    if (subjectId) query.subjectId = subjectId;
    if (streamId) query.streamId = streamId;
    if (classId) query.classId = classId;
    if (term) query['assessment.term'] = term;
    if (assessmentName) query['assessment.name'] = { $regex: assessmentName, $options: 'i' };
    if (assessmentType) query['assessment.type'] = assessmentType;
    if (academicYear) query['assessment.academicYear'] = academicYear;
    if (grade) query.grade = grade;
    if (isAbsent !== undefined) query.isAbsent = isAbsent === 'true';

    // Date range
    if (fromDate || toDate) {
      query['assessment.date'] = {};
      if (fromDate) query['assessment.date'].$gte = new Date(fromDate);
      if (toDate) query['assessment.date'].$lte = new Date(toDate);
    }

    // Score range
    if (minScore || maxScore) {
      query.percentage = {};
      if (minScore) query.percentage.$gte = parseFloat(minScore);
      if (maxScore) query.percentage.$lte = parseFloat(maxScore);
    }

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Execute query
    const scores = await Score.find(query)
      .populate('studentId', 'name regNumber rollNumber')
      .populate('subjectId', 'name code')
      .populate('streamId', 'name')
      .sort({ [sortBy]: parseInt(order) })
      .limit(parseInt(limit))
      .skip(skip);

    // Get total count
    const total = await Score.countDocuments(query);

    // Get summary statistics
    const stats = await Score.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          averageScore: { $avg: '$percentage' },
          highestScore: { $max: '$percentage' },
          lowestScore: { $min: '$percentage' },
          totalAssessments: { $sum: 1 }
        }
      }
    ]);

    res.status(200).json({
      success: true,
      count: scores.length,
      total,
      totalPages: Math.ceil(total / parseInt(limit)),
      currentPage: parseInt(page),
      summary: stats[0] || {
        averageScore: 0,
        highestScore: 0,
        lowestScore: 0,
        totalAssessments: 0
      },
      data: scores
    });

  } catch (error) {
    console.error('Get all scores error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching scores',
      error: error.message
    });
  }
};

// @desc    Get single score by ID
// @route   GET /api/scores/:id
// @access  Private
exports.getScoreById = async (req, res) => {
  try {
    const score = await Score.findOne({
      _id: req.params.id,
      teacherId: req.user._id
    })
    .populate('studentId', 'name regNumber rollNumber dateOfBirth')
    .populate('subjectId', 'name code category')
    .populate('streamId', 'name classId')
    .populate('streamId.classId', 'name academicYear');

    if (!score) {
      return res.status(404).json({
        success: false,
        message: 'Score not found'
      });
    }

    res.status(200).json({
      success: true,
      data: score
    });

  } catch (error) {
    console.error('Get score by ID error:', error);
    
    if (error.kind === 'ObjectId') {
      return res.status(400).json({
        success: false,
        message: 'Invalid score ID'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Server error while fetching score',
      error: error.message
    });
  }
};

// @desc    Update score
// @route   PUT /api/scores/:id
// @access  Private
exports.updateScore = async (req, res) => {
  try {
    const { score, totalPossible, remarks, isAbsent } = req.body;

    let scoreDoc = await Score.findOne({
      _id: req.params.id,
      teacherId: req.user._id
    });

    if (!scoreDoc) {
      return res.status(404).json({
        success: false,
        message: 'Score not found'
      });
    }

    // Update fields
    if (score !== undefined) scoreDoc.score = score;
    if (totalPossible !== undefined) scoreDoc.totalPossible = totalPossible;
    if (remarks !== undefined) scoreDoc.remarks = remarks;
    if (isAbsent !== undefined) scoreDoc.isAbsent = isAbsent;

    // Percentage and grade will be auto-calculated in pre-save
    await scoreDoc.save();

    // Populate for response
    await scoreDoc.populate('studentId', 'name regNumber')
                  .populate('subjectId', 'name code')
                  .populate('streamId', 'name')
                  .execPopulate();

    res.status(200).json({
      success: true,
      data: scoreDoc,
      message: 'Score updated successfully'
    });

  } catch (error) {
    console.error('Update score error:', error);
    
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(val => val.message);
      return res.status(400).json({
        success: false,
        message: messages.join(', ')
      });
    }

    res.status(500).json({
      success: false,
      message: 'Server error while updating score',
      error: error.message
    });
  }
};

// @desc    Delete score
// @route   DELETE /api/scores/:id
// @access  Private
exports.deleteScore = async (req, res) => {
  try {
    const score = await Score.findOne({
      _id: req.params.id,
      teacherId: req.user._id
    });

    if (!score) {
      return res.status(404).json({
        success: false,
        message: 'Score not found'
      });
    }

    await score.remove();

    res.status(200).json({
      success: true,
      message: 'Score deleted successfully'
    });

  } catch (error) {
    console.error('Delete score error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while deleting score',
      error: error.message
    });
  }
};

// @desc    Get stream average (your original function enhanced)
// @route   GET /api/scores/stream/:streamId/subject/:subjectId/average
// @access  Private
exports.getStreamAverage = async (req, res) => {
  try {
    const { streamId, subjectId } = req.params;
    const { term, academicYear } = req.query;

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

    // Find all students in this stream
    const students = await Student.find({ 
      streamId, 
      teacherId: req.user._id,
      status: 'active' 
    });
    
    const studentIds = students.map(s => s._id);

    // Build match criteria
    const match = { 
      studentId: { $in: studentIds }, 
      subjectId: mongoose.Types.ObjectId(subjectId)
    };

    if (term) match['assessment.term'] = term;
    if (academicYear) match['assessment.academicYear'] = academicYear;

    // Aggregate scores
    const stats = await Score.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          averagePercentage: { $avg: '$percentage' },
          medianScore: { $avg: '$percentage' }, // Simple median approximation
          highestScore: { $max: '$percentage' },
          lowestScore: { $min: '$percentage' },
          totalAssessments: { $sum: 1 },
          totalStudents: { $addToSet: '$studentId' },
          passCount: {
            $sum: { 
              $cond: [{ $gte: ['$percentage', 50] }, 1, 0] 
            }
          },
          failCount: {
            $sum: { 
              $cond: [{ $lt: ['$percentage', 50] }, 1, 0] 
            }
          }
        }
      },
      {
        $project: {
          _id: 0,
          averagePercentage: 1,
          medianScore: 1,
          highestScore: 1,
          lowestScore: 1,
          totalAssessments: 1,
          studentCount: { $size: '$totalStudents' },
          passCount: 1,
          failCount: 1,
          passRate: {
            $multiply: [
              { $divide: ['$passCount', { $max: ['$totalAssessments', 1] }] },
              100
            ]
          }
        }
      }
    ]);

    // Get subject info
    const subject = await Subject.findById(subjectId).select('name code passMark');

    res.status(200).json({
      success: true,
      data: {
        stream: {
          id: streamId,
          name: stream.name
        },
        subject: {
          id: subjectId,
          name: subject?.name,
          code: subject?.code,
          passMark: subject?.passMark
        },
        statistics: stats[0] || {
          averagePercentage: 0,
          highestScore: 0,
          lowestScore: 0,
          totalAssessments: 0,
          studentCount: students.length,
          passCount: 0,
          failCount: 0,
          passRate: 0
        }
      }
    });

  } catch (error) {
    console.error('Get stream average error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while calculating stream average',
      error: error.message
    });
  }
};

// @desc    Get student performance summary
// @route   GET /api/scores/student/:studentId/summary
// @access  Private
exports.getStudentPerformanceSummary = async (req, res) => {
  try {
    const { studentId } = req.params;
    const { term, academicYear } = req.query;

    // Verify student belongs to teacher
    const student = await Student.findOne({
      _id: studentId,
      teacherId: req.user._id
    });

    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    // Build match criteria
    const match = { studentId };
    if (term) match['assessment.term'] = term;
    if (academicYear) match['assessment.academicYear'] = academicYear;

    // Get performance by subject
    const subjectPerformance = await Score.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$subjectId',
          averageScore: { $avg: '$percentage' },
          highestScore: { $max: '$percentage' },
          lowestScore: { $min: '$percentage' },
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
          averageScore: 1,
          highestScore: 1,
          lowestScore: 1,
          assessments: 1,
          overallPercentage: {
            $multiply: [
              { $divide: ['$totalScore', '$totalPossible'] },
              100
            ]
          }
        }
      },
      { $sort: { averageScore: -1 } }
    ]);

    // Get overall performance
    const overall = await Score.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          overallAverage: { $avg: '$percentage' },
          totalAssessments: { $sum: 1 },
          totalScore: { $sum: '$score' },
          totalPossible: { $sum: '$totalPossible' },
          aCount: {
            $sum: { $cond: [{ $eq: ['$grade', 'A'] }, 1, 0] }
          },
          bCount: {
            $sum: { $cond: [{ $in: ['$grade', ['B+', 'B', 'B-']] }, 1, 0] }
          },
          cCount: {
            $sum: { $cond: [{ $in: ['$grade', ['C+', 'C', 'C-']] }, 1, 0] }
          },
          dCount: {
            $sum: { $cond: [{ $in: ['$grade', ['D+', 'D', 'D-']] }, 1, 0] }
          },
          eCount: {
            $sum: { $cond: [{ $eq: ['$grade', 'E'] }, 1, 0] }
          },
          fCount: {
            $sum: { $cond: [{ $eq: ['$grade', 'F'] }, 1, 0] }
          }
        }
      },
      {
        $project: {
          overallAverage: 1,
          totalAssessments: 1,
          overallPercentage: {
            $multiply: [
              { $divide: ['$totalScore', '$totalPossible'] },
              100
            ]
          },
          gradeDistribution: {
            A: '$aCount',
            B: '$bCount',
            C: '$cCount',
            D: '$dCount',
            E: '$eCount',
            F: '$fCount'
          }
        }
      }
    ]);

    // Get recent scores
    const recentScores = await Score.find(match)
      .populate('subjectId', 'name code')
      .sort({ 'assessment.date': -1 })
      .limit(10);

    res.status(200).json({
      success: true,
      data: {
        student: {
          id: student._id,
          name: student.name,
          regNumber: student.regNumber,
          stream: student.streamId,
          class: student.classId
        },
        overall: overall[0] || {
          overallAverage: 0,
          totalAssessments: 0,
          overallPercentage: 0,
          gradeDistribution: { A: 0, B: 0, C: 0, D: 0, E: 0, F: 0 }
        },
        subjectPerformance,
        recentScores
      }
    });

  } catch (error) {
    console.error('Get student performance error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching student performance',
      error: error.message
    });
  }
};

// @desc    Get class/stream performance report
// @route   GET /api/scores/stream/:streamId/report
// @access  Private
exports.getStreamPerformanceReport = async (req, res) => {
  try {
    const { streamId } = req.params;
    const { term, academicYear, subjectId } = req.query;

    // Verify stream belongs to teacher
    const stream = await Stream.findOne({
      _id: streamId,
      teacherId: req.user._id
    }).populate('classId', 'name');

    if (!stream) {
      return res.status(404).json({
        success: false,
        message: 'Stream not found'
      });
    }

    // Get all students in stream
    const students = await Student.find({ 
      streamId, 
      status: 'active' 
    }).select('_id name regNumber');

    const studentIds = students.map(s => s._id);

    // Build match criteria
    const match = { 
      studentId: { $in: studentIds },
      streamId
    };
    
    if (term) match['assessment.term'] = term;
    if (academicYear) match['assessment.academicYear'] = academicYear;
    if (subjectId) match.subjectId = mongoose.Types.ObjectId(subjectId);

    // Get overall stream statistics
    const streamStats = await Score.aggregate([
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
      { $sort: { averageScore: -1 } }
    ]);

    // Get grade distribution
    const gradeDistribution = await Score.aggregate([
      { $match: match },
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
        $match: {
          assessments: { $gte: 3 } // At least 3 assessments
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
      { $limit: 10 }
    ]);

    res.status(200).json({
      success: true,
      data: {
        stream: {
          id: stream._id,
          name: stream.name,
          class: stream.classId?.name,
          totalStudents: students.length
        },
        reportPeriod: {
          term: term || 'All Terms',
          academicYear: academicYear || stream.academicYear
        },
        summary: streamStats[0] || {
          averageScore: 0,
          highestScore: 0,
          lowestScore: 0,
          totalAssessments: 0,
          totalStudents: students.length
        },
        subjectPerformance,
        gradeDistribution,
        topStudents
      }
    });

  } catch (error) {
    console.error('Get stream report error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while generating stream report',
      error: error.message
    });
  }
};

// @desc    Get grade distribution
// @route   GET /api/scores/grade-distribution
// @access  Private
exports.getGradeDistribution = async (req, res) => {
  try {
    const { streamId, subjectId, term, academicYear } = req.query;

    const match = { teacherId: req.user._id };
    if (streamId) match.streamId = streamId;
    if (subjectId) match.subjectId = subjectId;
    if (term) match['assessment.term'] = term;
    if (academicYear) match['assessment.academicYear'] = academicYear;

    const distribution = await Score.aggregate([
      { $match: match },
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

    // Calculate percentages
    const total = distribution.reduce((sum, item) => sum + item.count, 0);

    const distributionWithPercentages = distribution.map(item => ({
      ...item,
      percentage: total > 0 ? (item.count / total) * 100 : 0
    }));

    res.status(200).json({
      success: true,
      data: {
        distribution: distributionWithPercentages,
        total
      }
    });

  } catch (error) {
    console.error('Get grade distribution error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching grade distribution',
      error: error.message
    });
  }
};

// @desc    Get performance trends
// @route   GET /api/scores/trends
// @access  Private
exports.getPerformanceTrends = async (req, res) => {
  try {
    const { streamId, subjectId, studentId } = req.query;

    const match = { teacherId: req.user._id };
    if (streamId) match.streamId = streamId;
    if (subjectId) match.subjectId = subjectId;
    if (studentId) match.studentId = studentId;

    // Group by assessment date (monthly)
    const monthlyTrends = await Score.aggregate([
      { $match: match },
      {
        $group: {
          _id: {
            year: { $year: '$assessment.date' },
            month: { $month: '$assessment.date' }
          },
          averageScore: { $avg: '$percentage' },
          assessmentCount: { $sum: 1 }
        }
      },
      {
        $project: {
          period: {
            $concat: [
              { $toString: '$_id.year' },
              '-',
              { $toString: '$_id.month' }
            ]
          },
          year: '$_id.year',
          month: '$_id.month',
          averageScore: 1,
          assessmentCount: 1
        }
      },
      { $sort: { year: 1, month: 1 } }
    ]);

    // Group by assessment type
    const typePerformance = await Score.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$assessment.type',
          averageScore: { $avg: '$percentage' },
          count: { $sum: 1 }
        }
      },
      { $sort: { averageScore: -1 } }
    ]);

    res.status(200).json({
      success: true,
      data: {
        monthlyTrends,
        byAssessmentType: typePerformance
      }
    });

  } catch (error) {
    console.error('Get trends error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching trends',
      error: error.message
    });
  }
};

// @desc    Export scores to CSV
// @route   GET /api/scores/export/csv
// @access  Private
exports.exportScoresToCSV = async (req, res) => {
  try {
    const { streamId, subjectId, term, academicYear } = req.query;

    const match = { teacherId: req.user._id };
    if (streamId) match.streamId = streamId;
    if (subjectId) match.subjectId = subjectId;
    if (term) match['assessment.term'] = term;
    if (academicYear) match['assessment.academicYear'] = academicYear;

    const scores = await Score.find(match)
      .populate('studentId', 'name regNumber rollNumber')
      .populate('subjectId', 'name code')
      .populate('streamId', 'name')
      .sort({ 'assessment.date': -1 });

    // Create CSV header
    const fields = [
      'Student Name', 'Registration Number', 'Roll Number',
      'Subject', 'Assessment Name', 'Assessment Type', 'Term',
      'Date', 'Score', 'Total Possible', 'Percentage', 'Grade',
      'Absent', 'Remarks'
    ];

    const csvRows = [];
    csvRows.push(fields.join(','));

    // Add data rows
    for (const score of scores) {
      const row = [
        `"${score.studentId?.name || ''}"`,
        score.studentId?.regNumber || '',
        score.studentId?.rollNumber || '',
        `"${score.subjectId?.name || ''}"`,
        `"${score.assessment.name}"`,
        score.assessment.type,
        score.assessment.term,
        new Date(score.assessment.date).toLocaleDateString(),
        score.score,
        score.totalPossible,
        score.percentage?.toFixed(2) || '',
        score.grade,
        score.isAbsent ? 'Yes' : 'No',
        `"${score.remarks || ''}"`
      ];
      csvRows.push(row.join(','));
    }

    const csvContent = csvRows.join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=scores.csv');
    res.status(200).send(csvContent);

  } catch (error) {
    console.error('Export scores error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while exporting scores',
      error: error.message
    });
  }
};

// @desc    Get score statistics dashboard
// @route   GET /api/scores/stats/dashboard
// @access  Private
exports.getScoreStatsDashboard = async (req, res) => {
  try {
    const { academicYear } = req.query;

    const match = { teacherId: req.user._id };
    if (academicYear) match['assessment.academicYear'] = academicYear;

    // Overall statistics
    const overallStats = await Score.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          totalScores: { $sum: 1 },
          averageScore: { $avg: '$percentage' },
          highestScore: { $max: '$percentage' },
          lowestScore: { $min: '$percentage' },
          totalStudents: { $addToSet: '$studentId' },
          totalSubjects: { $addToSet: '$subjectId' }
        }
      },
      {
        $project: {
          totalScores: 1,
          averageScore: 1,
          highestScore: 1,
          lowestScore: 1,
          studentCount: { $size: '$totalStudents' },
          subjectCount: { $size: '$totalSubjects' }
        }
      }
    ]);

    // Performance by term
    const termPerformance = await Score.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$assessment.term',
          averageScore: { $avg: '$percentage' },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Recent activity (last 10 scores)
    const recentScores = await Score.find(match)
      .populate('studentId', 'name regNumber')
      .populate('subjectId', 'name code')
      .sort({ createdAt: -1 })
      .limit(10);

    res.status(200).json({
      success: true,
      data: {
        summary: overallStats[0] || {
          totalScores: 0,
          averageScore: 0,
          highestScore: 0,
          lowestScore: 0,
          studentCount: 0,
          subjectCount: 0
        },
        termPerformance,
        recentScores
      }
    });

  } catch (error) {
    console.error('Get score dashboard error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching dashboard',
      error: error.message
    });
  }
};