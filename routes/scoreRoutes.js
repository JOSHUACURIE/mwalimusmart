// routes/scoreRoutes.js
const express = require('express');
const router = express.Router();
const {
  protect,
  isTeacher
} = require('../middleware/authMiddleware');
const {
  submitScore,
  bulkSubmitScores,
  getAllScores,
  getScoreById,
  updateScore,
  deleteScore,
  getStreamAverage,
  getStudentPerformanceSummary,
  getStreamPerformanceReport,
  getGradeDistribution,
  getPerformanceTrends,
  exportScoresToCSV,
  getScoreStatsDashboard
} = require('../controllers/scoreController');

router.use(protect);
router.use(isTeacher);

router.get('/stats/dashboard', getScoreStatsDashboard);


router.get('/export/csv', exportScoresToCSV);

router.get('/grade-distribution', getGradeDistribution);

router.get('/trends', getPerformanceTrends);


router.route('/')
  .get(getAllScores)
  .post(submitScore);

router.post('/bulk', bulkSubmitScores);


router.get('/stream/:streamId/subject/:subjectId/average', getStreamAverage);

router.get('/stream/:streamId/report', getStreamPerformanceReport);


router.get('/student/:studentId/summary', getStudentPerformanceSummary);


router.route('/:id')
  .get(getScoreById)
  .put(updateScore)
  .delete(deleteScore);

module.exports = router;