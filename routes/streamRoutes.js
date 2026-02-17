// routes/streamRoutes.js
const express = require('express');
const router = express.Router();
const {
  protect,
  authorize,
  isTeacher
} = require('../middleware/authMiddleware');
const {
  createStream,
  getAllStreams,
  getStreamById,
  updateStream,
  deleteStream,
  permanentDeleteStream,
  getStreamsByClass,
  bulkCreateStreams,
  getStreamPerformance,
  getStreamAttendance,
  transferStudents,
  getStreamStats,
  archiveStream
} = require('../controllers/streamController');

// All routes are protected
router.use(protect);
router.use(isTeacher); // Ensure user is a teacher

// Public routes (within teacher's scope)
router.route('/')
  .get(getAllStreams)
  .post(createStream);

router.route('/bulk')
  .post(bulkCreateStreams);

router.route('/stats/overview')
  .get(getStreamStats);

router.route('/transfer-students')
  .post(transferStudents);

router.route('/class/:classId')
  .get(getStreamsByClass);

// Single stream routes
router.route('/:id')
  .get(getStreamById)
  .put(updateStream)
  .delete(deleteStream);

router.route('/:id/performance')
  .get(getStreamPerformance);

router.route('/:id/attendance')
  .get(getStreamAttendance);

router.route('/:id/archive')
  .put(archiveStream);

// Admin only routes
router.route('/:id/permanent')
  .delete(authorize('admin', 'superadmin'), permanentDeleteStream);

module.exports = router;