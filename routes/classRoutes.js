
const express = require('express');
const router = express.Router();
const {
  protect,
  authorize,
  isTeacher
} = require('../middleware/authMiddleware');
const {
  createClass,
  getAllClasses,
  getClassById,
  updateClass,
  deleteClass,
  permanentDeleteClass,
  getClassSummary,
  getClassesByAcademicYear,
  bulkCreateClasses,
  archiveClass
} = require('../controllers/classController');

// All routes are protected
router.use(protect);
router.use(isTeacher); // Ensure user is a teacher

// Public routes (within teacher's scope)
router.route('/')
  .get(getAllClasses)
  .post(createClass);

router.route('/bulk')
  .post(bulkCreateClasses);

router.route('/year/:academicYear')
  .get(getClassesByAcademicYear);

// Single class routes
router.route('/:id')
  .get(getClassById)
  .put(updateClass)
  .delete(deleteClass);

router.route('/:id/summary')
  .get(getClassSummary);

router.route('/:id/archive')
  .put(archiveClass);

// Admin only routes
router.route('/:id/permanent')
  .delete(authorize('admin', 'superadmin'), permanentDeleteClass);

module.exports = router;