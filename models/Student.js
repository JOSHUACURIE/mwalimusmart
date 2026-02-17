const StudentSchema = new mongoose.Schema({
  name: { type: String, required: true },
  regNumber: { type: String, required: true, unique: true },
  streamId: { type: mongoose.Schema.Types.ObjectId, ref: 'Stream', required: true },
  teacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
});