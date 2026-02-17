// controllers/lessonController.js
const Lesson = require('../models/Lesson');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

// @desc    Create a new lesson plan
// @route   POST /api/lessons
// @access  Private
exports.createLessonPlan = async (req, res) => {
  try {
    const lessonData = {
      ...req.body,
      teacherId: req.user._id
    };

    const lesson = new Lesson(lessonData);
    await lesson.save();

    // Populate references for response
    await lesson.populate('subjectId', 'name code').populate('classId', 'name').execPopulate();

    res.status(201).json({
      success: true,
      data: lesson,
      message: 'Lesson plan created successfully'
    });
  } catch (err) {
    console.error('Create lesson error:', err);
    
    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map(val => val.message);
      return res.status(400).json({
        success: false,
        message: messages.join(', ')
      });
    }

    res.status(500).json({
      success: false,
      message: 'Server error while creating lesson plan',
      error: err.message
    });
  }
};

// @desc    Get all lesson plans for a teacher
// @route   GET /api/lessons
// @access  Private
exports.getAllLessonPlans = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      order = -1,
      subjectId,
      classId,
      status,
      search
    } = req.query;

    // Build query
    const query = { teacherId: req.user._id };

    if (subjectId) query.subjectId = subjectId;
    if (classId) query.classId = classId;
    if (status) query.status = status;
    
    // Search in title and topic
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { topic: { $regex: search, $options: 'i' } },
        { tags: { $in: [new RegExp(search, 'i')] } }
      ];
    }

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Execute query
    const lessons = await Lesson.find(query)
      .populate('subjectId', 'name code')
      .populate('classId', 'name')
      .sort({ [sortBy]: parseInt(order) })
      .limit(parseInt(limit))
      .skip(skip);

    // Get total count
    const total = await Lesson.countDocuments(query);

    // Add delivery statistics
    const lessonsWithStats = lessons.map(lesson => ({
      ...lesson.toObject(),
      totalDeliveries: lesson.deliveryRecords?.length || 0,
      completedDeliveries: lesson.deliveryRecords?.filter(r => r.status === 'completed').length || 0,
      pendingDeliveries: lesson.deliveryRecords?.filter(r => r.status === 'planned').length || 0
    }));

    res.status(200).json({
      success: true,
      count: lessons.length,
      total,
      totalPages: Math.ceil(total / parseInt(limit)),
      currentPage: parseInt(page),
      data: lessonsWithStats
    });

  } catch (err) {
    console.error('Get all lessons error:', err);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching lesson plans',
      error: err.message
    });
  }
};

// @desc    Get single lesson plan by ID
// @route   GET /api/lessons/:id
// @access  Private
exports.getLessonPlanById = async (req, res) => {
  try {
    const lesson = await Lesson.findOne({
      _id: req.params.id,
      teacherId: req.user._id
    })
    .populate('subjectId', 'name code category')
    .populate('classId', 'name academicYear')
    .populate('deliveryRecords.streamId', 'name roomNumber');

    if (!lesson) {
      return res.status(404).json({
        success: false,
        message: 'Lesson plan not found'
      });
    }

    res.status(200).json({
      success: true,
      data: lesson
    });

  } catch (err) {
    console.error('Get lesson by ID error:', err);
    
    if (err.kind === 'ObjectId') {
      return res.status(400).json({
        success: false,
        message: 'Invalid lesson ID'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Server error while fetching lesson plan',
      error: err.message
    });
  }
};

// @desc    Update lesson plan
// @route   PUT /api/lessons/:id
// @access  Private
exports.updateLessonPlan = async (req, res) => {
  try {
    let lesson = await Lesson.findOne({
      _id: req.params.id,
      teacherId: req.user._id
    });

    if (!lesson) {
      return res.status(404).json({
        success: false,
        message: 'Lesson plan not found'
      });
    }

    // Update lesson
    lesson = await Lesson.findByIdAndUpdate(
      req.params.id,
      { ...req.body, updatedAt: Date.now() },
      { new: true, runValidators: true }
    )
    .populate('subjectId', 'name code')
    .populate('classId', 'name');

    res.status(200).json({
      success: true,
      data: lesson,
      message: 'Lesson plan updated successfully'
    });

  } catch (err) {
    console.error('Update lesson error:', err);
    
    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map(val => val.message);
      return res.status(400).json({
        success: false,
        message: messages.join(', ')
      });
    }

    res.status(500).json({
      success: false,
      message: 'Server error while updating lesson plan',
      error: err.message
    });
  }
};

