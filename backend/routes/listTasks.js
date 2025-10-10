const express = require("express");
const router = express.Router({ mergeParams: true });
const Task = require("../models/Task");
const List = require("../models/List");
const auth = require("../middleware/auth");
const authorizeList = require("../middleware/authorizeList");
const mongoose = require("mongoose");

const Subscription = require("../models/Subscription");
const webpush = require("web-push");

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

    // Get the list to find all members for notifications
    const list = await List.findById(listId);
    if (list) {
      // Get all member user IDs (including the owner)
      const memberIds = [list.owner, ...list.members.map(m => m.userId)];

      //  Emit event via WebSocket to the list room (all connected members)
      const io = req.app.get("io");
      io.to(`list:${listId}`).emit("task:created", task);

      //  Send push notifications to ALL list members
      const subs = await Subscription.find({ userId: { $in: memberIds } });
      const payload = JSON.stringify({
        title: "New Task Added",
        body: `📝 ${task.text} was added to the list`,
      });

      for (const s of subs) {
        try {
          const endpoint = s.subscription.endpoint || "";
          const isFCM = endpoint.includes('fcm.googleapis.com');
          const isWNS = endpoint.includes('notify.windows.com');
          console.log(`📤 Sending notification to ${s.userId} via ${isFCM ? 'FCM' : isWNS ? 'WNS' : 'Unknown'}: ${endpoint}`);

          await webpush.sendNotification(s.subscription, payload);
          console.log("✅ Notification sent to", s.userId);
        } catch (err) {
          console.error(`❌ Push error for ${s.userId}:`, err.statusCode || err.message, err.body || '');
        }
      }
    }

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

    // Get the list to find all members
    const list = await List.findById(listId);
    if (!list) return res.status(404).json({ error: "List not found" });

    // Get all member user IDs (including the owner)
    const memberIds = [list.owner, ...list.members.map(m => m.userId)];

    //  Emit event via WebSocket to the list room (all connected members)
    const io = req.app.get("io");
    io.to(`list:${listId}`).emit("task:updated", task);

    // 🔔 Send push notifications to ALL list members
    const subs = await Subscription.find({ userId: { $in: memberIds } });
    const payload = JSON.stringify({
      title: "Task Updated",
      body: `✏️ ${task.text} was updated`,
    });

    for (const s of subs) {
      try {
        const endpoint = s.subscription.endpoint || "";
        const isFCM = endpoint.includes('fcm.googleapis.com');
        const isWNS = endpoint.includes('notify.windows.com');
        console.log(`📤 Sending notification to ${s.userId} via ${isFCM ? 'FCM' : isWNS ? 'WNS' : 'Unknown'}: ${endpoint}`);

        await webpush.sendNotification(s.subscription, payload);
        console.log("✅ Notification sent to", s.userId);
      } catch (err) {
        console.error(`❌ Push error for ${s.userId}:`, err.statusCode || err.message, err.body || '');
      }
    }

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

    // Get the list to find all members for notifications
    const list = await List.findById(listId);
    if (list) {
      // Get all member user IDs (including the owner)
      const memberIds = [list.owner, ...list.members.map(m => m.userId)];

      //  Emit event via WebSocket to the list room (all connected members)
      const io = req.app.get("io");
      console.log(`📡 Emitting task:deleted for task ${task._id} to list:${listId}`);
      io.to(`list:${listId}`).emit("task:deleted", task._id);

      //  Send push notifications to ALL list members
      const subs = await Subscription.find({ userId: { $in: memberIds } });
      const payload = JSON.stringify({
        title: "Task Deleted",
        body: `🗑️ ${task.text} was removed from the list`,
      });

      for (const s of subs) {
        try {
          const endpoint = s.subscription.endpoint || "";
          const isFCM = endpoint.includes('fcm.googleapis.com');
          const isWNS = endpoint.includes('notify.windows.com');
          console.log(`📤 Sending notification to ${s.userId} via ${isFCM ? 'FCM' : isWNS ? 'WNS' : 'Unknown'}: ${endpoint}`);

          await webpush.sendNotification(s.subscription, payload);
          console.log("✅ Notification sent to", s.userId);
        } catch (err) {
          console.error(`❌ Push error for ${s.userId}:`, err.statusCode || err.message, err.body || '');
        }
      }
    }

    res.json({ success: true });
  } catch (err) {
    console.error("Delete task error:", err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
