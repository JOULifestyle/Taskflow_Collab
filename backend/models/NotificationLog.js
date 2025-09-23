const mongoose = require("mongoose");

const notificationLogSchema = new mongoose.Schema({
  taskId: { type: mongoose.Schema.Types.ObjectId, ref: "Task", required: true },
  due: { type: Date, required: true },
  stage: { type: String, enum: ["15min", "5min", "0min"], required: true },
  sentAt: { type: Date, default: Date.now }
});
// unique combo so each stage is only sent once per task
notificationLogSchema.index({ taskId: 1, due: 1, stage: 1 }, { unique: true });


// TTL: delete logs automatically 2 days (172800 seconds) after sentAt
notificationLogSchema.index({ sentAt: 1 }, { expireAfterSeconds: 172800 });

module.exports = mongoose.model("NotificationLog", notificationLogSchema);