// @desc    Delete lesson plan (soft delete by changing status)
// @route   DELETE /api/lessons/:id
// @access  Private
exports.deleteLessonPlan = async (req, res) => {
  try {
    const lesson = await Lesson.findOne({
      _id: req.params.id,
      teacherId: req.user._id
    });

    if (!lesson) {
      return res.status(404).json({
        success: false,
        message: 'Lesson plan not found'
      });
    }

    // Soft delete - change status to archived
    lesson.status = 'archived';
    await lesson.save();

    res.status(200).json({
      success: true,
      message: 'Lesson plan archived successfully'
    });

  } catch (err) {
    console.error('Delete lesson error:', err);
    res.status(500).json({
      success: false,
      message: 'Server error while deleting lesson plan',
      error: err.message
    });
  }
};

// @desc    Permanently delete lesson plan
// @route   DELETE /api/lessons/:id/permanent
// @access  Private (Admin only)
exports.permanentDeleteLesson = async (req, res) => {
  try {
    const lesson = await Lesson.findOne({
      _id: req.params.id,
      teacherId: req.user._id
    });

    if (!lesson) {
      return res.status(404).json({
        success: false,
        message: 'Lesson plan not found'
      });
    }

    await lesson.remove();

    res.status(200).json({
      success: true,
      message: 'Lesson plan permanently deleted'
    });

  } catch (err) {
    console.error('Permanent delete error:', err);
    res.status(500).json({
      success: false,
      message: 'Server error while permanently deleting lesson plan',
      error: err.message
    });
  }
};

// @desc    Log work covered (delivery record)
// @route   POST /api/lessons/:id/log-work
// @access  Private
exports.logWorkCovered = async (req, res) => {
  try {
    const { streamId, remarks, dateDelivered, durationActual, homeworkGiven, reflection } = req.body;

    const lesson = await Lesson.findOne({
      _id: req.params.id,
      teacherId: req.user._id
    });

    if (!lesson) {
      return res.status(404).json({
        success: false,
        message: 'Lesson plan not found'
      });
    }

    // Check if already logged for this stream today
    const today = new Date().toDateString();
    const existingRecord = lesson.deliveryRecords?.find(
      r => r.streamId.toString() === streamId && 
           new Date(r.dateDelivered || r.datePlanned).toDateString() === today
    );

    if (existingRecord) {
      return res.status(400).json({
        success: false,
        message: 'Work already logged for this stream today'
      });
    }

    // Add delivery record
    lesson.deliveryRecords.push({
      streamId,
      dateDelivered: dateDelivered || new Date(),
      datePlanned: dateDelivered || new Date(),
      remarks,
      durationActual,
      status: 'completed',
      completionPercentage: 100,
      homeworkGiven,
      reflection,
      studentEngagement: req.body.studentEngagement || 'medium'
    });

    // Update statistics
    await lesson.save();

    // Populate for response
    await lesson.populate('deliveryRecords.streamId', 'name').execPopulate();

    res.status(200).json({
      success: true,
      message: 'Work record logged successfully',
      data: lesson
    });

  } catch (err) {
    console.error('Log work error:', err);
    res.status(500).json({
      success: false,
      message: 'Server error while logging work',
      error: err.message
    });
  }
};

