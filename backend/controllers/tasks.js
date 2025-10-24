const Task = require("../models/Task");
const NotificationLog = require("../models/NotificationLog");

exports.updateTask = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;
    const updates = { ...req.body };

    if (updates.repeat === "") {
      updates.repeat = null;
    }

    const existingTask = await Task.findOne({ _id: id, userId });
    if (!existingTask) {
      return res.status(404).json({ message: "Task not found" });
    }

    const oldDue = existingTask.due ? new Date(existingTask.due).getTime() : null;
    const newDue = updates.due ? new Date(updates.due).getTime() : oldDue;

    
    if (
      existingTask.repeat &&
      updates.completed === true &&
      existingTask.completed === false
    ) {
      updates.lastCompletedAt = new Date();
    }

    const updatedTask = await Task.findByIdAndUpdate(id, updates, { new: true });

    
    if (oldDue !== newDue) {
      await NotificationLog.deleteMany({ taskId: updatedTask._id });
    }

    res.json(updatedTask);
  } catch (err) {
    console.error("Update task error:", err);
    res.status(500).json({ message: "Server error" });
  }
};
