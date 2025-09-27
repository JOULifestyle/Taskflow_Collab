const mongoose = require("mongoose");

const taskSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  listId: { type: mongoose.Schema.Types.ObjectId, ref: "List", required: true },
  text: { type: String, required: true },
  completed: { type: Boolean, default: false },
  due: { type: Date, default: null },
  notified: { type: Boolean, default: false },
  priority: { type: String, default: "medium" },
  category: { type: String, default: "General" },
  repeat: { 
    type: String, 
    enum: ["daily", "weekly", "monthly", null], 
    default: null 
  },
  lastCompletedAt: { type: Date, default: null }, 
  createdAt: { type: Date, default: Date.now },
  order: { type: Number, default: 0 },
});

module.exports = mongoose.model("Task", taskSchema);