// @desc    Schedule lesson for a stream
// @route   POST /api/lessons/:id/schedule
// @access  Private
exports.scheduleLesson = async (req, res) => {
  try {
    const { streamId, datePlanned } = req.body;

    const lesson = await Lesson.findOne({
      _id: req.params.id,
      teacherId: req.user._id
    });

    if (!lesson) {
      return res.status(404).json({
        success: false,
        message: 'Lesson plan not found'
      });
    }

    // Check if already scheduled for this stream on this date
    const scheduledDate = new Date(datePlanned).toDateString();
    const existing = lesson.deliveryRecords?.find(
      r => r.streamId.toString() === streamId && 
           new Date(r.datePlanned).toDateString() === scheduledDate
    );

    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'Lesson already scheduled for this stream on the specified date'
      });
    }

    // Schedule lesson
    lesson.deliveryRecords.push({
      streamId,
      datePlanned: new Date(datePlanned),
      status: 'planned',
      completionPercentage: 0
    });

    await lesson.save();

    res.status(200).json({
      success: true,
      message: 'Lesson scheduled successfully',
      data: lesson
    });

  } catch (err) {
    console.error('Schedule lesson error:', err);
    res.status(500).json({
      success: false,
      message: 'Server error while scheduling lesson',
      error: err.message
    });
  }
};

// @desc    Get lesson plans by subject
// @route   GET /api/lessons/subject/:subjectId
// @access  Private
exports.getLessonsBySubject = async (req, res) => {
  try {
    const { subjectId } = req.params;
    const { status } = req.query;

    const query = {
      teacherId: req.user._id,
      subjectId
    };

    if (status) query.status = status;

    const lessons = await Lesson.find(query)
      .populate('subjectId', 'name code')
      .populate('classId', 'name')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: lessons.length,
      data: lessons
    });

  } catch (err) {
    console.error('Get lessons by subject error:', err);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching lessons',
      error: err.message
    });
  }
};

// @desc    Get lesson plans by class
// @route   GET /api/lessons/class/:classId
// @access  Private
exports.getLessonsByClass = async (req, res) => {
  try {
    const { classId } = req.params;
    const { status } = req.query;

    const query = {
      teacherId: req.user._id,
      classId
    };

    if (status) query.status = status;

    const lessons = await Lesson.find(query)
      .populate('subjectId', 'name code')
      .populate('classId', 'name')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: lessons.length,
      data: lessons
    });

  } catch (err) {
    console.error('Get lessons by class error:', err);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching lessons',
      error: err.message
    });
  }
};

// @desc    Get upcoming lessons
// @route   GET /api/lessons/upcoming
// @access  Private
exports.getUpcomingLessons = async (req, res) => {
  try {
    const { days = 7 } = req.query;

    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + parseInt(days));

    const lessons = await Lesson.find({
      teacherId: req.user._id,
      'deliveryRecords': {
        $elemMatch: {
          datePlanned: { $gte: startDate, $lte: endDate },
          status: 'planned'
        }
      }
    })
    .populate('subjectId', 'name code')
    .populate('classId', 'name')
    .populate('deliveryRecords.streamId', 'name');

    // Filter and format delivery records
    const upcoming = lessons.map(lesson => {
      const upcomingDeliveries = lesson.deliveryRecords.filter(
        r => r.status === 'planned' && 
             r.datePlanned >= startDate && 
             r.datePlanned <= endDate
      );
      
      return {
        ...lesson.toObject(),
        upcomingDeliveries
      };
    });

    res.status(200).json({
      success: true,
      count: upcoming.length,
      data: upcoming
    });

  } catch (err) {
    console.error('Get upcoming lessons error:', err);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching upcoming lessons',
      error: err.message
    });
  }
};

