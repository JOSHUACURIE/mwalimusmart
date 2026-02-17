// routes/studentRoutes.js
const express = require('express');
const router = express.Router();
const { protect, isTeacher, authorize } = require('../middleware/authMiddleware');
const {
  createStudent,
  getAllStudents,
  getStudentById,
  updateStudent,
  deleteStudent,
  permanentDeleteStudent,
  getStudentProfile,
  getStudentPerformance,
  bulkCreateStudents,
  bulkUpdateStudents,
  promoteStudents,
  transferStudents,
  getStudentsByStream,
  getStudentsByClass,
  searchStudents,
  addDisciplinaryRecord,
  addAchievement,
  updateStudentStatus,
  exportStudentsToCSV,
  getStudentStats
} = require('../controllers/studentController');

// All routes are protected
router.use(protect);
router.use(isTeacher);

// Statistics route
router.get('/stats/overview', getStudentStats);

// Export route
router.get('/export/csv', exportStudentsToCSV);

// Search route
router.get('/search', searchStudents);

// Bulk operations
router.post('/bulk', bulkCreateStudents);
router.put('/bulk/update', bulkUpdateStudents);

// Promotion and transfer
router.post('/promote', promoteStudents);
router.post('/transfer', transferStudents);

// Get students by stream and class
router.get('/stream/:streamId', getStudentsByStream);
router.get('/class/:classId', getStudentsByClass);

// Main CRUD routes
router.route('/')
  .get(getAllStudents)
  .post(createStudent);

// Single student routes
router.route('/:id')
  .get(getStudentById)
  .put(updateStudent)
  .delete(deleteStudent);

// Student profile and performance
router.get('/:id/profile', getStudentProfile);
router.get('/:id/performance', getStudentPerformance);

// Student status update
router.patch('/:id/status', updateStudentStatus);

// Student achievements and disciplinary
router.post('/:id/disciplinary', addDisciplinaryRecord);
router.post('/:id/achievements', addAchievement);

// Permanent delete (admin only)
router.delete('/:id/permanent', authorize('admin', 'superadmin'), permanentDeleteStudent);

module.exports = router;