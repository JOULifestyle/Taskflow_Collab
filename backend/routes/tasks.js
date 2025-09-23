const express = require("express");
const jwt = require("jsonwebtoken");
const Task = require("../models/Task");
const taskController = require("../controllers/tasks");

const router = express.Router();

// Middleware to check JWT
const authMiddleware = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Unauthorized" });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.id;
    next();
  } catch (err) {
    console.error("JWT error:", err);
    res.status(401).json({ error: "Invalid token" });
  }
};

// GET /tasks
router.get("/", authMiddleware, async (req, res) => {
  try {
    const tasks = await Task.find({ userId: req.userId }).sort({ order: 1 });
    res.json(tasks);
  } catch (err) {
    console.error("Fetch tasks error:", err);
    res.status(500).json({ error: "Failed to fetch tasks" });
  }
});

// POST /tasks
router.post("/", authMiddleware, async (req, res) => {
  try {
    const { text, due, repeat, priority, category, order } = req.body;

    const task = new Task({
      text,
      due: due || null,
      repeat: repeat || null,
      priority: priority || "medium",
      category: category || "General",
      order: order || 0,
      userId: req.userId,
    });

    await task.save();
    res.json(task);
  } catch (err) {
    console.error("Create task error:", err);
    res.status(500).json({ error: "Failed to create task" });
  }
});

// PUT /tasks/reorder
router.put("/reorder", authMiddleware, async (req, res) => {
  const { orderedIds } = req.body;

  if (!Array.isArray(orderedIds)) {
    return res.status(400).json({ error: "Invalid orderedIds" });
  }

  try {
    for (let i = 0; i < orderedIds.length; i++) {
      await Task.findOneAndUpdate(
        { _id: orderedIds[i], userId: req.userId },
        { order: i }
      );
    }

    const tasks = await Task.find({ userId: req.userId }).sort({ order: 1 });
    res.json(tasks);
  } catch (err) {
    console.error("Reorder tasks error:", err);
    res.status(500).json({ error: "Failed to reorder tasks" });
  }
});


// PUT /tasks/:id uses controller (with NotificationLog clearing)
router.put("/:id", authMiddleware, (req, res) => {
  taskController.updateTask(req, res);
});

// DELETE /tasks/:id
router.delete("/:id", authMiddleware, async (req, res) => {
  try {
    const deleted = await Task.findOneAndDelete({
      _id: req.params.id,
      userId: req.userId,
    });

    if (!deleted) {
      return res.status(404).json({ error: "Task not found" });
    }

    res.json({ message: "Deleted" });
  } catch (err) {
    console.error("Delete task error:", err);
    res.status(500).json({ error: "Failed to delete task" });
  }
});

module.exports = router;