// @desc    Get lesson statistics
// @route   GET /api/lessons/stats/overview
// @access  Private
exports.getLessonStats = async (req, res) => {
  try {
    const { subjectId, classId } = req.query;

    const match = { teacherId: req.user._id };
    if (subjectId) match.subjectId = subjectId;
    if (classId) match.classId = classId;

    const stats = await Lesson.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          totalLessons: { $sum: 1 },
          draftLessons: {
            $sum: { $cond: [{ $eq: ['$status', 'draft'] }, 1, 0] }
          },
          publishedLessons: {
            $sum: { $cond: [{ $eq: ['$status', 'published'] }, 1, 0] }
          },
          archivedLessons: {
            $sum: { $cond: [{ $eq: ['$status', 'archived'] }, 1, 0] }
          }
        }
      }
    ]);

    // Get delivery statistics
    const deliveryStats = await Lesson.aggregate([
      { $match: match },
      { $unwind: '$deliveryRecords' },
      {
        $group: {
          _id: null,
          totalDeliveries: { $sum: 1 },
          completedDeliveries: {
            $sum: { $cond: [{ $eq: ['$deliveryRecords.status', 'completed'] }, 1, 0] }
          },
          plannedDeliveries: {
            $sum: { $cond: [{ $eq: ['$deliveryRecords.status', 'planned'] }, 1, 0] }
          }
        }
      }
    ]);

    // Get lessons by subject
    const lessonsBySubject = await Lesson.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$subjectId',
          count: { $sum: 1 }
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
          count: 1
        }
      },
      { $sort: { count: -1 } },
      { $limit: 5 }
    ]);

    res.status(200).json({
      success: true,
      data: {
        lessonStats: stats[0] || { totalLessons: 0, draftLessons: 0, publishedLessons: 0 },
        deliveryStats: deliveryStats[0] || { totalDeliveries: 0, completedDeliveries: 0, plannedDeliveries: 0 },
        popularSubjects: lessonsBySubject
      }
    });

  } catch (err) {
    console.error('Get lesson stats error:', err);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching statistics',
      error: err.message
    });
  }
};

