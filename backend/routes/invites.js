const express = require("express");
const router = express.Router();
const User = require("../models/User");
const List = require("../models/List");
const { verifyInviteToken } = require("../utils/inviteToken");
const auth = require("../middleware/auth");

// Accept invitation
router.post("/accept", auth, async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ error: "Token required" });
    }

    const inviteData = verifyInviteToken(token);
    if (!inviteData) {
      return res.status(400).json({ error: "Invalid or expired token" });
    }

    const { listId, email, role } = inviteData;

    
    const list = await List.findById(listId);
    if (!list) {
      return res.status(404).json({ error: "List not found" });
    }

    
    if (!req.user?.email) {
      return res.status(401).json({ error: "User email not found in request" });
    }

    
    const existingMember = list.members.find(
      (m) => String(m.userId) === String(req.user.id)
    );
    if (existingMember) {
      return res.status(400).json({ error: "You are already a member of this list" });
    }

    
    if (req.user.email.toLowerCase() !== email.toLowerCase()) {
      return res.status(403).json({ error: "This invitation is not for you" });
    }

    
    list.members.push({ userId: req.user.id, role });
    await list.save();

    // Emit real-time event 
    req.io?.to(`list:${list._id}`).emit("list:memberJoined", {
      listId: list._id,
      userId: req.user.id,
      role,
    });

    return res.json({ message: "Successfully joined the list", list });
  } catch (err) {
    console.error("Accept invite error:", err);
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
