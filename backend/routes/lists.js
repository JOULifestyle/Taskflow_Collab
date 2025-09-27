const express = require("express");
const router = express.Router();
const List = require("../models/List");
const auth = require("../middleware/auth");
const authorizeList = require("../middleware/authorizeList");

// Create a new list
router.post("/", auth, async (req, res) => {
  try {
    const list = new List({
      name: req.body.name,
      owner: req.user.id, //  set owner
      members: [{ userId: req.user.id, role: "owner" }], //  match auth middleware
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

// Add member to a list (invite/accept flow can extend this)
router.post("/:listId/members", auth, authorizeList("owner"), async (req, res) => {
  try {
    const { userId, role } = req.body;

    // prevent duplicates
    const exists = req.list.members.some(
      (m) => String(m.userId) === String(userId)
    );
    if (exists) {
      return res.status(400).json({ error: "User already a member" });
    }

    req.list.members.push({ userId, role });
    await req.list.save();

    res.json(req.list);
  } catch (err) {
    console.error("Add member error:", err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