// @desc    Export lesson plan to PDF
// @route   GET /api/lessons/:id/export/pdf
// @access  Private
exports.exportLessonToPDF = async (req, res) => {
  try {
    const lesson = await Lesson.findOne({
      _id: req.params.id,
      teacherId: req.user._id
    })
    .populate('subjectId', 'name code')
    .populate('classId', 'name academicYear')
    .populate('deliveryRecords.streamId', 'name');

    if (!lesson) {
      return res.status(404).json({
        success: false,
        message: 'Lesson plan not found'
      });
    }

    // Create PDF document
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    
    // Set response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=lesson-${lesson.title.replace(/\s+/g, '-').toLowerCase()}.pdf`);

    // Pipe PDF to response
    doc.pipe(res);

    // Add content to PDF
    // Header
    doc.fontSize(20).font('Helvetica-Bold').text('Lesson Plan', { align: 'center' });
    doc.moveDown();
    
    // School info
    doc.fontSize(12).font('Helvetica').text(`Teacher: ${req.user.name}`);
    doc.text(`School: ${req.user.schoolName || 'Not specified'}`);
    doc.text(`Date: ${new Date().toLocaleDateString()}`);
    doc.moveDown();

    // Lesson details
    doc.fontSize(14).font('Helvetica-Bold').text('Lesson Details');
    doc.moveDown(0.5);
    
    doc.fontSize(12).font('Helvetica');
    doc.text(`Title: ${lesson.title}`);
    doc.text(`Topic: ${lesson.topic || 'N/A'}`);
    doc.text(`Subject: ${lesson.subjectId?.name} (${lesson.subjectId?.code})`);
    doc.text(`Class: ${lesson.classId?.name}`);
    doc.text(`Duration: ${lesson.duration?.plannedMinutes} minutes (${lesson.duration?.periodsRequired} periods)`);
    doc.moveDown();

    // Learning Objectives
    if (lesson.learningObjectives && lesson.learningObjectives.length > 0) {
      doc.fontSize(14).font('Helvetica-Bold').text('Learning Objectives');
      doc.moveDown(0.5);
      doc.fontSize(12).font('Helvetica');
      lesson.learningObjectives.forEach((obj, index) => {
        doc.text(`${index + 1}. ${obj}`);
      });
      doc.moveDown();
    }

    // Materials Needed
    if (lesson.materialsNeeded && lesson.materialsNeeded.length > 0) {
      doc.fontSize(14).font('Helvetica-Bold').text('Materials Needed');
      doc.moveDown(0.5);
      doc.fontSize(12).font('Helvetica');
      lesson.materialsNeeded.forEach(material => {
        if (typeof material === 'string') {
          doc.text(`• ${material}`);
        } else {
          doc.text(`• ${material.item} ${material.quantity ? `(x${material.quantity})` : ''}`);
        }
      });
      doc.moveDown();
    }

    // Procedure
    if (lesson.procedure) {
      doc.fontSize(14).font('Helvetica-Bold').text('Lesson Procedure');
      doc.moveDown(0.5);
      doc.fontSize(12).font('Helvetica');
      
      if (lesson.procedure.introduction) {
        doc.fontSize(12).font('Helvetica-Bold').text('Introduction:');
        doc.fontSize(12).font('Helvetica').text(lesson.procedure.introduction);
        doc.moveDown(0.5);
      }

      if (lesson.procedure.mainActivities && lesson.procedure.mainActivities.length > 0) {
        doc.fontSize(12).font('Helvetica-Bold').text('Main Activities:');
        lesson.procedure.mainActivities.forEach(activity => {
          doc.fontSize(12).font('Helvetica').text(`Step ${activity.step}: ${activity.description}`);
          if (activity.duration) doc.text(`Duration: ${activity.duration} minutes`);
          doc.moveDown(0.3);
        });
      }

      if (lesson.procedure.conclusion) {
        doc.fontSize(12).font('Helvetica-Bold').text('Conclusion:');
        doc.fontSize(12).font('Helvetica').text(lesson.procedure.conclusion);
        doc.moveDown();
      }
    }

    // Assessment
    if (lesson.assessment) {
      doc.fontSize(14).font('Helvetica-Bold').text('Assessment');
      doc.moveDown(0.5);
      doc.fontSize(12).font('Helvetica');
      
      if (lesson.assessment.formative && lesson.assessment.formative.length > 0) {
        doc.text('Formative Assessment:');
        lesson.assessment.formative.forEach(assessment => {
          doc.text(`• ${assessment.type}: ${assessment.description || ''}`);
        });
      }
      
      if (lesson.assessment.sumulative) {
        doc.text(`Summative Assessment: ${lesson.assessment.sumulative}`);
      }
      
      if (lesson.assessment.successCriteria && lesson.assessment.successCriteria.length > 0) {
        doc.text('Success Criteria:');
        lesson.assessment.successCriteria.forEach(criteria => {
          doc.text(`• ${criteria}`);
        });
      }
      doc.moveDown();
    }

    // Delivery Records
    if (lesson.deliveryRecords && lesson.deliveryRecords.length > 0) {
      doc.fontSize(14).font('Helvetica-Bold').text('Delivery Records');
      doc.moveDown(0.5);
      doc.fontSize(12).font('Helvetica');
      
      lesson.deliveryRecords.forEach((record, index) => {
        doc.text(`Delivery ${index + 1}:`);
        doc.text(`  Stream: ${record.streamId?.name || 'Unknown'}`);
        doc.text(`  Date Planned: ${new Date(record.datePlanned).toLocaleDateString()}`);
        if (record.dateDelivered) {
          doc.text(`  Date Delivered: ${new Date(record.dateDelivered).toLocaleDateString()}`);
        }
        doc.text(`  Status: ${record.status}`);
        if (record.teacherRemarks) {
          doc.text(`  Remarks: ${record.teacherRemarks}`);
        }
        if (record.studentEngagement) {
          doc.text(`  Engagement: ${record.studentEngagement}`);
        }
        doc.moveDown(0.3);
      });
    }

    // Footer
    doc.moveDown(2);
    doc.fontSize(10).font('Helvetica').text(
      `Generated by EduLog Pro on ${new Date().toLocaleString()}`,
      { align: 'center' }
    );

    // Finalize PDF
    doc.end();

  } catch (err) {
    console.error('Export PDF error:', err);
    res.status(500).json({
      success: false,
      message: 'Server error while exporting to PDF',
      error: err.message
    });
  }
};

