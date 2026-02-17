
const express = require('express');
const router = express.Router();
const {
  protect,
  isTeacher
} = require('../middleware/authMiddleware');
const {
  createLessonPlan,
  getAllLessonPlans,
  getLessonPlanById,
  updateLessonPlan,
  deleteLessonPlan,
  permanentDeleteLesson,
  logWorkCovered,
  scheduleLesson,
  getLessonsBySubject,
  getLessonsByClass,
  getUpcomingLessons,
  getLessonStats,
  exportLessonToPDF,
  exportLessonToText
} = require('../controllers/lessonController');


router.use(protect);
router.use(isTeacher);


router.get('/stats/overview', getLessonStats);


router.get('/upcoming', getUpcomingLessons);

router.route('/')
  .get(getAllLessonPlans)
  .post(createLessonPlan);


router.get('/subject/:subjectId', getLessonsBySubject);
router.get('/class/:classId', getLessonsByClass);


router.route('/:id')
  .get(getLessonPlanById)
  .put(updateLessonPlan)
  .delete(deleteLessonPlan);


router.post('/:id/log-work', logWorkCovered);
router.post('/:id/schedule', scheduleLesson);


router.get('/:id/export/pdf', exportLessonToPDF);
router.get('/:id/export/text', exportLessonToText);


router.delete('/:id/permanent', protect, isTeacher, permanentDeleteLesson);

module.exports = router;