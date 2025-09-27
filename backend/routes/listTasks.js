const express = require("express");
const router = express.Router({ mergeParams: true });
const Task = require("../models/Task");
const auth = require("../middleware/auth");
const authorizeList = require("../middleware/authorizeList");
const mongoose = require("mongoose");

// Get all tasks in a list
router.get("/", auth, authorizeList("viewer"), async (req, res) => {
  try {
    const listId = new mongoose.Types.ObjectId(req.params.listId);
    const tasks = await Task.find({ listId });
    res.json(tasks);
  } catch (err) {
    console.error("Get tasks error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Add a task
router.post("/", auth, authorizeList("editor"), async (req, res) => {
  try {
    console.log("👉 Params:", req.params);
    console.log("👉 Body:", req.body);

    const listId = new mongoose.Types.ObjectId(req.params.listId);

    const repeat =
      req.body.repeat && req.body.repeat.trim() !== "" ? req.body.repeat : null;

    // Strip listId if frontend sends it
    const { listId: ignoreListId, ...body } = req.body;

    const lastTask = await Task.findOne({ listId }).sort({ order: -1 }).exec();
    const nextOrder = lastTask ? lastTask.order + 1 : 1;

    const task = new Task({
      ...body,
      repeat,
      listId, // enforce correct listId
      userId: req.user.id,
      order: nextOrder,
    });

    await task.save();
     console.log("✅ Task created in DB:", task);
    res.json(task);
  } catch (err) {
    console.error("Create task error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Update task
router.put("/:taskId", auth, authorizeList("editor"), async (req, res) => {
  try {
    const listId = new mongoose.Types.ObjectId(req.params.listId);

    // Strip listId if frontend sends it
    const { listId: ignoreListId, ...updateData } = req.body;

    // Normalize repeat if provided
    if (
      Object.prototype.hasOwnProperty.call(updateData, "repeat") &&
      (!updateData.repeat || updateData.repeat.trim() === "")
    ) {
      updateData.repeat = null;
    }

    const task = await Task.findOneAndUpdate(
      { _id: req.params.taskId, listId }, // enforce listId filter
      updateData,
      { new: true }
    );

    if (!task) return res.status(404).json({ error: "Task not found" });
    res.json(task);
  } catch (err) {
    console.error("Update task error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Delete task
router.delete("/:taskId", auth, authorizeList("editor"), async (req, res) => {
  try {
    const listId = new mongoose.Types.ObjectId(req.params.listId);

    const task = await Task.findOneAndDelete({
      _id: req.params.taskId,
      listId, // enforce correct listId
    });

    if (!task) return res.status(404).json({ error: "Task not found" });
    res.json({ success: true });
  } catch (err) {
    console.error("Delete task error:", err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