// @desc    Export lesson plan to simple text format
// @route   GET /api/lessons/:id/export/text
// @access  Private
exports.exportLessonToText = async (req, res) => {
  try {
    const lesson = await Lesson.findOne({
      _id: req.params.id,
      teacherId: req.user._id
    })
    .populate('subjectId', 'name code')
    .populate('classId', 'name');

    if (!lesson) {
      return res.status(404).json({
        success: false,
        message: 'Lesson plan not found'
      });
    }

    // Create text content
    let textContent = '';
    textContent += '='.repeat(60) + '\n';
    textContent += 'LESSON PLAN\n';
    textContent += '='.repeat(60) + '\n\n';
    
    textContent += `Teacher: ${req.user.name}\n`;
    textContent += `School: ${req.user.schoolName || 'Not specified'}\n`;
    textContent += `Date: ${new Date().toLocaleDateString()}\n\n`;
    
    textContent += 'LESSON DETAILS\n';
    textContent += '-'.repeat(40) + '\n';
    textContent += `Title: ${lesson.title}\n`;
    textContent += `Topic: ${lesson.topic || 'N/A'}\n`;
    textContent += `Subject: ${lesson.subjectId?.name} (${lesson.subjectId?.code})\n`;
    textContent += `Class: ${lesson.classId?.name}\n`;
    textContent += `Duration: ${lesson.duration?.plannedMinutes} minutes\n\n`;
    
    if (lesson.learningObjectives && lesson.learningObjectives.length > 0) {
      textContent += 'LEARNING OBJECTIVES\n';
      textContent += '-'.repeat(40) + '\n';
      lesson.learningObjectives.forEach((obj, index) => {
        textContent += `${index + 1}. ${obj}\n`;
      });
      textContent += '\n';
    }
    
    if (lesson.materialsNeeded && lesson.materialsNeeded.length > 0) {
      textContent += 'MATERIALS NEEDED\n';
      textContent += '-'.repeat(40) + '\n';
      lesson.materialsNeeded.forEach(material => {
        if (typeof material === 'string') {
          textContent += `• ${material}\n`;
        } else {
          textContent += `• ${material.item} ${material.quantity ? `(x${material.quantity})` : ''}\n`;
        }
      });
      textContent += '\n';
    }
    
    if (lesson.procedure) {
      textContent += 'PROCEDURE\n';
      textContent += '-'.repeat(40) + '\n';
      
      if (lesson.procedure.introduction) {
        textContent += 'INTRODUCTION:\n';
        textContent += `${lesson.procedure.introduction}\n\n`;
      }
      
      if (lesson.procedure.mainActivities && lesson.procedure.mainActivities.length > 0) {
        textContent += 'MAIN ACTIVITIES:\n';
        lesson.procedure.mainActivities.forEach(activity => {
          textContent += `Step ${activity.step}: ${activity.description}\n`;
          if (activity.duration) textContent += `Duration: ${activity.duration} minutes\n`;
          textContent += '\n';
        });
      }
      
      if (lesson.procedure.conclusion) {
        textContent += 'CONCLUSION:\n';
        textContent += `${lesson.procedure.conclusion}\n`;
      }
    }

    // Set response headers
    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Content-Disposition', `attachment; filename=lesson-${lesson.title.replace(/\s+/g, '-').toLowerCase()}.txt`);
    
    res.status(200).send(textContent);

  } catch (err) {
    console.error('Export text error:', err);
    res.status(500).json({
      success: false,
      message: 'Server error while exporting to text',
      error: err.message
    });
  }
};