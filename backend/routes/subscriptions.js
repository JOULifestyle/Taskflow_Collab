const express = require("express");
const router = express.Router();
const Subscription = require("../models/Subscription");

router.post("/", async (req, res) => {
  try {
    const sub = new Subscription(req.body);
    await sub.save();
    res.status(201).json({ message: "Subscription saved" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
