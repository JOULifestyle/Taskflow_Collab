const express = require("express");
const router = express.Router();
const Subscription = require("../models/Subscription");
const auth = require("../middleware/auth");

router.post("/", auth, async (req, res) => {
  try {
    console.log("Raw request body:", req.body);

    // Accept either wrapped or unwrapped subscription
    const subscription = req.body.subscription || req.body;

    if (!subscription || !subscription.endpoint || !subscription.keys) {
      console.log("❌ Invalid subscription object:", subscription);
      return res.status(400).json({ error: "Invalid subscription object" });
    }

    console.log("📩 Incoming subscription:", subscription);

    // Prevent duplicates by upserting on (userId + endpoint)
    await Subscription.findOneAndUpdate(
      { userId: req.user.id, "subscription.endpoint": subscription.endpoint },
      { $set: { subscription } },
      { upsert: true, new: true }
    );

    res.status(201).json({ message: "Subscription saved/updated" });
  } catch (err) {
    console.error("❌ Subscription save error:", err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
