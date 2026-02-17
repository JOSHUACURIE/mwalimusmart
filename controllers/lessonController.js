const Lesson = require('../models/Lesson');


exports.createLessonPlan = async (req, res) => {
  try {
    const newPlan = new Lesson({ ...req.body, teacherId: req.user.id });
    await newPlan.save();
    res.status(201).json(newPlan);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.logWorkCovered = async (req, res) => {
  const { lessonId } = req.params;
  const { streamId, remarks } = req.body;

  try {
    const lesson = await Lesson.findOne({ _id: lessonId, teacherId: req.user.id });
    if (!lesson) return res.status(404).json({ msg: "Lesson not found" });

    // Add to deliveryLog array
    lesson.deliveryLogs.push({ streamId, remarks, isCompleted: true });
    await lesson.save();

    res.json({ msg: "Work record updated successfully", lesson });
  } catch (err) {
    res.status(500).send("Server Error");
  }
};