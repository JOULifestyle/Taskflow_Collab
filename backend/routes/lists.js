const express = require("express");
const router = express.Router();
const List = require("../models/List");
const auth = require("../middleware/auth");
const authorizeList = require("../middleware/authorizeList");
const Task = require("../models/Task");
const NotificationLog = require("../models/NotificationLog");


// Create a new list
router.post("/", auth, async (req, res) => {
  try {
    const list = new List({
      name: req.body.name,
      owner: req.user.id,
      members: [{ userId: req.user.id, role: "owner" }],
    });
    await list.save();
    res.json(list);
  } catch (err) {
    console.error("Create list error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Get lists user belongs to
router.get("/", auth, async (req, res) => {
  try {
    const lists = await List.find({ "members.userId": req.user.id });
    res.json(lists);
  } catch (err) {
    console.error("Get lists error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Add or update a member's role
router.post("/:listId/members", auth, authorizeList("owner"), async (req, res) => {
  try {
    const { userId, role } = req.body;

    if (!userId || !role) {
      return res.status(400).json({ error: "userId and role are required" });
    }

    const roles = ["viewer", "editor", "owner"];
    if (!roles.includes(role)) {
      return res.status(400).json({ error: "Invalid role" });
    }

    // prevent owner from being reassigned
    if (String(req.list.owner) === String(userId)) {
      return res.status(400).json({ error: "Owner role cannot be changed" });
    }

    const member = req.list.members.find(
      (m) => String(m.userId) === String(userId)
    );

    if (member) {
      member.role = role; // update role if already exists
    } else {
      req.list.members.push({ userId, role });
    }

    await req.list.save();
    res.json(req.list);
  } catch (err) {
    console.error("Add member error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Get members of a list
router.get("/:listId/members", auth, authorizeList("viewer"), async (req, res) => {
  try {
    res.json(req.list.members);
  } catch (err) {
    console.error("Get members error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Share a list with another user
router.post("/:listId/share", auth, authorizeList("owner"), async (req, res) => {
  try {
    const { userId, role } = req.body;

    if (!userId || !role) {
      return res.status(400).json({ error: "userId and role required" });
    }

    const roles = ["viewer", "editor"];
    if (!roles.includes(role)) {
      return res.status(400).json({ error: "Role must be viewer or editor" });
    }

    // prevent re-assigning owner
    if (String(req.list.owner) === String(userId)) {
      return res.status(400).json({ error: "Owner cannot be re-assigned" });
    }

    const existing = req.list.members.find(
      (m) => String(m.userId) === String(userId)
    );

    if (existing) {
      existing.role = role; // update
    } else {
      req.list.members.push({ userId, role });
    }

    await req.list.save();

    // 🚀 emit real-time event to all sockets in that list
    req.io?.to(`list:${req.list._id}`).emit("list:shared", {
      listId: req.list._id,
      userId,
      role,
    });

    res.json(req.list);
  } catch (err) {
    console.error("Share list error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Delete a member from a list
router.delete(
  "/:listId/members/:userId",
  auth,
  authorizeList("owner"),
  async (req, res) => {
    try {
      const { userId } = req.params;

      // prevent removing the owner
      if (String(req.list.owner) === String(userId)) {
        return res.status(400).json({ error: "Owner cannot be removed" });
      }

      // filter out the user
      const beforeCount = req.list.members.length;
      req.list.members = req.list.members.filter(
        (m) => String(m.userId) !== String(userId)
      );

      if (req.list.members.length === beforeCount) {
        return res.status(404).json({ error: "User not found in list" });
      }

      await req.list.save();

      // 🚀 emit real-time event
      req.io?.to(`list:${req.list._id}`).emit("list:memberRemoved", {
        listId: req.list._id,
        userId,
      });

      res.json({ success: true, members: req.list.members });
    } catch (err) {
      console.error("Remove member error:", err);
      res.status(500).json({ error: err.message });
    }
  }
);

// Update list (e.g. name)
router.put("/:listId", auth, authorizeList("owner"), async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || name.trim() === "") {
      return res.status(400).json({ error: "List name is required" });
    }

    const list = await List.findOneAndUpdate(
      { _id: req.params.listId },
      { name },
      { new: true }
    );

    if (!list) return res.status(404).json({ error: "List not found" });

    // 🚀 emit event so all collaborators see updated name in realtime
    req.io?.to(`list:${list._id}`).emit("list:updated", {
      listId: list._id,
      name: list.name,
    });

    res.json(list);
  } catch (err) {
    console.error("Update list error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Delete a list + cascade delete tasks & notifications
router.delete("/:listId", auth, authorizeList("owner"), async (req, res) => {
  try {
    const listId = req.params.listId;

    // Delete tasks for this list
    await Task.deleteMany({ listId });

    // Delete notifications for this list
    await NotificationLog.deleteMany({ listId });

    // Finally delete the list itself
    await List.findByIdAndDelete(listId);

    // 🚀 emit real-time event to all sockets in that list
    req.io?.to(`list:${listId}`).emit("list:deleted", { listId });

    res.json({ success: true, message: "List, tasks, and notifications deleted" });
  } catch (err) {
    console.error("Delete list error:", err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
