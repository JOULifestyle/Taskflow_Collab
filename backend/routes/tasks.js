const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const Task = require("../models/Task");

// Get all tasks across all user's lists
router.get("/all", auth, async (req, res) => {
  try {
    // Find all lists the user belongs to
    const List = require("../models/List");
    const userLists = await List.find({ "members.userId": req.user.id });

    if (!userLists.length) {
      return res.json([]);
    }

    const listIds = userLists.map(list => list._id);

    // Get all tasks from these lists
    const tasks = await Task.find({ listId: { $in: listIds } })
      .populate('listId', 'name')
      .sort({ order: 1 });

    res.json(tasks);
  } catch (err) {
    console.error("Error fetching all tasks:", err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;