const Performance = require('../models/Performance');
const Student = require('../models/Student');

exports.getStreamAverage = async (req, res) => {
  const { streamId, subjectId } = req.params;

  try {
    // 1. Find all students in this stream
    const students = await Student.find({ streamId, teacherId: req.user.id });
    const studentIds = students.map(s => s._id);

    // 2. Aggregate scores for these students in this subject
    const stats = await Performance.aggregate([
      { $match: { 
          studentId: { $in: studentIds }, 
          subjectId: mongoose.Types.ObjectId(subjectId) 
      }},
      { $group: {
          _id: "$subjectId",
          averagePercentage: { $avg: "$percentage" },
          totalAssessments: { $sum: 1 }
      }}
    ]);

    res.json(stats[0] || { msg: "No data found for this stream" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};